# build_scene.py —— 擺出整個村子，匯出 public/village.glb 與 public/scene.json，並算兩張圖到 docs/playtest/m1/。
# 用法：blender --background --python blender/build_scene.py [-- --out public --render docs/playtest/m1]
import bpy, sys, os, json, math, importlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if HERE not in sys.path:
    sys.path.insert(0, HERE)

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return args[args.index(name) + 1] if name in args else default
OUT = os.path.join(ROOT, arg('--out', 'public'))
RENDER = os.path.join(ROOT, arg('--render', 'docs/playtest/m1')) if '--no-render' not in args else None

import rb, layout, scenery
for m in (rb, layout, scenery):
    importlib.reload(m)

MAKERS = {t: importlib.import_module(f'make_{t}') for t in
          ['book', 'lectern', 'speaker', 'notice', 'house', 'door', 'fence', 'boundary', 'villager', 'outsider', 'lamppost', 'clothes', 'lamp',
           'library', 'workstation', 'goat', 'rope', 'census', 'carved_stone', 'well',
           'field', 'granary', 'shop', 'post', 'cart']}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

# 地面（匯出，畫面端保留）
size = getattr(layout, 'MAP', max(layout.CENTER) + layout.RADIUS + 12)
ground = rb.box(None, 'ground', (size * 1.0, size * 1.0, 0.02), (size / 2 - 0.5, size / 2 - 0.5, -0.01), rb.GRASS)

records = []
parents = []
for o in layout.OBJECTS:
    o = dict(o)
    t, id_, pos = o.pop('type'), o.pop('id'), o.pop('pos')
    if pos is None:   # 區域假物件：沒有模型
        records.append({'id': id_, 'type': t, 'pos': None, 'state': 'intact', 'tags': ['zone'], 'verbs': ['enter']})
        continue
    kw = dict(o)
    if t == 'villager':
        kw['color'] = layout.VILLAGER_COLORS[id_]
    if t in ('keepsake', 'clothes'):
        kw['color'] = layout.VILLAGER_COLORS[kw['owner']]
    p = MAKERS[t.replace('-', '_')].make(id_, pos, **kw)
    parents.append(p)
    rec = {'id': id_, 'type': t, 'pos': [int(pos[0]), int(pos[1])]}
    default_state = {'book': 'closed', 'speaker': 'intact', 'notice': 'written', 'door': 'closed', 'fence': 'intact',
                     'cart': 'intact', 'villager': 'puppet', 'lamp': 'unlit', 'census': 'intact', 'rope': 'intact'}.get(t, 'intact')
    rec['state'] = o.get('state', default_state)
    rec['tags'] = [s for s in p['rb_tags'].split(',') if s]
    rec['verbs'] = [s for s in p['rb_verbs'].split(',') if s]
    for k in ('radius', 'owner', 'parent', 'dir', 'kind', 'carrier', 'role', 'field', 'shop', 'cart'):
        if k in o and o[k] is not None:
            rec[k] = o[k]
    if t == 'villager':
        rec['color'] = [round(c, 2) for c in layout.VILLAGER_COLORS[id_]]
    records.append(rec)
    p['rb_state'] = rec['state']

# 只顯示初始狀態（匯出時所有狀態都要保留，所以不隱藏；畫面端依 scene.json 切換）

# 星露谷風裝飾（非互動、不進 scene.json）
scenery.scatter(layout, seed=7)

# —— 效能：把上百件靜態裝飾依「平面地貼 / 立體道具」各合併成一個 mesh ——
# 合併後 three.js 的 draw call 從數千降到依材質數的數十，FPS 大幅提升。裝飾不互動、不需獨立節點。
def merge_decor():
    flats, props = [], []
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            continue
        root = o
        while root.parent:
            root = root.parent
        if not root.name.startswith('decor'):
            continue
        (flats if '_slab' in o.name else props).append(o)
    for group, newname in [(flats, 'decor_ground_slab_merged'), (props, 'decor_props_merged')]:
        group = [o for o in group if o.name in bpy.data.objects]
        if not group:
            continue
        for o in group:                       # 先把世界座標烘進 local，解除父子關係
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
        try:
            with bpy.context.temp_override(active_object=group[0], selected_objects=group,
                                           selected_editable_objects=group):
                bpy.ops.object.join()
            group[0].name = newname
        except Exception as e:
            print('MERGE skipped for', newname, e)
    # 清掉空的 decor empties（已無子物件）
    for o in list(bpy.data.objects):
        if o.type == 'EMPTY' and o.name.startswith('decor') and not o.children:
            bpy.data.objects.remove(o, do_unlink=True)
