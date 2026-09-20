"""Original Coffee Under Fire style sample. Blender Z-up, front -Y; GLB Y-up, front +Z."""
import bpy, math, json
from pathlib import Path
from mathutils import Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/web/public/assets/models'
SRC=ROOT/'assets/blender/slice'
OUT.mkdir(parents=True,exist_ok=True);SRC.mkdir(parents=True,exist_ok=True)
bpy.context.preferences.filepaths.save_version=0

def scene(name):
    s=bpy.data.scenes.new(name);bpy.context.window.scene=s;s.unit_settings.system='METRIC';s.render.fps=30
    return s

def mat(name,color,metal=0):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.82;p.inputs['Metallic'].default_value=metal
    return m
olive=mat('Olive_cloth',(.28,.36,.18));light=mat('Olive_highlight',(.42,.48,.27));skin=mat('Warm_skin',(.78,.55,.35));dark=mat('Boots_and_rifle',(.075,.10,.075));leather=mat('Warm_leather',(.27,.16,.08));canvas=mat('Canvas_gold',(.65,.54,.31));cream=mat('Enamel_cream',(.93,.86,.66));coffee=mat('Coffee',(.10,.04,.017));steel=mat('Steel',(.28,.31,.28),.4);wood=mat('Wood',(.38,.25,.13));soil=mat('Warm_earth',(.38,.39,.25));grass=mat('Dry_grass',(.47,.48,.28));stone=mat('Stone',(.48,.48,.37))

def cube(name,loc,size,m,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Small_flat_bevel','BEVEL');mod.width=bevel;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def cyl(name,loc,r,depth,m,verts=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=bpy.context.object;o.name=name;o.data.materials.append(m);return o

def ico(name,loc,scale,m):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(m);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return o

def export(name):
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_active_scene=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_yup=True)

s=scene('Slice_soldier')
ad=bpy.data.armatures.new('Soldier_rig');rig=bpy.data.objects.new('Soldier',ad);s.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in [('root',(0,0,0),(0,0,.45),None),('body',(0,0,.55),(0,0,1.15),'root'),('leg_l',(-.18,0,.62),(-.18,0,.12),'root'),('leg_r',(.18,0,.62),(.18,0,.12),'root'),('arm_l',(-.4,0,1.16),(-.4,0,.72),'body'),('arm_r',(.4,0,1.16),(.4,0,.72),'body')]:
    b=ad.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=ad.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

def bind(o,bone):
    g=o.vertex_groups.new(name=bone);g.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Skeleton','ARMATURE');mod.object=rig;o.parent=rig;return o
bind(cube('Tunic',(0,0,.92),(.66,.40,.70),olive,.07),'body')
bind(cube('Belt',(0,0,.69),(.69,.43,.11),leather,.015),'body')
bind(cube('Buckle',(0,-.23,.69),(.13,.04,.09),cream,.01),'body')
bind(cube('Backpack',(0,.26,1),(.49,.22,.52),canvas,.05),'body')
for x in [-.2,.2]:
    bind(cube('Front_pouch',(x,-.245,.83),(.18,.12,.21),canvas,.025),'body')
bind(cube('Head',(0,-.01,1.42),(.46,.40,.39),skin,.065),'body')
bind(cube('Nose',(0,-.24,1.43),(.1,.1,.12),skin,.015),'body')
for x in [-.105,.105]:bind(cube('Eye',(x,-.221,1.48),(.055,.025,.04),dark),'body')
bind(cyl('Helmet_brim',(0,0,1.62),.36,.07,olive,12),'body')
bind(ico('Helmet_dome',(0,.025,1.66),(.35,.31,.20),light),'body')
for x,b in [(-.18,'leg_l'),(.18,'leg_r')]:
    bind(cube('Trouser',(x,0,.45),(.26,.29,.39),olive,.025),b)
    bind(cube('Boot',(x,-.06,.15),(.28,.44,.29),dark,.035),b)
for x,b in [(-.4,'arm_l'),(.4,'arm_r')]:
    bind(cube('Sleeve',(x,0,1),(.22,.30,.39),olive,.04),b)
    bind(cube('Hand',(x,-.06,.76),(.19,.21,.18),skin,.035),b)
bind(cube('Rifle_stock',(.4,-.15,.85),(.13,.6,.15),wood,.025),'arm_r')
bind(cube('Rifle_barrel',(.4,-.60,.89),(.085,.44,.085),dark,.01),'arm_r')
bind(cube('Rifle_magazine',(.4,-.31,.72),(.12,.13,.2),steel,.01),'arm_r')
bind(cyl('VIS_Coffee',(-.44,-.17,.89),.16,.26,cream,12),'arm_l')
bind(cyl('VIS_Coffee_fill',(-.44,-.17,1.027),.135,.012,coffee,12),'arm_l')
bpy.ops.mesh.primitive_torus_add(major_segments=10,minor_segments=5,location=(-.62,-.17,.89),rotation=(math.pi/2,0,0),major_radius=.09,minor_radius=.025)
bpy.context.object.name='VIS_Coffee_handle';bpy.context.object.data.materials.append(cream);bind(bpy.context.object,'arm_l')
for name,loc,b in [('SOCKET_hand_weapon',(.4,-.25,.85),'arm_r'),('SOCKET_hand_coffee',(-.44,-.17,1.03),'arm_l'),('SOCKET_muzzle',(.4,-.83,.89),'arm_r')]:
    o=bpy.data.objects.new(name,None);s.collection.objects.link(o);o.parent=rig;o.parent_type='BONE';o.parent_bone=b;bpy.context.view_layer.update();o.matrix_world=Matrix.Translation(loc)
