#!/usr/bin/env python3
"""Download supported pinned Node after verifying official SHA256 manifest."""
import hashlib
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
import urllib.request

root = Path(__file__).resolve().parent.parent
version = '26.13.0'
if platform.system() != 'Linux' or platform.machine() not in {'x86_64','aarch64'}:
    raise SystemExit('Install Node26.13.0 manually on this platform; use AEGIS_NODE_BIN')
arch = 'x64' if platform.machine() == 'x86_64' else 'arm64'
name = f'node-v{version}-linux-{arch}'
base = f'https://nodejs.org/dist/v{version}/'
target = root / '.local/toolchains/node'
if not target.is_dir():
    target.parent.mkdir(parents=True,exist_ok=True)
    manifest = urllib.request.urlopen(base+'SHASUMS256.txt',timeout=30).read().decode()
    filename = name+'.tar.xz'
    digest = next(line.split()[0] for line in manifest.splitlines() if line.split()[-1] == filename)
    content = urllib.request.urlopen(base+filename,timeout=30).read()
    if hashlib.sha256(content).hexdigest() != digest:
        raise SystemExit('Official Node checksum mismatch')
    archive = target.parent / filename
    archive.write_bytes(content)
    with tarfile.open(archive) as tar:
        tar.extractall(target.parent,filter='data')
    (target.parent/name).rename(target)
    archive.unlink()
print(subprocess.check_output([str(target/'bin/node'),'--version'],text=True).strip())
