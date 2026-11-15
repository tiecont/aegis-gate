// Offline diagnostic decoding only. Uses the existing test decoder.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { decoder } from './wire-observer.mjs';
const [input, output] = process.argv.slice(2);
assert.match(input ?? '', /^evidence\/sprint05b-b\/[a-z0-9-]+$/);
assert.match(output ?? '', /^evidence\/sprint05b-b\/analysis-[a-z0-9-]+$/);
assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const load = (file) => JSON.parse(fs.readFileSync(path.join(input, file)));
const raw = load('wire.json'), original = load('original75.json'), receipt = load('receipt.json');
assert.equal(raw.omitted, 0);
// Full original75/23 capture is independent of the optional Docker-only resource helper.
for (const label of ['original75', 'evaluate75', 'original23'])
  assert.equal(receipt.commands.find((c) => c.label === label)?.exit_code, 1);
assert.equal(receipt.cleanup_complete, true); assert.equal(original.tests.length, 75);
const name = 'HTTP2-authority-Host-and-SNI-confusion-rejected';
const test = original.tests.find((t) => t.name === name); assert.equal(test.status, 'fail');
const target = raw.events.find((e) => e.kind === 'test-end' && e.message.startsWith(`FAIL ${name}:`));
assert.ok(target); const prior = raw.events.filter((e) => e.kind === 'test-end' && e.sequence < target.sequence).at(-1);
assert.ok(prior.message.startsWith('PASS HTTP2-downstream-and-upstream-ALPN'));
const frames = [];
for (const c of raw.connections) for (const direction of ['envoy_to_origin', 'origin_to_envoy']) {
  let offset = 0, current;
  const decode = decoder({ client: direction === 'envoy_to_origin', emit(event) {
    assert.notEqual(event.kind, 'decode-limit');
    frames.push({ connection: c.id, direction, offset, observed_sequence: current.sequence,
      observed_ns: current.time_ns, ...event }); offset += event.bytes;
  } });
  const chunks = raw.events.filter((e) => e.kind === 'bytes' && e.connection === c.id && e.direction === direction);
  for (const chunk of chunks) {
    current = chunk; const bytes = Buffer.from(chunk.hex, 'hex');
    for (let i = 0; i < bytes.length; i += 16384) decode(bytes.subarray(i, i + 16384));
  }
  assert.equal(offset, c[direction], 'capture contains incomplete frame or missing bytes');
}
const interval = raw.events.filter((e) => e.kind === 'bytes' && e.direction === 'envoy_to_origin' &&
  e.sequence > prior.sequence && e.sequence < target.sequence);
assert.equal(interval.map((e) => e.hex).join(''), '000000040100000000');
assert.equal(test.origin.decrypted_bytes, 9); assert.equal(test.origin.handler_invocations, 0);
assert.equal(test.origin.parser_errors, 0); assert.equal(test.origin.transport_errors, 0);
assert.equal(interval.length, 1);
const id = interval[0].connection;
const peerSettings = frames.filter((f) => f.connection === id && f.direction === 'origin_to_envoy' &&
  f.kind === 'frame' && f.type === 4 && f.flags === 0 && f.observed_sequence < interval[0].sequence);
const allAcks = frames.filter((f) => f.connection === id && f.direction === 'envoy_to_origin' &&
  f.kind === 'frame' && f.type === 4 && f.flags === 1 && f.observed_sequence <= interval[0].sequence);
assert.equal(peerSettings.length, 1); assert.equal(allAcks.length, 1);
assert.equal(allAcks[0].hex, '000000040100000000');
assert.ok(raw.events.find((e) => e.kind === 'relay-secure' && e.connection === id).sequence < prior.sequence);
const endpoint = raw.connections.find((c) => c.id === id);
assert.equal(endpoint.local.address, '127.0.0.1'); assert.equal(endpoint.remote.address, '127.0.0.1');
const report = { source_commit: git('rev-parse', 'HEAD'), source_tree: git('rev-parse', 'HEAD^{tree}'),
  argv: process.argv, node: process.version, input_source_commit: receipt.source_commit,
  input_source_tree: receipt.source_tree, inputs: ['wire.json', 'original75.json', 'receipt.json']
    .map((file) => ({ file: `${input}/${file}`, sha256: sha(fs.readFileSync(`${input}/${file}`)) })),
  overall_collector_complete: receipt.recording_complete, overall_collector_error: receipt.error,
  resource_eligibility: receipt.resource_eligibility,
  unchanged_gate: test, boundary_before: prior, boundary_after: target, endpoint,
  interval, peer_settings: peerSettings, corresponding_ack: allAcks[0],
  event_order: frames.filter((f) => f.connection === id && f.observed_sequence <= interval[0].sequence)
    .sort((a, b) => a.observed_sequence - b.observed_sequence || a.offset - b.offset),
  conclusion: 'Envoy sent the sole ACK of the sole observed origin SETTINGS on the already established H2 origin connection during the unchanged failing interval. No HEADERS/DATA were sent in that interval. This is still an all-byte gate failure.',
  limit: 'Times identify JS relay observation order, not Envoy internal scheduling or kernel wire-send timestamps.', exit_code: 0 };
fs.writeFileSync(`${output}/receipt.json`, JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(`${output}/SHA256.json`, JSON.stringify([{ file: 'receipt.json',
  sha256: sha(fs.readFileSync(`${output}/receipt.json`)) }], null, 2) + '\n');
console.log(report.conclusion);
