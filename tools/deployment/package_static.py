#!/usr/bin/env python3
"""Package a built subpath app into independent, bounded upload archives."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dist", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--base", default="/duetblox/")
    parser.add_argument("--max-mib", type=int, default=80)
    args = parser.parse_args()
    base = args.base
    parts = base.strip("/").split("/")
    if (not base.startswith("/") or not base.endswith("/") or
            any(not p or p in (".", "..") or not all(c.isalnum() or c in "-_" for c in p) for p in parts)):
        parser.error("--base must be a non-root directory path such as /duetblox/")
    root = args.dist.resolve(strict=True)
    output = args.output.resolve()
    if output == root or root in output.parents:
        parser.error("output must be outside dist")
    if not 1 <= args.max_mib <= 1000:
        parser.error("--max-mib must be between 1 and 1000")
    manifest = json.loads((root / "offline-manifest.json").read_text())
    if not all(f["url"].startswith(base) for f in manifest["files"]):
        parser.error("offline manifest contains URLs outside the requested base")
    for entry in manifest["files"]:
        relative = entry["url"][len(base):] or "index.html"
        path = root / relative
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != entry["sha256"]:
            parser.error("offline file is absent or differs from the manifest: " + relative)
    files = []
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            parser.error("symlinks are not allowed in a static deployment: " + str(path))
        if path.is_file() and path.name != ".DS_Store":
            relative = path.relative_to(root).as_posix()
            if any(p.startswith(".") for p in PurePosixPath(relative).parts):
                parser.error("unexpected hidden file in dist: " + relative)
            files.append((path, relative, path.stat().st_size))
    limit = args.max_mib * 1024 * 1024
    batches, current, size = [], [], 0
    for item in files:
        if item[2] > limit:
            parser.error("single file exceeds archive limit: " + item[1])
        if current and size + item[2] > limit:
            batches.append(current)
            current, size = [], 0
        current.append(item)
        size += item[2]
    if current:
        batches.append(current)
    output.mkdir(parents=True, exist_ok=True)
    report = {"base": base, "offlinePack": manifest["version"], "files": len(files),
              "bytes": sum(x[2] for x in files), "archives": []}
    for n, batch in enumerate(batches, 1):
        archive = output / f"duetblox-{manifest['version']}-part-{n:02d}.zip"
        if archive.exists():
            parser.error("refusing to overwrite an existing archive: " + str(archive))
        entries = []
        with zipfile.ZipFile(archive, "x", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for path, relative, length in batch:
                name = "/".join(parts) + "/" + relative
                z.write(path, name)
                entries.append({"path": name, "bytes": length,
                                "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
        report["archives"].append({"file": archive.name, "bytes": archive.stat().st_size,
                                   "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
                                   "entries": entries})
    (output / "deployment-manifest.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "archives"}))
    for archive in report["archives"]:
        print(f"{archive['file']}: {len(archive['entries'])} files, {archive['bytes']} bytes")


if __name__ == "__main__":
    main()
