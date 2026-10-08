"""Vendor the tracked upstream engine, recording the exact revision.

Run: python scripts/sync_engine.py ../LapPredictionEngine
Only previously tracked vendor files are pruned. Builds and user data are untouched.
"""
import json
import shutil
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
target = root / 'backend' / 'engine'
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=source, text=True).strip()
files = subprocess.check_output(['git', 'ls-files'], cwd=source, text=True).splitlines()
old = subprocess.check_output(['git', 'ls-files', 'backend/engine'], cwd=root, text=True).splitlines()
wanted = set(files)
for relative in old:
    dest = root / relative
    name = dest.relative_to(target).as_posix()
    if name not in wanted and name != 'Dockerfile':
        if not dest.resolve().is_relative_to(target.resolve()):
            raise RuntimeError('Vendor target escaped workspace')
        dest.unlink(missing_ok=True)
for name in files:
    if name == '.gitignore':
        continue
    dest = target / name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source / name, dest)
(target / 'UPSTREAM.json').write_text(json.dumps({
    'repository': 'https://github.com/pouyabrn/LapPredictionEngine',
    'commit': sha,
}, indent=2) + '\n')
print(f'Vendored {len(files)} upstream files at {sha}')
