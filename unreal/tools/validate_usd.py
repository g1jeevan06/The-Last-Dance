"""Validate with a Python installation containing pxr (OpenUSD)."""
import json
from pathlib import Path
from pxr import Usd, UsdGeom, UsdShade

root = Path(__file__).resolve().parents[1] / 'SourceData'
meta = json.loads((root / 'shots.json').read_text(encoding='utf-8'))
report = json.loads((root / 'export-report.json').read_text(encoding='utf-8'))
stage = Usd.Stage.Open(str(root / 'TheLastDance.usda'))
assert stage and stage.GetDefaultPrim().GetName() == 'Reel'
assert stage.GetTimeCodesPerSecond() == meta['fps']
assert stage.GetEndTimeCode() == meta['duration'] * meta['fps'] - 1
camera = UsdGeom.Camera(stage.GetPrimAtPath('/Reel/Camera'))
assert camera
mesh_count = 0
animated_meshes = 0
for prim in stage.Traverse():
    if prim.IsA(UsdGeom.Mesh):
        mesh = UsdGeom.Mesh(prim)
        indices = mesh.GetFaceVertexIndicesAttr().Get()
        counts = mesh.GetFaceVertexCountsAttr().Get()
        points = mesh.GetPointsAttr().Get(0)
        assert points and sum(counts) == len(indices), str(prim.GetPath())
        assert min(indices) >= 0 and max(indices) < len(points), str(prim.GetPath())
        assert UsdShade.MaterialBindingAPI(prim).ComputeBoundMaterial()[0], str(prim.GetPath())
        mesh_count += 1
        animated_meshes += mesh.GetPointsAttr().GetNumTimeSamples() > 1
for shot in meta['shots']:
    # Verify cuts at their first frame and last frame, not just mid-shot.
    for frame in (round(shot['start'] * meta['fps']), round((shot['start'] + shot['dur']) * meta['fps']) - 1):
        visible = [name for name in report['worlds'] if UsdGeom.Imageable(stage.GetPrimAtPath('/Reel/' + name)).ComputeVisibility(frame) != 'invisible']
        assert visible == [shot['world']], (shot['no'], frame, visible)
        assert camera.GetFocalLengthAttr().Get(frame) > 0
        assert camera.GetLocalTransformation(frame).GetDeterminant() != 0
expected = sum(w['meshes'] for w in report['worlds'].values())
assert mesh_count == expected, (mesh_count, expected)
result = {'usdParsed': True, 'meshes': mesh_count, 'deformingMeshes': animated_meshes, 'shotsChecked': len(meta['shots']), 'frames': report['frames'], 'unrealEditorTested': False}
(root / 'validation-report.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