merge_decor()

# —— 效能：把每個互動物件、每個狀態內的 mesh 合併成一個（共用材質者併為同一 draw call）。
# 保留 __col（碰撞，驗證器要對照）與屋頂（__intact_roof，進屋時要單獨隱藏）不併。
def merge_states():
    def keep(n):
        return '__col' in n or '__intact_roof' in n
    # 先收集所有狀態根的名字（join 只會移除 mesh，不動 empty，所以之後以名字重新取用都安全）
    srnames = []
    for parent in list(bpy.data.objects):
        if parent.parent is not None or parent.type != 'EMPTY':
            continue
        if parent.name.startswith('decor') or parent.name == 'ground':
            continue
        for sr in [c for c in parent.children if c.type == 'EMPTY']:
            srnames.append(sr.name)
    for srname in srnames:
        sr = bpy.data.objects.get(srname)
        if not sr:
            continue
        meshes = [o for o in sr.children_recursive if o.type == 'MESH' and not keep(o.name)]
        if len(meshes) < 2:
            continue
        for o in meshes:
            mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
        try:
            with bpy.context.temp_override(active_object=meshes[0], selected_objects=meshes,
                                           selected_editable_objects=meshes):
                bpy.ops.object.join()
            m = meshes[0]
            mw = m.matrix_world.copy(); m.parent = sr; m.matrix_world = mw
            m.name = srname + '_merged'
        except Exception as e:
            print('STATE MERGE skip', srname, e)
merge_states()

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, 'scene.json'), 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=0)
    f.write('\n')
with open(os.path.join(OUT, 'scene.meta.json'), 'w', encoding='utf-8') as f:
    json.dump({'center': list(layout.CENTER), 'radius': layout.RADIUS, 'start': list(layout.START), 'size': size,
               'roads': getattr(layout, 'ROADS', []),
               'plaza': getattr(layout, 'PLAZA', None), 'wildDeep': getattr(layout, 'WILDDEEP', None)}, f)

glb = os.path.join(OUT, 'village.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', export_extras=True, export_apply=True,
                          export_cameras=False, export_lights=False, export_yup=True)
print('WROTE', glb, os.path.getsize(glb), 'bytes;', len(records), 'objects')

# ---- 算圖：正上方 + 斜上方 ----
if RENDER:
    os.makedirs(RENDER, exist_ok=True)
    # 只顯示每個物件的初始狀態
    for p in parents:
        st = p['rb_state']
        for ch in p.children:
            if '__col' in ch.name:
                ch.hide_render = True
            elif ch.name.startswith(p.name + '__') and ch.name != f'{p.name}__{st}':
                ch.hide_render = True
                for g in ch.children_recursive:
                    g.hide_render = True
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.display.shading.shadow_intensity = 0.4
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_object_outline = True
    scene.render.resolution_x = 1800
    scene.render.resolution_y = 1800
    scene.render.film_transparent = False
    world = bpy.data.worlds.new('w'); scene.world = world; world.color = (0.9, 0.9, 0.9)
    cx, cy = layout.CENTER
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 2 * (layout.RADIUS + 6)
    co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); scene.camera = co
    # 正上方
    co.location = (cx, cy, 120); co.rotation_euler = (0, 0, 0)
    scene.render.filepath = os.path.join(RENDER, 'top.png'); bpy.ops.render.render(write_still=True)
    # 斜上方（從 -Y 方向、俯角 55°）
    pitch = math.radians(55)
    d = 120
    co.location = (cx, cy - d * math.sin(pitch), d * math.cos(pitch) + 0)
    co.rotation_euler = (pitch, 0, 0)
    cam.ortho_scale = 2 * (layout.RADIUS + 8)
    scene.render.filepath = os.path.join(RENDER, 'iso.png'); bpy.ops.render.render(write_still=True)
    print('RENDERED', RENDER)
