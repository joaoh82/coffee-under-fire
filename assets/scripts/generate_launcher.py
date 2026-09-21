"""Original low-poly shoulder launcher. Actor-space GLB +Z front, Blender -Y front.
Run Blender --background --factory-startup --python assets/scripts/generate_launcher.py.
"""
import bpy, json, math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
mount = json.loads((ROOT / 'packages/shared/weapon-mounts.json').read_text())['rocket']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = .78
    return m
olive = material('Launcher_olive', (.23, .30, .14))
steel = material('Launcher_dark_steel', (.09, .12, .10))
brass = material('Launcher_band', (.66, .51, .23))
x, z = mount['x'], mount['y']

def tube(name, center, radius, length, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=radius, depth=length,
        location=(x, center, z), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    return o
# Forward opening aligns exactly with the deterministic rocket mount.
front = -mount['z']
tube('Launcher_tube', front + .65, .145, 1.3, olive)
for y in [front + .12, front + .85]:
    tube('Launcher_reinforcing_band', y, .16, .1, brass)
tube('Launcher_rear_cap', front + 1.30, .18, .10, steel)
tube('Launcher_muzzle_rim', front + .04, .18, .08, steel)
tube('Launcher_dark_bore', front - .002, .12, .006, steel)
bpy.ops.mesh.primitive_cube_add(size=1, location=(x, front + .75, z-.19))
bpy.context.object.name='Launcher_shoulder_pad'
bpy.context.object.scale=(.27,.36,.15)
bpy.context.object.data.materials.append(steel)
socket = bpy.data.objects.new('SOCKET_rocket_muzzle', None)
bpy.context.scene.collection.objects.link(socket)
socket.location=(x, front, z)
source=ROOT/'assets/blender/launcher'; source.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(source/'shoulder_launcher.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/models/shoulder_launcher.glb'),
    export_format='GLB', export_yup=True)
