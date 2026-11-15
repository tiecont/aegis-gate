"""Observe only readiness exit codes on the owned private PostgreSQL fixture."""
import json
import subprocess
import time

compose = ['docker', 'compose', '--env-file', '.local/compose.env',
           '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml']
started = time.monotonic()
samples = []
for attempt in range(60):
    sample = {'elapsed_ms': round((time.monotonic() - started) * 1000)}
    for label, args in [
        ('socket', ['pg_isready', '-U', 'aegisgate_local', '-d', 'aegisgate_local']),
        ('tcp', ['pg_isready', '-h', '127.0.0.1', '-U', 'aegisgate_local', '-d', 'aegisgate_local']),
        ('tcp_authenticated_sql', ['sh', '-c', 'PGPASSWORD=$(cat /run/secrets/postgres-password) psql -h 127.0.0.1 -U aegisgate_local -d aegisgate_local -v ON_ERROR_STOP=1 -tAc "SELECT 1"']),
    ]:
        result = subprocess.run(compose + ['exec', '-T', 'postgres'] + args,
                                capture_output=True, text=True, timeout=5)
        sample[label + '_exit'] = result.returncode
        if label == 'tcp_authenticated_sql' and result.returncode:
            sample['sql_starting_up'] = 'starting up' in result.stderr
            sample['sql_connection_refused'] = 'Connection refused' in result.stderr
            sample['sql_socket_missing'] = 'No such file or directory' in result.stderr
    samples.append(sample)
    if all(sample[key] == 0 for key in ['socket_exit', 'tcp_exit', 'tcp_authenticated_sql_exit']):
        print(json.dumps({'scope': 'Readiness exit codes only; inner outputs not retained',
                          'samples': samples, 'complete': True}))
        break
    time.sleep(.25)
else:
    print(json.dumps({'scope': 'Readiness exit codes only; inner outputs not retained',
                      'samples': samples, 'complete': False}))
    raise SystemExit(1)
