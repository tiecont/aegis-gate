const suffix = 'GET /pipeline-successor HTTP/1.1\r\nHost: edge-a.test\r\nConnection: close\r\n\r\n';
const pipeline = (line, headers = 'Host: edge-a.test') => `${line}\r\n${headers}\r\n\r\n${suffix}`;

export const supplementalNegatives = Object.freeze([
  { name: 'space-target-before-pipelined-request', request: pipeline('GET /bad target HTTP/1.1') },
  { name: 'tab-target-before-pipelined-request', request: pipeline('GET /bad\ttarget HTTP/1.1') },
  { name: 'duplicate-host-before-pipelined-request', request: pipeline('GET / HTTP/1.1', 'Host: edge-a.test\r\nHost: edge-b.test') },
  { name: 'conflicting-length-before-pipelined-request', request: pipeline('POST / HTTP/1.1', 'Host: edge-a.test\r\nContent-Length: 0\r\nContent-Length: 1') },
  { name: 'signed-content-length', request: pipeline('POST / HTTP/1.1', 'Host: edge-a.test\r\nContent-Length: +0') },
  { name: 'negative-content-length', request: pipeline('POST / HTTP/1.1', 'Host: edge-a.test\r\nContent-Length: -1') },
  { name: 'repeated-transfer-encoding-fields', request: 'POST / HTTP/1.1\r\nHost: edge-a.test\r\nTransfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n0\r\n\r\n' },
  { name: 'nul-in-header-value', request: pipeline('GET / HTTP/1.1', 'Host: edge-a.test\r\nX-Lab: before\x00after') },
  { name: 'invalid-header-name', request: pipeline('GET / HTTP/1.1', 'Host: edge-a.test\r\nBad Header: value') },
]);

export const supplementalTestNames = Object.freeze([
  ...supplementalNegatives.map(({ name }) => `supplemental-${name}`),
  'valid-HTTP1-pipelining-preserves-boundaries-and-encoded-targets',
]);