rig.animation_data_create()
for clip,length in [('idle',40),('run',24),('shoot',8),('reload',36),('hit',8),('death',24)]:
    a=bpy.data.actions.new(clip);rig.animation_data.action=a
    for f in range(1,length+2,2):
        t=(f-1)/length
        for pb in rig.pose.bones:pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
        if clip in ['idle','run']:
            stride=math.sin(t*math.tau)*(.58 if clip=='run' else .02)
            rig.pose.bones['leg_l'].rotation_euler.x=stride;rig.pose.bones['leg_r'].rotation_euler.x=-stride
            rig.pose.bones['arm_l'].rotation_euler.x=-stride*.45;rig.pose.bones['arm_r'].rotation_euler.x=stride*.2
            rig.pose.bones['body'].location.y=abs(math.sin(t*math.tau))*(.045 if clip=='run' else .012)
        if clip=='shoot':rig.pose.bones['arm_r'].rotation_euler.x=-.24*math.sin(t*math.pi);rig.pose.bones['body'].rotation_euler.x=.055*math.sin(t*math.pi)
        if clip=='reload':rig.pose.bones['arm_r'].rotation_euler.z=.6*math.sin(t*math.pi);rig.pose.bones['arm_l'].rotation_euler.z=-.65*math.sin(t*math.pi)
        if clip=='hit':rig.pose.bones['body'].rotation_euler.x=-.25*math.sin(t*math.pi)
        if clip=='death':rig.pose.bones['root'].rotation_euler.x=-math.pi/2*min(1,t*1.4);rig.pose.bones['root'].location.y=-.3*min(1,t*1.4)
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path='rotation_euler',frame=f);pb.keyframe_insert(data_path='location',frame=f)
    track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,a);rig.animation_data.action=None;track.mute=True
for pb in rig.pose.bones:pb.rotation_euler=(0,0,0);pb.location=(0,0,0)
s.frame_set(1)
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'soldier.blend'));export('slice_soldier')

s=scene('Slice_kitchen')
# Runtime origin is the interaction marker; prop goes behind it so the player is not inside a table.
cube('Table',(0,.9,.8),(2.5,.8,.16),wood,.04)
for x in [-1,1]:cube('Table_leg',(x,.9,.38),(.13,.65,.76),wood,.025)
for x in [-1.45,1.45]:cube('Awning_post',(x,1.25,1.35),(.10,.10,2.7),wood,.015)
cube('Canvas_awning',(0,1.05,2.7),(3.25,1.65,.12),canvas,.04)
for x in [-1.2,-.6,0,.6,1.2]:cube('Awning_stripe',(x,1.05,2.77),(.23,1.65,.018),cream)
cyl('Coffee_urn',(.6,.9,1.23),.29,.72,steel,10);cyl('Urn_lid',(.6,.9,1.62),.33,.08,dark,10)
cube('Urn_tap',(.6,.53,1.15),(.10,.22,.08),cream,.01)
for x in [-.7,-.3]:cyl('Waiting_mug',(x,.75,.99),.13,.22,cream,10);cyl('Coffee_surface',(x,.75,1.105),.11,.01,coffee,10)
cube('Coffee_crate',(-1.5,1.2,.3),(.65,.6,.6),wood,.04)
marker=bpy.data.objects.new('MARKER_kitchen_interact',None);s.collection.objects.link(marker)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'kitchen.blend'));export('slice_kitchen')

s=scene('Slice_tent')
# Open front canvas tent, origin at delivery interaction marker.
verts=[(-1.8,.6,0),(1.8,.6,0),(0,.6,2.65),(-1.8,3.5,0),(1.8,3.5,0),(0,3.5,2.65)]
mesh=bpy.data.meshes.new('Canvas');mesh.from_pydata(verts,[],[(0,2,5,3),(2,1,4,5),(3,5,4)]);mesh.materials.append(canvas)
o=bpy.data.objects.new('Tent_canvas',mesh);s.collection.objects.link(o)
# Double-sided canvas baked as thin solid geometry.
mod=o.modifiers.new('Canvas_thickness','SOLIDIFY');mod.thickness=.035;bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name)
for y in [.65,3.4]:cube('Tent_pole',(0,y,1.3),(.09,.09,2.6),wood,.01)
cube('Desk',(0,2.2,.7),(1.4,.7,.12),wood,.03);cube('Map',(0,2.2,.77),(.9,.5,.015),cream)
for x in [-1.95,1.95]:cube('Peg',(x,.4,.14),(.12,.12,.28),wood,.01)
marker=bpy.data.objects.new('MARKER_tent_interact',None);s.collection.objects.link(marker)
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'tent.blend'));export('slice_tent')

s=scene('Slice_terrain')
# Non-colliding low relief dressing, placed only inside the kitchen corner.
for i,(x,y,r) in enumerate([(-2,-1,.7),(1.5,-1,.65),(-1,2,.5),(2,2,.7),(0,-2,.6)]):
    ico('Ground_patch',(x,y,-.02),(r,r*.8,.04),soil if i%2 else grass)
for i in range(9):
    x=-2.7+(i%3)*.22;y=1.8+(i//3)*.25
    ico('Small_stone',(x,y,.08),(.16,.12,.1),stone)
for x,y in [(2.4,1.5),(-2.5,-1.4),(1.8,-2)]:
    for angle in [-.3,0,.4]:
        o=cube('Grass_blade',(x+angle*.2,y,.12),(.035,.07,.24),grass);o.rotation_euler.y=angle
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'terrain.blend'));export('slice_terrain')
(OUT/'slice-markers.json').write_text(json.dumps({'version':'slice-markers.v1','frame':'Y_up_XZ_meters','kitchen':{'interaction':[0,0,0]},'tent':{'interaction':[0,0,0]},'source':'assets/scripts/generate_slice.py'},indent=2))
print('SLICE_EXPORT_COMPLETE',bpy.app.version_string)
