mod body;
mod config;

use arc_swap::ArcSwap;
use body::{ProxyBody, Streaming, empty};
use config::{Failure, Snapshot, bounded_read, canonical_host};
use http::{HeaderMap, HeaderValue, Method, Request, Response, StatusCode, Version};
use hyper::{body::Incoming, service::service_fn};
use hyper_util::rt::{TokioExecutor, TokioIo, TokioTimer};
use std::{convert::Infallible, path::PathBuf, sync::Arc, time::Duration};
use tokio::{net::TcpListener, sync::Semaphore, task::JoinSet, time::timeout};
use tokio_rustls::TlsAcceptor;

fn deny(code: StatusCode, version: Version) -> Response<ProxyBody> {
    let mut res = Response::new(empty());
    *res.status_mut() = code;
    if version != Version::HTTP_2 {
        res.headers_mut()
            .insert("connection", HeaderValue::from_static("close"));
    }
    res
}

fn valid_request<B>(req: &Request<B>, sni: &str) -> bool {
    let headers = req.headers();
    let hosts: Vec<_> = headers.get_all("host").iter().collect();
    let authority = req.uri().authority().map(|a| a.as_str());
    let host = hosts
        .first()
        .and_then(|h| h.to_str().ok())
        .and_then(canonical_host);
    if hosts.len() > 1
        || (req.version() != Version::HTTP_2 && hosts.len() != 1)
        || (hosts.len() == 1 && host.as_deref() != Some(sni))
        || authority.is_some_and(|a| canonical_host(a).as_deref() != Some(sni))
        || (req.version() == Version::HTTP_2 && authority.is_none())
        || req.method() == Method::CONNECT
        || req.uri().scheme_str().is_some_and(|s| s != "https")
        || !req.uri().path().starts_with('/')
        || req.uri().to_string().contains('#')
    {
        return false;
    }
    if headers.contains_key("content-length") && headers.contains_key("transfer-encoding") {
        return false;
    }
    let tes: Vec<_> = headers.get_all("transfer-encoding").iter().collect();
    if !tes.is_empty() && (tes.len() != 1 || !tes[0].as_bytes().eq_ignore_ascii_case(b"chunked")) {
        return false;
    }
    if let Some(cl) = headers.get("content-length")
        && !cl.as_bytes().iter().all(u8::is_ascii_digit)
    {
        return false;
    }
    for conn in headers.get_all("connection").iter() {
        let Ok(value) = conn.to_str() else {
            return false;
        };
        if value.split(',').any(|name| {
            !matches!(
                name.trim().to_ascii_lowercase().as_str(),
                "close" | "keep-alive" | "upgrade"
            )
        }) {
            return false;
        }
    }
    true
}

fn sanitize(headers: &mut HeaderMap, upgrade: bool) {
    for name in [
        "connection",
        "keep-alive",
        "proxy-connection",
        "proxy-authenticate",
        "proxy-authorization",
        "transfer-encoding",
        "upgrade",
        "trailer",
    ] {
        headers.remove(name);
    }
    if upgrade {
        headers.insert("connection", HeaderValue::from_static("upgrade"));
        headers.insert("upgrade", HeaderValue::from_static("websocket"));
    }
}

