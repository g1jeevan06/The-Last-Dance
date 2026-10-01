# The Last Dance: web scene → Unreal

This is a **USD-backed cinematic setup**, built from the actual procedural geometry and animation in `../index.html`. It is not a screenshot or a webpage displayed inside Unreal.

The included export contains **11 environments, 7,910 meshes, 78 shots, and 8,016 frames at 24 fps (5:34)**. The environment visibility follows the shot cuts. A USD camera carries the original animated framing and focal length. The Unreal setup script creates a fresh level and a Master sequence with 78 camera-cut sections and shot markers.

## Open in Unreal

1. Install a complete **Unreal Engine 5.4 or newer** through Epic Games Launcher. If using another version, right-click `TheLastDance.uproject`, select **Switch Unreal Engine version**, and choose your installed editor.
2. Open **TheLastDance.uproject**. Allow the enabled USD Importer, Python, Sequencer Scripting and Movie Render Queue plugins to load.
3. Choose **Tools → Execute Python Script** and select **Content/Python/build_last_dance.py**. The first import can take time because the film contains thousands of mesh parts.
4. The script opens the generated **Master** sequence, under `/Game/TheLastDance/Build_<timestamp>/`. Press Play in Sequencer and keep the camera-cut viewport lock enabled.
5. Save the project. Keep **SourceData** with it: the level is linked to the USD stage, which supplies the animation.

Each setup run creates a new timestamped level; it does not replace earlier builds. The script requests saving dirty packages before changing levels.

## Editing

- **Timing and cuts:** edit the Master sequence's camera cuts and markers. Its `Time` track advances the USD stage in source frame numbers. Retiming that track retimes the source animation.
- **Source scene:** open **Window → Virtual Production → USD Stage** and select the stage actor. Edit the USD stage/layers there. The source hierarchy retains separate mesh parts rather than merging the film into one mesh.
- **Camera:** the original camera is generated and animated by the USD stage. For independent native camera work, add your own Cine Camera Actor, bind it in Sequencer, and replace the relevant cut binding.
- **Native assets:** Unreal's USD Stage workflow can import the stage content into the Content Browser. The included setup keeps a live USD link; it does not bake a standalone packaged game.
- **Renders:** use Movie Render Queue from the Master sequence after checking lighting, materials and unsupported effects in the editor.

USD-generated actors are managed by the stage. If you close/reopen or replace the stage and the camera binding becomes unresolved, rebuild the setup in a new timestamped level. Moving the project to another machine also requires rebuilding the level so its source path points at the new location.

## Refresh from the webpage

The ready-to-load USD files are included, so Node.js is only needed when rebuilding them after a webpage change.

Double-click **Prepare-Unreal.cmd**, or run from this folder:

```powershell
node --max-old-space-size=8192 tools/export-scene.cjs
```

Then rerun the Unreal setup script. Back up any edits to the exported USD layers before regenerating: regeneration replaces files in `SourceData`.

The exporter executes the trusted JavaScript inside this repository's HTML in a headless Node context. Do not use it on untrusted HTML.

## What still needs Unreal work

- Browser particle systems, snow/smoke point sprites, shader effects and fog need Unreal/Niagara replacements.
- Generated browser audio and speech synthesis are not sound assets and are not included. Dialogue and narration text remain in `SourceData/shots.json`.
- HUD text, fades, flashes and title/end-card overlays need Sequencer/compositing equivalents.
- Materials use USD Preview Surface approximations; light intensity and exposure need an Unreal visual pass. Animated material properties are not baked.
- Character motion is baked mesh-part motion, not a skeletal animation or Control Rig.

## Validation and status

The USD stage has been parsed with OpenUSD 25.2. Mesh topology, material bindings, all 78 shot boundaries, camera focal lengths and transform invertibility were checked. JavaScript and Python syntax checks passed. See `SourceData/validation-report.json`.

**The Unreal setup script has not been run in Unreal Editor.** The local Epic Games folders had no `UnrealEditor.exe` or `UnrealEditor-Cmd.exe`, so editor import, playback, binding persistence and final rendering still need verification on a complete installation. This is an export and setup package, not an already validated `.umap`/`.uasset` build.

To rerun USD checks with a Python installation that provides `pxr`:

```powershell
python tools/validate_usd.py
```

References: [Epic's USD workflow](https://dev.epicgames.com/documentation/unreal-engine/universal-scene-description-in-unreal-engine), [USD Stage Python API](https://dev.epicgames.com/documentation/en-us/unreal-engine/python-api/class/UsdStageActor?application_version=5.4), [Sequencer Python](https://dev.epicgames.com/documentation/unreal-engine/python-scripting-in-sequencer-in-unreal-engine).
