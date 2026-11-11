"""Loopback-published Compose-only TLS origin. No request/credential logging."""
import http.server
import ssl

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def do_GET(self):
        if self.path != '/healthz':
            self.send_error(404)
            return
        body = b'{"service":"unsafe-local-origin","status":"alive"}\n'
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_):
        pass
    def setup(self):
        super().setup()
        self.connection.settimeout(3)

server = http.server.ThreadingHTTPServer(('0.0.0.0', 8443), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.minimum_version = ssl.TLSVersion.TLSv1_2
context.load_cert_chain('/fixtures/origin.pem', '/fixtures/origin.key')
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