async fn proxy(
    mut req: Request<Incoming>,
    sni: String,
    store: Arc<ArcSwap<Snapshot>>,
    requests: Arc<Semaphore>,
) -> Result<Response<ProxyBody>, Infallible> {
    let version = req.version();
    if !valid_request(&req, &sni) {
        let bound_host = req
            .headers()
            .get("host")
            .and_then(|h| h.to_str().ok())
            .and_then(canonical_host);
        let bound_authority = req
            .uri()
            .authority()
            .and_then(|a| canonical_host(a.as_str()));
        let code = if bound_host.as_deref().is_some_and(|h| h != sni)
            || bound_authority.as_deref().is_some_and(|h| h != sni)
        {
            StatusCode::MISDIRECTED_REQUEST
        } else {
            StatusCode::BAD_REQUEST
        };
        return Ok(deny(code, version));
    }
    let snapshot = store.load_full();
    let Some(route) = snapshot.routes.get(&sni) else {
        return Ok(deny(StatusCode::MISDIRECTED_REQUEST, version));
    };
    if req
        .headers()
        .get("content-length")
        .and_then(|h| h.to_str().ok())
        .and_then(|h| h.parse::<u64>().ok())
        .is_some_and(|n| n > 1024 * 1024)
    {
        return Ok(deny(StatusCode::PAYLOAD_TOO_LARGE, version));
    }
    let Ok(permit) = requests.try_acquire_owned() else {
        return Ok(deny(StatusCode::SERVICE_UNAVAILABLE, version));
    };
    let permit = Arc::new(permit);
    let Some(port) = route.select() else {
        return Ok(deny(StatusCode::SERVICE_UNAVAILABLE, version));
    };
    let upgrade = !route.h2
        && version == Version::HTTP_11
        && req
            .headers()
            .get("upgrade")
            .is_some_and(|v| v.as_bytes().eq_ignore_ascii_case(b"websocket"));
    let downstream = upgrade.then(|| hyper::upgrade::on(&mut req));
    let target = req.uri().path_and_query().map_or("/", |p| p.as_str());
    let uri: http::Uri = format!("https://{}:{port}{target}", route.origin_name)
        .parse()
        .expect("validated URI");
    *req.uri_mut() = uri;
    *req.version_mut() = if route.h2 {
        Version::HTTP_2
    } else {
        Version::HTTP_11
    };
    for name in [
        "x-forwarded-for",
        "x-forwarded-host",
        "x-forwarded-proto",
        "forwarded",
        "x-tenant-id",
        "x-lab-generation",
        "x-lab-route",
    ] {
        req.headers_mut().remove(name);
    }
    sanitize(req.headers_mut(), upgrade);
    req.headers_mut().insert(
        "host",
        HeaderValue::from_str(&route.origin_name).expect("validated host"),
    );
    req.headers_mut().insert(
        "x-lab-route",
        HeaderValue::from_str(&route.host).expect("validated host"),
    );
    req.headers_mut()
        .insert("x-lab-generation", HeaderValue::from(snapshot.generation));
    let (parts, body) = req.into_parts();
    let outgoing = Request::from_parts(
        parts,
        Streaming::wrap(body, 1024 * 1024, snapshot.clone(), permit.clone()),
    );
    let response = timeout(Duration::from_secs(2), route.client.request(outgoing)).await;
    let mut response = match response {
        Ok(Ok(res)) => res,
        Ok(Err(_)) => return Ok(deny(StatusCode::BAD_GATEWAY, version)),
        Err(_) => return Ok(deny(StatusCode::GATEWAY_TIMEOUT, version)),
    };
    if response.status() == StatusCode::SWITCHING_PROTOCOLS && upgrade {
        let upstream = hyper::upgrade::on(&mut response);
        tokio::spawn(async move {
            let _permit = permit;
            if let Ok(Ok((down, up))) = timeout(Duration::from_secs(2), async {
                Ok::<_, Failure>((
                    downstream.expect("upgrade requested").await?,
                    upstream.await?,
                ))
            })
            .await
            {
                let mut down = TokioIo::new(down);
                let mut up = TokioIo::new(up);
                let _ = timeout(
                    Duration::from_secs(30),
                    tokio::io::copy_bidirectional_with_sizes(&mut down, &mut up, 16384, 16384),
                )
                .await;
            }
        });
        let (mut parts, _) = response.into_parts();
        sanitize(&mut parts.headers, true);
        parts
            .headers
            .insert("x-lab-generation", HeaderValue::from(snapshot.generation));
        return Ok(Response::from_parts(parts, empty()));
    }
    let (mut parts, body) = response.into_parts();
    sanitize(&mut parts.headers, false);
    if upgrade && version != Version::HTTP_2 {
        parts
            .headers
            .insert("connection", HeaderValue::from_static("close"));
    }
    parts
        .headers
        .insert("x-lab-generation", HeaderValue::from(snapshot.generation));
    Ok(Response::from_parts(
        parts,
        Streaming::wrap(body, 8 * 1024 * 1024, snapshot, permit),
    ))
}

