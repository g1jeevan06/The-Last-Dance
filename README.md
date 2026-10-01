# The-Last-Dance
3D Movie

Open `index.html` for the browser previz.

The main cast uses [downloaded CC0 rigged character models](assets/models/README.md),
embedded for offline playback and retargeted to the existing shot animation.
The existing Unreal USD exports still use the earlier procedural characters.

The player includes [photographic PBR textures](assets/textures/README.md) for
eight material families, with color, normal and roughness maps embedded for offline use.

`index.json` contains the complete page as structured JSON: elements, attributes,
text, styles and scripts. It preserves the original HTML exactly and is a data
representation, not an executable webpage or a native Unreal scene.
Regenerate it with `python tools/html_to_json.py`. The converter checks JSON
parsing and byte-for-byte reconstruction before writing the result.

The [Unreal setup](unreal/README.md) includes the exported USD scenes, animation,
and an Unreal Python script that creates a level and Sequencer timeline.
