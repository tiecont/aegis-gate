import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { X509Certificate, createPrivateKey } from 'node:crypto';

const type = (name) => `type.googleapis.com/envoy.${name}`;
const typed = (name, value = {}) => ({ '@type': type(name), ...value });
const source = (filename) => ({ path_config_source: { path: filename }, resource_api_version: 'V3' });
const address = (port) => ({ socket_address: { address: '127.0.0.1', port_value: port } });
const exactKeys = (obj, keys) => assert.ok(Object.keys(obj).every((key) => keys.includes(key)), 'unknown field');
const host = (s) => typeof s === 'string' && s.length <= 253 && s.split('.').every((v) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v));
const portValid = (p) => Number.isInteger(p) && p >= 1024 && p <= 65535;

export function readBounded(filename, directory, privateFile = false) {
  assert.ok(path.isAbsolute(filename) && path.dirname(filename) === directory, 'fixture outside manifest directory');
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd);
    assert.ok(stat.isFile() && stat.size <= 65536, 'fixture size/type');
    assert.ok(!privateFile || (stat.mode & 0o077) === 0, 'private key permissions');
    const bytes = Buffer.alloc(65537);
    let length = 0;
    while (length < bytes.length) {
      const n = fs.readSync(fd, bytes, length, bytes.length - length, null);
      if (!n) break;
      length += n;
    }
    assert.ok(length <= 65536, 'fixture grew beyond bound');
    return bytes.subarray(0, length);
  } finally { fs.closeSync(fd); }
}

export function validateManifest(filename, previous = 0) {
  const directory = path.dirname(filename);
  const m = JSON.parse(readBounded(filename, directory));
  exactKeys(m, ['generation', 'ca_file', 'routes']);
  assert.ok(Number.isSafeInteger(m.generation) && m.generation > previous, 'nonmonotonic generation');
  new X509Certificate(readBounded(m.ca_file, directory));
  assert.ok(Array.isArray(m.routes) && m.routes.length > 0 && m.routes.length <= 16, 'route count');
  const seen = new Set();
  for (const r of m.routes) {
    exactKeys(r, ['host', 'origin_name', 'origin_port', 'cert_file', 'key_file', 'h2', 'backends']);
    assert.ok(host(r.host) && host(r.origin_name) && !seen.has(r.host), 'host/duplicate');
    seen.add(r.host);
    assert.ok(portValid(r.origin_port) && (r.h2 === undefined || typeof r.h2 === 'boolean'), 'port/protocol');
    const cert = new X509Certificate(readBounded(r.cert_file, directory));
    const key = createPrivateKey(readBounded(r.key_file, directory, true));
    assert.ok(cert.checkPrivateKey(key), 'certificate/key mismatch');
    assert.ok(cert.checkHost(r.host, { wildcards: false, subject: 'never' }) === r.host, 'SAN mismatch');
    assert.ok(Date.parse(cert.validFrom) <= Date.now() && Date.parse(cert.validTo) > Date.now(), 'certificate validity');
    assert.ok(!r.backends || (Array.isArray(r.backends) && r.backends.length <= 8), 'backend count');
    const ports = new Set();
    for (const b of r.backends ?? []) {
      exactKeys(b, ['port', 'weight']);
      assert.ok(portValid(b.port) && !ports.has(b.port) && Number.isInteger(b.weight) && b.weight >= 1 && b.weight <= 16, 'backend');
      ports.add(b.port);
    }
  }
  return m;
}

const response = (name, resources, version) => ({ version_info: String(version), type_url: type(name), resources });
const addHeader = (key, value) => ({ header: { key, value: String(value) }, append_action: 'OVERWRITE_IF_EXISTS_OR_ADD' });
const tlsSocket = (name, config) => ({ name: 'envoy.transport_sockets.tls', typed_config: typed(`extensions.transport_sockets.tls.v3.${name}`, config) });

