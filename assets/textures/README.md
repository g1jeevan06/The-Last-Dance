# Photographic PBR materials

These maps come from [Poly Haven](https://polyhaven.com/textures) and are licensed
under [CC0](https://polyhaven.com/license). The source URLs and original MD5 hashes
for each file are recorded in `manifest.json`.

The page uses 1K JPEG color, OpenGL normal, and roughness maps for painted metal,
tread plate, concrete, plaster, rock, wood, denim, and leather. Surface assignments
and mesh UV density are handled in `index.html`. Skin and hair retain restrained
procedural microdetail; they are not scanned human textures.

The JPEGs are embedded into the page to support opening the HTML from disk and to
avoid runtime CDN dependencies. The standalone files are retained for reuse and
for rebuilding. These photographic maps are not baked into the earlier Unreal USD
snapshot, which has its own material conversion limitations.

To rebuild after a texture change, run these commands from the repository root:

```powershell
python tools/fetch_textures.py
python tools/embed_textures.py
python tools/html_to_json.py
```

The fetch script verifies the source hashes. The JSON converter verifies exact
reconstruction of the HTML. Color maps use sRGB decoding; normal and roughness
maps remain linear. Shared maps and mipmapping limit duplicate GPU allocations.
