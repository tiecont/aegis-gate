"""Owned 05A fixture identity, fresh restart, stale-volume and cleanup proof."""
from pathlib import Path
import json
import os
import re
import secrets
import subprocess
import tempfile
import time

root = Path.cwd()
project = os.environ['COMPOSE_PROJECT_NAME']
assert re.fullmatch(r'aegisgate-05[ab]-e-attempt-\d{2}-[a-f0-9]{12}', project)
compose = ['docker', 'compose', '--env-file', '.local/compose.env',
           '--env-file', '.local/fixture-images.env', '-f', 'infra/compose/compose.yaml']


def docker(*args, check=True):
    result = subprocess.run(['docker', *args], capture_output=True, text=True)
    if check and result.returncode:
        raise RuntimeError('Owned fixture Docker operation failed: ' + args[0])
    return result


# Rendered config/inspect are parsed in memory, never written to evidence.
config = json.loads(subprocess.check_output(compose + ['config', '--format', 'json'], text=True))
assert config['name'] == project
assert set(config['services']) == {'postgres', 'redis', 'nats', 'demo-origin'}
network = config['networks']['lab']['name']
lock = json.loads((root / '.local/fixture-images.lock.json').read_text())
images = {}
for service, definition in config['services'].items():
    cid = subprocess.check_output(compose + ['ps', '-q', service], text=True).strip()
    actual = json.loads(docker('inspect', cid).stdout)[0]
    expected = json.loads(docker('image', 'inspect', definition['image']).stdout)[0]['Id']
    assert actual['Image'] == expected
    assert network in actual['NetworkSettings']['Networks']
    assert actual['Config']['Labels']['com.docker.compose.project'] == project
    for bindings in actual['NetworkSettings']['Ports'].values():
        for binding in bindings or []:
            assert binding['HostIp'] == '127.0.0.1', 'Public fixture listener'
    if service in ('postgres', 'demo-origin'):
        assert expected == lock[service]['image_id']
    images[service] = dict(reference=definition['image'], running_image=expected)

name = project + '-restart-stale'
volume = name + '-data'
image = lock['postgres']['image_id']
original = root / '.local/postgres-password'
docker('volume', 'create', '--label', 'aegisgate.fixture.owner=' + project, volume)
try:
    with tempfile.TemporaryDirectory(prefix=project + '-secret-') as temp:
        rotated = Path(temp) / 'password'
        rotated.write_text(secrets.token_urlsafe(32) + '\n')
        rotated.chmod(0o600)

        def ready():
            for _ in range(120):
                if docker('exec', name, 'pg_isready', '-h', name, '-U', 'aegisgate_local',
                          '-d', 'aegisgate_local', check=False).returncode == 0:
                    return
                time.sleep(.25)
            raise RuntimeError('Owned fixture readiness deadline')

        def launch(secret):
            docker('run', '-d', '--name', name, '--network', network,
                   '--label', 'aegisgate.fixture.owner=' + project,
                   '-e', 'POSTGRES_DB=aegisgate_local', '-e', 'POSTGRES_USER=aegisgate_local',
                   '-e', 'POSTGRES_PASSWORD_FILE=/run/secrets/configured-password',
                   '--mount', 'type=volume,src=' + volume + ',dst=/var/lib/postgresql',
                   '--mount', 'type=bind,src=' + str(secret) + ',dst=/run/secrets/configured-password,readonly',
                   '--mount', 'type=bind,src=' + str(original) + ',dst=/run/secrets/original-password,readonly', image)
            ready()
            inspected = json.loads(docker('inspect', name).stdout)[0]
            assert inspected['Image'] == image
            assert network in inspected['NetworkSettings']['Networks']
            assert not inspected['HostConfig']['PortBindings']
            uid = docker('exec', name, 'sh', '-c', 'awk \'/^Uid:/ {print $2}\' /proc/1/status')
            assert uid.stdout.strip().isdigit() and uid.stdout.strip() != '0'

        def sql(secret_path, statement):
            command = 'PGPASSWORD=$(cat "$1") psql -h "$2" -U aegisgate_local -d aegisgate_local -v ON_ERROR_STOP=1 -tAc "$3"'
            return docker('exec', name, 'sh', '-c', command, 'owned-stale-volume', secret_path,
                          name, statement, check=False)

        launch(original)
        assert sql('/run/secrets/original-password',
                   'CREATE TABLE stale_volume_check(id integer PRIMARY KEY); INSERT INTO stale_volume_check VALUES(1);').returncode == 0
        denied = sql('/run/secrets/configured-password-missing', 'SELECT 1')
        assert denied.returncode != 0
        docker('stop', '--time', '5', name)
        docker('start', name)
        ready()
        retained = sql('/run/secrets/original-password', 'SELECT count(*) FROM stale_volume_check')
        assert retained.returncode == 0 and retained.stdout.strip() == '1'
        docker('rm', '--force', name)
        launch(rotated)
        denied = sql('/run/secrets/configured-password', 'SELECT 1')
        assert denied.returncode != 0 and 'password authentication failed' in denied.stderr
        retained = sql('/run/secrets/original-password', 'SELECT count(*) FROM stale_volume_check')
        assert retained.returncode == 0 and retained.stdout.strip() == '1'
finally:
    docker('rm', '--force', '--volumes', name, check=False)
    assert docker('volume', 'rm', volume, check=False).returncode == 0
    assert docker('container', 'inspect', name, check=False).returncode != 0
    assert docker('volume', 'inspect', volume, check=False).returncode != 0

print(json.dumps(dict(project=project, network=network, images=images,
                     fresh_init=True, non_root_postgres=True, persisted_restart=True,
                     stale_volume_changed_password_denied=True, original_data_retained=True,
                     no_public_probe_port=True, probe_container=name, probe_volume=volume,
                     probe_container_and_volume_removed=True)))
