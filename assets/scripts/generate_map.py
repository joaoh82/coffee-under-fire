"""Original deterministic outpost dressing; retains shared collision and objective layout."""
import bpy, math, json, random
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
layout=json.loads((ROOT/'packages/shared/map-layout.json').read_text())
rng=random.Random(7341)
s=bpy.data.scenes.new('Coffee_Outpost_Map');bpy.context.window.scene=s
s.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0

def mat(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=1
 return m
# Linear colors, no external textures.
earth=[mat('Ground_'+str(i),(.185+i*.007,.19+i*.006,.145+i*.005)) for i in range(5)]
dirt=mat('Packed_dirt',(.29,.235,.165));edge=mat('Path_edge',(.33,.30,.20));rock=mat('Grey_stone',(.37,.38,.30));rocklight=mat('Stone_light',(.46,.455,.35));grass=mat('Dry_grass',(.21,.245,.13));leaf=mat('Deep_foliage',(.12,.175,.10));wood=mat('Crate_wood',(.32,.215,.105));woodlight=mat('Wood_braces',(.48,.345,.17));metal=mat('Iron_bands',(.105,.135,.12));sand=mat('Sandbags',(.37,.335,.235));sandlight=mat('Sandbags_light',(.46,.405,.28))

scorch=mat('Scorched_earth',(.075,.065,.048));mud=mat('Wet_ruts',(.15,.12,.085));splinter=mat('Exposed_splinters',(.47,.365,.225))

def cube(name,x,z,y,w,d,h,m,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Flat_bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def ico(name,x,z,y,scale,m):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,-z,y));o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m);return o

def poly(name,points,height,m):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([(x,-z,height) for x,z in points],[],[tuple(range(len(points)-1,-1,-1))]);mesh.materials.append(m);o=bpy.data.objects.new(name,mesh);s.collection.objects.link(o);return o
# Broad subtle faceted terrain, flat gameplay surface.
verts=[(-22+x*4.4+(rng.uniform(-.7,.7) if 0<x<10 else 0),18-z*3.6+(rng.uniform(-.6,.6) if 0<z<10 else 0),0) for z in range(11) for x in range(11)]
faces=[]
for z in range(10):
 for x in range(10):
  a=z*11+x;faces.extend([(a,a+11,a+12),(a,a+12,a+1)])
mesh=bpy.data.meshes.new('Ground');mesh.from_pydata(verts,[],faces)
for m in earth:mesh.materials.append(m)
for p in mesh.polygons:p.material_index=rng.randrange(len(earth))
o=bpy.data.objects.new('VIS_Ground',mesh);s.collection.objects.link(o)
# Irregular-edged broad paths, all only visual.
roads=[((-21,5),(21,5),3.2),((15,-17),(15,17),3.0),((-17,12),(-17,5),2.3),((-3,-14),(15,-14),2.3)]
for index,(start,end,width) in enumerate(roads):
 dx=end[0]-start[0];dz=end[1]-start[1];length=math.hypot(dx,dz);nx=-dz/length;nz=dx/length
 points=[];count=max(3,int(length/2))
 for side in [-1,1]:
  seq=range(count+1) if side==-1 else reversed(range(count+1))
  for i in seq:
   t=i/count;spread=width/2+rng.uniform(-.18,.18)
   points.append((start[0]+dx*t+nx*spread*side,start[1]+dz*t+nz*spread*side))
 poly('VIS_Track_'+str(index),points,.012+index*.003,dirt)
 for i in range(1,count):
  t=i/count
  for side in [-1,1]:
   x=start[0]+dx*t+nx*(width/2+.18)*side;z=start[1]+dz*t+nz*(width/2+.18)*side
   ico('VIS_Path_pebble',x,z,.025,(rng.uniform(.08,.2),rng.uniform(.1,.18),.055),rock)
# Clear pale staging areas around every possible objective.
for p in [layout['kitchen']]+layout['tents']:
 points=[(p['x']+math.cos(i*math.tau/10)*2.65,p['z']+math.sin(i*math.tau/10)*2.5) for i in range(10)]
 poly('VIS_Objective_earth',points,.025,dirt)
