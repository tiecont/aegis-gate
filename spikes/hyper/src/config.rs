use crate::body::ProxyBody;
use arc_swap::ArcSwap;
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_timeout::TimeoutConnector;
use hyper_util::{
    client::legacy::{
        Client,
        connect::{HttpConnector, dns::Name},
    },
    rt::{TokioExecutor, TokioTimer},
};
use openssl::{asn1::Asn1Time, x509::X509};
use rustls::{
    ClientConfig, RootCertStore, ServerConfig,
    server::{ClientHello, ResolvesServerCert},
    sign::CertifiedKey,
};
use rustls_pki_types::{CertificateDer, PrivateKeyDer, ServerName, pem::PemObject};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    future::{Ready, ready},
    io::{self, Read},
    net::SocketAddr,
    os::unix::fs::PermissionsExt,
    path::Path,
    sync::{
        Arc, Mutex,
        atomic::{AtomicBool, Ordering},
    },
    task::{Context, Poll},
    time::Duration,
};
use tower_service::Service;

pub type Failure = Box<dyn std::error::Error + Send + Sync>;
type Connector = TimeoutConnector<HttpsConnector<HttpConnector<Loopback>>>;
pub type OriginClient = Client<Connector, ProxyBody>;

// Never consult public DNS. Only this isolated lab can use loopback origins.
#[derive(Clone)]
pub struct Loopback;
impl Service<Name> for Loopback {
    type Response = std::vec::IntoIter<SocketAddr>;
    type Error = io::Error;
    type Future = Ready<Result<Self::Response, Self::Error>>;
    fn poll_ready(&mut self, _: &mut Context<'_>) -> Poll<Result<(), io::Error>> {
        Poll::Ready(Ok(()))
    }
    fn call(&mut self, _: Name) -> Self::Future {
        ready(Ok(vec![SocketAddr::from(([127, 0, 0, 1], 0))].into_iter()))
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    generation: u64,
    ca_file: String,
    routes: Vec<RouteInput>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RouteInput {
    host: String,
    origin_name: String,
    origin_port: u16,
    cert_file: String,
    key_file: String,
    #[serde(default)]
    h2: bool,
    #[serde(default)]
    backends: Vec<BackendInput>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BackendInput {
    port: u16,
    weight: i64,
}

pub struct Backend {
    pub port: u16,
    weight: i64,
    healthy: AtomicBool,
}
pub struct Route {
    pub host: String,
    pub origin_name: String,
    pub origin_port: u16,
    pub h2: bool,
    pub cert: Arc<CertifiedKey>,
    pub client: OriginClient,
    backends: Vec<Backend>,
    weights: Mutex<Vec<i64>>,
}
pub struct Snapshot {
    pub generation: u64,
    pub routes: BTreeMap<String, Arc<Route>>,
}

pub fn bounded_read(path: &Path, private: bool) -> Result<Vec<u8>, Failure> {
    if fs::symlink_metadata(path)?.file_type().is_symlink() {
        return Err("symlink fixture".into());
    }
    let file = fs::File::open(path)?;
    let meta = file.metadata()?;
    if !meta.is_file() || meta.len() > 65536 || (private && meta.permissions().mode() & 0o077 != 0)
    {
        return Err("fixture bounds/permissions".into());
    }
    let mut bytes = Vec::new();
    file.take(65537).read_to_end(&mut bytes)?;
    if bytes.len() > 65536 {
        return Err("fixture bounds".into());
    }
    Ok(bytes)
}

pub fn canonical_host(value: &str) -> Option<String> {
    let authority: http::uri::Authority = value.parse().ok()?;
    if value.contains('@') || (value.contains(':') && authority.port_u16().is_none()) {
        return None;
    }
    let host = authority
        .host()
        .strip_suffix('.')
        .unwrap_or(authority.host())
        .to_ascii_lowercase();
    if host.is_empty()
        || host.len() > 253
        || host.split('.').any(|label| {
            label.is_empty()
                || label.len() > 63
                || label.starts_with('-')
                || label.ends_with('-')
                || !label
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        })
    {
        return None;
    }
    Some(host)
}

fn client(roots: RootCertStore, h2: bool) -> OriginClient {
    let tls = ClientConfig::builder()
        .with_root_certificates(roots)
        .with_no_client_auth();
    let mut http = HttpConnector::new_with_resolver(Loopback);
    http.enforce_http(false);
    http.set_connect_timeout(Some(Duration::from_secs(1)));
    let builder = HttpsConnectorBuilder::new()
        .with_tls_config(tls)
        .https_only();
    let https = if h2 {
        builder.enable_http2().wrap_connector(http)
    } else {
        builder.enable_http1().wrap_connector(http)
    };
    let mut connector = TimeoutConnector::new(https);
    connector.set_connect_timeout(Some(Duration::from_secs(1)));
    connector.set_read_timeout(Some(Duration::from_secs(2)));
    connector.set_write_timeout(Some(Duration::from_secs(2)));
    Client::builder(TokioExecutor::new())
        .pool_timer(TokioTimer::new())
        .timer(TokioTimer::new())
        .pool_idle_timeout(Duration::from_secs(2))
        .pool_max_idle_per_host(2)
        .http2_only(h2)
        .http2_max_concurrent_streams(32)
        .http2_max_send_buf_size(65536)
        .http2_max_header_list_size(32768)
        .http1_max_buf_size(32768)
        .http1_max_headers(64)
        .retry_canceled_requests(false)
        .build(connector)
}

impl Snapshot {
    pub fn parse(bytes: &[u8]) -> Result<Self, Failure> {
        let input: Manifest = serde_json::from_slice(bytes)?;
        if input.generation == 0 || input.routes.is_empty() || input.routes.len() > 16 {
            return Err("manifest bounds".into());
        }
        let mut roots = RootCertStore::empty();
        for cert in CertificateDer::pem_slice_iter(&bounded_read(Path::new(&input.ca_file), false)?)
        {
            roots.add(cert?)?;
        }
        if roots.is_empty() {
            return Err("empty trust".into());
        }
        let mut routes = BTreeMap::new();
        for row in input.routes {
            if canonical_host(&row.host).as_deref() != Some(&row.host)
                || row.host.contains(':')
                || canonical_host(&row.origin_name).as_deref() != Some(&row.origin_name)
                || row.origin_name.contains(':')
                || row.origin_port < 1024
                || row.backends.len() > 8
            {
                return Err("route bounds".into());
            }
            let pem = bounded_read(Path::new(&row.cert_file), false)?;
            let certs = CertificateDer::pem_slice_iter(&pem).collect::<Result<Vec<_>, _>>()?;
            let leaf = certs.first().ok_or("empty cert")?;
            let parsed = rustls::server::ParsedCertificate::try_from(leaf)?;
            rustls::client::verify_server_name(&parsed, &ServerName::try_from(row.host.as_str())?)?;
            let x509 = X509::from_der(leaf)?;
            let now = Asn1Time::days_from_now(0)?;
            if x509.not_before() > now || x509.not_after() < now {
                return Err("certificate time".into());
            }
            let key =
                PrivateKeyDer::from_pem_slice(&bounded_read(Path::new(&row.key_file), true)?)?;
            let cert = Arc::new(CertifiedKey::from_der(
                certs,
                key,
                &rustls::crypto::ring::default_provider(),
            )?);
            cert.keys_match()?;
            let mut seen = BTreeSet::new();
            let mut backends = Vec::new();
            for backend in row.backends {
                if backend.port < 1024
                    || backend.weight < 1
                    || backend.weight > 16
                    || !seen.insert(backend.port)
                {
                    return Err("backend bounds".into());
                }
                backends.push(Backend {
                    port: backend.port,
                    weight: backend.weight,
                    healthy: AtomicBool::new(false),
                });
            }
            let route = Arc::new(Route {
                weights: Mutex::new(vec![0; backends.len()]),
                backends,
                host: row.host.clone(),
                origin_name: row.origin_name,
                origin_port: row.origin_port,
                cert,
                h2: row.h2,
                client: client(roots.clone(), row.h2),
            });
            if routes.insert(row.host, route).is_some() {
                return Err("duplicate route".into());
            }
        }
        Ok(Self {
            generation: input.generation,
            routes,
        })
    }

    pub async fn health(&self) {
        for route in self.routes.values() {
            for backend in &route.backends {
                let uri = format!("https://{}:{}/", route.origin_name, backend.port);
                let healthy = match tokio::time::timeout(
                    Duration::from_millis(250),
                    route.client.get(uri.parse().expect("validated URI")),
                )
                .await
                {
                    Ok(Ok(res)) => res.status().is_success(),
                    _ => false,
                };
                backend.healthy.store(healthy, Ordering::Relaxed);
            }
        }
    }
}

impl Route {
    pub fn select(&self) -> Option<u16> {
        if self.backends.is_empty() {
            return Some(self.origin_port);
        }
        let mut weights = self.weights.lock().ok()?;
        let mut selected = None;
        let mut total = 0;
        for (index, backend) in self.backends.iter().enumerate() {
            if backend.healthy.load(Ordering::Relaxed) {
                total += backend.weight;
                weights[index] += backend.weight;
                if selected.is_none_or(|prev| weights[index] > weights[prev]) {
                    selected = Some(index);
                }
            } else {
                weights[index] = 0;
            }
        }
        selected.map(|index| {
            weights[index] -= total;
            self.backends[index].port
        })
    }
}

pub struct Certificates(pub Arc<ArcSwap<Snapshot>>);
impl std::fmt::Debug for Certificates {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Certificates(redacted)")
    }
}
impl ResolvesServerCert for Certificates {
    fn resolve(&self, hello: ClientHello<'_>) -> Option<Arc<CertifiedKey>> {
        let sni = hello.server_name()?;
        if sni.contains(':') {
            return None;
        }
        let host = canonical_host(sni)?;
        self.0.load().routes.get(&host).map(|r| r.cert.clone())
    }
}
pub fn server_config(store: Arc<ArcSwap<Snapshot>>) -> ServerConfig {
    let mut tls = ServerConfig::builder()
        .with_no_client_auth()
        .with_cert_resolver(Arc::new(Certificates(store)));
    tls.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    tls.session_storage = Arc::new(rustls::server::NoServerSessionStorage {});
    tls.send_tls13_tickets = 0;
    tls
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn authority_rejects_ambiguous_hosts() {
        assert_eq!(canonical_host("A.TEST.:443").as_deref(), Some("a.test"));
        for s in [
            "a.test:99999",
            "user@a.test",
            "a.test:bad",
            "a.test,b.test",
            "a..test",
            "[::1]",
            "a.test/path",
            "",
        ] {
            assert_eq!(canonical_host(s), None);
        }
    }
    #[test]
    fn invalid_manifest_cannot_bootstrap() {
        for s in [
            "{}",
            "{\"generation\":0,\"ca_file\":\"x\",\"routes\":[]}",
            "{\"generation\":1,\"ca_file\":\"x\",\"routes\":[],\"insecure\":true}",
        ] {
            assert!(Snapshot::parse(s.as_bytes()).is_err());
        }
    }
}
