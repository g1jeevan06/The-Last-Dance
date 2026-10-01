# Online character models

The main cast now uses **Quaternius Universal Base Characters (Standard)**:
https://quaternius.com/packs/universalbasecharacters.html
https://quaternius.itch.io/universal-base-characters

License: **CC0** (public domain), as specified by the creator on the pack page.
Downloaded from the creator's free itch.io download on 2026-10-01.
The source pack is `Universal Base Characters[Standard].zip`.

Included derivatives:
- `female.glb`: Superhero_Female_FullBody, used for adult Zara.
- `male.glb`: Superhero_Male_FullBody, used for Jax, Reynolds and Rex.
- `hair_female.glb`: Hair_Long.
- `hair_male.glb`: Hair_SimpleParted.

These are two shared character bases, not four independently sculpted likenesses.
They are game models with anatomical meshes, textured faces and articulated hands;
they are not scanned or photorealistic digital doubles.

Textures are resized to at most 1024px, packed into GLB, and embedded in the page
for offline playback. Runtime cloth shading provides fitted costumes; existing
coats, towels, armour and story props remain. The film's procedural pose drivers
retarget the imported skeletons. Child Zara, supporting characters, creatures,
vehicles and environments retain their existing models. Failed loading leaves
the procedural characters available and displays an asset error.

Rebuild after extracting the Standard pack:
```
python tools/prepare_models.py <extracted-pack-directory>
python tools/embed_models.py
python tools/html_to_json.py
```
Preparation requires Pillow. Browser runtime does not need a server or downloads.
The matching Three.js r128 GLTFLoader and SkeletonUtils are MIT licensed; see
`../vendor/three-LICENSE.txt`.

The existing `unreal/` USD exports predate these replacements and still contain
the procedural models. The GLBs here are separate importable assets; this change
does not rebuild or verify an Unreal skeletal-animation project.
