mod config;

use arc_swap::ArcSwap;
use async_trait::async_trait;
use config::{Failure, Route, Snapshot, bounded_read, canonical_host};
use pingora::{
    http::{RequestHeader, ResponseHeader},
    listeners::{ConnectionFilter, TlsAccept, tls::TlsSettings},
    prelude::*,
    server::Server,
    tls::{
        ext,
        ssl::{NameType, SslOptions, SslRef, SslSessionCacheMode, SslVersion},
    },
};
use std::{any::Any, path::PathBuf, sync::Arc, time::Duration};

struct Sni(String);
struct Certificates(Arc<ArcSwap<Snapshot>>);

fn canonical_sni(value: &str) -> Option<String> {
    if value.contains(':') {
        return None;
    }
    canonical_host(value)
}

#[derive(Debug)]
struct LabConnectionFilter;

#[async_trait]
impl ConnectionFilter for LabConnectionFilter {
    async fn should_accept(&self, addr: Option<&std::net::SocketAddr>) -> bool {
        addr.is_some_and(|a| a.ip() == std::net::IpAddr::V4(std::net::Ipv4Addr::LOCALHOST))
    }
}

fn safe_original_framing(bytes: &[u8]) -> bool {
    let mut headers = [httparse::EMPTY_HEADER; 256];
    let mut request = httparse::Request::new(&mut headers);
    if !matches!(request.parse(bytes), Ok(httparse::Status::Complete(_))) {
        return false;
    }
    let cl = request
        .headers
        .iter()
        .any(|h| h.name.eq_ignore_ascii_case("content-length"));
    let te = request
        .headers
        .iter()
        .any(|h| h.name.eq_ignore_ascii_case("transfer-encoding"));
    !(cl && te)
}

#[async_trait]
impl TlsAccept for Certificates {
    async fn certificate_callback(&self, ssl: &mut SslRef) {
        let snapshot = self.0.load();
        let Some(name) = ssl.servername(NameType::HOST_NAME).and_then(canonical_sni) else {
            return;
        };
        let Some(route) = snapshot.routes.get(&name) else {
            return;
        };
        // No default certificate exists: unknown SNI must fail the TLS handshake.
        if ext::ssl_use_certificate(ssl, &route.cert).is_err() {
            return;
        }
        let _ = ext::ssl_use_private_key(ssl, &route.key);
    }

    async fn handshake_complete_callback(
        &self,
        ssl: &SslRef,
    ) -> Option<Arc<dyn Any + Send + Sync>> {
        Some(Arc::new(Sni(canonical_sni(
            ssl.servername(NameType::HOST_NAME)?,
        )?)))
    }
}

struct LabProxy(Arc<ArcSwap<Snapshot>>);
struct RequestContext {
    snapshot: Arc<Snapshot>,
    route: Option<Arc<Route>>,
    body_bytes: usize,
}

#[async_trait]
impl ProxyHttp for LabProxy {
    type CTX = RequestContext;

    fn new_ctx(&self) -> Self::CTX {
        RequestContext {
            snapshot: self.0.load_full(),
            route: None,
            body_bytes: 0,
        }
    }