# Every tall interior prop is contained by an EXISTING gameplay collider.
for ob in layout['obstacles']:
 x,z,w,d=ob['x'],ob['z'],ob['w'],ob['d']
 if ob['id'].startswith('wall'):
  cols=math.ceil(w/1.4);step=w/cols
  for row in range(3):
   for col in range(cols):
    for depth_row in [-1,1]:
     xx=x-w/2+step*(col+.5)
     # Keep the continuous base readable as collision cover; damage only the top.
     height=.37 if row<2 else rng.uniform(.18,.37)
     bag=cube('VIS_Sandbag',xx,z+depth_row*d*.245,.19+row*.34-(.37-height)/2,step-.025,d*.47,height,sand if (col+row)%3 else sandlight,.10)
     if row==2:bag.rotation_euler.z=rng.uniform(-.08,.08)
     if row==2 and col%3==0:
      cube('VIS_Torn_seam',xx,z+depth_row*d*.485,.19+row*.34,step*.42,.018,.05,scorch)
 elif ob['id']=='orchard_north':
  ico('VIS_Cover_boulder',x,z,.55,(w*.52,d*.52,.85),rocklight)
  ico('VIS_Cover_boulder',x+.25,z-.3,1.02,(.55,.5,.45),rock)
 else:
  cube('VIS_Crate_body',x,z,.6,w,d,1.2,wood,.05)
  for xx in [x-w*.36,x+w*.36]:
   cube('VIS_Crate_brace',xx,z,.62,.12,d+.015,1.18,woodlight,.012)
  for zz in [z-d*.38,z+d*.38]:
   cube('VIS_Crate_band',x,zz,.62,w+.012,.075,1.19,metal,.01)
  # Slats on the lid, no extra collider height.
  for i in range(max(2,int(w/.45))):
   plank=cube('VIS_Lid_slat',x-w/2+.23+i*.45,z,1.207,.38,d-.08,.025,woodlight,.008)
   plank.rotation_euler.z=rng.uniform(-.035,.035)
  for j in range(3):
   cube('VIS_Crate_damage',x-w*.32+j*w*.25,z-d/2-.01,.42+j*.2,.035,.018,.21,scorch)
# Low dressing: short grass/flat stones do not pretend to be collision cover.
def forbidden(x,z):
 if any(math.hypot(x-p['x'],z-p['z'])<3 for p in [layout['kitchen']]+layout['tents']+layout['spawns']):return True
 if any(abs(x-o['x'])<o['w']/2+.7 and abs(z-o['z'])<o['d']/2+.7 for o in layout['obstacles']):return True
 if abs(z-5)<2.1 or abs(x-15)<2 or (abs(x+17)<1.6 and 4<z<14) or (abs(z+14)<1.6 and -4<x<16):return True
 return False
for i in range(145):
 x=rng.uniform(-21.4,21.4);z=rng.uniform(-17.4,17.4)
 if forbidden(x,z):continue
 if i%3==0:
  radius=rng.uniform(.15,.4);ico('VIS_Flat_stone',x,z,.025,(radius,radius*.7,.07),rocklight)
 else:
  for j in range(4):
   o=cube('VIS_Grass',x+j*.065,z,.13,.045,.065,.26,grass);o.rotation_euler.y=rng.uniform(-.45,.45)
# Shallow shell scars: rings sit on the gameplay plane, not deep holes or new barriers.
for x,z,r in [(-11,8,1.35),(-7,-9,1.6),(3,1,1.15),(9,10,1.4),(-17,-7,.95),(6,-9,1.2),(18,-6,1.0),(-6,13,1.1)]:
 if forbidden(x,z):continue
 points=[(x+math.cos(i*math.tau/12)*r*rng.uniform(.92,1.12),z+math.sin(i*math.tau/12)*r*rng.uniform(.92,1.12)) for i in range(12)]
 poly('VIS_Blast_halo',[(x+(px-x)*1.3,z+(pz-z)*1.3) for px,pz in points],.027,mud)
 poly('VIS_Shell_scar',points,.035,scorch)
 for i in range(12):
  a=points[i];b=points[(i+1)%12]
  poly('VIS_Crater_slope',[a,b,(x+(b[0]-x)*.7,z+(b[1]-z)*.7),(x+(a[0]-x)*.7,z+(a[1]-z)*.7)],.055,dirt if i%3 else mud)
 for j in range(4):
  a=j*math.tau/4+.3
  ico('VIS_Ejected_soil',x+math.cos(a)*r,z+math.sin(a)*r,.065,(.22,.18,.12),dirt)
# Broken, interrupted wheel ruts and churned ground along the supply track.
for x in range(-20,21):
 for z in [4.25,5.65]:
  if rng.random()<.24:continue
  poly('VIS_Wheel_rut',[(x-.42,z-.11),(x+.38,z-.13),(x+.48,z+.09),(x-.38,z+.13)],.03,mud)
  for j in [-1,1]:
   poly('VIS_Tread_mark',[(x-.2,z+j*.15),(x+.03,z+j*.15),(x+.17,z+j*.32),(x-.07,z+j*.32)],.031,edge)
# Flat splinters and weathered ground patches never act as hidden obstacles.
for i in range(55):
 x=rng.uniform(-21,21);z=rng.uniform(-17,17)
 if forbidden(x,z):continue
 r=rng.uniform(.25,.65)
 poly('VIS_Churned_patch',[(x-r,z),(x-.4*r,z-r*.6),(x+r,z-.2*r),(x+.7*r,z+r*.4)],.021,edge if i%3 else mud)
 if i%4==0:
  o=cube('VIS_Flat_splinter',x,z,.045,.07,.5,.04,splinter);o.rotation_euler.z=rng.uniform(0,math.tau)
