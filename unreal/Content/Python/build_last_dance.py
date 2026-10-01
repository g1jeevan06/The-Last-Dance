"""Run through Unreal Editor: Tools > Execute Python Script.

Creates a new timestamped level and a USD-backed Sequencer reel. Does not
overwrite an earlier build. Requires the USD export beside the project.
"""
import json
from datetime import datetime
from pathlib import Path
import unreal


def build():
    root = Path(__file__).resolve().parents[2]
    source = root / 'SourceData' / 'TheLastDance.usda'
    if not source.is_file():
        raise RuntimeError('Run Prepare-Unreal.cmd first to generate the scene data.')
    if not hasattr(unreal, 'UsdStageActor'):
        raise RuntimeError('Enable USD Importer and restart Unreal Editor.')
    # Do not discard work in whichever level the user currently has open.
    if unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages() or unreal.EditorLoadingAndSavingUtils.get_dirty_content_packages():
        if not unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True):
            raise RuntimeError('Save the current work before building the reel.')
    metadata = json.loads((source.parent / 'shots.json').read_text(encoding='utf-8'))
    fps = metadata['fps']
    finish = round(metadata['duration'] * fps)
    package = '/Game/TheLastDance/Build_' + datetime.now().strftime('%Y%m%d_%H%M%S')
    level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    unreal.EditorAssetLibrary.make_directory(package)
    if not level_subsystem.new_level(package + '/Reel'):
        raise RuntimeError('Could not create the new reel level.')
    stage = actors.spawn_actor_from_class(unreal.UsdStageActor, unreal.Vector())
    stage.set_actor_label('The Last Dance — USD scene')
    stage.set_root_layer(str(source).replace('\\', '/'))
    stage.set_time(0.0)
    component = stage.get_generated_component('/Reel/Camera')
    if not component:
        raise RuntimeError('USD camera did not load. Inspect Output Log for USD import errors.')
    camera = component.get_owner()
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    sequence = tools.create_asset('Master', package, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(fps, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(finish)
    # A linear time track drives the source's baked transforms, visibility and lens.
    stage_binding = sequence.add_possessable(stage)
    time_track = stage_binding.add_track(unreal.MovieSceneFloatTrack)
    time_track.set_property_name_and_path('Time', 'Time')
    time_section = time_track.add_section()
    time_section.set_range(0, finish)
    channel = time_section.get_all_channels()[0]
    channel.add_key(unreal.FrameNumber(0), 0.0, interpolation=unreal.MovieSceneKeyInterpolation.LINEAR)
    channel.add_key(unreal.FrameNumber(finish - 1), float(finish - 1), interpolation=unreal.MovieSceneKeyInterpolation.LINEAR)
    camera_binding = sequence.add_possessable(camera)
    camera_binding.set_display_name('Source camera — animated by USD')
    binding_id = unreal.MovieSceneObjectBindingID()
    binding_id.set_editor_property('guid', camera_binding.get_id())
    cuts = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    for shot in metadata['shots']:
        start = round(shot['start'] * fps)
        stop = round((shot['start'] + shot['dur']) * fps)
        cut = cuts.add_section()
        cut.set_range(start, stop)
        cut.set_camera_binding_id(binding_id)
        mark = unreal.MovieSceneMarkedFrame()
        mark.set_editor_property('frame_number', unreal.FrameNumber(start))
        mark.set_editor_property('label', 'SH ' + shot['no'] + ' — ' + shot['name'])
        sequence.add_marked_frame(mark)
    player_actor = actors.spawn_actor_from_class(unreal.LevelSequenceActor, unreal.Vector())
    player_actor.set_actor_label('The Last Dance — Master Sequence')
    player_actor.set_sequence(sequence)
    unreal.EditorAssetLibrary.save_loaded_asset(sequence)
    if not level_subsystem.save_current_level():
        raise RuntimeError('Could not save the reel level.')
    unreal.LevelSequenceEditorBlueprintLibrary.open_level_sequence(sequence)
    unreal.LevelSequenceEditorBlueprintLibrary.set_current_time(0)
    unreal.LevelSequenceEditorBlueprintLibrary.set_lock_camera_cut_to_viewport(True)
    unreal.log('The Last Dance created: ' + package + '/Master')
    unreal.log('USD scene remains linked to SourceData. Keep that folder with this project.')


if __name__ == '__main__':
    build()
