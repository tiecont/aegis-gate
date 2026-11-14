"""Independently verify 05A E receipts and scan only owned additions offline."""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

lock = Path('/tmp/aegisgate-sprint02-fixtures.lock')
if '--locked' not in sys.argv:
    print('Waiting for exclusive fixture verification lock', flush=True)
    sys.exit(subprocess.run(['flock', '--exclusive', str(lock), sys.executable, __file__, *sys.argv[1:], '--locked']).returncode)


def assert_lock():
    ancestors = set()
    pid = os.getppid()
    while pid > 1 and pid not in ancestors:
        ancestors.add(pid)
        pid = int(re.search(r'^PPid:\s+(\d+)', Path(f'/proc/{pid}/status').read_text(), re.M)[1])
    assert any(len(f := line.split()) > 5 and f[1] == 'FLOCK' and f[3] == 'WRITE'
               and int(f[4]) in ancestors and f[5].endswith(':' + str(lock.stat().st_ino))
               for line in Path('/proc/locks').read_text().splitlines())


assert_lock()
root = Path.cwd()
attempt, output = sys.argv[1:3]
assert re.fullmatch(r'attempt-\d{2}', attempt)
out = root / output
assert out.parent == root / 'evidence/sprint05a-e' and not out.exists()
sha = lambda b: hashlib.sha256(b).hexdigest()
git = lambda *a: subprocess.check_output(['git', *a], text=True).strip()
assert git('status', '--porcelain') == '', 'Commit proof/report before independent verification'
prefix = root / 'evidence/sprint05a-e' / attempt
r = json.loads((prefix / 'commands.json').read_text())
assert r['passed'] and r['tracked_clean'] and r['lock_held_through_cleanup']
assert r['source_tree'] == git('rev-parse', r['source_commit'] + '^{tree}')
assert r['go'] == dict(packages=11, top_level=88, subtests=151, skipped=0)
assert r['private_values_checked'] == 4 and r['credential_matches'] == r['private_key_matches'] == 0
assert r['owned_private_material_removed'] and r['secret_scan_stage_removed']
verified = 0
for line in (prefix / 'SHA256SUMS').read_text().splitlines():
    expected, file = line.split('  ', 1)
    assert sha((root / file).read_bytes()) == expected, file
    verified += 1
streams = {s: (prefix / (s + '.log')).read_bytes() for s in ['stdout', 'stderr']}
offsets = dict.fromkeys(streams, 0)
labels = {}
for c in r['commands']:
    assert c['label'] not in labels
    labels[c['label']] = c
    expected = 1 if c['label'].startswith('lock-') or c['label'] == 'typescript7-strict-resolution' else 0
    assert c['exit_code'] == expected and c['signal'] is None and c['error_code'] is None, c['label']
    for s, part in c['streams'].items():
        assert part['offset'] == offsets[s]
        b = streams[s][part['offset']:part['offset'] + part['length']]
        assert len(b) == part['length'] and sha(b) == part['sha256']
        offsets[s] += part['length']
assert offsets == {s: len(b) for s, b in streams.items()}


def raw(label, stream='stdout'):
    p = labels[label]['streams'][stream]
    return streams[stream][p['offset']:p['offset'] + p['length']].decode()


assert not re.search(r'--- (FAIL|SKIP):', raw('go-full-race-integration'))
required = ['fixture-tls-credentials', 'fixture-fresh-restart', 'fixture-stale-volume-image-network',
            'immutable-baseline', 'go-full-race-integration', 'golden', 'contracts-integration',
            'dependency-scans', 'owned-gitleaks', 'source-unchanged', 'dashboard-lint',
            'dashboard-typecheck', 'dashboard-test', 'dashboard-build', 'dashboard-integration']
assert all(label in labels for label in required)
for label in labels:
    if label.startswith('cleanup-') and 'image' not in label:
        assert raw(label).strip() == ''
fixtures = json.loads(raw('fixture-stale-volume-image-network'))
assert fixtures['project'] == r['compose_project'] and fixtures['probe_container_and_volume_removed']
assert fixtures['fresh_init'] and fixtures['persisted_restart'] and fixtures['stale_volume_changed_password_denied']
references = json.loads((prefix / 'baseline-references.json').read_text())['files']
for ref in references:
    b = (root / ref['file']).read_bytes()
    assert len(b) == ref['bytes'] and sha(b) == ref['sha256']
    assert git('rev-parse', ref['commit'] + ':' + ref['file']) == git('hash-object', ref['file']) == ref['blob']