# Broken fences, snapped trunks and fallen timber outside movement bounds.
for x,z in [(-23,1),(-23,12),(23,4),(-6,-19.5),(13,19.5)]:
 for offset,height in [(-1.4,.8),(0,1.3),(1.4,.55)]:
  post=cube('VIS_Broken_fence_post',x if abs(x)>22 else x+offset,z+offset if abs(x)>22 else z,height/2,.16,.18,height,wood,.025);post.rotation_euler.y=.13
 for offset,angle in [(-.7,.18),(.65,-.3)]:
  rail=cube('VIS_Split_fence_rail',x if abs(x)>22 else x+offset,z+offset if abs(x)>22 else z,.65,1.35,.10,.12,splinter,.015)
  if abs(x)>22:rail.rotation_euler.z=math.pi/2;rail.rotation_euler.x=angle
  else:rail.rotation_euler.y=angle
for x,z in [(-23.3,-6),(23.4,9),(-9,19.2),(11,-19.2)]:
 log=cube('VIS_Fallen_trunk',x,z,.3,2.8,.48,.48,wood,.12);log.rotation_euler.z=.35+(math.pi/2 if abs(x)>22 else 0)
 stump_x=x if abs(x)>22 else x-1.2
 cube('VIS_Snapped_stump',stump_x,z+.7,.42,.55,.55,.84,wood,.1)
 ico('VIS_Stump_core',stump_x,z+.7,.85,(.23,.23,.035),splinter)
 for dx in [-.5,.6]:
  branch=cube('VIS_Snapped_branch',x+dx,z+.35,.45,.16,1.1,.14,wood,.03);branch.rotation_euler.z=-.5
# Rock berm and trees OUTSIDE the 44x36 movement bounds; sparse gaps preserve spawn readability.
for side in [-1,1]:
 for i in range(16):
  z=-17+i*2.25
  if any(abs(z-p['z'])<1.4 and side*p['x']>18 for p in layout['spawns']):continue
  ico('VIS_Border_rock',side*22.7,z,.2,(.7,1,.5),rock)
 for i in range(20):
  x=-21+i*2.2
  if any(abs(x-p['x'])<1.4 and side*p['z']>14 for p in layout['spawns']):continue
  ico('VIS_Border_rock',x,side*18.65,.2,(1,.6,.45),rock)
for x,z in [(-24,-12),(-24,7),(24,-8),(24,12),(-12,-21),(7,21)]:
 cube('VIS_Tree_trunk',x,z,1.15,.35,.35,2.3,wood,.03)
 if x<0:
  for dx,tilt in [(-.45,-.65),(.4,.6)]:
   branch=cube('VIS_Bare_branch',x+dx,z,2.0,.18,.18,1.3,wood,.025);branch.rotation_euler.y=tilt
 else:
  for dx,dz,y,r in [(0,0,2.5,1.15),(.4,.3,3.2,.8),(-.55,0,2.9,.75)]:ico('VIS_Tree_canopy',x+dx,z+dz,y,(r,r,r*.8),leaf)
# Keep editable pieces in .blend; merge runtime meshes by material to bound draw calls.
markers=[]
for ob in layout['obstacles']:
 marker=bpy.data.objects.new('COL_'+ob['id'],None);s.collection.objects.link(marker);marker.location=(ob['x'],-ob['z'],0)
 marker['width']=ob['w'];marker['depth']=ob['d'];markers.append({'id':marker.name,'position':[ob['x'],0,ob['z']],'width':ob['w'],'depth':ob['d']})
for kind,points in [('KITCHEN',[layout['kitchen']]),('TENT',layout['tents']),('SPAWN',layout['spawns'])]:
 for i,p in enumerate(points):
  marker=bpy.data.objects.new(f'{kind}_{i}',None);s.collection.objects.link(marker);marker.location=(p['x'],-p['z'],0);markers.append({'id':marker.name,'position':[p['x'],0,p['z']]})
source=ROOT/'assets/blender/map/outpost.blend';bpy.ops.wm.save_as_mainfile(filepath=str(source))
groups={}
for o in list(s.objects):
 if o.type=='MESH':groups.setdefault(tuple(m.name for m in o.data.materials),[]).append(o)
for names,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name='VIS_Batch_'+'_'.join(names)
out=ROOT/'apps/web/public/assets/models'
bpy.ops.export_scene.gltf(filepath=str(out/'outpost_map.glb'),export_format='GLB',use_active_scene=True,export_animations=False,export_extras=True,export_yup=True)
(out/'outpost-markers.json').write_text(json.dumps({'version':'outpost-markers.v1','frame':'Y_up_XZ_meters','layout':layout,'markers':markers},indent=2))
print('OUTPOST_MAP_EXPORTED',bpy.app.version_string)
