"""Fetch the selected CC0 material maps, keeping source URLs and hashes."""
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'textures'
ASSETS = {'concrete': 'concrete_floor_02', 'plaster': 'grey_plaster', 'stone': 'dark_rock_02',
          'metal': 'blue_metal_plate', 'deck': 'metal_plate', 'cloth': 'denim_fabric_04',
          'wood': 'wood_table_worn', 'leather': 'brown_leather'}


def fetch(url):
    with urlopen(Request(url, headers={'User-Agent': 'TheLastDance-TextureSetup/1.0'}), timeout=90) as response:
        return response.read()


def main():
    manifest = {'provider': 'Poly Haven', 'license': 'CC0-1.0',
                'licenseUrl': 'https://polyhaven.com/license', 'resolution': '1k', 'materials': {}}
    for material, asset in ASSETS.items():
        files = json.loads(fetch('https://api.polyhaven.com/files/' + asset))
        entry = {'asset': asset, 'source': 'https://polyhaven.com/a/' + asset, 'maps': {}}
        for role, choices in {'color': ['Diffuse', 'diff', 'diffuse'], 'normal': ['nor_gl'], 'roughness': ['Rough', 'rough']}.items():
            key = next((k for k in choices if k in files), None)
            if not key:
                raise RuntimeError(f'{asset}: missing {role}; available: {list(files)}')
            info = files[key]['1k']['jpg']
            output = DEST / material / (role + '.jpg')
            output.parent.mkdir(parents=True, exist_ok=True)
            data = output.read_bytes() if output.exists() else fetch(info['url'])
            if hashlib.md5(data).hexdigest() != info['md5']:
                data = fetch(info['url'])
            if hashlib.md5(data).hexdigest() != info['md5']:
                raise RuntimeError('Checksum mismatch: ' + str(output))
            output.write_bytes(data)
            entry['maps'][role] = {'file': output.relative_to(ROOT).as_posix(),
                                  'url': info['url'], 'md5': info['md5'], 'bytes': len(data)}
        manifest['materials'][material] = entry
        print(material + ': downloaded and verified', flush=True)
    (DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
