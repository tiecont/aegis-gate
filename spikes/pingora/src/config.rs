use openssl::asn1::Asn1Time;
use pingora::lb::{
    Backend, Backends, LoadBalancer, discovery, health_check::HttpHealthCheck,
    selection::RoundRobin,
};
use pingora::tls::{
    pkey::{PKey, Private},
    x509::X509,
};
use serde::Deserialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Read,
    os::unix::fs::PermissionsExt,
    path::Path,
    sync::Arc,
    time::Duration,
};

pub type Failure = Box<dyn std::error::Error + Send + Sync>;

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub generation: u64,
    pub ca_file: String,
    pub routes: Vec<RouteInput>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RouteInput {
    pub host: String,
    pub origin_name: String,
    pub origin_port: u16,
    pub cert_file: String,
    pub key_file: String,
    #[serde(default)]
    pub h2: bool,
    #[serde(default)]
    pub backends: Vec<BackendInput>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BackendInput {
    pub port: u16,
    pub weight: usize,
}

pub struct Route {
    pub host: String,
    pub origin_name: String,
    pub origin_port: u16,
    pub cert: X509,
    pub key: PKey<Private>,
    pub h2: bool,
    pub balancer: Option<Arc<LoadBalancer<RoundRobin>>>,
    pub pool_key: u64,
}

pub struct Snapshot {
    pub generation: u64,
    pub routes: BTreeMap<String, Arc<Route>>,
    pub ca: Arc<Box<[X509]>>,
}

pub fn bounded_read(path: &Path, max: u64, private: bool) -> Result<Vec<u8>, Failure> {
    if fs::symlink_metadata(path)?.file_type().is_symlink() {
        return Err("symlink fixture refused".into());
    }
    let file = fs::File::open(path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() || metadata.len() > max {
        return Err("fixture size/type refused".into());
    }
    if private && metadata.permissions().mode() & 0o077 != 0 {
        return Err("private fixture permissions refused".into());
    }
    let mut bytes = Vec::new();
    file.take(max + 1).read_to_end(&mut bytes)?;
    if bytes.len() as u64 > max {
        return Err("fixture size refused".into());
    }
    Ok(bytes)
}

pub fn canonical_host(value: &str) -> Option<String> {
    let authority: http::uri::Authority = value.parse().ok()?;
    let host = authority.host();
    if authority.as_str().contains('@')
        || (authority.as_str().contains(':') && authority.port().is_none())
    {
        return None;
    }
    let host = host.strip_suffix('.').unwrap_or(host).to_ascii_lowercase();
    if host.len() > 253
        || host.is_empty()
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

impl Snapshot {
    pub fn parse(bytes: &[u8]) -> Result<Self, Failure> {
        let input: Manifest = serde_json::from_slice(bytes)?;
        if input.generation == 0
            || input.generation > (u64::MAX - 16) / 16
            || input.routes.is_empty()
            || input.routes.len() > 16
        {
            return Err("invalid fixture generation/routes".into());
        }
        let ca = X509::stack_from_pem(&bounded_read(Path::new(&input.ca_file), 65536, false)?)?;
        if ca.is_empty() {
            return Err("empty fixture trust store".into());
        }
        let ca = Arc::new(ca.into_boxed_slice());
        let mut routes = BTreeMap::new();
        for (index, row) in input.routes.into_iter().enumerate() {
            if canonical_host(&row.host).as_deref() != Some(&row.host)
                || row.host.contains(':')
                || canonical_host(&row.origin_name).as_deref() != Some(&row.origin_name)
                || row.origin_name.contains(':')
                || row.origin_port < 1024
            {
                return Err("invalid exact lab host/port".into());
            }
            let cert = X509::from_pem(&bounded_read(Path::new(&row.cert_file), 65536, false)?)?;
            let key =
                PKey::private_key_from_pem(&bounded_read(Path::new(&row.key_file), 65536, true)?)?;
            if !cert.public_key()?.public_eq(&key) {
                return Err("fixture certificate/key mismatch".into());
            }
            let now = Asn1Time::days_from_now(0)?;
            if cert.not_before() > now || cert.not_after() < now {
                return Err("fixture certificate time invalid".into());
            }
            if !cert
                .subject_alt_names()
                .is_some_and(|names| names.iter().any(|n| n.dnsname() == Some(&row.host)))
            {
                return Err("fixture certificate SAN mismatch".into());
            }
            let balancer = if row.backends.is_empty() {
                None
            } else {
                if row.backends.len() > 8 {
                    return Err("too many fixture backends".into());
                }
                let mut ports = BTreeSet::new();
                let mut backends = BTreeSet::new();
                for backend in row.backends {
                    if backend.port < 1024
                        || backend.weight == 0
                        || backend.weight > 16
                        || !ports.insert(backend.port)
                    {
                        return Err("invalid fixture weighted backend".into());
                    }
                    backends.insert(Backend::new_with_weight(
                        &format!("127.0.0.1:{}", backend.port),
                        backend.weight,
                    )?);
                }
                let mut lb = LoadBalancer::<RoundRobin>::from_backends(Backends::new(
                    discovery::Static::new(backends),
                ));
                let mut check = HttpHealthCheck::new(&row.origin_name, true);
                check.peer_template.options.ca = Some(ca.clone());
                check.peer_template.options.verify_cert = true;
                check.peer_template.options.verify_hostname = true;
                check.peer_template.options.connection_timeout = Some(Duration::from_millis(300));
                check.peer_template.options.read_timeout = Some(Duration::from_millis(300));
                check.peer_template.options.write_timeout = Some(Duration::from_millis(300));
                lb.set_health_check(Box::new(check));
                Some(Arc::new(lb))
            };
            let host = row.host.clone();
            if routes
                .insert(
                    host.clone(),
                    Arc::new(Route {
                        host,
                        origin_name: row.origin_name,
                        origin_port: row.origin_port,
                        cert,
                        key,
                        h2: row.h2,
                        balancer,
                        pool_key: input.generation * 16 + index as u64,
                    }),
                )
                .is_some()
            {
                return Err("duplicate fixture host".into());
            }
        }
        Ok(Self {
            generation: input.generation,
            routes,
            ca,
        })
    }

    pub async fn initialize(&self) -> Result<(), Failure> {
        for route in self.routes.values() {
            if let Some(lb) = &route.balancer {
                lb.update().await?;
                lb.backends().run_health_check(true).await;
            }
        }
        Ok(())
    }

    pub async fn check_health(&self) {
        for route in self.routes.values() {
            if let Some(lb) = &route.balancer {
                lb.backends().run_health_check(true).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonicalization_uses_authority_parser() {
        assert_eq!(canonical_host("A.TEST.:443").as_deref(), Some("a.test"));
        for value in [
            "user@a.test",
            "a.test:bad",
            "a..test",
            "-a.test",
            "a.test\r\nx:1",
            "[::1]",
            "",
            "a.test/path",
        ] {
            assert_eq!(canonical_host(value), None, "{value:?}");
        }
    }

    #[test]
    fn malformed_and_unknown_manifest_fields_fail_closed() {
        for bytes in [
            b"{}".as_slice(),
            b"{\"generation\":1,\"ca_file\":\"x\",\"routes\":[],\"insecure\":true}",
            b"{\"generation\":0,\"ca_file\":\"x\",\"routes\":[]}",
        ] {
            assert!(Snapshot::parse(bytes).is_err());
        }
    }
}
