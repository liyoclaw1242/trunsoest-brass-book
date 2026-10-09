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

import rb, layout
for m in (rb, layout):
    importlib.reload(m)

MAKERS = {t: importlib.import_module(f'make_{t}') for t in
          ['book', 'lectern', 'speaker', 'notice', 'house', 'door', 'fence', 'keepsake', 'boundary', 'villager', 'outsider', 'lamppost', 'clothes', 'lamp',
           'library', 'workstation', 'goat', 'rope', 'census', 'bell', 'carved_stone', 'well']}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1.0

# 地面（匯出，畫面端保留）
size = getattr(layout, 'MAP', max(layout.CENTER) + layout.RADIUS + 12)
ground = rb.box(None, 'ground', (size * 1.0, size * 1.0, 0.02), (size / 2 - 0.5, size / 2 - 0.5, -0.01), (0.45, 0.62, 0.38))

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
    for k in ('radius', 'owner', 'parent', 'dir', 'kind', 'carrier'):
        if k in o and o[k] is not None:
            rec[k] = o[k]
    if t == 'villager':
        rec['color'] = [round(c, 2) for c in layout.VILLAGER_COLORS[id_]]
    records.append(rec)
    p['rb_state'] = rec['state']

# 只顯示初始狀態（匯出時所有狀態都要保留，所以不隱藏；畫面端依 scene.json 切換）

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