async fn run() -> Result<(), Failure> {
    let _ = rustls::crypto::ring::default_provider().install_default();
    let mut args = std::env::args().skip(1);
    let path = PathBuf::from(args.next().ok_or("manifest-path port required")?);
    let port: u16 = args.next().ok_or("port required")?.parse()?;
    if args.next().is_some() || port < 1024 {
        return Err("invalid arguments".into());
    }
    let initial = Snapshot::parse(&bounded_read(&path, true)?)?;
    initial.health().await;
    let store = Arc::new(ArcSwap::from_pointee(initial));
    let tls = TlsAcceptor::from(Arc::new(config::server_config(store.clone())));
    let listener = TcpListener::bind(("127.0.0.1", port)).await?;
    let watch = store.clone();
    let watcher = tokio::spawn(async move {
        let mut previous = Vec::new();
        loop {
            tokio::time::sleep(Duration::from_millis(50)).await;
            if let Ok(bytes) = bounded_read(&path, true)
                && previous != bytes
            {
                previous = bytes.clone();
                match Snapshot::parse(&bytes) {
                    Ok(next) if next.generation > watch.load().generation => {
                        next.health().await;
                        watch.store(Arc::new(next));
                        eprintln!("manifest applied");
                    }
                    _ => eprintln!("manifest rejected; last good retained"),
                }
            }
            watch.load_full().health().await;
        }
    });
    let connections = Arc::new(Semaphore::new(64));
    let requests = Arc::new(Semaphore::new(128));
    let mut tasks = JoinSet::new();
    let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
    eprintln!("isolated Hyper lab ready on 127.0.0.1:{port}");
    loop {
        tokio::select! {
            _ = term.recv() => break,
            _ = tokio::signal::ctrl_c() => break,
            Some(_) = tasks.join_next(), if !tasks.is_empty() => {},
            accepted = listener.accept() => {
                let (tcp, peer) = accepted?;
                if peer.ip()!=std::net::IpAddr::from([127,0,0,1]) { continue; }
                let Ok(permit) = connections.clone().try_acquire_owned() else { continue; };
                let tls = tls.clone(); let store=store.clone(); let requests=requests.clone();
                tasks.spawn(async move {
                    let _permit = permit;
                    let Ok(Ok(tls)) = timeout(Duration::from_secs(2), tls.accept(tcp)).await else { return; };
                    let sni = tls.get_ref().1.server_name().and_then(canonical_host).unwrap_or_default();
                    let h2 = tls.get_ref().1.alpn_protocol()==Some(b"h2");
                    let service = service_fn(move |req| proxy(req, sni.clone(), store.clone(), requests.clone()));
                    if h2 {
                        let mut builder = hyper::server::conn::http2::Builder::new(TokioExecutor::new());
                        builder.max_concurrent_streams(32).max_header_list_size(32768).max_send_buf_size(65536)
                            .initial_stream_window_size(65535).initial_connection_window_size(1048576);
                        let _ = builder.serve_connection(TokioIo::new(tls), service).await;
                    } else {
                        let mut builder = hyper::server::conn::http1::Builder::new();
                        builder.timer(TokioTimer::new()).header_read_timeout(Duration::from_secs(2))
                            .max_headers(64).max_header_size(32768).max_buf_size(32768).half_close(false);
                        let _ = builder.serve_connection(TokioIo::new(tls), service).with_upgrades().await;
                    }
                });
            }
        }
    }
    watcher.abort();
    tasks.abort_all();
    while tasks.join_next().await.is_some() {}
    Ok(())
}

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() {
    if run().await.is_err() {
        eprintln!("isolated Hyper startup failed (details redacted)");
        std::process::exit(78);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserved_encoded_targets_survive_uri_and_policy_layers() {
        for target in [
            "/bad%20target",
            "/bad%09target",
            "/bad%01target",
            "/bad%00target",
            "/encoded%2Fsegment?value=%2520",
            "/caf%C3%A9?x=a%20b",
        ] {
            let req = Request::builder()
                .uri(target)
                .header("host", "edge-a.test")
                .body(())
                .unwrap();
            assert!(valid_request(&req, "edge-a.test"));
            assert_eq!(req.uri().path_and_query().unwrap().as_str(), target);
        }
    }

    #[test]
    fn parsed_policy_rejects_ambiguous_authority_and_framing() {
        for req in [
            Request::builder()
                .uri("/")
                .header("host", "edge-b.test")
                .body(())
                .unwrap(),
            Request::builder()
                .uri("https://edge-b.test/")
                .header("host", "edge-a.test")
                .body(())
                .unwrap(),
            Request::builder()
                .uri("/")
                .header("host", "edge-a.test")
                .header("transfer-encoding", "chunked, chunked")
                .body(())
                .unwrap(),
            Request::builder()
                .uri("/")
                .header("host", "edge-a.test")
                .header("content-length", "0")
                .header("transfer-encoding", "chunked")
                .body(())
                .unwrap(),
            Request::builder()
                .uri("/")
                .header("host", "edge-a.test")
                .header("connection", "X-Forwarded-For")
                .body(())
                .unwrap(),
        ] {
            assert!(!valid_request(&req, "edge-a.test"));
        }
    }
}
