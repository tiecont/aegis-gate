"""Scan only sanitized owned additions; retain exact safe scanner receipts."""
import datetime
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys

root = Path.cwd()
out = Path(sys.argv[1])
assert not out.exists()
out.mkdir(parents=True)
git = lambda *a: subprocess.check_output(['git', *a], text=True).strip()
sha = lambda b: hashlib.sha256(b).hexdigest()
assert not git('status', '--porcelain', '--untracked-files=no')
stage = root / '.local/sanitized-e-scan'
assert not stage.exists()
stage.mkdir(parents=True)
r = dict(source_commit=git('rev-parse', 'HEAD'), source_tree=git('rev-parse', 'HEAD^{tree}'),
         argv=sys.argv, python=sys.version, started_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
try:
    files = git('diff', '--name-only', 'a325b9e', 'HEAD').splitlines()
    for file in files:
        dest = stage / file
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes((root / file).read_bytes())
    r['input_files'] = len(files)
    image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
    argv = ['docker', 'run', '--rm', '--network', 'none', '-v', str(stage)+':/input:ro',
            '-v', str(root/'.github/gitleaks.toml')+':/config:ro', '-v', str(out.resolve())+':/reports',
            image, 'dir', '/input', '--config', '/config', '--redact', '--report-format', 'json',
            '--report-path', '/reports/secrets.json', '--no-banner']
    r['scanner_argv'] = argv
    p = subprocess.run(argv, capture_output=True, timeout=90)
    r['streams'] = []
    for stream in ['stdout', 'stderr']:
        b = getattr(p, stream)
        (out / (stream+'.log')).write_bytes(b)
        r['streams'].append(dict(file=stream+'.log', sha256=sha(b)))
    r['exit_code'] = p.returncode
    assert p.returncode == 0 and json.loads((out/'secrets.json').read_text()) == []
finally:
    shutil.rmtree(stage)
    r['stage_removed'] = not stage.exists()
    r['ended_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (out/'receipt.json').write_text(json.dumps(r, indent=2)+'\n')
    (out/'SHA256SUMS').write_text(''.join(sha(f.read_bytes())+'  '+str(f)+'\n' for f in sorted(out.iterdir()) if f.name!='SHA256SUMS'))
print(json.dumps({'exit_code': r['exit_code'], 'input_files': r['input_files']}))
