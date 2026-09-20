"""Original ruined village; shared colliders, editable pieces, deterministic export."""
import bpy, math, json, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'packages/shared/village-layout.json').read_text())
rng=random.Random(7342)
s=bpy.data.scenes.new('Coffee_Ruined_Village');bpy.context.window.scene=s
s.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0

def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=1
 return m
earth=[mat('Ground_'+str(i),(.20+i*.008,.185+i*.007,.15+i*.006)) for i in range(4)]
road=mat('Packed_dirt',(.30,.28,.235));stone=mat('Limestone',(.46,.43,.35));brick=mat('Broken_brick',(.32,.17,.105));plaster=mat('Weathered_plaster',(.52,.47,.35));char=mat('Charred_timber',(.075,.067,.055));roof=mat('Slate_roof',(.15,.18,.18));scorch=mat('Ground_scorch',(.10,.09,.075));metal=mat('Dull_iron',(.11,.13,.12))
def cube(name,x,z,y,w,d,h,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Flat_bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def ico(name,x,z,y,scale,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m);return o

def poly(name,points,height,m):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,height) for x,z in points],[],[tuple(range(len(points)-1,-1,-1))]);mesh.materials.append(m);o=bpy.data.objects.new(name,mesh);s.collection.objects.link(o);return o

# Faceted earth, muted palette. No hidden height changes.
verts=[(-22+x*4+(rng.uniform(-.65,.65) if 0<x<11 else 0),18-z*4+(rng.uniform(-.6,.6) if 0<z<9 else 0),0) for z in range(10) for x in range(12)]
faces=[]
for z in range(9):
 for x in range(11):
  a=z*12+x;faces.extend([(a,a+12,a+13),(a,a+13,a+1)])
mesh=bpy.data.meshes.new('Ground');mesh.from_pydata(verts,[],faces)
for m in earth:mesh.materials.append(m)
for p in mesh.polygons:p.material_index=rng.randrange(len(earth))
o=bpy.data.objects.new('VIS_Ground',mesh);s.collection.objects.link(o)
for x,z,w,d in [(0,-2,44,3.6),(-3,0,3.6,36),(0,12,44,3.4),(16,0,3.2,36)]:
 poly('VIS_Street',[(x-w/2,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2)],.014,road)
# Broken paving flush with the ground: decorative and traversable.
for i in range(180):
 x=rng.uniform(-21.5,21.5);z=rng.choice([-2,12])+rng.uniform(-1.3,1.3)
 w=rng.uniform(.25,.6);d=rng.uniform(.2,.5)
 poly('VIS_Paving',[(x-w,z-d),(x+w,z-d),(x+w*.8,z+d),(x-w*.9,z+d)],.021,stone)
# Tall geometry confined to rectangular colliders. Rubble plinths mark blocked interiors.
for ob in layout['obstacles']:
 x,z,w,d=ob['x'],ob['z'],ob['w'],ob['d']
 cube('VIS_Rubble_foundation',x,z,.16,w,d,.32,brick,.035)
 if ob['id']=='fountain':
  for dx,dz,ww,dd in [(-1.3,0,.3,3),(1.3,0,.3,3),(0,-1.3,2.4,.3),(0,1.3,2.4,.3)]:cube('VIS_Dry_fountain',x+dx,z+dz,.38,ww,dd,.6,stone,.04)
  cube('VIS_Broken_pedestal',x,z,.65,.7,.7,1.1,stone,.05)
 elif ob['id']=='barricade':
  for j in range(9):
   xx=x-w/2+.3+j*(w-.6)/8
   ico('VIS_Barricade_rubble',xx,z,.45,(.25,.45,.5),stone if j%2 else brick)
 else:
  # Low, torn walls maintain top-down visibility; closed rubble base forbids false doors.
  for side in [-1,1]:
   for j in range(int(w*2)):
    ww=w/int(w*2);h=rng.uniform(.45,1.55)
    cube('VIS_Broken_wall',x-w/2+(j+.5)*ww,z+side*(d/2-.17),.3+h/2,ww,.34,h,plaster if j%3 else brick,.02)
  for side in [-1,1]:
   for j in range(int(d*2)-2):
    dd=d/(int(d*2));h=rng.uniform(.35,1.2)
    cube('VIS_Return_wall',x+side*(w/2-.17),z-d/2+(j+1.5)*dd,.3+h/2,.34,dd,h,plaster,.02)
  for j in range(14):
   xx=x+rng.uniform(-w/2+.5,w/2-.5);zz=z+rng.uniform(-d/2+.5,d/2-.5)
   ico('VIS_Rubble',xx,zz,.45,(.25,.3,rng.uniform(.12,.4)),brick if j%2 else stone)
  for j in range(4):
   o=cube('VIS_Fallen_roof_beam',x+rng.uniform(-1,1),z+rng.uniform(-.5,.5),.5,.13,d*.65,.16,char);o.rotation_euler.z=rng.uniform(-.4,.4)
  # Broken slate roof panels remain inside the collider.
  poly('VIS_Collapsed_roof',[(x-.6,z-.7),(x+1,z-.5),(x+.8,z+.8),(x-.5,z+.5)],.63,roof)
