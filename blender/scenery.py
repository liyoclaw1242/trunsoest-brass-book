# scenery.py —— 星露谷風格的裝飾（樹、灌木、花、草叢、鋪石廣場、草地色塊）。
# 全部是「非互動、不擋路」的裝飾：不進 scene.json、不產生 __col，畫面端用節點名前綴 decor_ 辨識。
# 擺放用固定種子，確保每次重建一致。
import math, random
import bpy
import rb

def _decor(id, pos, z=0.0):
    e = bpy.data.objects.new(id, None)
    e.empty_display_size = 0.1
    e.location = (float(pos[0]), float(pos[1]), z)
    return rb.link(e)

# ---------- 單件裝飾 ----------
def tree(id, pos, kind='round', rng=random):
    p = _decor(id, pos)
    h = 1.6 + rng.random() * 1.1
    rb.cyl(p, f'{id}_trunk', 0.16, h, (0, 0, h / 2), rb.TRUNK)
    if kind == 'pine':
        leaf = rng.choice([rb.LEAF, rb.LEAF2])
        for i in range(3):
            s = 1.7 - i * 0.45
            rb.cone(p, f'{id}_canopy{i}', s * 0.6, 1.1, (0, 0, h - 0.1 + i * 0.7), leaf)
    else:
        leaf = rng.choice([rb.LEAF, rb.LEAF2, rb.LEAF3])
        for i, (dx, dy, dz, r) in enumerate([(0, 0, 0, 1.25), (-0.5, 0.2, -0.3, 0.9), (0.5, -0.1, -0.2, 0.95), (0.1, 0.4, 0.4, 0.8)]):
            rb.sphere(p, f'{id}_canopy{i}', r, (dx, dy, h + 0.4 + dz), leaf)
    return p

def bush(id, pos, rng=random):
    p = _decor(id, pos)
    leaf = rng.choice([rb.LEAF, rb.LEAF2, rb.LEAF3])
    for i, (dx, dy, r) in enumerate([(0, 0, 0.55), (-0.3, 0.1, 0.4), (0.3, 0.05, 0.42)]):
        o = rb.sphere(p, f'{id}_leaf{i}', r, (dx, dy, 0.4 + r * 0.3), leaf)
        o.scale = (o.scale[0], o.scale[1], o.scale[2] * 0.8)
    if rng.random() < 0.5:
        c = rng.choice(rb.FLOWERS)
        for j in range(3):
            rb.sphere(p, f'{id}_berry{j}', 0.08, (rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), 0.7), c)
    return p

def flowers(id, pos, rng=random):
    p = _decor(id, pos)
    n = 2 + rng.randint(0, 3)
    for i in range(n):
        dx, dy = rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35)
        rb.box(p, f'{id}_stem{i}', (0.03, 0.03, 0.28), (dx, dy, 0.14), (0.35, 0.55, 0.25))
        rb.sphere(p, f'{id}_bloom{i}', 0.1, (dx, dy, 0.3), rng.choice(rb.FLOWERS))
    return p

def grasstuft(id, pos, rng=random):
    p = _decor(id, pos)
    col = rng.choice([rb.GRASS2, rb.LEAF3, rb.GRASS])
    for i in range(3 + rng.randint(0, 2)):
        dx, dy = rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25)
        rb.box(p, f'{id}_blade{i}', (0.05, 0.05, 0.22 + rng.random() * 0.18), (dx, dy, 0.12), col,
               rot=(rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), 0))
    return p

def rock(id, pos, rng=random):
    p = _decor(id, pos)
    r = 0.35 + rng.random() * 0.3
    o = rb.sphere(p, f'{id}_rock', r, (0, 0, r * 0.35), rng.choice([rb.STONE, rb.COBBLE2, rb.DARKSTONE]))
    o.scale = (o.scale[0] * 1.2, o.scale[1], o.scale[2] * 0.6)
    return p

def scarecrow(id, pos, rng=random):
    p = _decor(id, pos)
    rb.box(p, f'{id}_post', (0.12, 0.12, 2.0), (0, 0, 1.0), rb.TRUNK)
    rb.box(p, f'{id}_arms', (1.5, 0.1, 0.1), (0, 0, 1.5), rb.TRUNK)
    rb.box(p, f'{id}_body', (0.5, 0.3, 0.6), (0, 0, 1.35), rb.THATCH)
    rb.sphere(p, f'{id}_head', 0.26, (0, 0, 1.85), (0.86, 0.72, 0.5))
    rb.cyl(p, f'{id}_hatbrim', 0.4, 0.05, (0, 0, 2.02), rb.DARKWOOD)
    rb.cyl(p, f'{id}_hattop', 0.22, 0.22, (0, 0, 2.14), rb.DARKWOOD)
    rb.box(p, f'{id}_eyeL', (0.06, 0.06, 0.06), (-0.1, -0.22, 1.9), rb.INK)
    rb.box(p, f'{id}_eyeR', (0.06, 0.06, 0.06), (0.1, -0.22, 1.9), rb.INK)
    # 稻草從袖口露出
    for j, dx in enumerate((-0.72, 0.72)):
        rb.cone(p, f'{id}_straw{j}', 0.1, 0.3, (dx, 0, 1.5), rb.THATCH, rot=(0, 1.5708 if dx > 0 else -1.5708, 0))
    return p

