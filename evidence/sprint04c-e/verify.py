"""Verify compact receipts, protected sources and owned fixture-secret cleanup."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone

root = Path.cwd()
output = Path(sys.argv[1])
audit_only = '--audit-only' in sys.argv[2:]
assert not output.exists(), 'Fresh verification output required'
lock = Path('/tmp/aegisgate-sprint02-fixtures.lock')
ancestors = set()
pid = os.getppid()
while pid > 1 and pid not in ancestors:
    ancestors.add(pid)
    pid = int(re.search(r'^PPid:\s+(\d+)', Path(f'/proc/{pid}/status').read_text(), re.M)[1])
assert any(len(f := line.split()) > 5 and f[1] == 'FLOCK' and f[3] == 'WRITE'
           and int(f[4]) in ancestors and f[5].endswith(':' + str(lock.stat().st_ino))
           for line in Path('/proc/locks').read_text().splitlines())

sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.check_output(['git', *a], text=True).strip()
assert git('diff', '--name-only') == ''
prefix = root / 'evidence/sprint04c-e/attempt-02'
r = json.loads((prefix / 'commands.json').read_text())
assert r['passed'] and r['tracked_clean'] and r['lock_held_through_cleanup']
assert r['source_tree'] == git('rev-parse', r['source_commit'] + '^{tree}')
verified = 0
for line in (prefix / 'SHA256SUMS').read_text().splitlines():
    expected, file = line.split('  ', 1)
    assert sha((root / file).read_bytes()) == expected, file
    verified += 1
streams = {name: (prefix / (name + '.log')).read_bytes() for name in ['stdout', 'stderr']}
offsets = dict.fromkeys(streams, 0)
by_label = {}
for command in r['commands']:
    by_label[command['label']] = command
    for name, s in command['streams'].items():
        assert s['offset'] == offsets[name], command['label']
        raw = streams[name][s['offset']:s['offset'] + s['length']]
        assert len(raw) == s['length'] and sha(raw) == s['sha256']
        offsets[name] += s['length']
    assert command['signal'] is None and command['error_code'] is None
    expected = 1 if command['label'].startswith('lock-') or command['label'] == 'typescript7-strict-resolution' else 0
    assert command['exit_code'] == expected, command['label']
assert offsets == {name: len(raw) for name, raw in streams.items()}
def raw(label, name='stdout'):
    s = by_label[label]['streams'][name]
    return streams[name][s['offset']:s['offset'] + s['length']].decode()
tests = raw('go-full-race-integration')
assert not re.search(r'--- (FAIL|SKIP):', tests)
go = dict(packages=len(re.findall(r'^ok\s', tests, re.M)), top_level=len(re.findall(r'^--- PASS:', tests, re.M)),
          subtests=len(re.findall(r'^\s+--- PASS:', tests, re.M)), skipped=0)
assert go == dict(packages=11, top_level=88, subtests=151, skipped=0)
for label in ['cleanup-container', 'cleanup-network', 'cleanup-volume']:
    assert raw(label).strip() == ''
assert not git('diff', '--name-only', 'a325b9e', 'HEAD', '--', '.', ':!evidence/sprint04c-e', ':!docs/reports/sprint04c-e-regressions.md')
private_names = ['postgres-password', 'redis-password', 'nats-token']
private_paths = [root / '.local' / f for f in private_names] + [root / '.local/pki/valid.jwt']
if not audit_only:
    assert all(p.is_file() for p in private_paths), 'Full cleanup verification requires original private fixture values'
secrets = [p.read_bytes().strip() for p in private_paths if p.is_file()]
owned = [p for p in (root / 'evidence/sprint04c-e').rglob('*') if p.is_file() and '__pycache__' not in str(p)]
for p in owned:
    b = p.read_bytes()
    assert not any(value and value in b for value in secrets), 'Private generated value in owned evidence'
    assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', b), 'Private key marker in owned evidence'
for kind in ['container', 'network', 'volume']:
    assert not subprocess.check_output(['docker', kind, 'ls', '--filter', 'label=com.docker.compose.project=aegisgate-04c-e', '--format', '{{.ID}}'], text=True).strip()
# These paths were generated only by this isolated recorder, never shared state.
if not audit_only:
    for name in private_names + ['compose.env', 'redis.conf', 'nats.conf']:
        (root / '.local' / name).unlink()
    shutil.rmtree(root / '.local/pki')
result = dict(source_commit=git('rev-parse', 'HEAD'), source_tree=git('rev-parse', 'HEAD^{tree}'),
              argv=sys.argv, python=sys.version, python_binary=sys.executable,
              python_binary_sha256=sha(Path(sys.executable).read_bytes()), cwd=str(root),
              verified_manifest_entries=verified, verified_commands=len(r['commands']), go=go,
              exact_source_unchanged=True, credential_matches=0 if len(secrets) == 4 else None,
              private_key_matches=0, audit_only=audit_only,
              cleanup_inventory_empty=True, owned_generated_private_material_removed=True if not audit_only else None,
              fixture_lock_held=True, exit_code=0, ended_at=datetime.now(timezone.utc).isoformat())
output.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