    async fn request_filter(&self, session: &mut Session, ctx: &mut Self::CTX) -> Result<bool> {
        // new_ctx runs before waiting for headers on an idle keepalive connection.
        // Capture policy here, once headers exist, then retain it for this request.
        ctx.snapshot = self.0.load_full();
        session.set_read_timeout(Some(Duration::from_secs(2)));
        session.set_write_timeout(Some(Duration::from_secs(2)));
        // Pingora removes CL when TE is present. Reuse its maintained parser dependency
        // on the preserved header bytes to enforce our stricter reject-both policy.
        if session
            .as_ref()
            .as_http1()
            .is_some_and(|h1| !safe_original_framing(&h1.get_headers_raw_bytes()))
        {
            session.respond_error(400).await?;
            return Ok(true);
        }
        let request = session.req_header();
        let hosts: Vec<_> = request.headers.get_all("host").iter().collect();
        let authority = request
            .uri
            .authority()
            .map(|a| a.as_str())
            .or_else(|| hosts.first().and_then(|h| h.to_str().ok()));
        let host = authority.and_then(canonical_host);
        let sni = session
            .digest()
            .and_then(|d| d.ssl_digest.as_ref())
            .and_then(|d| d.extension.get::<Sni>())
            .map(|s| s.0.as_str());
        let ambiguous_host = hosts.len() > 1
            || hosts
                .iter()
                .any(|h| h.to_str().ok().and_then(canonical_host) != host);
        let ambiguous_framing = request.headers.contains_key("content-length")
            && request.headers.contains_key("transfer-encoding");
        if ambiguous_framing || ambiguous_host {
            session.respond_error(400).await?;
            return Ok(true);
        }
        if request
            .headers
            .get("content-length")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok())
            .is_some_and(|n| n > 1024 * 1024)
        {
            session.respond_error(413).await?;
            return Ok(true);
        }
        if host.as_deref() != sni
            || host
                .as_ref()
                .is_none_or(|h| !ctx.snapshot.routes.contains_key(h))
        {
            session.respond_error(421).await?;
            return Ok(true);
        }
        ctx.route = host.and_then(|h| ctx.snapshot.routes.get(&h).cloned());
        Ok(false)
    }

    async fn upstream_peer(&self, _: &mut Session, ctx: &mut Self::CTX) -> Result<Box<HttpPeer>> {
        let route = ctx
            .route
            .as_ref()
            .ok_or_else(|| Error::new(ErrorType::InternalError))?;
        // This isolated executable can ONLY dial loopback; it is not a production SSRF policy.
        let port = match &route.balancer {
            Some(lb) => lb
                .select(b"", 16)
                .and_then(|backend| backend.addr.as_inet().map(|addr| addr.port()))
                .ok_or_else(|| Error::new(ErrorType::HTTPStatus(503)))?,
            None => route.origin_port,
        };
        let mut peer = HttpPeer::new(("127.0.0.1", port), true, route.origin_name.clone());
        // Pingora's default reuse hash excludes the custom CA. Isolate each exact
        // route/generation so a changed trust policy cannot reuse an older TLS session.
        peer.group_key = route.pool_key;
        peer.options.ca = Some(ctx.snapshot.ca.clone());
        peer.options.verify_cert = true;
        peer.options.verify_hostname = true;
        peer.options.connection_timeout = Some(Duration::from_secs(1));
        peer.options.total_connection_timeout = Some(Duration::from_secs(2));
        peer.options.read_timeout = Some(Duration::from_secs(2));
        peer.options.write_timeout = Some(Duration::from_secs(2));
        peer.options.idle_timeout = Some(Duration::from_secs(2));
        if route.h2 {
            peer.options.set_http_version(2, 2);
        }
        Ok(Box::new(peer))
    }

    async fn upstream_request_filter(
        &self,
        _: &mut Session,
        request: &mut RequestHeader,
        ctx: &mut Self::CTX,
    ) -> Result<()> {
        let route = ctx
            .route
            .as_ref()
            .ok_or_else(|| Error::new(ErrorType::InternalError))?;
        for name in [
            "x-forwarded-for",
            "x-forwarded-host",
            "x-forwarded-proto",
            "forwarded",
            "x-tenant-id",
            "x-lab-generation",
        ] {
            request.remove_header(name);
        }
        request.insert_header("host", &route.origin_name)?;
        request.insert_header("x-lab-generation", ctx.snapshot.generation.to_string())?;
        request.insert_header("x-lab-route", &route.host)?;
        Ok(())
    }

    async fn response_filter(
        &self,
        _: &mut Session,
        response: &mut ResponseHeader,
        ctx: &mut Self::CTX,
    ) -> Result<()> {
        response.insert_header("x-lab-generation", ctx.snapshot.generation.to_string())?;
        Ok(())
    }

    async fn request_body_filter(
        &self,
        _: &mut Session,
        body: &mut Option<bytes::Bytes>,
        _: bool,
        ctx: &mut Self::CTX,
    ) -> Result<()> {
        ctx.body_bytes += body.as_ref().map_or(0, |b| b.len());
        if ctx.body_bytes > 1024 * 1024 {
            return Error::e_explain(ErrorType::HTTPStatus(413), "lab body limit");
        }
        Ok(())
    }

    fn suppress_error_log(&self, _: &Session, _: &Self::CTX, _: &Error) -> bool {
        true
    }
}