def bench(id, pos, rng=random, face='y'):
    p = _decor(id, pos)
    rot = (0, 0, 1.5708) if face == 'x' else (0, 0, 0)
    rb.box(p, f'{id}_seat', (1.2, 0.4, 0.08), (0, 0, 0.45), rb.WOOD, rot)
    rb.box(p, f'{id}_back', (1.2, 0.08, 0.4), (0, 0.16, 0.68), rb.WOOD, rot)
    rb.box(p, f'{id}_legL', (0.1, 0.4, 0.45), (-0.5, 0, 0.22), rb.DARKWOOD, rot)
    rb.box(p, f'{id}_legR', (0.1, 0.4, 0.45), (0.5, 0, 0.22), rb.DARKWOOD, rot)
    if face == 'x':
        for o in p.children:
            o.location = (o.location.y, o.location.x, o.location.z)
    return p

def planter(id, pos, rng=random):
    p = _decor(id, pos)
    rb.box(p, f'{id}_box', (0.7, 0.7, 0.4), (0, 0, 0.2), rb.TIMBER)
    rb.box(p, f'{id}_soil', (0.58, 0.58, 0.1), (0, 0, 0.4), rb.SOILC)
    for j in range(5):
        dx, dy = rng.uniform(-0.22, 0.22), rng.uniform(-0.22, 0.22)
        rb.box(p, f'{id}_stem{j}', (0.03, 0.03, 0.26), (dx, dy, 0.55), (0.35, 0.55, 0.25))
        rb.sphere(p, f'{id}_bloom{j}', 0.1, (dx, dy, 0.7), rng.choice(rb.FLOWERS))
    return p

def signpost(id, pos, rng=random):
    p = _decor(id, pos)
    rb.box(p, f'{id}_post', (0.14, 0.14, 2.0), (0, 0, 1.0), rb.DARKWOOD)
    rb.box(p, f'{id}_board', (1.2, 0.1, 0.5), (0.2, 0, 1.7), rb.WOOD)
    rb.box(p, f'{id}_board2', (0.9, 0.1, 0.4), (-0.1, 0, 1.15), rb.WOOD)
    rb.cyl(p, f'{id}_cap', 0.12, 0.14, (0, 0, 2.05), rb.BRASS)
    return p

def ground_patch(id, pos, w, d, color, z=0.012):
    p = _decor(id, pos, z)
    rb.box(p, f'{id}_slab', (w, d, 0.02), (0, 0, 0), color)
    return p

def ground_disc(id, pos, r, color, z=0.01):
    """圓形草地色塊：邊緣柔和，不像方塊拼貼。"""
    p = _decor(id, pos, z)
    rb.cyl(p, f'{id}_slab', r, 0.02, (0, 0, 0), color)
    return p

