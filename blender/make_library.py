# 圖書館：intact / broken。和住宅同樣 4×4 佔地（grid 以 houseCells 處理），但有圓頂、顏色不同。書放在裡面。
import rb
LIB = (0.72, 0.68, 0.58)
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('library', ['enter', 'break'], ['building', 'roofed', 'breakable']))
    s = rb.state_root(p, 'intact')
    H, T = 3.0, 0.3; cx, cy = -0.5, -0.5
    rb.box(s, f'{id}__intact_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_wallN', (4.0, T, H), (cx, cy + 2 - T/2, H/2), LIB)
    rb.box(s, f'{id}__intact_wallW', (T, 4.0, H), (cx - 2 + T/2, cy, H/2), LIB)
    rb.box(s, f'{id}__intact_wallE', (T, 4.0, H), (cx + 2 - T/2, cy, H/2), LIB)
    rb.box(s, f'{id}__intact_wallSL', (2.0, T, H), (-1.5, cy - 2 + T/2, H/2), LIB)
    rb.box(s, f'{id}__intact_wallSR', (1.0, T, H), (1.0, cy - 2 + T/2, H/2), LIB)
    rb.box(s, f'{id}__intact_lintel', (1.0, T, 0.5), (0, cy - 2 + T/2, H - 0.25), LIB)
    rb.box(s, f'{id}__intact_roof', (4.4, 4.4, 0.3), (cx, cy, H + 0.15), (0.4, 0.3, 0.22))
    rb.box(s, f'{id}__intact_dome', (1.6, 1.6, 1.0), (cx, cy, H + 0.7), rb.BRASS)
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    rb.box(s, f'{id}__broken_rubble', (2.2, 2.2, 1.0), (cx, cy, 0.5), (0.6, 0.55, 0.48), rot=(0.2, 0.2, 0.4))
    # 碰撞同住宅（正面留門洞）
    rb.col(p, (4.0, 1.0, H), (cx, cy + 1.5, H/2), '_n'); rb.col(p, (1.0, 4.0, H), (cx - 1.5, cy, H/2), '_w'); rb.col(p, (1.0, 4.0, H), (cx + 1.5, cy, H/2), '_e')
    rb.col(p, (2.0, 1.0, H), (-1.5, cy - 1.5, H/2), '_sl'); rb.col(p, (1.0, 1.0, H), (1.0, cy - 1.5, H/2), '_sr')
    return p
