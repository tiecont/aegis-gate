"""Read-only recheck of the previously retained registry provenance."""
import hashlib
import json
from pathlib import Path
import tarfile
import tomllib

root = Path.cwd()
evidence = root / "evidence/sprint04a-c"
provenance = json.loads((evidence / "registry-provenance.json").read_bytes())
metadata = json.loads((evidence / "local/pingora-metadata.stdout.txt").read_bytes())
folders = {(p["name"], p["version"]): Path(p["manifest_path"]).parent
           for p in metadata["packages"]}
with (root / "spikes/pingora/Cargo.lock").open("rb") as stream:
    locked = {(p["name"], p["version"]): p.get("checksum")
              for p in tomllib.load(stream)["package"]}
rows = []
for package in provenance["packages"]:
    identity = (package["name"], package["version"])
    archive = Path(package["archive"])
    checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
    assert checksum == package["archive_sha256"] == locked[identity], identity
    count = 0
    with tarfile.open(archive, "r:gz") as bundle:
        prefix = "-".join(identity)
        for member in bundle.getmembers():
            if member.isdir():
                continue
            parts = Path(member.name).parts
            assert member.isfile() and parts[0] == prefix and ".." not in parts
            relative = Path(*parts[1:])
            actual = folders[identity] / relative
            assert not actual.is_symlink() and actual.is_file(), str(actual)
            assert actual.read_bytes() == bundle.extractfile(member).read(), str(actual)
            count += 1
    assert count == package["files_checked"], identity
    for retained in package["retained"]:
        assert hashlib.sha256((evidence / retained["file"]).read_bytes()).hexdigest() == retained["sha256"]
    rows.append({"name": identity[0], "version": identity[1],
                 "archive_sha256": checksum, "files_checked": count})
assert len(rows) == 7
print(json.dumps({"packages": rows, "files_checked": sum(r["files_checked"] for r in rows),
                  "mismatches": 0, "archive_lock_matches": True}, indent=2))
