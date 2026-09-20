"""Blender 5.2 source generator. Run in a separate background process, never an open user scene."""
import bpy, json, math
from mathutils import Matrix
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
# New scene: leave any existing scene/data untouched.
scene = bpy.data.scenes.new('Coffee_pipeline_sample')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Coffee_sample')
scene.collection.children.link(collection)
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.render.fps = 30

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 1
    return m
olive = material('MAT_Allied_olive', (.33,.43,.25))
skin = material('MAT_warm_skin', (.71,.50,.31))
boots = material('MAT_boots', (.12,.16,.10))
enamel = material('MAT_enamel', (.94,.90,.75))

def cube(name, loc, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj

arm_data = bpy.data.armatures.new('Soldier_skeleton')
rig = bpy.data.objects.new('VIS_Soldier', arm_data)
collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, head, tail in [('root',(0,0,0),(0,0,.5)),('body',(0,0,.5),(0,0,1.1)),('leg_l',(-.18,0,.6),(-.18,0,.1)),('leg_r',(.18,0,.6),(.18,0,.1)),('arm_l',(-.4,0,1.05),(-.4,-.05,.65)),('arm_r',(.4,0,1.05),(.4,-.05,.65))]:
    bone = arm_data.edit_bones.new(name)
    bone.head, bone.tail = head, tail
    if name != 'root': bone.parent = arm_data.edit_bones['root']
bpy.ops.object.mode_set(mode='OBJECT')
parts = [
 ('VIS_Torso',(0,0,.86),(.63,.4,.65),olive,'body'),
 ('VIS_Head',(0,0,1.37),(.48,.43,.43),skin,'body'),
 ('VIS_Helmet',(0,0,1.61),(.60,.52,.13),olive,'body'),
 ('VIS_Left_boot',(-.18,-.035,.17),(.24,.44,.33),boots,'leg_l'),
 ('VIS_Right_boot',(.18,-.035,.17),(.24,.44,.33),boots,'leg_r'),
 ('VIS_Left_arm',(-.4,0,.85),(.20,.25,.44),olive,'arm_l'),
 ('VIS_Right_arm',(.4,0,.85),(.20,.25,.44),olive,'arm_r'),
 ('VIS_Coffee',(-.44,-.20,.9),(.22,.22,.25),enamel,'arm_l'),
]
for name, loc, scale, mat, bone in parts:
    obj = cube(name,loc,scale,mat)
    group = obj.vertex_groups.new(name=bone)
    group.add(list(range(len(obj.data.vertices))),1,'REPLACE')
    modifier=obj.modifiers.new('Armature','ARMATURE'); modifier.object=rig
    obj.parent=rig
for name, loc, bone in [('SOCKET_hand_weapon',(.4,-.25,.85),'arm_r'),('SOCKET_hand_coffee',(-.4,-.25,.85),'arm_l'),('SOCKET_muzzle',(.4,-.7,.85),'arm_r')]:
    obj=bpy.data.objects.new(name,None);collection.objects.link(obj);obj.parent=rig;obj.parent_type='BONE';obj.parent_bone=bone
    bpy.context.view_layer.update();obj.matrix_world=Matrix.Translation(loc)
# Two in-place clips, split by NLA track. Arm swing and legs have deliberate independent bones.
rig.animation_data_create()
for clip in ['idle','run']:
    action=bpy.data.actions.new(clip);rig.animation_data.action=action
    for frame in [1,9,17,25,33]:
        for bone_name, phase in [('leg_l',0),('leg_r',math.pi),('arm_l',math.pi),('arm_r',0)]:
            pb=rig.pose.bones[bone_name];pb.rotation_mode='XYZ'
            pb.rotation_euler.x=math.sin((frame-1)/32*2*math.pi+phase)*(.45 if clip=='run' else .025)
            pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone_name)
    track=rig.animation_data.nla_tracks.new();track.name=clip
    track.strips.new(clip,1,action)
    rig.animation_data.action=None
    track.mute=True
for pb in rig.pose.bones: pb.rotation_euler=(0,0,0)
scene.frame_set(1)
for track in rig.animation_data.nla_tracks: track.mute=False
source=ROOT/'assets/blender/characters/soldier_sample.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(source))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/models/soldier_sample.glb'),export_format='GLB',use_active_scene=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)

# An asymmetric marker scene catches swapped axes and sign errors.
markers=bpy.data.scenes.new('Coffee_marker_sample');bpy.context.window.scene=markers
rows=[]
for name, loc in [('KITCHEN_sample',(-3,2,0)),('TENT_sample',(4,-5,0)),('SPAWN_sample',(7,3,0)),('NAV_sample',(-2,-6,0))]:
    obj=bpy.data.objects.new(name,None);markers.collection.objects.link(obj);obj.location=loc
    rows.append({'id':name,'position':{'x':loc[0],'y':loc[2],'z':-loc[1]}})
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/arena/marker_sample.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/models/marker_sample.glb'),export_format='GLB',use_active_scene=True,export_yup=True)
(ROOT/'apps/web/public/assets/models/marker_sample.json').write_text(json.dumps({'version':'markers.v1','coordinateFrame':'Y_up_XZ_meters','markers':rows},indent=2)+'\n')
print('COFFEE_EXPORT_COMPLETE')