assert not git('diff', '--name-only', r['source_commit'], 'HEAD', '--', 'scripts/sprint05a-e-*')
assert not git('diff', '--name-only', '8e77a4f', 'HEAD', '--', '.', ':!evidence/sprint05a-e',
               ':!scripts/sprint05a-e-*', ':!docs/reports/sprint05a-e-regressions.md')
protected = ['spikes/edge-comparison', 'spikes/pingora/lab.mjs', 'spikes/envoy/config.mjs',
             'spikes/envoy/recovery-config.mjs', 'spikes/envoy/recovery-launcher.mjs',
             'spikes/envoy/wire-probes.mjs', 'spikes/envoy/wire-fixtures.mjs']
assert git('ls-tree', '-r', 'HEAD', '--', *protected) == git('ls-tree', '-r', r['baseline_commit'], '--', *protected)
for kind in ['container', 'network', 'volume']:
    for key in ['com.docker.compose.project', 'aegisgate.fixture.owner']:
        assert not subprocess.check_output(['docker', kind, 'ls', '--filter', f'label={key}={r["compose_project"]}', '--format', '{{.ID}}'], text=True).strip()
for kind, name in [('container', fixtures['probe_container']), ('volume', fixtures['probe_volume'])]:
    assert subprocess.run(['docker', kind, 'inspect', name], capture_output=True).returncode != 0
private = ['postgres-password', 'redis-password', 'nats-token', 'compose.env', 'redis.conf', 'nats.conf', 'pki']
assert all(not (root / '.local' / name).exists() for name in private)
out.mkdir()
stage = root / '.local/sprint05a-e-verify-scan'
assert not stage.exists()
stage.mkdir(parents=True)
result = dict(source_commit=git('rev-parse', 'HEAD'), source_tree=git('rev-parse', 'HEAD^{tree}'),
              runtime_source_commit=r['source_commit'], runtime_source_tree=r['source_tree'],
              argv=sys.argv, cwd=str(root), python=sys.version, python_binary=sys.executable,
              python_binary_sha256=sha(Path(sys.executable).read_bytes()), started_at=datetime.now(timezone.utc).isoformat(),
              verified_manifest_entries=verified, verified_commands=len(labels), verified_stream_slices=2 * len(labels),
              verified_baseline_references=len(references), go=r['go'], fixture_lock_held=True,
              cleanup_inventory_empty=True, owned_private_material_removed=True, protected_objects_equal=True)
try:
    files = git('ls-files', 'evidence/sprint05a-e', 'scripts/sprint05a-e-*', 'docs/reports/sprint05a-e-regressions.md').splitlines()
    result['input_files'] = len(files)
    for file in files:
        b = (root / file).read_bytes()
        assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', b)
        dest = stage / file
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(b)
    image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
    argv = ['docker', 'run', '--rm', '--name', r['compose_project'] + '-verify-gitleaks', '--network', 'none',
            '-v', str(stage) + ':/input:ro', '-v', str(root / '.github/gitleaks.toml') + ':/config:ro',
            '-v', str(out) + ':/reports', image, 'dir', '/input', '--config', '/config', '--redact',
            '--report-format', 'json', '--report-path', '/reports/secrets.json', '--no-banner']
    result['scanner_argv'] = argv
    p = subprocess.run(argv, capture_output=True, timeout=90)
    result['streams'] = []
    for stream in ['stdout', 'stderr']:
        b = getattr(p, stream)
        (out / (stream + '.log')).write_bytes(b)
        result['streams'].append(dict(file=stream + '.log', bytes=len(b), sha256=sha(b)))
    result['exit_code'] = p.returncode
    assert p.returncode == 0 and json.loads((out / 'secrets.json').read_text()) == []
finally:
    shutil.rmtree(stage)
    result['stage_removed'] = not stage.exists()
    result['ended_at'] = datetime.now(timezone.utc).isoformat()
    (out / 'receipt.json').write_text(json.dumps(result, indent=2) + '\n')
    (out / 'SHA256SUMS').write_text(''.join(sha(f.read_bytes()) + '  ' + str(f.relative_to(root)) + '\n'
                                         for f in sorted(out.iterdir()) if f.name != 'SHA256SUMS'))
    assert_lock()
print(json.dumps(result))
