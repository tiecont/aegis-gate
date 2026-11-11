#!/usr/bin/env python3
"""Create private local fixtures; never print secrets, overwrite or use in prod."""
from pathlib import Path
import os
import secrets

root = Path(__file__).resolve().parent.parent
local = root / '.local'
if local.is_symlink():
    raise RuntimeError('Refusing symlink local secret directory')
local.mkdir(mode=0o700, exist_ok=True)
os.chmod(local, 0o700)
items = {
    'postgres-password': secrets.token_urlsafe(32) + '\n',
    'redis-password': secrets.token_urlsafe(32) + '\n',
    'nats-token': secrets.token_urlsafe(32) + '\n',
}
for name, value in items.items():
    target = local / name
    if target.is_symlink():
        raise RuntimeError('Refusing symlink local secret file')
    if not target.exists():
        with open(target, 'x', opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
            f.write(value)
    if target.is_symlink() or target.stat().st_mode & 0o077:
        raise RuntimeError('Unsafe local secret permissions')
configs = {
    'compose.env': f'LOCAL_UID={os.getuid()}\nLOCAL_GID={os.getgid()}\n',
    'redis.conf': 'bind 0.0.0.0\nprotected-mode yes\nappendonly yes\ndir /data\nrequirepass ' + (local / 'redis-password').read_text().strip() + '\n',
    'nats.conf': 'port: 4222\nhttp: 8222\njetstream { store_dir: /data/jetstream, max_mem_store: 64MB, max_file_store: 256MB }\nauthorization { token: "' + (local / 'nats-token').read_text().strip() + '" }\n',
}
for name, value in configs.items():
    target = local / name
    if target.is_symlink():
        raise RuntimeError('Refusing symlink local secret file')
    if not target.exists():
        with open(target, 'x', opener=lambda path, flags: os.open(path, flags, 0o600)) as f:
            f.write(value)
    if target.is_symlink() or target.stat().st_mode & 0o077:
        raise RuntimeError('Unsafe local config permissions')
print('Local development secrets ready (material not logged)')
