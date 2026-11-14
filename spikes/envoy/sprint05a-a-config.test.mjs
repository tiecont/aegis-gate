import test from 'node:test';
import assert from 'node:assert/strict';
import { compile as baseline } from './recovery-config.mjs';
import { compile } from './sprint05a-a-config.mjs';

test('candidate changes only local reply mapping across every baseline filter chain', () => {
  const m = { generation: 1, ca_file: '/fixture/ca.pem', routes: [false, true].map((h2, i) => ({
    host: `edge-${i}.test`, origin_name: 'lab-origin.test', origin_port: 12345 + i,
    cert_file: `/fixture/edge-${i}.pem`, key_file: `/fixture/edge-${i}.key`, h2,
  })) };
  const original = baseline(m, 23456, '/fixture');
  const candidate = compile(m, 23456, '/fixture');
  let count = 0;
  for (const listener of candidate.bootstrap.static_resources.listeners) for (const chain of listener.filter_chains)
    for (const filter of chain.filters) if (filter.name === 'envoy.filters.network.http_connection_manager') {
      assert.deepEqual(filter.typed_config.local_reply_config, { mappers: [{
        filter: { status_code_filter: { comparison: { op: 'EQ',
          value: { default_value: 501, runtime_key: 'sprint05a_a_local_501' } } } }, status_code: 400,
      }] });
      delete filter.typed_config.local_reply_config; count++;
    }
  assert.equal(count, 2);
  assert.deepEqual(candidate, original);
});
