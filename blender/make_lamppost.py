# 燈柱：intact / broken。夜間照亮周圍（畫面端畫光圈）。擋路。
import rb

def make(id, pos, radius=4, **kw):
    p = rb.parent_empty(id, pos, rb.props('lamppost', ['break'], ['breakable', 'light'], radius=radius))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_base', (0.52, 0.52, 0.28), (0, 0, 0.14), rb.DARKSTONE)
    rb.box(s, f'{id}__intact_base2', (0.36, 0.36, 0.14), (0, 0, 0.34), rb.STONE)
    rb.cyl(s, f'{id}__intact_pole', 0.06, 2.5, (0, 0, 1.5), rb.DARKSTONE)
    # 燈籠：銅框＋發亮暖玻璃＋小尖頂
    rb.box(s, f'{id}__intact_lframe', (0.42, 0.42, 0.56), (0, 0, 2.86), rb.BRASS)
    rb.box(s, f'{id}__intact_lantern', (0.32, 0.32, 0.46), (0, 0, 2.86), (1.0, 0.92, 0.58))
    rb.pyramid(s, f'{id}__intact_cap', (0.5, 0.5, 0.26), (0, 0, 3.27), rb.DARKSTONE)
    rb.sphere(s, f'{id}__intact_finial', 0.07, (0, 0, 3.45), rb.BRASS)
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_base', (0.5, 0.5, 0.2), (0, 0, 0.1), rb.DARKSTONE)
    rb.cyl(s, f'{id}__broken_pole', 0.06, 1.2, (0, 0, 0.8), rb.METAL, rot=(0.3, 0, 0))
    rb.box(s, f'{id}__broken_lantern', (0.4, 0.4, 0.5), (0.3, -0.6, 0.25), (0.5, 0.45, 0.3), rot=(0.4, 0.9, 0))
    rb.col(p, (0.6, 0.6, 3.2), (0, 0, 1.6))
    return p
