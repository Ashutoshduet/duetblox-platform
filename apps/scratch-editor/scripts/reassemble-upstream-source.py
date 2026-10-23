#!/usr/bin/env python3
"""Verify source downloads and join the split editor archive; no network access."""
import argparse
import hashlib
import json
import pathlib
import tempfile


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def filename(value):
    if pathlib.Path(value).name != value or value in ('', '.', '..'):
        raise ValueError('Unexpected archive filename in manifest')
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parent)
    parser.add_argument('--output', type=pathlib.Path, help='Destination for reassembled archive; defaults to download directory')
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args()
    directory = args.directory.resolve()
    manifest = json.loads((directory / 'manifest.json').read_text())
    output = (args.output or directory).resolve()
    if not args.verify_only:
        output.mkdir(parents=True, exist_ok=True)
    for archive in manifest['archives']:
        parts = archive['parts']
        for part in parts:
            source = directory / filename(part['file'])
            if source.stat().st_size != part['bytes'] or digest(source) != part['sha256']:
                raise ValueError('Checksum or length mismatch: ' + source.name)
        if len(parts) > 1 and not args.verify_only:
            destination = output / filename(archive['archive'])
            if destination.exists():
                if digest(destination) != archive['sha256']:
                    raise FileExistsError('Existing archive differs; remove or rename it first: ' + str(destination))
            else:
                temporary = None
                try:
                    with tempfile.NamedTemporaryFile(dir=output, delete=False) as target:
                        temporary = pathlib.Path(target.name)
                        for part in parts:
                            with (directory / filename(part['file'])).open('rb') as source:
                                for block in iter(lambda: source.read(1024 * 1024), b''):
                                    target.write(block)
                    if temporary.stat().st_size != archive['bytes'] or digest(temporary) != archive['sha256']:
                        raise ValueError('Reassembled archive checksum mismatch')
                    temporary.rename(destination)
                finally:
                    if temporary is not None and temporary.exists():
                        temporary.unlink()
            print('Reassembled:', destination.name)
        print('Verified:', archive['archive'])
    print('All source archive checks passed.')


if __name__ == '__main__':
    main()
