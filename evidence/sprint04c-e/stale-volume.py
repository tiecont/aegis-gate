"""Owned isolated Postgres stale-volume credential and image/network probe."""
from pathlib import Path
import json
import os
import secrets
import subprocess
import tempfile
import time

root = Path.cwd()
compose = ['docker', 'compose', '--env-file', '.local/compose.env',
           '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml']


def docker(*args, check=True):
    result = subprocess.run(['docker', *args], capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError('Owned fixture Docker operation failed: ' + args[0])
    return result


config = json.loads(subprocess.check_output(compose + ['config', '--format', 'json'], text=True))
network = config['networks']['lab']['name']
assert config['name'] == os.environ['COMPOSE_PROJECT_NAME'] == 'aegisgate-04c-e'
lock = json.loads((root / '.local/fixture-images.lock.json').read_text())
for service in config['services']:
    cid = subprocess.check_output(compose + ['ps', '-q', service], text=True).strip()
    actual = json.loads(docker('inspect', cid).stdout)[0]
    expected = json.loads(docker('image', 'inspect', config['services'][service]['image']).stdout)[0]['Id']
    assert actual['Image'] == expected, 'Running image differs from configured immutable image'
    assert network in actual['NetworkSettings']['Networks'], 'Wrong project network'
    for bindings in actual['NetworkSettings']['Ports'].values():
        for binding in bindings or []:
            assert binding['HostIp'] == '127.0.0.1', 'Public fixture listener'
    if service in ('postgres', 'demo-origin'):
        assert expected == lock[service]['image_id'], 'Build lock image mismatch'
print(json.dumps({'project': config['name'], 'network': network, 'running_images_match': True}))

name = 'aegisgate-04c-e-stale-' + secrets.token_hex(6)
volume = name + '-data'
image = lock['postgres']['image_id']
original = root / '.local/postgres-password'
docker('volume', 'create', volume)
try:
    with tempfile.TemporaryDirectory(prefix='aegisgate-04c-e-secret-') as temp:
        rotated = Path(temp) / 'password'
        rotated.write_text(secrets.token_urlsafe(32) + '\n')
        rotated.chmod(0o600)

        def launch(secret):
            docker('run', '-d', '--name', name, '--network', network,
                   '-e', 'POSTGRES_DB=aegisgate_local', '-e', 'POSTGRES_USER=aegisgate_local',
                   '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/configured-password',
                   '--mount', 'type=volume,src=' + volume + ',dst=/var/lib/postgresql',
                   '--mount', 'type=bind,src=' + str(secret) + ',dst=/run/secrets/configured-password,readonly',
                   '--mount', 'type=bind,src=' + str(original) + ',dst=/run/secrets/original-password,readonly',
                   image)
            for _ in range(120):
                if docker('exec', name, 'pg_isready', '-h', name, '-U', 'aegisgate_local',
                          '-d', 'aegisgate_local', check=False).returncode == 0:
                    break
                time.sleep(.25)
            else:
                raise RuntimeError('Owned stale-volume fixture readiness deadline')
            inspected = json.loads(docker('inspect', name).stdout)[0]
            assert inspected['Image'] == image
            assert network in inspected['NetworkSettings']['Networks']
            assert not inspected['HostConfig']['PortBindings'], 'Unexpected published port'

        def sql(secret_path, statement):
            command = 'PGPASSWORD=$(cat "$1") psql -h "$2" -U aegisgate_local -d aegisgate_local -v ON_ERROR_STOP=1 -tAc "$3"'
            return docker('exec', name, 'sh', '-c', command, 'owned-stale-volume', secret_path,
                          name, statement, check=False)

        launch(original)
        created = sql('/run/secrets/original-password',
                      'CREATE TABLE stale_volume_check(id integer PRIMARY KEY); INSERT INTO stale_volume_check VALUES(1);')
        assert created.returncode == 0, 'Fresh credential failed'
        docker('rm', '--force', name)
        launch(rotated)
        denied = sql('/run/secrets/configured-password', 'SELECT 1')
        assert denied.returncode != 0 and 'password authentication failed' in denied.stderr
        retained = sql('/run/secrets/original-password', 'SELECT count(*) FROM stale_volume_check')
        assert retained.returncode == 0 and retained.stdout.strip() == '1'
        print('PASS: recreated container with stale named volume rejects changed secret; original credential/data persist; exact image/private network/no published port')
finally:
    removed = docker('rm', '--force', '--volumes', name, check=False)
    volume_removed = docker('volume', 'rm', volume, check=False)
    assert docker('container', 'inspect', name, check=False).returncode != 0, 'Leaked fixture container'
    assert volume_removed.returncode == 0, 'Leaked stale fixture volume'
    print('PASS: isolated stale-volume container and named volume removed')
