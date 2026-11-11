// Independent Node/OpenSSL consumption of the public Go-produced golden vector.
// This verifies published canonical bytes; it implements no JSON canonicalizer.
import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url));
const envelope = JSON.parse(read('snapshot-v1.json'));
const input = Buffer.from(read('snapshot-v1.signing-input.hex').toString().trim(), 'hex');
const publicBytes = Buffer.from(read('snapshot-v1.public-key.hex').toString().trim(), 'hex');
const prefix = Buffer.from('AEGISGATE_CONFIG_V1\0');
assert.deepEqual(input.subarray(0, prefix.length), prefix);
const unsigned = { ...envelope };
delete unsigned.signature;
assert.deepEqual(JSON.parse(input.subarray(prefix.length)), unsigned);
const publicKey = createPublicKey({
  key: { kty: 'OKP', crv: 'Ed25519', x: publicBytes.toString('base64url') },
  format: 'jwk',
});
const signature = Buffer.from(envelope.signature, 'base64');
assert.equal(verify(null, input, publicKey, signature), true);
const tampered = Buffer.from(input);
tampered[tampered.length - 1] ^= 1;
assert.equal(verify(null, tampered, publicKey, signature), false);
const payload = read('snapshot-v1.payload.json').subarray(0, -1);
assert.deepEqual(JSON.parse(payload), envelope.payload);
assert.equal(createHash('sha256').update(payload).digest('hex'), envelope.content_sha256);
console.log('PASS: Node/OpenSSL Ed25519, context, complete envelope binding, canonical-payload SHA256 and byte tamper');
