"""Original cartoon light tank. Editable pieces, separately grouped hull/turret exports."""
import bpy, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
s=bpy.data.scenes.new('Coffee_Light_Tank');bpy.context.window.scene=s
bpy.context.preferences.filepaths.save_version=0

def material(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.9
 return m
armor=material('Weathered_armor',(.23,.27,.23));edge=material('Armor_edges',(.34,.36,.28));track=material('Dark_tracks',(.065,.075,.068));steel=material('Worn_steel',(.22,.24,.23));rust=material('Rust_chips',(.35,.18,.10));glass=material('Vision_slit',(.035,.07,.07))
hull=bpy.data.objects.new('HULL',None);s.collection.objects.link(hull)
turret=bpy.data.objects.new('TURRET',None);s.collection.objects.link(turret)
cannon=bpy.data.objects.new('CANNON',None);s.collection.objects.link(cannon);cannon.parent=turret

def box(name,x,z,y,w,d,h,mat,parent=hull,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(w,d,h)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat)
 mod=o.modifiers.new('Flat_edges','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.parent=parent;return o
box('Sloped_hull',0,0,.50,1.23,1.7,.57,armor,bevel=.16)
box('Engine_deck',0,-.51,.80,1.0,.52,.09,edge)
for x in [-.63,.63]:
 box('Track_belt',x,0,.30,.32,1.70,.48,track,bevel=.10)
 for z in [-.60,-.30,0,.30,.60]:
  box('Wheel_hub',x+(-.165 if x<0 else .165),z,.3,.025,.18,.22,steel,bevel=.05)
 box('Side_fender',x,0,.68,.34,1.60,.09,edge)
 # Separate editable tread links; runtime moves these around the belt by distance travelled.
 for i in range(6):
  t=i/6*(2.4+math.tau*.25)
  if t<1.2:z=-.6+t;y=.55;a=0
  elif t<1.2+math.pi*.25:
   a=(t-1.2)/.25;z=.6+math.sin(a)*.25;y=.3+math.cos(a)*.25
  elif t<2.4+math.pi*.25:z=.6-(t-1.2-math.pi*.25);y=.05;a=math.pi
  else:
   a=math.pi+(t-2.4-math.pi*.25)/.25;z=-.6+math.sin(a)*.25;y=.3+math.cos(a)*.25
  link=box('TREAD_'+('L' if x<0 else 'R')+'_'+str(i),x,z,y,.33,.15,.055,steel,bevel=.01)
  link.rotation_euler.x=a
box('Turret_body',0,-.02,1.03,.94,.85,.47,armor,turret,.14)
box('Turret_hatch',0,-.08,1.30,.51,.48,.07,edge,turret)
box('Gun_mantlet',0,.40,1.04,.38,.21,.29,steel,turret,.06)
box('Cannon_barrel',0,.95,1.05,.14,1.03,.14,steel,cannon,.02)
box('Muzzle_brake',0,1.47,1.05,.23,.23,.22,track,cannon,.025)
box('Vision_slit',0,.405,1.19,.35,.025,.055,glass,turret,.008)
for x,z in [(-.32,.48),(.35,-.57),(-.43,-.38)]:box('Rust_chip',x,z,.795,.14,.11,.012,rust,bevel=.002)
for z in [-.65,-.54,-.43]:box('Engine_vent',0,z,.85,.62,.04,.015,track,bevel=.005)
socket=bpy.data.objects.new('SOCKET_muzzle',None);s.collection.objects.link(socket);socket.location=(0,-1.59,1.05);socket.parent=cannon
source=ROOT/'assets/blender/npcs/tank.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
groups={}
for o in list(s.objects):
 if o.type=='MESH' and not o.name.startswith('TREAD_'):groups.setdefault((o.parent.name,o.data.materials[0].name),[]).append(o)
for (parent,palette),objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 bpy.context.object.name=parent+'_'+palette
bpy.ops.export_scene.gltf(filepath=str(ROOT/'apps/web/public/assets/models/npc_tank.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_yup=True)
print('TANK_EXPORTED',bpy.app.version_string)
