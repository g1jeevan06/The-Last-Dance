# The-Last-Dance
3D Movie

Open `index.html` for the browser previz.

`index.json` contains the complete page as structured JSON: elements, attributes,
text, styles and scripts. It preserves the original HTML exactly and is a data
representation, not an executable webpage or a native Unreal scene.
Regenerate it with `python tools/html_to_json.py`. The converter checks JSON
parsing and byte-for-byte reconstruction before writing the result.

The [Unreal setup](unreal/README.md) includes the exported USD scenes, animation,
and an Unreal Python script that creates a level and Sequencer timeline.
