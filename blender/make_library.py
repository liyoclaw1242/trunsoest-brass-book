# 圖書館：intact / broken。4×4 佔地（同住宅），但更宏偉：暖石牆、露明木架、四坡屋頂＋黃銅圓頂燈塔。書放在裡面。
# 碰撞與佔地和原本一致（正面留門洞）。
import rb
WARMSTONE = (0.76, 0.71, 0.60)
WARMSTONE2 = (0.68, 0.63, 0.53)
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('library', ['enter', 'break'], ['building', 'roofed', 'breakable']))
    s = rb.state_root(p, 'intact')
    H, T = 3.0, 0.3
    cx, cy = -0.5, -0.5
    rb.box(s, f'{id}__intact_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_plinth', (4.3, 4.3, 0.4), (cx, cy, 0.2), WARMSTONE2)
    rb.box(s, f'{id}__intact_wallN', (4.0, T, H), (cx, cy + 2 - T / 2, H / 2), WARMSTONE)
    rb.box(s, f'{id}__intact_wallW', (T, 4.0, H), (cx - 2 + T / 2, cy, H / 2), WARMSTONE)
    rb.box(s, f'{id}__intact_wallE', (T, 4.0, H), (cx + 2 - T / 2, cy, H / 2), WARMSTONE)
    rb.box(s, f'{id}__intact_wallSL', (2.0, T, H), (-1.5, cy - 2 + T / 2, H / 2), WARMSTONE)
    rb.box(s, f'{id}__intact_wallSR', (1.0, T, H), (1.0, cy - 2 + T / 2, H / 2), WARMSTONE)
    rb.box(s, f'{id}__intact_lintel', (1.3, T + 0.06, 0.6), (0, cy - 2 + T / 2, H - 0.3), rb.BRASS)
    # 壁柱（四角）
    for i, (mx, my) in enumerate([(-2.5, -2.5), (1.5, -2.5), (-2.5, 1.5), (1.5, 1.5)]):
        rb.box(s, f'{id}__intact_pil{i}', (0.34, 0.34, H), (mx, my, H / 2), WARMSTONE2)
    # 拱窗（左右牆、背牆）
    for tag, cc, face in [('wl', (cx - 2 + T / 2, cy + 0.7, 1.6), 'x'), ('wl2', (cx - 2 + T / 2, cy - 0.7, 1.6), 'x'),
                          ('wr', (cx + 2 - T / 2, cy + 0.7, 1.6), 'x'), ('wr2', (cx + 2 - T / 2, cy - 0.7, 1.6), 'x'),
                          ('wn', (cx, cy + 2 - T / 2, 1.7), 'y')]:
        if face == 'x':
            rb.box(s, f'{id}__intact_{tag}f', (0.14, 0.7, 1.4), cc, rb.TIMBER)
            rb.box(s, f'{id}__intact_{tag}g', (0.18, 0.5, 1.1), cc, rb.WINDOW)
        else:
            rb.box(s, f'{id}__intact_{tag}f', (0.9, 0.14, 1.4), cc, rb.TIMBER)
            rb.box(s, f'{id}__intact_{tag}g', (0.66, 0.18, 1.1), cc, rb.WINDOW)
    # 四坡屋頂（石板色）＋屋簷
    roof = rb.ROOF_TEAL
    rb.box(s, f'{id}__intact_roofeave', (4.8, 4.8, 0.18), (cx, cy, H + 0.02), (roof[0] * 0.7, roof[1] * 0.7, roof[2] * 0.7))
    rb.pyramid(s, f'{id}__intact_roof', (4.7, 4.7, 1.5), (cx, cy, H + 0.78), roof)
    # 黃銅圓頂燈塔（書的信標）
    rb.box(s, f'{id}__intact_roofdrum', (1.4, 1.4, 0.7), (cx, cy, H + 1.5), WARMSTONE2)
    rb.cyl(s, f'{id}__intact_roofcol1', 0.08, 0.7, (cx - 0.5, cy - 0.5, H + 1.5), rb.CREAM)
    rb.cyl(s, f'{id}__intact_roofcol2', 0.08, 0.7, (cx + 0.5, cy - 0.5, H + 1.5), rb.CREAM)
    rb.cyl(s, f'{id}__intact_roofcol3', 0.08, 0.7, (cx - 0.5, cy + 0.5, H + 1.5), rb.CREAM)
    rb.cyl(s, f'{id}__intact_roofcol4', 0.08, 0.7, (cx + 0.5, cy + 0.5, H + 1.5), rb.CREAM)
    rb.sphere(s, f'{id}__intact_roofdome', 0.85, (cx, cy, H + 2.1), rb.BRASS)
    rb.cyl(s, f'{id}__intact_roofspire', 0.05, 0.5, (cx, cy, H + 2.7), rb.BRASS)
    rb.sphere(s, f'{id}__intact_rooffinial', 0.12, (cx, cy, H + 2.95), rb.BRASS)
    # 破損
    s2 = rb.state_root(p, 'broken')
    rb.box(s2, f'{id}__broken_floor', (4.0, 4.0, 0.08), (cx, cy, 0.04), rb.DARKWOOD)
    rb.box(s2, f'{id}__broken_rubble', (2.4, 2.4, 1.1), (cx, cy, 0.55), (0.6, 0.55, 0.48), rot=(0.2, 0.2, 0.4))
    rb.sphere(s2, f'{id}__broken_dome', 0.85, (cx + 1.2, cy - 1.0, 0.6), rb.BRASS)
    # 碰撞（與原本一致）
    rb.col(p, (4.0, 1.0, H), (cx, cy + 1.5, H / 2), '_n'); rb.col(p, (1.0, 4.0, H), (cx - 1.5, cy, H / 2), '_w'); rb.col(p, (1.0, 4.0, H), (cx + 1.5, cy, H / 2), '_e')
    rb.col(p, (2.0, 1.0, H), (-1.5, cy - 1.5, H / 2), '_sl'); rb.col(p, (1.0, 1.0, H), (1.0, cy - 1.5, H / 2), '_sr')
    return p
