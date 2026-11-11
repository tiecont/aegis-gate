import fs from 'node:fs';
import { createHash } from 'node:crypto';

const output = process.argv[2] ?? 'evidence/sprint03a-b/upstream.json';
const sources = [
  ['release', 'https://api.github.com/repos/envoyproxy/envoy/releases/latest', null],
  ['support-policy', 'https://raw.githubusercontent.com/envoyproxy/envoy/v1.40.2/RELEASES.md', /support|supported|release|month|version/i],
  ['balsa-parser', 'https://raw.githubusercontent.com/envoyproxy/envoy/v1.40.2/source/common/http/http1/balsa_parser.cc', /continuation|validation_policy|cr_or_lf|kValid|value_without/],
  ['h2-host', 'https://raw.githubusercontent.com/envoyproxy/envoy/v1.40.2/source/common/http/http2/codec_impl.cc', /discard_host_header|HostLegacy|allow_different_host_and_authority|Discard the host/],
  ['header-validator-api', 'https://raw.githubusercontent.com/envoyproxy/envoy/v1.40.2/api/envoy/extensions/filters/network/http_connection_manager/v3/http_connection_manager.proto', /typed_header_validation_config|not-implemented-hide|header validation|UHV/],
  ['license', 'https://raw.githubusercontent.com/envoyproxy/envoy/v1.40.2/LICENSE', /Apache|Version|Copyright/],
];
const records = [];
for (const [name, url, pattern] of sources) {
  const fetched_at = new Date().toISOString();
  const response = await fetch(url);
  const bytes = Buffer.from(await response.arrayBuffer());
  const text = bytes.toString();
  records.push({ name, url, fetched_at, status: response.status,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    ...(pattern ? { excerpts: text.split('\n').flatMap((line, i) => pattern.test(line) ? [{ line: i + 1, text: line }] : []) }
      : { release: JSON.parse(text) }) });
}
fs.writeFileSync(output, JSON.stringify(records, null, 2) + '\n');
if (records.some((r) => r.status !== 200)) process.exitCode = 1;
