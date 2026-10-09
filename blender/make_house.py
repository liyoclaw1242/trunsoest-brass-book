# 住宅：intact。4×4 格，牆厚 0.3，正面（-Y）牆中央留一格門洞；門另做（make_door）。
# 佔地：x-2..x+1、y-2..y+1；室內可走格 x-1..x、y-1..y；門洞在 (x, y-2)。
# 星露谷風：暖白牆＋露明木架、四坡暖色屋頂、窗戶、煙囪、窗台花箱。碰撞與佔地不變。
import rb

HOUSE_COLORS = [rb.CREAM, rb.PLASTER, rb.CREAM, rb.PLASTER, rb.CREAM, rb.PLASTER]

def _window(s, id, tag, center, face):
    """牆上的窗：木框＋淡青玻璃。face 'y' 朝前後、'x' 朝左右。"""
    if face == 'y':
        rb.box(s, f'{id}__intact_{tag}frame', (0.95, 0.12, 0.95), center, rb.TIMBER)
        rb.box(s, f'{id}__intact_{tag}glass', (0.72, 0.16, 0.72), center, rb.WINDOW)
        rb.box(s, f'{id}__intact_{tag}barv', (0.08, 0.18, 0.78), center, rb.TIMBER)
        rb.box(s, f'{id}__intact_{tag}barh', (0.78, 0.18, 0.08), center, rb.TIMBER)
    else:
        rb.box(s, f'{id}__intact_{tag}frame', (0.12, 0.95, 0.95), center, rb.TIMBER)
        rb.box(s, f'{id}__intact_{tag}glass', (0.16, 0.72, 0.72), center, rb.WINDOW)
        rb.box(s, f'{id}__intact_{tag}barv', (0.18, 0.08, 0.78), center, rb.TIMBER)
        rb.box(s, f'{id}__intact_{tag}barh', (0.18, 0.78, 0.08), center, rb.TIMBER)

def make(id, pos, owner=None, color_index=0, **kw):
    p = rb.parent_empty(id, pos, rb.props('house', ['enter', 'reside'], ['shelter', 'building', 'roofed'], owner=owner))
    c = HOUSE_COLORS[color_index % len(HOUSE_COLORS)]
    roof = rb.ROOFS[color_index % len(rb.ROOFS)]
    s = rb.state_root(p, 'intact')
    H, T = 2.4, 0.3
    cx, cy = -0.5, -0.5
    rb.box(s, f'{id}__intact_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    # 牆（暖白）
    rb.box(s, f'{id}__intact_wallN', (4.0, T, H), (cx, cy + 2 - T / 2, H / 2), c)
    rb.box(s, f'{id}__intact_wallW', (T, 4.0, H), (cx - 2 + T / 2, cy, H / 2), c)
    rb.box(s, f'{id}__intact_wallE', (T, 4.0, H), (cx + 2 - T / 2, cy, H / 2), c)
    rb.box(s, f'{id}__intact_wallSL', (2.0, T, H), (-1.5, cy - 2 + T / 2, H / 2), c)
    rb.box(s, f'{id}__intact_wallSR', (1.0, T, H), (1.0, cy - 2 + T / 2, H / 2), c)
    rb.box(s, f'{id}__intact_lintel', (1.0, T, 0.5), (0, cy - 2 + T / 2, H - 0.25), rb.TIMBER)
    # 露明木架：四角柱＋腰線＋地梁，讓暖白牆有鄉村木屋感
    for i, (mx, my) in enumerate([(-2.5, -2.5), (1.5, -2.5), (-2.5, 1.5), (1.5, 1.5)]):
        rb.box(s, f'{id}__intact_post{i}', (0.22, 0.22, H), (mx, my, H / 2), rb.TIMBER)
    rb.box(s, f'{id}__intact_beltN', (4.1, 0.14, 0.14), (cx, cy + 2 - T / 2, H * 0.5), rb.TIMBER)
    rb.box(s, f'{id}__intact_beltW', (0.14, 4.1, 0.14), (cx - 2 + T / 2, cy, H * 0.5), rb.TIMBER)
    rb.box(s, f'{id}__intact_beltE', (0.14, 4.1, 0.14), (cx + 2 - T / 2, cy, H * 0.5), rb.TIMBER)
    rb.box(s, f'{id}__intact_sill', (4.2, 4.2, 0.16), (cx, cy, 0.08), rb.DARKWOOD)
    # 窗：左右牆各一、背牆一、正面右段一
    _window(s, id, 'winW', (cx - 2 + T / 2, cy + 0.6, 1.25), 'x')
    _window(s, id, 'winE', (cx + 2 - T / 2, cy - 0.6, 1.25), 'x')
    _window(s, id, 'winN', (cx + 0.8, cy + 2 - T / 2, 1.35), 'y')
    _window(s, id, 'winS', (1.0, cy - 2 + T / 2, 1.3), 'y')
    # 窗台花箱（正面窗下）
    rb.box(s, f'{id}__intact_boxf', (0.9, 0.3, 0.26), (1.0, cy - 2 - 0.05, 0.7), rb.TIMBER)
    for j, dx in enumerate((-0.28, 0, 0.28)):
        rb.sphere(s, f'{id}__intact_bloom{j}', 0.12, (1.0 + dx, cy - 2 - 0.05, 0.92), rb.FLOWERS[(color_index + j) % len(rb.FLOWERS)])
    # 四坡屋頂（暖色），帶屋簷與屋脊
    rb.box(s, f'{id}__intact_roofeave', (4.7, 4.7, 0.16), (cx, cy, H + 0.02), (roof[0] * 0.7, roof[1] * 0.7, roof[2] * 0.7))
    rb.pyramid(s, f'{id}__intact_roof', (4.6, 4.6, 1.7), (cx, cy, H + 0.9), roof)
    rb.box(s, f'{id}__intact_roofridge', (0.24, 0.24, 0.24), (cx, cy, H + 1.72), (roof[0] * 0.7, roof[1] * 0.7, roof[2] * 0.7))
    # 煙囪
    rb.box(s, f'{id}__intact_chimney', (0.5, 0.5, 1.1), (cx + 1.3, cy + 1.0, H + 0.55), rb.ROOF_RED if roof != rb.ROOF_RED else rb.DARKSTONE)
    rb.box(s, f'{id}__intact_chimcap', (0.62, 0.62, 0.14), (cx + 1.3, cy + 1.0, H + 1.15), rb.DARKSTONE)
    # 破損
    s2 = rb.state_root(p, 'broken')
    rb.box(s2, f'{id}__broken_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    rb.box(s2, f'{id}__broken_rubble', (2.4, 2.4, 1.0), (cx, cy, 0.5), (0.6, 0.55, 0.48), rot=(0.2, 0.2, 0.4))
    rb.box(s2, f'{id}__broken_beam', (3.2, 0.2, 0.2), (cx, cy - 0.5, 0.3), rb.TIMBER, rot=(0, 0, 0.5))
    # 碰撞：四面牆（正面留門洞），室內不擋（與原本完全一致）
    rb.col(p, (4.0, 1.0, H), (cx, cy + 1.5, H / 2), '_n')
    rb.col(p, (1.0, 4.0, H), (cx - 1.5, cy, H / 2), '_w')
    rb.col(p, (1.0, 4.0, H), (cx + 1.5, cy, H / 2), '_e')
    rb.col(p, (2.0, 1.0, H), (-1.5, cy - 1.5, H / 2), '_sl')
    rb.col(p, (1.0, 1.0, H), (1.0, cy - 1.5, H / 2), '_sr')
    return p
