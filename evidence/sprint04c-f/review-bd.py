import copy,datetime,hashlib,json,os,pathlib,re,subprocess,sys
root=pathlib.Path.cwd();out=root/sys.argv[1];assert not out.exists();out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda cwd,*a:subprocess.check_output(['git',*a],cwd=cwd,text=True).strip()
assert not git(root,'status','--porcelain','--untracked-files=no')
r={'reviewer_commit':git(root,'rev-parse','HEAD'),'reviewer_tree':git(root,'rev-parse','HEAD^{tree}'),'argv':sys.argv,'python':sys.version,'python_sha256':sha(pathlib.Path(sys.executable).read_bytes()),'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'owners':[],'commands':[],'upstream':[],'adversarial':[]}
node='/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node';go='/home/tiecont/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.27.4.linux-amd64/bin/go'
env={**os.environ,'PATH':str(pathlib.Path(go).parent)+':'+str(pathlib.Path(node).parent)+':'+os.environ['PATH'],'GOTOOLCHAIN':'go1.27.4'}
def tree(cwd,ref):
 return {line.split('\t',1)[1]:line.split('\t',1)[0] for line in subprocess.check_output(['git','ls-tree','-r',ref],cwd=cwd,text=True).splitlines()}
def run(label,argv,cwd=root,data=None,reference=None):
 started=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=cwd,capture_output=True,input=data,env=env,timeout=240);row={'label':label,'argv':argv,'cwd':str(cwd),'started_at':started,'ended_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit_code':p.returncode,'streams':[]}
 if data is not None:row.update(stdin_hex=data.hex(),stdin_sha256=sha(data))
 for name in ['stdout','stderr']:
  b=getattr(p,name)
  if reference is not None and name=='stdout':
   assert b==pathlib.Path(reference).read_bytes(),label;row['streams'].append({'retained_reference':str(reference),'sha256':sha(b),'bytes':len(b)})
  else:
   f=label+'.'+name;(out/f).write_bytes(b);row['streams'].append({'file':f,'sha256':sha(b),'bytes':len(b)})
 r['commands'].append(row);assert p.returncode==0,label
 return p.stdout