# ---------- 擺放 ----------
def scatter(layout, seed=7):
    rng = random.Random(seed)
    cx, cy = layout.CENTER
    R = layout.RADIUS
    objs = []
    # 佔用格（建物／站點／住宅佔地）避免把樹種在屋裡或攤子上
    occupied = set()
    for o in layout.OBJECTS:
        pos = o.get('pos')
        if not pos:
            continue
        t = o['type']
        if t in ('house', 'library'):
            for i in range(pos[0] - 3, pos[0] + 3):
                for j in range(pos[1] - 4, pos[1] + 3):
                    occupied.add((i, j))
        else:
            for i in range(pos[0] - 1, pos[0] + 2):
                for j in range(pos[1] - 1, pos[1] + 2):
                    occupied.add((i, j))

    def free(x, y, pad=0):
        for i in range(x - pad, x + pad + 1):
            for j in range(y - pad, y + pad + 1):
                if (i, j) in occupied:
                    return False
        return True

    def road_center(x, y):
        for (x0, y0, x1, y1) in layout.ROADS:
            if x0 <= x <= x1 and y0 <= y <= y1:
                return True
        return False

    # 鋪石廣場（出生點一帶）
    if getattr(layout, 'PLAZA', None):
        x0, y0, x1, y1 = layout.PLAZA
        objs.append(ground_patch('decor_plaza', ((x0 + x1) / 2, (y0 + y1) / 2), x1 - x0 + 1, y1 - y0 + 1, rb.COBBLE, z=0.02))

    # 草地色塊（圓形、低對比、邊緣柔和，讓地面有層次卻不像拼磚）
    for k in range(110):
        x = rng.randint(cx - R - 8, cx + R + 8); y = rng.randint(cy - R - 8, cy + R + 8)
        if (x - cx) ** 2 + (y - cy) ** 2 > (R + 12) ** 2:
            continue
        r = rng.uniform(1.6, 3.6)
        objs.append(ground_disc(f'decor_grass_{k:02d}', (x, y), r, rng.choice([rb.GRASS2, rb.GRASS3, rb.GRASS2]), z=0.006 + rng.random() * 0.004))

    # 樹：沿影響圈外圍成林，框住村子（在範圍內緣也點綴幾棵）
    ti = 0
    for ang_i in range(64):
        a = 2 * math.pi * ang_i / 64 + rng.uniform(-0.04, 0.04)
        rr = R + rng.uniform(1.5, 12)
        x = round(cx + rr * math.cos(a)); y = round(cy + rr * math.sin(a))
        if not (0 <= x < layout.MAP and 0 <= y < layout.MAP):
            continue
        # 別把出口路堵死：通往荒野的東路／北路附近留白
        if road_center(x, y):
            continue
        objs.append(tree(f'decor_tree_{ti:02d}', (x, y), rng.choice(['round', 'round', 'pine']), rng))
        ti += 1
    # 林中空地外再撒一些成叢的樹
    for c in range(10):
        bx = rng.randint(cx - R - 14, cx + R + 14); by = rng.randint(cy - R - 14, cy + R + 14)
        if (bx - cx) ** 2 + (by - cy) ** 2 < (R + 2) ** 2:
            continue
        if not (2 <= bx < layout.MAP - 2 and 2 <= by < layout.MAP - 2):
            continue
        for k in range(rng.randint(2, 4)):
            x = bx + rng.randint(-3, 3); y = by + rng.randint(-3, 3)
            objs.append(tree(f'decor_tree_{ti:02d}', (x, y), rng.choice(['round', 'pine']), rng))
            ti += 1

    # 村內的灌木、花、草叢、石頭：掃點撒，避開佔用格與路心，讓村子溫馨
    placed = []
    def place(maker, prefix, count, rmin, rmax, avoid_road=True):
        nonlocal placed
        n = 0; tries = 0
        while n < count and tries < count * 20:
            tries += 1
            a = rng.uniform(0, 2 * math.pi); rr = rng.uniform(rmin, rmax)
            x = round(cx + rr * math.cos(a)); y = round(cy + rr * math.sin(a))
            if not (0 <= x < layout.MAP and 0 <= y < layout.MAP):
                continue
            if not free(x, y):
                continue
            if avoid_road and road_center(x, y):
                continue
            if (x, y) in placed:
                continue
            placed.append((x, y))
            objs.append(maker(f'{prefix}_{n:02d}', (x, y), rng))
            n += 1
    # 稻草人：立在每塊田旁
    si = 0
    for o in layout.OBJECTS:
        if o.get('type') == 'field':
            fx, fy = o['pos']
            objs.append(scarecrow(f'decor_scarecrow_{si}', (fx + 2, fy + 1), rng))
            si += 1

    # 廣場家具：長椅、花箱、指示牌，讓鎮中心有人味
    if getattr(layout, 'PLAZA', None):
        x0, y0, x1, y1 = layout.PLAZA
        for i, (bx, by, fc) in enumerate([(x0 + 2, y0 + 1, 'y'), (x1 - 2, y0 + 1, 'y'), (x0 + 2, y1 - 1, 'y'), (x1 - 2, y1 - 1, 'y')]):
            if free(bx, by):
                objs.append(bench(f'decor_bench_{i}', (bx, by), rng, fc))
        for i, (px, py) in enumerate([(x0, y0), (x1, y0), (x0, y1), (x1, y1)]):
            if free(px, py):
                objs.append(planter(f'decor_planter_{i}', (px, py), rng))
        sx, sy = (x0 + x1) // 2 - 3, y0
        if free(sx, sy):
            objs.append(signpost('decor_sign_0', (sx, sy), rng))

    place(bush, 'decor_bush', 26, 6, R - 1)
    place(flowers, 'decor_flower', 48, 4, R - 1)
    place(grasstuft, 'decor_tuft', 90, 3, R + 2, avoid_road=False)
    place(rock, 'decor_rock', 16, 8, R + 8)

    return [o for o in objs if o is not None]