# Flat shell scars and ash patches in open ground, no false collision.
for i in range(30):
 x=rng.uniform(-21,21);z=rng.uniform(-17,17);r=rng.uniform(.3,1)
 if any(abs(x-o['x'])<o['w']/2+1 and abs(z-o['z'])<o['d']/2+1 for o in layout['obstacles']):continue
 poly('VIS_Blast_scar',[(x+math.cos(j*math.tau/8)*r*rng.uniform(.8,1.2),z+math.sin(j*math.tau/8)*r) for j in range(8)],.025,scorch)
# Boundary ruins beyond playable bounds, with open sightlines at spawn approaches.
for x,z in [(-24,-10),(-24,8),(24,-7),(24,8),(-12,-21),(9,-21),(-9,21),(9,21)]:
 cube('VIS_Boundary_ruin',x,z,.65,2.4,2.4,1.3,brick,.06)
 cube('VIS_Chimney',x-.7,z-.6,1.8,.6,.65,3.6,brick,.04)
 for j in range(3):
  cube('VIS_Boundary_wall',x-.8+j*.7,z-1,1.2,.6,.3,rng.uniform(1.8,2.8),plaster,.02)
# Objective pads clearly stand out from the streets.
for p in [layout['kitchen']]+layout['tents']:
 poly('VIS_Objective_pad',[(p['x']+math.cos(j*math.tau/10)*2.6,p['z']+math.sin(j*math.tau/10)*2.4) for j in range(10)],.03,road)
# Keep editable pieces in .blend; merge runtime meshes by material to bound draw calls.
markers=[]
for ob in layout['obstacles']:
 marker=bpy.data.objects.new('COL_'+ob['id'],None);s.collection.objects.link(marker);marker.location=(ob['x'],-ob['z'],0)
 marker['width']=ob['w'];marker['depth']=ob['d'];markers.append({'id':marker.name,'position':[ob['x'],0,ob['z']],'width':ob['w'],'depth':ob['d']})
for kind,points in [('KITCHEN',[layout['kitchen']]),('TENT',layout['tents']),('SPAWN',layout['spawns'])]:
 for i,p in enumerate(points):
  marker=bpy.data.objects.new(f'{kind}_{i}',None);s.collection.objects.link(marker);marker.location=(p['x'],-p['z'],0);markers.append({'id':marker.name,'position':[p['x'],0,p['z']]})
source=ROOT/'assets/blender/map/village.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
groups={}
for o in list(s.objects):
 if o.type=='MESH':groups.setdefault(tuple(m.name for m in o.data.materials),[]).append(o)
for names,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='VIS_Batch_'+'_'.join(names)
out=ROOT/'apps/web/public/assets/models'
bpy.ops.export_scene.gltf(filepath=str(out/'village_map.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_extras=True,export_yup=True)
(out/'village-markers.json').write_text(json.dumps({'version':'village-markers.v1','frame':'Y_up_XZ_meters','layout':layout,'markers':markers},indent=2))
print('VILLAGE_MAP_EXPORTED',bpy.app.version_string)
