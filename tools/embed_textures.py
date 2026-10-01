"""Embed the verified JPEG maps in the existing script; no runtime fetch required."""
import base64
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'assets/textures/manifest.json').read_text(encoding='utf-8'))
assets = {}
for kind, entry in manifest['materials'].items():
    assets[kind] = {}
    for role, info in entry['maps'].items():
        data = (root / info['file']).read_bytes()
        assert hashlib.md5(data).hexdigest() == info['md5'], info['file']
        assets[kind][role] = 'data:image/jpeg;base64,' + base64.b64encode(data).decode('ascii')
page = root / 'index.html'
source = page.read_text(encoding='utf-8')
start, stop = '/* PBR_ASSETS_START */', '/* PBR_ASSETS_END */'
before, remaining = source.split(start, 1)
_, after = remaining.split(stop, 1)
page.write_text(before + start + '\nconst PBR_ASSETS = ' + json.dumps(assets, separators=(',', ':')) + ';\n' + stop + after, encoding='utf-8')
print(f'Embedded {len(assets)} materials and {sum(map(len, assets.values()))} verified maps.')