fn run() -> std::result::Result<(), Failure> {
    let mut args = std::env::args().skip(1);
    let config = PathBuf::from(args.next().ok_or("usage: spike MANIFEST LISTEN_PORT")?);
    let port: u16 = args.next().ok_or("missing loopback port")?.parse()?;
    if args.next().is_some() || port < 1024 {
        return Err("invalid loopback listener".into());
    }
    let bytes = bounded_read(&config, 65536, true)?;
    let health_runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()?;
    let initial = Snapshot::parse(&bytes)?;
    health_runtime.block_on(initial.initialize())?;
    let store = Arc::new(ArcSwap::from_pointee(initial));
    let watch_store = store.clone();
    std::thread::spawn(move || {
        let mut previous = bytes;
        loop {
            std::thread::sleep(Duration::from_millis(50));
            health_runtime.block_on(watch_store.load_full().check_health());
            let Ok(next) = bounded_read(&config, 65536, true) else {
                continue;
            };
            if next == previous {
                continue;
            }
            previous = next.clone();
            match Snapshot::parse(&next) {
                Ok(snapshot) if snapshot.generation > watch_store.load().generation => {
                    if health_runtime.block_on(snapshot.initialize()).is_err() {
                        eprintln!("lab initialization rejected; previous snapshot retained");
                        continue;
                    }
                    let generation = snapshot.generation;
                    watch_store.store(Arc::new(snapshot));
                    eprintln!("lab generation applied: {generation}");
                }
                _ => eprintln!("lab generation rejected; previous snapshot retained"),
            }
        }
    });
    let mut server = Server::new(None)?;
    let server_conf = Arc::get_mut(&mut server.configuration).ok_or("shared initial config")?;
    server_conf.threads = 2;
    server_conf.grace_period_seconds = Some(0);
    server_conf.graceful_shutdown_timeout_seconds = Some(2);
    server_conf.upstream_keepalive_pool_size = 16;
    server.bootstrap();
    let mut service = http_proxy_service(&server.configuration, LabProxy(store.clone()));
    service.set_connection_filter(Arc::new(LabConnectionFilter));
    let mut tls = TlsSettings::with_callbacks(Box::new(Certificates(store)))?;
    tls.set_min_proto_version(Some(SslVersion::TLS1_2))?;
    // Disable session resumption for this proof so each new connection selects the current cert.
    tls.set_options(SslOptions::NO_TICKET);
    tls.set_session_cache_mode(SslSessionCacheMode::OFF);
    tls.enable_h2();
    service.add_tls_with_settings(&format!("127.0.0.1:{port}"), None, tls);
    server.add_service(service);
    eprintln!("isolated lab listener ready: 127.0.0.1:{port}");
    server.run_forever();
}

fn main() {
    if run().is_err() {
        eprintln!("lab startup failed (fixture details redacted)");
        std::process::exit(78);
    }
}

#[cfg(test)]
mod tests {
    use super::{canonical_sni, safe_original_framing};

    #[test]
    fn sni_cannot_contain_an_authority_port() {
        assert_eq!(canonical_sni("edge-a.test:443"), None);
        assert_eq!(canonical_sni("EDGE-A.TEST").as_deref(), Some("edge-a.test"));
    }

    #[test]
    fn original_cl_te_is_rejected_regardless_of_case_or_order() {
        for headers in [
            "Content-Length: 1\r\nTransfer-Encoding: chunked",
            "transfer-encoding: chunked\r\nCONTENT-LENGTH: 1",
        ] {
            assert!(!safe_original_framing(
                format!("POST / HTTP/1.1\r\nHost: a.test\r\n{headers}\r\n\r\n").as_bytes()
            ));
        }
        assert!(safe_original_framing(
            b"POST / HTTP/1.1\r\nHost: a.test\r\nTransfer-Encoding: chunked\r\n\r\n"
        ));
        assert!(!safe_original_framing(b"incomplete"));
    }
}
