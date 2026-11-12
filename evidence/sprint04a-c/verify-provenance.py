"""Bind inspected registry sources to locked published archives without editing them."""
import hashlib
import json
from pathlib import Path
import subprocess
import tarfile
import tomllib
from datetime import datetime, timezone

root = Path.cwd()
output = root / "evidence/sprint04a-c"
metadata = json.loads((output / "local/pingora-metadata.stdout.txt").read_bytes())
with (root / "spikes/pingora/Cargo.lock").open("rb") as source:
    lock = tomllib.load(source)
locked = {(p["name"], p["version"]): p.get("checksum") for p in lock["package"]}
selected = {
    "pingora-core": ["Cargo.toml", "src/protocols/http/v1/server.rs", "src/upstreams/peer.rs",
                     "src/server/configuration/mod.rs", "src/server/mod.rs", "src/apps/mod.rs"],
    "pingora-load-balancing": ["Cargo.toml", "src/lib.rs"],
    "serde_yaml": ["Cargo.toml", "src/lib.rs"],
    "unsafe-libyaml": ["Cargo.toml", "src/lib.rs"],
    "derivative": ["Cargo.toml", "src/lib.rs"],
    "httparse": ["Cargo.toml", "src/lib.rs"],
    "http": ["Cargo.toml", "src/uri/path.rs"],
}
rows = []
for package in metadata["packages"]:
    if package["name"] not in selected:
        continue
    folder = Path(package["manifest_path"]).parent
    prefix = f'{package["name"]}-{package["version"]}'
    archive = folder.parent.parent.parent / "cache" / folder.parent.name / f"{prefix}.crate"
    archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    mismatches, retained = [], []
    count = 0
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle.getmembers():
            if member.isdir():
                continue
            parts = Path(member.name).parts
            if not member.isfile() or parts[0] != prefix or ".." in parts:
                raise ValueError("unexpected archive entry")
            relative = Path(*parts[1:])
            published = bundle.extractfile(member).read()
            actual = folder / relative
            count += 1
            if actual.is_symlink() or not actual.is_file() or actual.read_bytes() != published:
                mismatches.append(str(relative))
            if str(relative) in selected[package["name"]]:
                target = output / "registry" / prefix / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(published)
                retained.append({"file": str(target.relative_to(output)),
                                 "sha256": hashlib.sha256(published).hexdigest()})
    rows.append({"name": package["name"], "version": package["version"],
                 "registry_source": package["source"], "archive": str(archive),
                 "download_url": f'https://static.crates.io/crates/{package["name"]}/{prefix}.crate',
                 "archive_sha256": archive_hash,
                 "lock_checksum": locked[(package["name"], package["version"])],
                 "files_checked": count, "mismatches": mismatches, "retained": retained})
receipt = {"recorded_at": datetime.now(timezone.utc).isoformat(),
           "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
           "command": ["python3", "evidence/sprint04a-c/verify-provenance.py"], "packages": rows}
(output / "registry-provenance.json").write_text(json.dumps(receipt, indent=2) + "\n")
assert all(not r["mismatches"] and r["archive_sha256"] == r["lock_checksum"] for r in rows)
print(json.dumps({"packages": len(rows), "files_checked": sum(r["files_checked"] for r in rows),
                  "mismatches": 0, "archive_lock_matches": True}))
