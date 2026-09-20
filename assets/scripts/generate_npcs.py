"""Original NPC variants built on the project's proven six-bone soldier rig.
Run after generate_slice.py. Sources keep editable parts; exports batch by palette.
Blender Z-up/front -Y, exported glTF Y-up/front +Z. No faction insignia.
"""
import bpy, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/web/public/assets/models'
SRC = ROOT / 'assets/blender/npcs'
SRC.mkdir(parents=True, exist_ok=True)

for model_name in ['rifleman', 'rifleman_scout', 'rifleman_veteran', 'general']:
    role = 'general' if model_name == 'general' else 'rifleman'
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/slice/soldier.blend'))
    bpy.context.preferences.filepaths.save_version = 0
    s = bpy.context.scene
    s.name = 'Character_' + model_name
    rig = next(o for o in s.objects if o.type == 'ARMATURE')
    rig.name = 'Character_rig'

    def material(name, color):
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*color, 1)
        m.use_nodes = True
        p = m.node_tree.nodes.get('Principled BSDF')
        p.inputs['Base Color'].default_value = (*color, 1)
        p.inputs['Roughness'].default_value = .85
        return m

    cloth = material('Slate_cloth' if role == 'rifleman' else 'Officer_olive',
                     (.20, .26, .29) if role == 'rifleman' else (.34, .38, .19))
    if model_name == 'rifleman_scout':
        cloth.diffuse_color = (.28,.245,.20,1)
        cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = cloth.diffuse_color
    elif model_name == 'rifleman_veteran':
        cloth.diffuse_color = (.25,.28,.235,1)
        cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = cloth.diffuse_color
    trim = material('Slate_highlight' if role == 'rifleman' else 'Brass_trim',
                    (.35, .43, .45) if role == 'rifleman' else (.80, .61, .23))
    skin = material('Warm_skin', (.69, .48, .33) if role == 'rifleman' else (.82, .61, .42))
    dark = material('Charcoal', (.065, .08, .075))
    leather = material('Leather', (.25, .16, .10))
    accent = material('Terracotta_cloth', (.49, .22, .16))
    cream = material('Paper_and_enamel', (.91, .84, .65))

    for o in list(s.objects):
        if o.type != 'MESH':
            continue
        if (model_name == 'rifleman_scout' and o.name.startswith(('Backpack', 'Helmet_'))) or (role == 'rifleman' and o.name.startswith('VIS_Coffee')) or (
            role == 'general' and o.name.startswith(('Rifle_', 'Backpack', 'Front_pouch', 'Helmet_'))
        ):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        old = o.data.materials[0].name
        new = (cloth if old == 'Olive_cloth' else trim if old == 'Olive_highlight'
               else skin if old == 'Warm_skin' else dark if old in ['Boots_and_rifle', 'Steel', 'Coffee']
               else cream if old == 'Enamel_cream' else leather)
        o.data.materials.clear()
        o.data.materials.append(new)

    def bind(o, bone):
        g = o.vertex_groups.new(name=bone)
        g.add(list(range(len(o.data.vertices))), 1, 'REPLACE')
        mod = o.modifiers.new('Skeleton', 'ARMATURE')
        mod.object = rig
        o.parent = rig
        return o

    def box(name, loc, size, mat, bone='body', bevel=.015):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.name = name
        o.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        o.data.materials.append(mat)
        if bevel:
            mod = o.modifiers.new('Flat_edges', 'BEVEL')
            mod.width = bevel
            mod.segments = 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return bind(o, bone)

    if role == 'rifleman':
        box('Collar_scarf', (0, -.12, 1.24), (.43, .27, .12), accent)
        box('Helmet_band', (0, -.294, 1.63), (.37, .035, .045), dark)
        if model_name != 'rifleman_scout':
            box('Bedroll', (0, .40, 1.24), (.65, .19, .20), trim, bevel=.055)
            box('Backpack_strap', (0, .385, .98), (.08, .035, .5), dark)
        if model_name == 'rifleman_scout':
            box('Soft_field_cap', (0, 0, 1.64), (.59,.46,.19), cloth, bevel=.065)
            box('Soft_cap_peak', (0,-.25,1.59), (.46,.28,.045), leather, bevel=.02)
            box('Light_satchel', (.32,.22,.87), (.25,.23,.32), leather, bevel=.03)
            for x in [-.12,.12]:box('Dust_goggles', (x,-.257,1.49), (.18,.045,.09), dark, bevel=.025)
        if model_name == 'rifleman_veteran':
            box('Helmet_canvas_patch', (.13,-.27,1.72), (.18,.055,.14), leather, bevel=.02)
            box('Shoulder_blanket', (0,.17,1.20), (.79,.38,.14), accent, bevel=.05)
            for x in [-.26,.26]:box('Extra_pouch', (x,-.24,.81), (.18,.16,.22), leather, bevel=.025)
    else:
        # Broad officer cap, moustache, brass shoulder tabs and coat hem.
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=.34, depth=.17, location=(0, 0, 1.66))
        o = bpy.context.object
        o.name = 'Officer_cap'
        o.data.materials.append(cloth)
        bind(o, 'body')
        box('Cap_peak', (0, -.25, 1.58), (.48, .34, .055), dark, bevel=.035)
        box('Cap_band', (0, -.318, 1.62), (.34, .035, .045), trim)
        box('Moustache', (0, -.244, 1.36), (.25, .048, .065), leather)
        box('Coat_hem', (0, .005, .61), (.71, .43, .23), cloth, bevel=.04)
        for x in [-.36, .36]:
            box('Shoulder_tab', (x, 0, 1.22), (.18, .32, .055), trim,
                'arm_l' if x < 0 else 'arm_r')
        for z in [.85, 1.02, 1.15]:
            box('Coat_button', (0, -.213, z), (.04, .026, .04), trim, bevel=.005)
        box('VIS_Map', (.40, -.2, .91), (.34, .10, .42), cream, 'arm_r')
        box('VIS_Map_fold', (.40, -.257, .91), (.02, .012, .36), trim, 'arm_r', bevel=0)

        # These clips illustrate Jev's existing complete reaction choices only.
        for clip in ['map', 'watch', 'sip', 'pleased']:
            action = bpy.data.actions.new(clip)
            rig.animation_data.action = action
            for f in range(1, 62, 2):
                t = (f - 1) / 60
                ease = math.sin(math.pi * t) ** 2
                for pb in rig.pose.bones:
                    pb.rotation_mode = 'XYZ'
                    pb.rotation_euler = (0, 0, 0)
                    pb.location = (0, 0, 0)
                if clip == 'map':
                    rig.pose.bones['arm_r'].rotation_euler.x = -0.65 * ease
                    rig.pose.bones['body'].rotation_euler.x = .12 * ease
                elif clip == 'watch':
                    rig.pose.bones['arm_r'].rotation_euler.x = -2.0 * ease
                    rig.pose.bones['arm_r'].rotation_euler.z = .3 * ease
                    rig.pose.bones['body'].rotation_euler.z = .18 * math.sin(t * math.tau)
                elif clip == 'sip':
                    rig.pose.bones['arm_l'].rotation_euler.x = -1.7 * ease
                    rig.pose.bones['arm_l'].rotation_euler.z = -.65 * ease
                else:
                    rig.pose.bones['arm_r'].rotation_euler.x = -1.4 * ease
                    rig.pose.bones['arm_r'].rotation_euler.z = -.30 * ease
                    rig.pose.bones['body'].location.y = .04 * ease
                for pb in rig.pose.bones:
                    pb.keyframe_insert(data_path='rotation_euler', frame=f)
                    pb.keyframe_insert(data_path='location', frame=f)
            track = rig.animation_data.nla_tracks.new()
            track.name = clip
            track.strips.new(clip, 1, action)
            track.mute = True
            rig.animation_data.action = None

    # Replace the technical sample's below-ground fall with a grounded tumble.
    for track in list(rig.animation_data.nla_tracks):
        if track.name == 'death':
            rig.animation_data.nla_tracks.remove(track)
    action = bpy.data.actions.new('Grounded_death')
    rig.animation_data.action = action
    for f in range(1, 26, 2):
        fall = min(1, (f - 1) / 24 * 1.4)
        for pb in rig.pose.bones:
            pb.rotation_euler = (0, 0, 0)
            pb.location = (0, 0, 0)
        rig.pose.bones['root'].rotation_euler.x = -math.pi / 2 * fall
        rig.pose.bones['root'].location.y = .46 * fall
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path='rotation_euler', frame=f)
            pb.keyframe_insert(data_path='location', frame=f)
    track = rig.animation_data.nla_tracks.new()
    track.name = 'death'
    track.strips.new('death', 1, action)
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    s.frame_set(1)
    for tr in rig.animation_data.nla_tracks:
        tr.mute = False
    bpy.ops.wm.save_as_mainfile(filepath=str(SRC / (model_name + '.blend')))

    # Merge only the export copy. Keep mug/map switchable; reuse skin weights.
    groups = {}
    for o in list(s.objects):
        if o.type == 'MESH':
            visibility = 'VIS_Coffee' if o.name.startswith('VIS_Coffee') else 'VIS_Map' if o.name.startswith('VIS_Map') else 'Body'
            groups.setdefault((visibility, o.data.materials[0].name), []).append(o)
    for (visibility, palette), objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = visibility + '_' + palette
    bpy.ops.export_scene.gltf(filepath=str(OUT / ('npc_' + model_name + '.glb')),
        export_format='GLB', use_active_scene=True, export_animations=True,
        export_animation_mode='NLA_TRACKS', export_yup=True)
    print('NPC_EXPORT_COMPLETE', model_name, bpy.app.version_string)