try:
 baseline=tree(root,'a325b9e');owners=[('B',pathlib.Path('/tmp/aegisgate-04c-b'),'12abd255b754b553480544edbf9452b7f65d9a4d',r'^(docs/reports/sprint04c-b-upstream\.md|evidence/sprint04c-b/|spikes/envoy/sprint04c-(upstream|repro))'),('D',pathlib.Path('/tmp/aegisgate-04c-d'),'d9a2004167a178a3a1d4549cc97378fe4b02c360',r'^(docs/reports/sprint04c-d-protocol\.md|evidence/sprint04c-d/|spikes/envoy/sprint04c-(attribution|observer|protocol|run|verify))')]
 for owner,cwd,revision,allowed in owners:
  assert git(cwd,'rev-parse','HEAD')==revision;assert not git(cwd,'status','--porcelain','--untracked-files=no')
  current=tree(cwd,revision);assert all(current.get(f)==blob for f,blob in baseline.items())
  changes=git(cwd,'diff','--name-only','a325b9e',revision).splitlines();assert all(re.match(allowed,f) for f in changes)
  files=[];manifests=[]
  for f in changes:
   b=(cwd/f).read_bytes();assert b==subprocess.check_output(['git','show',revision+':'+f],cwd=cwd);files.append({'file':f,'sha256':sha(b),'bytes':len(b)})
   if f.endswith('/SHA256SUMS'):
    count=0
    for line in b.decode().splitlines():
     expected,p=line.split('  ',1);target=cwd/p if '/' in p else (cwd/f).parent/p;assert sha(target.read_bytes())==expected,(f,p);count+=1
    manifests.append({'file':f,'entries':count})
  r['owners'].append({'owner':owner,'revision':revision,'tree':git(cwd,'rev-parse',revision+'^{tree}'),'baseline_unchanged_objects':len(baseline),'files':files,'manifests':manifests})
  run('immutable75-'+owner,[node,'spikes/edge-comparison/extract-baseline.mjs','--check'],cwd)
  run('whitespace-'+owner,['git','diff','--check','a325b9e',revision,'--','docs','spikes/envoy/sprint04c-*'],cwd)
 b=pathlib.Path('/tmp/aegisgate-04c-b');d=pathlib.Path('/tmp/aegisgate-04c-d')
 # Independently refresh stable release/tag provenance, then all19 immutable released source files.
 prior=json.loads((b/'evidence/sprint04c-b/upstream-01/commands.json').read_text())
 run('gh-version',['gh','--version']);run('curl-version',['curl','--version']);run('go-version',[go,'version']);run('node-version',[node,'--version'])
 for project in prior['projects']:
  name=project['name'];repo=project['repo']
  release=json.loads(run('release-'+name,['gh','api','repos/'+repo+'/releases/latest']));assert not release['draft'] and not release['prerelease'] and release['tag_name']==project['tag']
  commit=json.loads(run('commit-'+name,['gh','api','repos/'+repo+'/commits/'+release['tag_name']]));assert commit['sha']==project['revision']
  checked=[]
  for i,file in enumerate(project['files']):
   url='https://raw.githubusercontent.com/'+repo+'/'+commit['sha']+'/'+file['file'];reference=b/file['retained']
   raw=run(name+'-source-'+str(i),['curl','--fail','--silent','--show-error','--location','--proto','=https','--proto-redir','=https','--tlsv1.2','--connect-timeout','10','--max-time','45',url],reference=reference)
   assert sha(raw)==file['sha256'];checked.append({'file':file['file'],'sha256':sha(raw)})
  r['upstream'].append({'project':name,'tag':release['tag_name'],'revision':commit['sha'],'files':checked})
 # Independent observation audit, distinct from runtime reproduction.
 h1=json.loads((b/'evidence/sprint04c-b/reproh-01/commands.json').read_text());assert len(h1['probes'])==29 and h1['completed_observations']
 for p in h1['probes']:
  assert p['identity']['authorized'] and p['identity']['alpn']=='http/1.1' and not p['timed_out']
  assert p['request_utf8'].encode().hex()==p['request_hex'];assert p['response_utf8'].encode().hex()==p['response_hex'];assert len(bytes.fromhex(p['origin']['decrypted_hex']))==p['origin']['decrypted_bytes']
 te=[p for p in h1['probes'] if re.match(r'^(malformed-HTTP-invalid-transfer-encoding|strict-ingress-TE-|supplemental-repeated-transfer-encoding-fields)',p['name'])];assert len(te)==16
 for p in te:
  assert p['peer_end'] and not p['client_sent_fin'];assert p['status'][-1]==(501 if p['listener']=='default' else 400)
  assert p['origin']['decrypted_bytes']==p['origin']['new_connections']==p['origin']['parser_errors']==p['origin']['transport_errors']==0 and not p['origin']['handlers']
 r['B_partial_TE_audited']=16
 # F's independent adversarial CLI inputs, not just the owner's test expectations.
 (root/'.local/bin').mkdir(parents=True,exist_ok=True);binary=str(root/'.local/bin/sprint04c-decoder-F')
 run('decoder-build',[go,'build','-o',binary,'./spikes/envoy/sprint04c-attribution'],d);r['decoder_binary_sha256']=sha(pathlib.Path(binary).read_bytes())
 run('D-owner-adversarial-and-relay',['flock','/tmp/aegisgate-sprint02-fixtures.lock',node,'--test','spikes/envoy/sprint04c-observer.test.mjs'],d)
 def frame(kind,flags,stream,payload=b''):return len(payload).to_bytes(3,'big')+bytes([kind,flags])+stream.to_bytes(4,'big')+payload
 pre=b'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n'
 def fixture(wire):return {'connection':'F-synthetic-1','hex':wire.hex(),'total_bytes':len(wire),'dropped_bytes':0,'client_preface':True,'capture_closed':True,'dial_observed':True,'identity_complete':True,'verified_sni':'lab-origin.test','tenant':'A','generation':7,'links':[{'upstream_stream':1,'downstream_stream':3,'downstream_connection':'F-down-1','rejected':False,'tenant':'A','generation':7}]}
 cases=[]
 c=fixture(pre+frame(1,4,1,b'\x82\x84'));c['links'][0]['rejected']=True;cases.append(('forbidden-HEADERS',c,'violations','rejected request emitted HEADERS'))
 c=fixture(pre+frame(1,4,1,b'\x20'));c['links'][0]['rejected']=True;cases.append(('HPACK-state-only',c,'violations','rejected request emitted HEADERS'))
 c=fixture(pre+frame(1,4,1,b'\x82\x84')[:-1]);c['links'][0]['rejected']=True;cases.append(('partial-HEADERS-no-handler',c,'incomplete','frame decoding failed'))
 c=fixture(pre);c['new_connection']=True;c['rejection_caused_dial']=True;c['links']=[];cases.append(('new-dial-no-handler',c,'violations','origin dial'))
 c=fixture(pre+frame(0,1,1,b'leaked'));c['links'][0]['rejected']=True;cases.append(('DATA-reused-stream',c,'violations','rejected request emitted DATA'))
 c=fixture(pre+frame(1,0,1,b'\x40')+frame(4,1,0));cases.append(('interleaved-CONTINUATION',c,'incomplete','frame decoding failed'))
 c=fixture(pre+frame(4,1,0));c['dropped_bytes']=1;cases.append(('dropped-capture',c,'incomplete','lost/truncated'))
 c=fixture(pre+frame(0,1,1,b'x'));c['links']=[];cases.append(('unmapped-stream',c,'incomplete','unattributed'))
 c=fixture(pre+frame(0,1,1,b'x'));c['links'][0]['tenant']='B';cases.append(('forged-tenant-map',c,'violations','tenant/generation'))
 c=fixture(pre+frame(1,4,1,b'\x40\x01x\x01v')+frame(1,4,1,b'\xbe'));cases.append(('stateful-dynamic-index',c,None,None))
 c=fixture(pre+frame(4,1,0)+frame(6,0,0,b'12345678')+frame(8,0,0,b'\x00\x00\x00\x01'));cases.append(('valid-existing-control',c,None,None))
 for label,c,field,word in cases:
  result=json.loads(run('F-fixture-'+label,['flock','/tmp/aegisgate-sprint02-fixtures.lock',binary],data=json.dumps(c).encode()))
  assert result['semantic_security_pass'] is False
  if field:assert word in ';'.join(result[field]),(label,result)
  else:assert result['capture_complete'] and not result['violations'],label
  if label=='stateful-dynamic-index':assert result['events'][1]['decoded_fields'][0]['Value']=='v'
  r['adversarial'].append({'fixture':label,'capture_complete':result['capture_complete'],'violations':result['violations'],'incomplete':result['incomplete'],'semantic_security_pass':result['semantic_security_pass']})
 # Root helper source is exactly the already reviewed04B helper with new namespace identifiers.
 old=subprocess.check_output(['git','show','a325b9e:scripts/sprint04b-gates.mjs']).decode();new=subprocess.check_output(['git','show','e090f59:scripts/sprint04c-gates.mjs']).decode()
 assert old.replace('sprint04b-root','sprint04c-root').replace('aegisgate-04b-root','aegisgate-04c-root')==new;r['root_helper_scoped_equivalence']=True
 r['exit_code']=0;r['verdict']='ACCEPT B upstream stop and audited partial proof; ACCEPT D bounded incomplete diagnostic observer only'
except Exception as e:r['error']=repr(e);r['exit_code']=1
finally:
 r['ended_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/'verification.json').write_text(json.dumps(r,indent=2)+'\n')
 (out/'SHA256SUMS').write_text(''.join(sha(f.read_bytes())+'  '+str(f.relative_to(root))+'\n' for f in sorted(out.iterdir()) if f.name!='SHA256SUMS'))
 print(json.dumps({'output':str(out),'exit_code':r['exit_code'],'error':r.get('error'),'verdict':r.get('verdict')}));sys.exit(r['exit_code'])
