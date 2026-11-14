import datetime, hashlib, json, pathlib, subprocess, sys
out=pathlib.Path(sys.argv[1]); argv=sys.argv[2:];assert not out.exists() and argv;out.mkdir(parents=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
git=lambda *a:subprocess.check_output(["git",*a],text=True).strip()
assert not git("status","--porcelain","--untracked-files=no")
r={"source_commit":git("rev-parse","HEAD"),"source_tree":git("rev-parse","HEAD^{tree}"),"argv":argv,"collector_argv":sys.argv,"python":sys.version,"cwd":str(pathlib.Path.cwd()),"started_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"tool_versions":{},"streams":[]}
for tool,args in [("gh",["gh","--version"]),("git",["git","--version"]),("node",["/home/tiecont/Projects/aegis-gate/.local/toolchains/node/bin/node","--version"])]:
 r["tool_versions"][tool]=subprocess.check_output(args,text=True).strip()
p=subprocess.run(argv,capture_output=True,timeout=180)
r.update(exit_code=p.returncode,ended_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
for stream in ["stdout","stderr"]:
 b=getattr(p,stream);file=stream+".log";(out/file).write_bytes(b);r["streams"].append({"file":file,"sha256":sha(b),"bytes":len(b)})
(out/"receipt.json").write_text(json.dumps(r,indent=2)+"\n")
(out/"SHA256SUMS").write_text("".join(sha(f.read_bytes())+"  "+str(f)+"\n" for f in sorted(out.iterdir()) if f.name!="SHA256SUMS"))
print(json.dumps({"output":str(out),"exit_code":p.returncode}));sys.exit(p.returncode)
