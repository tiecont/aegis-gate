import datetime, hashlib, json, pathlib, subprocess, sys
out=pathlib.Path(sys.argv[1]);assert not out.exists();out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(["git",*a],text=True).strip()
assert not git("status","--porcelain","--untracked-files=no")
r={"source_commit":git("rev-parse","HEAD"),"source_tree":git("rev-parse","HEAD^{tree}"),"argv":sys.argv,"python":sys.version,"started_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"commands":[],"documents":[]}
file="docs/reports/sprint04c-c-alternatives.md";b=pathlib.Path(file).read_bytes();assert b==subprocess.check_output(["git","show","HEAD:"+file]);r["documents"].append({"file":file,"sha256":sha(b)})
for attempt in ["source-01","source-02"]:
 for line in pathlib.Path("evidence/sprint04c-c",attempt,"SHA256SUMS").read_text().splitlines():
  expected,file=line.split("  ",1);assert sha(pathlib.Path(file).read_bytes())==expected
for name,args in [("immutable75",["/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node","spikes/edge-comparison/extract-baseline.mjs","--check"]),("whitespace",["git","diff","--check","a325b9e","HEAD","--","docs","evidence/sprint04c-c/collect.py","evidence/sprint04c-c/verify.py"]),("protected",["git","diff","--exit-code","a325b9e","HEAD","--","spikes/edge-comparison","spikes/envoy/lab.mjs","spikes/pingora/lab.mjs","docs/THREAT_MODEL.md","docs/QUALITY_GATES.md"])]:
 p=subprocess.run(args,capture_output=True);row={"label":name,"argv":args,"exit_code":p.returncode,"streams":[]}
 for stream in ["stdout","stderr"]:
  b=getattr(p,stream);f=name+"."+stream;(out/f).write_bytes(b);row["streams"].append({"file":f,"sha256":sha(b)})
 r["commands"].append(row)
r["exit_code"]=int(any(c["exit_code"] for c in r["commands"]));r["ended_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
(out/"receipt.json").write_text(json.dumps(r,indent=2)+"\n")
(out/"SHA256SUMS").write_text("".join(sha(f.read_bytes())+"  "+str(f)+"\n" for f in sorted(out.iterdir()) if f.name!="SHA256SUMS"))
print(json.dumps({"output":str(out),"exit_code":r["exit_code"]}));sys.exit(r["exit_code"])
