import datetime,hashlib,io,json,pathlib,re,subprocess,sys,tarfile,urllib.request
root=pathlib.Path.cwd();out=root/sys.argv[1];assert not out.exists();out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda cwd,*a:subprocess.check_output(['git',*a],cwd=cwd,text=True).strip()
assert not git(root,'status','--porcelain','--untracked-files=no')
r={'reviewer_commit':git(root,'rev-parse','HEAD'),'reviewer_tree':git(root,'rev-parse','HEAD^{tree}'),'argv':sys.argv,'python':sys.version,'python_sha256':sha(pathlib.Path(sys.executable).read_bytes()),'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'owners':[],'commands':[],'fetches':[]}
def tree(cwd,ref):
 return {line.split('\t',1)[1]:line.split('\t',1)[0] for line in subprocess.check_output(['git','ls-tree','-r',ref],cwd=cwd,text=True).splitlines()}
def run(label,argv,cwd=root):
 started=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=cwd,capture_output=True,timeout=240);row={'label':label,'argv':argv,'cwd':str(cwd),'started_at':started,'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':p.returncode,'streams':[]}
 for name in ['stdout','stderr']:
  b=getattr(p,name);f=label+'.'+name;(out/f).write_bytes(b);row['streams'].append({'file':f,'sha256':sha(b),'bytes':len(b)})
 r['commands'].append(row);assert p.returncode==0,label
 return p.stdout
try:
 baseline=tree(root,'a325b9e')
 for owner,cwd,revision,allowed in [
 ('A',pathlib.Path('/tmp/aegisgate-04c-a'),'dbc83509217b17f50df8680a5a54e3bd3622a406',r'^(docs/(reports/sprint04c-(a-architecture|human-approval-checklist)|ADR-012-sprint04c-decision-addendum-proposed)\.md|evidence/sprint04c-a/)'),
 ('C',pathlib.Path('/tmp/aegisgate-04c-c'),'7b20cf3a61c26caa170f8e3f7ec28f256653e5b9',r'^(docs/reports/sprint04c-c-alternatives\.md|evidence/sprint04c-c/)'),
 ('E',pathlib.Path('/tmp/aegisgate-04c-e'),'551591395880ce87863b4e861c05d266c719b91f',r'^(docs/reports/sprint04c-e-regressions\.md|evidence/sprint04c-e/)')]:
  assert git(cwd,'rev-parse','HEAD')==revision;assert not git(cwd,'status','--porcelain','--untracked-files=no')
  current=tree(cwd,revision);assert all(current.get(f)==blob for f,blob in baseline.items())
  changes=git(cwd,'diff','--name-only','a325b9e',revision).splitlines();assert all(re.match(allowed,f) for f in changes)
  files=[];manifests=[]
  for f in changes:
   b=(cwd/f).read_bytes();assert b==subprocess.check_output(['git','show',revision+':'+f],cwd=cwd);files.append({'file':f,'sha256':sha(b),'bytes':len(b)})
   if f.endswith('/SHA256SUMS'):
    count=0
    for line in b.decode().splitlines():
     expected,p=line.split('  ',1);target=cwd/p if '/' in p else (cwd/f).parent/p
     assert sha(target.read_bytes())==expected,(f,p);count+=1
    manifests.append({'file':f,'entries':count})
  r['owners'].append({'owner':owner,'revision':revision,'tree':git(cwd,'rev-parse',revision+'^{tree}'),'baseline_unchanged_objects':len(baseline),'files':files,'manifests':manifests})
  run('immutable75-'+owner,['/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node','spikes/edge-comparison/extract-baseline.mjs','--check'],cwd)
  run('whitespace-'+owner,['git','diff','--check','a325b9e',revision,'--','docs',*([f for f in changes if f.endswith(('.py','.mjs'))])],cwd)
 # Fresh official archive retrieval independent of C's collector. Archive remains in memory only.
 for label,url in [('checksum','https://www.haproxy.org/download/3.4/src/haproxy-3.4.7.tar.gz.sha256'),('archive','https://www.haproxy.org/download/3.4/src/haproxy-3.4.7.tar.gz')]:
  started=datetime.datetime.now(datetime.timezone.utc).isoformat()
  with urllib.request.urlopen(url,timeout=60) as response:b=response.read(12*1024*1024+1);status=response.status
  assert len(b)<=12*1024*1024
  r['fetches'].append({'label':label,'url':url,'status':status,'bytes':len(b),'sha256':sha(b),'started_at':started,'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
  if label=='checksum':expected=b.decode().split()[0];(out/'haproxy-checksum.txt').write_bytes(b)
  else:archive=b
 assert sha(archive)==expected=='ccfd342f3724c2cd659574044d788f44e20b212467c6bd5edbbfc517a2775dca'
 with tarfile.open(fileobj=io.BytesIO(archive),mode='r:gz') as t:
  h=t.extractfile('haproxy-3.4.7/src/h1.c').read();assert h==pathlib.Path('/tmp/aegisgate-04c-c/evidence/sprint04c-c/source-02/src_h1.c').read_bytes()
  r['haproxy_h1_sha256']=sha(h);r['haproxy_header_fold_normalization']={needle:needle in h.decode() for needle in ['H1_MSG_HDR_L1_LWS','H1_MSG_HDR_L2_LWS','replace HT,CR,LF with spaces']};assert all(r['haproxy_header_fold_normalization'].values())
  config=t.extractfile('haproxy-3.4.7/doc/configuration.txt').read();c=json.loads(pathlib.Path('/tmp/aegisgate-04c-c/evidence/sprint04c-c/source-02/receipt.json').read_text());assert sha(config)==c['configuration_sha256']
  for keyword in [b'ssl_fc_sni',b'send-proxy-v2-ssl-cn',b'http-reuse',b'alpn',b'verify required']:assert keyword in config
  r['haproxy_config_sha256']=sha(config)
 # Independent audit of E receipts and actual recovery/security-negative execution in reviewer's source.
 run('E-audit',['flock','/tmp/aegisgate-sprint02-fixtures.lock','python3','evidence/sprint04c-e/verify.py','/tmp/aegisgate-04c-f-e-audit.json','--audit-only'],pathlib.Path('/tmp/aegisgate-04c-e'))
 go='/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go'
 run('go-version',[go,'version'])
 run('independent-recovery',['flock','/tmp/aegisgate-sprint02-fixtures.lock',go,'test','-race','-v','./internal/configconsumer','./internal/configpublish','-run','Recovery|Negative','-count=1'])
 r['verdict']='ACCEPT A proposed decision, C scoped source/design NO-GO, E local regressions only';r['exit_code']=0
except Exception as e:r['error']=repr(e);r['exit_code']=1
finally:
 r['ended_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'verification.json').write_text(json.dumps(r,indent=2)+'\n')
 (out/'SHA256SUMS').write_text(''.join(sha(f.read_bytes())+'  '+str(f.relative_to(root))+'\n' for f in sorted(out.iterdir()) if f.name!='SHA256SUMS'))
 print(json.dumps({'output':str(out),'exit_code':r['exit_code'],'error':r.get('error'),'verdict':r.get('verdict')}));sys.exit(r['exit_code'])
