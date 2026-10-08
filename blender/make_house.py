# 住宅：intact。4×4 格，牆厚 0.3，正面（-Y）牆中央留一格門洞；門另做（make_door）。
# 佔地：x-2..x+1、y-2..y+1；室內可走格 x-1..x、y-1..y；門洞在 (x, y-2)。
import rb

HOUSE_COLORS = [(0.78, 0.6, 0.45), (0.6, 0.68, 0.78), (0.72, 0.72, 0.5), (0.7, 0.55, 0.65)]

def make(id, pos, owner=None, color_index=0, **kw):
    p = rb.parent_empty(id, pos, rb.props('house', ['enter'], ['shelter'], owner=owner))
    c = HOUSE_COLORS[color_index % len(HOUSE_COLORS)]
    s = rb.state_root(p, 'intact')
    H, T = 2.4, 0.3
    # 佔地中心相對父物件：x 範圍 [-2.5, 1.5] → 中心 -0.5；y 同。
    cx, cy = -0.5, -0.5
    rb.box(s, f'{id}__intact_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_wallN', (4.0, T, H), (cx, cy + 2 - T / 2, H / 2), c)
    rb.box(s, f'{id}__intact_wallW', (T, 4.0, H), (cx - 2 + T / 2, cy, H / 2), c)
    rb.box(s, f'{id}__intact_wallE', (T, 4.0, H), (cx + 2 - T / 2, cy, H / 2), c)
    # 正面牆：門洞在 x=0 的格子（相對 -0.5..0.5），左段 -2.5..-0.5、右段 0.5..1.5
    rb.box(s, f'{id}__intact_wallSL', (2.0, T, H), (-1.5, cy - 2 + T / 2, H / 2), c)
    rb.box(s, f'{id}__intact_wallSR', (1.0, T, H), (1.0, cy - 2 + T / 2, H / 2), c)
    rb.box(s, f'{id}__intact_lintel', (1.0, T, 0.5), (0, cy - 2 + T / 2, H - 0.25), c)
    rb.cone(s, f'{id}__intact_roof', 3.0, 1.3, (cx, cy, H + 0.65), rb.DARKWOOD)
    rb.cone(s, f'{id}__intact_roof2', 3.0, 1.3, (cx, cy, H + 0.6), (c[0] * 0.6, c[1] * 0.6, c[2] * 0.6))
    # 碰撞：四面牆（正面留門洞），室內不擋
    rb.col(p, (4.0, 1.0, H), (cx, cy + 1.5, H / 2), '_n')
    rb.col(p, (1.0, 4.0, H), (cx - 1.5, cy, H / 2), '_w')
    rb.col(p, (1.0, 4.0, H), (cx + 1.5, cy, H / 2), '_e')
    rb.col(p, (2.0, 1.0, H), (-1.5, cy - 1.5, H / 2), '_sl')
    rb.col(p, (1.0, 1.0, H), (1.0, cy - 1.5, H / 2), '_sr')
    return p
