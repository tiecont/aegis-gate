"""Compare the resolved registry trees with exact-lock published archives."""
import hashlib
import json
from pathlib import Path
import sys
import tarfile
import tomllib

metadata = json.load(sys.stdin)
root = Path(sys.argv[1])
with (root / "spikes/hyper/Cargo.lock").open("rb") as source:
    locked = tomllib.load(source)
checksums = {(p["name"], p["version"]): p.get("checksum") for p in locked["package"]}
rows = []
for package in metadata["packages"]:
    if not package["source"]:
        continue
    folder = Path(package["manifest_path"]).parent
    prefix = f'{package["name"]}-{package["version"]}'
    archive = root / ".local/cargo-home/registry/cache" / folder.parent.name / f"{prefix}.crate"
    archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
    expected = checksums[(package["name"], package["version"])]
    mismatches = []
    names = set()
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle.getmembers():
            if member.isdir():
                continue
            parts = Path(member.name).parts
            if not member.isfile() or parts[0] != prefix or ".." in parts:
                raise ValueError("unexpected registry archive entry")
            relative = Path(*parts[1:])
            names.add(str(relative))
            published = bundle.extractfile(member).read()
            actual = folder / relative
            if not actual.is_file() or actual.is_symlink() or actual.read_bytes() != published:
                mismatches.append(str(relative))
    extras = sorted(str(p.relative_to(folder)) for p in folder.rglob("*")
                    if p.is_file() and str(p.relative_to(folder)) not in names
                    and p.name not in {".cargo-ok", ".cargo-checksum.json"})
    rows.append({"name": package["name"], "version": package["version"],
                 "files_checked": len(names), "mismatches": mismatches, "extra_files": extras,
                 "package_checksum": expected, "archive_sha256": archive_hash,
                 "archive_matches": archive_hash == expected})
print(json.dumps(rows))
