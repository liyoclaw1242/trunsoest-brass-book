# rb.py —— 所有 make_*.py 共用的小工具：父空物件、方塊/圓柱/球、純色材質、碰撞方塊。
# 規範見 docs/scene-spec.md：1 單位＝1 公尺、原點底部中心、正面朝 -Y、狀態用子物件 <id>__<state>、碰撞 <id>__col。
import bpy, math

_mats = {}

# 金屬色（黃銅、灰金屬）給金屬感；其餘走霧面
_METAL = {(0.85, 0.65, 0.2), (0.45, 0.47, 0.5)}
def mat(color):
    """純色 principled 材質（快取）。金屬色自動帶金屬度，石材較粗糙。"""
    key = tuple(round(c, 3) for c in color)
    if key not in _mats:
        m = bpy.data.materials.new('rb_' + '_'.join(str(int(c * 255)) for c in key))
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        metal = key in {tuple(round(c, 3) for c in mc) for mc in _METAL}
        stone = key in {tuple(round(c, 3) for c in c2) for c2 in ((0.55, 0.55, 0.52), (0.35, 0.35, 0.34))}
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (*key, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.35 if metal else 0.95 if stone else 0.75
            if 'Metallic' in bsdf.inputs: bsdf.inputs['Metallic'].default_value = 0.8 if metal else 0.0
        m.diffuse_color = (*key, 1.0)
        _mats[key] = m
    return _mats[key]

def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj

def parent_empty(name, pos, props):
    """物件的根：空物件，放在格子 (x, y) 的地面上，自訂屬性全寫在這裡。"""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.3
    e.location = (float(pos[0]), float(pos[1]), 0.0)
    for k, v in props.items():
        if v is None:
            continue
        e[k] = v
    return link(e)

def state_root(parent, state):
    """狀態子物件 <id>__<state>，本身是空物件，底下掛該狀態的 mesh。原點與父物件相同。"""
    e = bpy.data.objects.new(f'{parent.name}__{state}', None)
    e.empty_display_size = 0.1
    e.parent = parent
    return link(e)

def _mesh_obj(name, mesh, parent, loc, rot, scale, color):
    mesh = mesh.copy()          # 每個物件自己一份 mesh，材質才不會互相串
    mesh.name = name
    o = bpy.data.objects.new(name, mesh)
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    o.parent = parent
    if color is not None:
        o.data.materials.append(mat(color))
    return link(o)

def _unit_cube():
    if 'rb_cube' not in bpy.data.meshes:
        bm = bpy.data.meshes.new('rb_cube')
        v = [(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5),(-.5,.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,.5,.5),(-.5,.5,.5)]
        f = [(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
        bm.from_pydata(v, [], f); bm.update()
    return bpy.data.meshes['rb_cube']

def _cyl(seg=12):
    key = f'rb_cyl{seg}'
    if key not in bpy.data.meshes:
        bm = bpy.data.meshes.new(key)
        v, f = [], []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            v.append((math.cos(a) * .5, math.sin(a) * .5, -.5)); v.append((math.cos(a) * .5, math.sin(a) * .5, .5))
        for i in range(seg):
            j = (i + 1) % seg
            f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
        f.append(tuple(2 * i for i in range(seg))[::-1]); f.append(tuple(2 * i + 1 for i in range(seg)))
        bm.from_pydata(v, [], f); bm.update()
    return bpy.data.meshes[key]

def _cone(seg=12):
    key = f'rb_cone{seg}'
    if key not in bpy.data.meshes:
        bm = bpy.data.meshes.new(key)
        v = [(math.cos(2 * math.pi * i / seg) * .5, math.sin(2 * math.pi * i / seg) * .5, -.5) for i in range(seg)] + [(0, 0, .5)]
        f = [(i, (i + 1) % seg, seg) for i in range(seg)] + [tuple(range(seg))[::-1]]
        bm.from_pydata(v, [], f); bm.update()
    return bpy.data.meshes[key]

def _sphere(seg=10, rings=6):
    key = f'rb_sph{seg}_{rings}'
    if key not in bpy.data.meshes:
        bm = bpy.data.meshes.new(key)
        v, f = [(0, 0, -.5)], []
        for r in range(1, rings):
            ph = math.pi * r / rings
            for s in range(seg):
                th = 2 * math.pi * s / seg
                v.append((math.sin(ph) * math.cos(th) * .5, math.sin(ph) * math.sin(th) * .5, -math.cos(ph) * .5))
        v.append((0, 0, .5))
        top = len(v) - 1
        for s in range(seg):
            f.append((0, 1 + (s + 1) % seg, 1 + s))
        for r in range(rings - 2):
            for s in range(seg):
                a = 1 + r * seg + s; b = 1 + r * seg + (s + 1) % seg
                f.append((a, b, b + seg, a + seg))
        base = 1 + (rings - 2) * seg
        for s in range(seg):
            f.append((base + s, base + (s + 1) % seg, top))
        bm.from_pydata(v, [], f); bm.update()
    return bpy.data.meshes[key]

def box(parent, name, size, center, color, rot=(0, 0, 0)):
    """方塊。size=(sx,sy,sz)，center 是方塊中心（相對父物件）。"""
    return _mesh_obj(name, _unit_cube(), parent, center, rot, size, color)

def cyl(parent, name, radius, height, center, color, rot=(0, 0, 0)):
    return _mesh_obj(name, _cyl(), parent, center, rot, (radius * 2, radius * 2, height), color)

def cone(parent, name, radius, height, center, color, rot=(0, 0, 0)):
    return _mesh_obj(name, _cone(), parent, center, rot, (radius * 2, radius * 2, height), color)

def sphere(parent, name, radius, center, color):
    return _mesh_obj(name, _sphere(), parent, center, (0, 0, 0), (radius * 2,) * 3, color)

def col(parent, size, center, suffix=''):
    """碰撞方塊 <id>__col。只有 translation + scale，沒有材質，畫面端讀取後隱藏。"""
    name = f'{parent.name}__col{suffix}'
    o = _mesh_obj(name, _unit_cube(), parent, center, (0, 0, 0), size, None)
    o.display_type = 'WIRE'
    o.hide_render = True
    return o

def props(type_, verbs, tags=(), **extra):
    """組出 rb_* 自訂屬性。"""
    p = {'rb_type': type_, 'rb_verbs': ','.join(verbs), 'rb_tags': ','.join(tags)}
    for k, v in extra.items():
        p['rb_' + k] = v
    return p

# 常用顏色
WOOD = (0.55, 0.36, 0.2)
DARKWOOD = (0.32, 0.2, 0.1)
BRASS = (0.85, 0.65, 0.2)
STONE = (0.55, 0.55, 0.52)
DARKSTONE = (0.35, 0.35, 0.34)
METAL = (0.45, 0.47, 0.5)
PAPER = (0.93, 0.9, 0.8)
INK = (0.15, 0.12, 0.1)
RED = (0.8, 0.15, 0.1)
