import datetime, hashlib, io, json, pathlib, subprocess, sys, tarfile, urllib.request
out=pathlib.Path(sys.argv[1]); assert not out.exists(); out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(["git",*a],text=True).strip()
assert not git("status","--porcelain","--untracked-files=no")
r={"source_commit":git("rev-parse","HEAD"),"source_tree":git("rev-parse","HEAD^{tree}"),"argv":sys.argv,"python":sys.version,"started_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"fetches":[],"commands":[]}
def get(url,save=None):
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"AegisGate-bounded-source-research"}),timeout=45) as response: b=response.read(12*1024*1024+1); status=response.status
 assert len(b)<=12*1024*1024
 if save: (out/save).write_bytes(b)
 r["fetches"].append({"url":url,"http_status":status,"started_at":started,"ended_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"bytes":len(b),"sha256":sha(b),"raw_file":save,"note":None if save else "Archive not retained; selected unmodified members retained below"})
 return b
try:
 checksum=get("https://www.haproxy.org/download/3.4/src/haproxy-3.4.7.tar.gz.sha256","release.sha256")
 archive=get("https://www.haproxy.org/download/3.4/src/haproxy-3.4.7.tar.gz")
 assert sha(archive)==checksum.decode().split()[0]
 with tarfile.open(fileobj=io.BytesIO(archive),mode="r:gz") as t:
  r["members"]=[]
  for name in ["src/h1.c","include/haproxy/h1-t.h","VERSION"]:
   b=t.extractfile("haproxy-3.4.7/"+name).read(); dest=name.replace("/","_"); (out/dest).write_bytes(b)
   r["members"].append({"member":name,"file":dest,"bytes":len(b),"sha256":sha(b)})
  config=t.extractfile("haproxy-3.4.7/doc/configuration.txt").read().decode()
  r["configuration_sha256"]=sha(config.encode())
  lines=config.splitlines(); chunks=[]
  for needle in ["option accept-invalid-http-request", "ssl_fc_sni", "send-proxy-v2-ssl-cn", "verify required", "http-reuse", "alpn", "http-hardening"]:
   matches=[i for i,l in enumerate(lines) if l.strip().startswith(needle)]
   r.setdefault("configuration_search",[]).append({"needle":needle,"line_numbers":[i+1 for i in matches]})
   if matches:
    i=matches[-1];chunks.append("\n".join(f"{j+1}: {lines[j]}" for j in range(max(0,i-2),min(len(lines),i+35))))
  (out/"configuration-excerpts.txt").write_text("\n\n".join(chunks)+"\n")
 for label,args in [("immutable75",["/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node","spikes/edge-comparison/extract-baseline.mjs","--check"]),("whitespace",["git","diff","--check","a325b9e","HEAD","--","docs","evidence/sprint04c-c/collect.py"])]:
  p=subprocess.run(args,capture_output=True); record={"label":label,"argv":args,"exit_code":p.returncode,"streams":[]}
  for stream in ["stdout","stderr"]:
   b=getattr(p,stream); f=label+"."+stream;(out/f).write_bytes(b);record["streams"].append({"file":f,"bytes":len(b),"sha256":sha(b)})
  r["commands"].append(record);assert p.returncode==0
 r["exit_code"]=0
except Exception as e:r["error"]=repr(e);r["exit_code"]=1
finally:
 r["ended_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat();(out/"receipt.json").write_text(json.dumps(r,indent=2)+"\n")
 (out/"SHA256SUMS").write_text("".join(sha(f.read_bytes())+"  "+str(f)+"\n" for f in sorted(out.iterdir()) if f.name!="SHA256SUMS"))
 print(json.dumps({"output":str(out),"exit_code":r["exit_code"],"error":r.get("error")}))
 sys.exit(r["exit_code"])
