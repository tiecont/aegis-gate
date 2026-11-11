#!/usr/bin/env python3
"""Build local-only fixtures; Compose/scans consume immutable image IDs, not tags."""
from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
context = root/'infra/compose'
local = root/'.local'
local.mkdir(mode=0o700,exist_ok=True)
if local.is_symlink():
    raise RuntimeError('Refusing symlink local directory')
records = {'schema_version':1}
for service, dockerfile, sources in [
    ('postgres','Dockerfile.postgres',['Dockerfile.postgres','su-exec-wrapper.sh']),
    ('demo-origin','Dockerfile.origin',['Dockerfile.origin']),
]:
    text=(context/dockerfile).read_text()
    base=next(line.removeprefix('FROM ') for line in text.splitlines() if line.startswith('FROM '))
    if not re.fullmatch(r'[^\s]+@sha256:[a-f0-9]{64}',base):
        raise RuntimeError('Fixture base must have immutable registry digest')
    with tempfile.TemporaryDirectory(prefix='aegis-image-id-') as temp:
        iid=Path(temp)/'image-id'
        # Local cached builds keep the same identity; registry provenance/signing
        # is a separate production release gate, never implied by this lock.
        subprocess.run(['docker','build','--pull=false','--provenance=false','--iidfile',str(iid),'-f',str(context/dockerfile),str(context)],check=True)
        image_id=iid.read_text().strip()
    if not re.fullmatch(r'sha256:[a-f0-9]{64}',image_id):
        raise RuntimeError('Builder failed to return immutable image ID')
    actual=subprocess.check_output(['docker','image','inspect',image_id,'--format','{{.Id}}'],text=True).strip()
    if actual!=image_id:
        raise RuntimeError('Image identity mismatch')
    source_digest=hashlib.sha256()
    for name in sorted(sources):
        source_digest.update(name.encode()+b'\0'+(context/name).read_bytes()+b'\0')
    records[service]={
        'image_id':image_id,'base':base,
        'dockerfile_sha256':hashlib.sha256((context/dockerfile).read_bytes()).hexdigest(),
        'source_sha256':source_digest.hexdigest(),'source_files':sorted(sources),
    }
env='AEGIS_POSTGRES_IMAGE='+records['postgres']['image_id']+'\nAEGIS_ORIGIN_IMAGE='+records['demo-origin']['image_id']+'\n'
# Atomic replacement keeps readers from seeing half-written image identity files.
for name,data in [('fixture-images.env',env),('fixture-images.lock.json',json.dumps(records,indent=2)+'\n')]:
    target=local/name
    if target.is_symlink():
        raise RuntimeError('Refusing symlink fixture image lock')
    temp=local/(name+'.tmp')
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w') as output:output.write(data)
    os.replace(temp,target)
print('Local fixture images built and locked by immutable image ID; no publication')
