import datetime,hashlib,json,pathlib,shutil,subprocess,sys
root=pathlib.Path.cwd();out=root/sys.argv[1];assert not out.exists();out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest();git=lambda cwd,*a:subprocess.check_output(['git',*a],cwd=cwd,text=True).strip()
assert not git(root,'status','--porcelain','--untracked-files=no')
r={'source_commit':git(root,'rev-parse','HEAD'),'source_tree':git(root,'rev-parse','HEAD^{tree}'),'argv':sys.argv,'python':sys.version,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'receipts':[],'commands':[]}
try:
 for owner,attempts in [('b',['upstream-01','reproh-01','reprot-01','reprot-02','checks-01']),('d',['attempt-01','verification-02'])]:
  cwd=pathlib.Path('/tmp/aegisgate-04c-'+owner)
  for attempt in attempts:
   file=cwd/'evidence'/('sprint04c-'+owner)/attempt/'commands.json';j=json.loads(file.read_text());assert git(cwd,'rev-parse',j['source_commit']+'^{tree}')==j['source_tree'];sources=0;streams=0
   for source in j.get('sources',[])+j.get('immutable',[]):
    raw=subprocess.check_output(['git','show',j['source_commit']+':'+source['file']],cwd=cwd);assert sha(raw)==source['sha256'];sources+=1
   for c in j['commands']:
    assert c['exit_code']==0 and c['signal'] is None
    for s in c.get('streams',[c['stdout'],c['stderr']] if 'stdout' in c else []):
     assert sha((cwd/s['file']).read_bytes())==s['sha256'];streams+=1
   r['receipts'].append({'owner':owner,'attempt':attempt,'source_commit':j['source_commit'],'source_tree':j['source_tree'],'verified_sources':sources,'verified_commands':len(j['commands']),'verified_streams':streams})
 # Copy only the validated owned additions into a bounded scanner input tree.
 stage=root/'.local/f-owned';assert not stage.exists();stage.mkdir(parents=True)
 total=0;count=0
 for owner in ['a','b','c','d','e']:
  cwd=pathlib.Path('/tmp/aegisgate-04c-'+owner)
  for file in git(cwd,'diff','--name-only','a325b9e','HEAD').splitlines():
   raw=(cwd/file).read_bytes();dest=stage/owner/file;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw);total+=len(raw);count+=1
 r['scan_input']={'files':count,'bytes':total,'scope':'All changed A-E files, validated exact source before staging'}
 image='ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'
 argv=['docker','run','--rm','--network','none','-v',str(stage)+':/input:ro','-v',str(root/'.github/gitleaks.toml')+':/config:ro','-v',str(out)+':/reports',image,'dir','/input','--config','/config','--redact','--report-format','json','--report-path','/reports/secrets.json','--no-banner']
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,capture_output=True,timeout=90)
 row={'argv':argv,'started_at':start,'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':p.returncode,'streams':[]}
 for stream in ['stdout','stderr']:
  raw=getattr(p,stream);f='secrets.'+stream;(out/f).write_bytes(raw);row['streams'].append({'file':f,'sha256':sha(raw)})
 r['commands'].append(row);assert p.returncode==0 and json.loads((out/'secrets.json').read_text())==[]
 shutil.rmtree(stage);r['scanner_stage_removed']=True;r['exit_code']=0
except Exception as e:r['error']=repr(e);r['exit_code']=1
finally:
 r['ended_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'verification.json').write_text(json.dumps(r,indent=2)+'\n')
 (out/'SHA256SUMS').write_text(''.join(sha(f.read_bytes())+'  '+str(f.relative_to(root))+'\n' for f in sorted(out.iterdir()) if f.name!='SHA256SUMS'))
 print(json.dumps({'exit_code':r['exit_code'],'error':r.get('error'),'receipts':len(r['receipts'])}));sys.exit(r['exit_code'])
