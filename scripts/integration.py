#!/usr/bin/env python3
"""Local owned Compose integration: never targets arbitrary hosts."""
from pathlib import Path
import json
import socket
import ssl
import subprocess
import time

root = Path(__file__).resolve().parent.parent
compose = ['docker','compose','--env-file',str(root/'.local/compose.env'),'--env-file',str(root/'.local/fixture-images.env'),'-f',str(root/'infra/compose/compose.yaml')]
def run(*args):
    return subprocess.check_output(compose+list(args),text=True,stderr=subprocess.STDOUT)
config = json.loads(run('config','--format','json'))
for service in config['services'].values():
    for port in service.get('ports',[]):
        assert port['host_ip'] == '127.0.0.1', 'Non-loopback published service'
    assert '@sha256:' in service['image'] or (service['image'].startswith('sha256:') and len(service['image']) == 71), 'Unpinned image'
run('exec','-T','postgres','psql','-U','aegisgate_local','-d','aegisgate_local','-v','ON_ERROR_STOP=1','-c','CREATE TEMP TABLE foundation_check(id integer PRIMARY KEY); INSERT INTO foundation_check VALUES(1); SELECT count(*) FROM foundation_check;')
# TCP verifies password authentication rather than relying only on local socket trust.
run('exec','-T','postgres','sh','-c','PGPASSWORD=$(cat /run/secrets/postgres-password) psql -h postgres -U aegisgate_local -d aegisgate_local -v ON_ERROR_STOP=1 -c "SELECT 1"')
failed = subprocess.run(compose+['exec','-T','postgres','sh','-c','PGPASSWORD=unsafe-wrong-fixture psql -h postgres -U aegisgate_local -d aegisgate_local -c "SELECT 1"'],capture_output=True,text=True)
assert failed.returncode != 0 and 'password authentication failed' in failed.stderr, 'Postgres accepted invalid credentials'
assert 'PONG' in run('exec','-T','redis','sh','-c','REDISCLI_AUTH=$(cat /run/secrets/redis-password) redis-cli --no-auth-warning ping')
assert 'NOAUTH' in run('exec','-T','redis','redis-cli','ping')
# NATS JetStream health (management port is not published).
assert 'ok' in run('exec','-T','nats','wget','-qO-','http://127.0.0.1:8222/healthz?js-enabled-only=true').lower()
# Unauthenticated client is rejected, with no traffic sent to third parties.
with socket.create_connection(('127.0.0.1',54222),timeout=3) as sock:
    sock.recv(8192)
    sock.sendall(b'CONNECT {"verbose":true}\r\nPING\r\n')
    assert b'Authorization Violation' in sock.recv(8192)
# Authenticated client succeeds without logging its token.
with socket.create_connection(('127.0.0.1',54222),timeout=3) as sock:
    sock.recv(8192)
    connect = json.dumps({'verbose':False,'auth_token':(root/'.local/nats-token').read_text().strip()}).encode()
    sock.sendall(b'CONNECT '+connect+b'\r\nPING\r\n')
    assert b'PONG' in sock.recv(8192), 'Authenticated NATS request failed'
# TLS chain AND hostname verification stay enabled against the private lab CA.
context = ssl.create_default_context(cafile=str(root/'.local/pki/ca.pem'))
for attempt in range(30):
    try:
        with socket.create_connection(('127.0.0.1',18443),timeout=2) as sock:
            with context.wrap_socket(sock,server_hostname='origin-a.test') as tls:
                tls.sendall(b'GET /healthz HTTP/1.1\r\nHost: origin-a.test\r\nConnection: close\r\n\r\n')
                assert b'200 OK' in tls.recv(4096)
        break
    except ConnectionRefusedError:
        time.sleep(.2)
else:
    raise RuntimeError('Local TLS origin did not start')
for hostname, ctx in [('wrong.test',context),('origin-a.test',ssl.create_default_context())]:
    try:
        with socket.create_connection(('127.0.0.1',18443),timeout=2) as sock:
            with ctx.wrap_socket(sock,server_hostname=hostname):
                raise AssertionError('TLS trust/hostname bypass')
    except ssl.SSLCertVerificationError:
        pass
print('PASS: local Postgres transaction + credential positive/negative, authenticated Redis/NATS, JetStream, TLS origin + wrong-host/untrusted negatives, loopback/digest policy')
