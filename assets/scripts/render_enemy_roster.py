"""Render the authored roster for visual review. Run from Blender background.
Output: artifacts/enemy-roster.png (synthetic asset preview, not gameplay).
"""
import bpy, math
from pathlib import Path
from mathutils import Vector
root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
for index, name in enumerate(['rifleman','rifleman_scout','rifleman_gunner','rifleman_marksman']):
    with bpy.data.libraries.load(str(root/'assets/blender/npcs'/f'{name}.blend'), link=False) as (source, target):
        target.objects = source.objects
    def belongs_to_rig(obj):
        while obj.parent is not None:
            obj = obj.parent
        return obj.type == 'ARMATURE'
    objects = [o for o in target.objects if o and belongs_to_rig(o)]
    for obj in objects:
        scene.collection.objects.link(obj)
        if obj.type == 'ARMATURE':
            obj.animation_data_clear()
            for bone in obj.pose.bones:
                bone.rotation_euler = (0,0,0)
                bone.location = (0,0,0)
        if obj.parent is None:
            obj.location.x += (index-1.5)*2
    bpy.ops.object.text_add(location=((index-1.5)*2-.7,-1.1,.015), rotation=(0,0,0))
    text=bpy.context.object
    text.data.body=['RIFLEMAN','SCOUT','GUNNER','MARKSMAN'][index]
    text.data.size=.22
bpy.ops.mesh.primitive_plane_add(size=200)
mat=bpy.data.materials.new('Review ground');mat.diffuse_color=(.16,.20,.15,1)
bpy.context.object.data.materials.append(mat)
bpy.ops.object.camera_add(location=(3,-9,7))
cam=bpy.context.object
cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=9.5;scene.camera=cam
bpy.ops.object.light_add(type='AREA', location=(-3,-4,8));bpy.context.object.data.energy=1300;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=7
scene.world=bpy.data.worlds.new('Review world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.6,.65,.55,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=1400;scene.render.resolution_y=700;scene.render.resolution_percentage=100
(root/'artifacts').mkdir(exist_ok=True)
scene.render.filepath=str(root/'artifacts/enemy-roster.png');bpy.ops.render.render(write_still=True)