export function compile(m, port, dir) {
  assert.ok(portValid(port), 'listener port');
  const files = {};
  const clusters = [];
  const chains = m.routes.map((r, i) => {
    const cluster = `route-${i}-generation-${m.generation}`;
    const backend = r.backends?.length ? r.backends : [{ port: r.origin_port, weight: 1 }];
    clusters.push(typed('config.cluster.v3.Cluster', {
      name: cluster, type: 'STATIC', connect_timeout: '0.5s', lb_policy: 'ROUND_ROBIN',
      common_lb_config: { healthy_panic_threshold: { value: 0 }, update_merge_window: '0s', ignore_new_hosts_until_first_hc: true },
      circuit_breakers: { thresholds: [{ max_connections: 64, max_pending_requests: 64, max_requests: 128, max_retries: 0 }] },
      load_assignment: { cluster_name: cluster, endpoints: [{ lb_endpoints: backend.map((b) => ({ endpoint: { address: address(b.port) }, load_balancing_weight: b.weight })) }] },
      typed_extension_protocol_options: { 'envoy.extensions.upstreams.http.v3.HttpProtocolOptions': typed('extensions.upstreams.http.v3.HttpProtocolOptions', {
        common_http_protocol_options: { idle_timeout: '5s', max_connection_duration: '60s' },
        explicit_http_config: r.h2 ? { http2_protocol_options: { max_concurrent_streams: 64 } } : { http_protocol_options: {} },
      }) },
      transport_socket: tlsSocket('UpstreamTlsContext', { sni: r.origin_name, common_tls_context: {
        tls_params: { tls_minimum_protocol_version: 'TLSv1_2' }, alpn_protocols: [r.h2 ? 'h2' : 'http/1.1'],
        validation_context: { trusted_ca: { filename: m.ca_file }, match_typed_subject_alt_names: [{ san_type: 'DNS', matcher: { exact: r.origin_name } }] },
      } }),
      ...(r.backends?.length ? { health_checks: [{ timeout: '0.1s', interval: '0.1s', no_traffic_interval: '0.1s',
        no_traffic_healthy_interval: '0.1s', unhealthy_threshold: 1, healthy_threshold: 1,
        http_health_check: { path: '/', host: r.origin_name, codec_client_type: r.h2 ? 'HTTP2' : 'HTTP1' } }] } : {}),
    }));
    const routeFile = path.join(dir, `route-${i}.json`);
    const secretFile = path.join(dir, `secret-${i}.json`);
    files[routeFile] = response('config.route.v3.RouteConfiguration', [typed('config.route.v3.RouteConfiguration', {
      name: `route-${i}`, virtual_hosts: [{ name: r.host, domains: [r.host, `${r.host}:443`], routes: [{ match: { prefix: '/' },
        route: { cluster, host_rewrite_literal: r.origin_name, timeout: '0s', idle_timeout: '2s' },
        request_headers_to_add: [addHeader('x-lab-route', r.host), addHeader('x-lab-generation', m.generation)],
        response_headers_to_add: [addHeader('x-lab-generation', m.generation)],
      }] }, { name: 'deny', domains: ['*'], routes: [{ match: { prefix: '/' }, direct_response: { status: 421 } }] }],
    })], m.generation);
    files[secretFile] = response('extensions.transport_sockets.tls.v3.Secret', [typed('extensions.transport_sockets.tls.v3.Secret', {
      name: `secret-${i}`, tls_certificate: { certificate_chain: { filename: r.cert_file }, private_key: { filename: r.key_file } },
    })], m.generation);
    return {
      name: `sni-${r.host}`, filter_chain_match: { server_names: [r.host], direct_source_prefix_ranges: [{ address_prefix: '127.0.0.1', prefix_len: 32 }] },
      transport_socket_connect_timeout: '2s',
      transport_socket: tlsSocket('DownstreamTlsContext', { require_sni: true, disable_stateless_session_resumption: true,
        disable_stateful_session_resumption: true, common_tls_context: {
          tls_params: { tls_minimum_protocol_version: 'TLSv1_2' }, alpn_protocols: ['h2', 'http/1.1'],
          tls_certificate_sds_secret_configs: [{ name: `secret-${i}`, sds_config: source(secretFile) }],
        } }),
      filters: [{ name: 'envoy.filters.network.http_connection_manager', typed_config: typed('extensions.filters.network.http_connection_manager.v3.HttpConnectionManager', {
        stat_prefix: `route_${i}`, codec_type: 'AUTO', use_remote_address: true, skip_xff_append: true,
        request_headers_timeout: '2s', stream_idle_timeout: '2s', max_request_headers_kb: 32,
        common_http_protocol_options: { idle_timeout: '10s', max_headers_count: 100 },
        http_protocol_options: { allow_absolute_url: false, allow_chunked_length: false, enable_trailers: true,
          override_stream_error_on_invalid_http_message: false },
        http2_protocol_options: { max_concurrent_streams: 64, initial_stream_window_size: 65536 },
        normalize_path: false, merge_slashes: false, path_with_escaped_slashes_action: 'KEEP_UNCHANGED',
        rds: { route_config_name: `route-${i}`, config_source: source(routeFile) },
        upgrade_configs: [{ upgrade_type: 'websocket' }],
        http_filters: [{ name: 'envoy.filters.http.lua', typed_config: typed('extensions.filters.http.lua.v3.Lua', {
          default_source_code: { inline_string: `local function deny(h, status)
  h:streamInfo():drainConnectionUponCompletion()
  h:respond({[":status"] = status}, "")
end

function envoy_on_request(h)
  local headers = h:headers()
  local authority = headers:get(":authority")
  if authority ~= "${r.host}" and authority ~= "${r.host}:443" then
    deny(h, "421")
    return
  end
  local length = tonumber(headers:get("content-length") or "")
  if length and length > 1048576 then
    deny(h, "413")
    return
  end
  headers:remove("x-forwarded-for")
  headers:remove("x-forwarded-host")
  headers:remove("x-tenant-id")
  headers:remove("x-lab-route")
  headers:remove("x-lab-generation")
end
` },
        }) }, { name: 'envoy.filters.http.router', typed_config: typed('extensions.filters.http.router.v3.Router') }],
      }) }],
    };
  });
  files[path.join(dir, 'clusters.json')] = response('config.cluster.v3.Cluster', clusters, m.generation);
  const listener = typed('config.listener.v3.Listener', { name: 'loopback-edge', address: address(port),
    per_connection_buffer_limit_bytes: 65536, listener_filters_timeout: '2s',
    listener_filters: [{ name: 'envoy.filters.listener.tls_inspector', typed_config: typed('extensions.filters.listener.tls_inspector.v3.TlsInspector') }],
    filter_chains: chains,
  });
  const { '@type': ignored, ...staticListener } = listener;
  return { files, listener, bootstrap: { node: { id: 'isolated-envoy-proof', cluster: 'loopback' },
    overload_manager: { resource_monitors: [{ name: 'envoy.resource_monitors.global_downstream_max_connections',
      typed_config: typed('extensions.resource_monitors.downstream_connections.v3.DownstreamConnectionsConfig', { max_active_downstream_connections: 256 }) }] },
    dynamic_resources: { cds_config: source(path.join(dir, 'clusters.json')) }, static_resources: { listeners: [staticListener] } } };
}
