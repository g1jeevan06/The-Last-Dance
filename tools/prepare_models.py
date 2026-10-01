"""Pack the CC0 Quaternius glTF downloads into portable, optimized GLBs."""
import io, json, pathlib, struct, sys
from PIL import Image

source = pathlib.Path(sys.argv[1])
out = pathlib.Path(__file__).resolve().parents[1] / 'assets/models'
out.mkdir(exist_ok=True, parents=True)
for asset_name,filename in [('female','Superhero_Female_FullBody'),('male','Superhero_Male_FullBody'),('hair_female','Hair_Long'),('hair_male','Hair_SimpleParted')]:
    path = next(source.rglob(f'{filename}.gltf'))
    doc = json.loads(path.read_text())
    binary = bytearray((path.parent / doc['buffers'][0]['uri']).read_bytes())
    for image in doc['images']:
        name = image.pop('uri')
        texture = path.parent / name
        if not texture.exists():
            texture = path.parent / name.replace('_png.png', '.png')
        im = Image.open(texture)
        im.thumbnail((1024, 1024))
        data = io.BytesIO()
        if 'Hair' in name:
            im.save(data, format='PNG', optimize=True)
            image['mimeType'] = 'image/png'
        else:
            im.convert('RGB').save(data, format='JPEG', quality=88)
            image['mimeType'] = 'image/jpeg'
        binary.extend(b'\0' * (-len(binary) % 4))
        image['bufferView'] = len(doc['bufferViews'])
        doc['bufferViews'].append(dict(buffer=0, byteOffset=len(binary), byteLength=len(data.getvalue())))
        binary.extend(data.getvalue())
    doc['buffers'] = [dict(byteLength=len(binary))]
    payload = json.dumps(doc, separators=(',', ':')).encode()
    payload += b' ' * (-len(payload) % 4)
    binary.extend(b'\0' * (-len(binary) % 4))
    glb = struct.pack('<III', 0x46546C67, 2, 28 + len(payload) + len(binary))
    glb += struct.pack('<II', len(payload), 0x4E4F534A) + payload
    glb += struct.pack('<II', len(binary), 0x004E4942) + binary
    target = out / f'{asset_name}.glb'
    target.write_bytes(glb)
    print(target.name, len(glb))
