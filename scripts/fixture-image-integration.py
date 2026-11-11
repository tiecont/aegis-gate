#!/usr/bin/env python3
"""Prove the local su-exec entrypoint supports fresh init and persisted restart."""
from pathlib import Path
import json
import secrets
import subprocess
import time

root=Path(__file__).resolve().parent.parent
lock=json.loads((root/'.local/fixture-images.lock.json').read_text())
image=lock['postgres']['image_id']
name='aegisgate-foundation-pg-'+secrets.token_hex(6)
secret=root/'.local/postgres-password'
def docker(*args,check=True):
    return subprocess.run(['docker',*args],check=check,capture_output=True,text=True)
def ready():
    for _ in range(60):
        # The official entrypoint starts a socket-only temporary init server.
        # Probe TCP so readiness cannot race its shutdown and final startup.
        result=docker('exec',name,'pg_isready','-h',name,'-U','aegisgate_local','-d','aegisgate_local',check=False)
        if result.returncode==0:return
        time.sleep(.25)
    raise RuntimeError('Private fresh Postgres fixture failed readiness; no credentials logged')
def sql(statement,valid=True):
    password='$(cat /run/secrets/postgres-password)' if valid else 'unsafe-wrong-fixture'
    command='PGPASSWORD='+password+' psql -h '+name+' -U aegisgate_local -d aegisgate_local -v ON_ERROR_STOP=1 -tAc "$1"'
    return docker('exec',name,'sh','-c',command,'local-pg-check',statement,check=valid)
try:
    docker('run','-d','--name',name,'--network','aegisgate-local_lab',
           '-e','POSTGRES_DB=aegisgate_local','-e','POSTGRES_USER=aegisgate_local',
           '-e','POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password',
           '--mount','type=bind,src='+str(secret)+',dst=/run/secrets/postgres-password,readonly',image)
    ready()
    sql('CREATE TABLE foundation_restart_check(id integer PRIMARY KEY); INSERT INTO foundation_restart_check VALUES(1);')
    assert sql('SELECT count(*) FROM foundation_restart_check').stdout.strip()=='1'
    denied=sql('SELECT 1',valid=False)
    assert denied.returncode!=0 and 'password authentication failed' in denied.stderr,'Invalid password accepted'
    docker('stop','--time','5',name)
    docker('start',name)
    ready()
    assert sql('SELECT count(*) FROM foundation_restart_check').stdout.strip()=='1','Persisted data lost on entrypoint restart'
    denied=sql('SELECT 1',valid=False)
    assert denied.returncode!=0 and 'password authentication failed' in denied.stderr,'Restart bypassed password auth'
    print('PASS: exact local Postgres image fresh initialization, su-exec UID drop, persisted-volume restart and password positive/negative; no public port')
finally:
    docker('rm','--force','--volumes',name,check=False)
