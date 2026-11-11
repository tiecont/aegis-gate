import tls from 'node:tls';

// A bounded transport relay observes decrypted bytes before Node's native H2
// implementation consumes them. It neither parses nor rewrites HTTP frames.
export function createTlsObserver({ cert, key, ca, port, onBytes, onTransportError = () => {} }) {
  const connections = new Set();
  const server = tls.createServer({ cert, key, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'],
    handshakeTimeout: 2000 }, (downstream) => {
    if (connections.size >= 64) { downstream.destroy(); return; }
    downstream.pause();
    const upstream = tls.connect({ host: '127.0.0.1', port, servername: 'lab-origin.test',
      ca, rejectUnauthorized: true, minVersion: 'TLSv1.2', ALPNProtocols: ['h2'] });
    const pair = { downstream, upstream };
    connections.add(pair);
    const stop = () => { downstream.destroy(); upstream.destroy(); connections.delete(pair); };
    for (const socket of [downstream, upstream]) {
      socket.on('error', () => { onTransportError(); stop(); });
      socket.on('close', stop);
      socket.setTimeout(5000, stop);
    }
    downstream.on('data', (chunk) => onBytes(chunk.length));
    upstream.once('secureConnect', () => {
      if (upstream.alpnProtocol !== 'h2' || downstream.alpnProtocol !== 'h2') { stop(); return; }
      downstream.pipe(upstream);
      upstream.pipe(downstream);
    });
  });
  server.maxConnections = 64;
  server.on('tlsClientError', () => onTransportError());
  server.closeAllConnections = () => {
    for (const { downstream, upstream } of connections) { downstream.destroy(); upstream.destroy(); }
    connections.clear();
  };
  return server;
}
