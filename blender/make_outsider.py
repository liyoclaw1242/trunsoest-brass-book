# 外鄉人：intact。藍衣、背著旅行包、戴尖頂旅人帽，和村民一眼分得出來。可愛（chibi）比例。
import rb

BLUE = (0.22, 0.42, 0.86)
BLUE_D = (0.16, 0.30, 0.62)
SKIN = (0.96, 0.84, 0.72)

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('outsider', ['capture'], ['actor', 'player']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_legL', (0.17, 0.2, 0.42), (-0.12, 0, 0.21), BLUE_D)
    rb.box(s, f'{id}__intact_legR', (0.17, 0.2, 0.42), (0.12, 0, 0.21), BLUE_D)
    rb.box(s, f'{id}__intact_shoeL', (0.2, 0.26, 0.12), (-0.12, -0.04, 0.06), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_shoeR', (0.2, 0.26, 0.12), (0.12, -0.04, 0.06), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_body', (0.5, 0.34, 0.66), (0, 0, 0.78), BLUE)
    rb.box(s, f'{id}__intact_scarf', (0.52, 0.36, 0.14), (0, 0, 1.08), rb.ROOF_RED)
    rb.box(s, f'{id}__intact_pack', (0.42, 0.26, 0.5), (0, 0.3, 0.86), rb.WOOD)
    rb.box(s, f'{id}__intact_packflap', (0.44, 0.1, 0.22), (0, 0.36, 1.02), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_armL', (0.13, 0.13, 0.52), (-0.33, 0, 0.82), BLUE)
    rb.box(s, f'{id}__intact_armR', (0.13, 0.13, 0.52), (0.33, 0, 0.82), BLUE)
    rb.sphere(s, f'{id}__intact_handL', 0.1, (-0.33, 0, 0.54), SKIN)
    rb.sphere(s, f'{id}__intact_handR', 0.1, (0.33, 0, 0.54), SKIN)
    rb.sphere(s, f'{id}__intact_head', 0.3, (0, 0, 1.4), SKIN)
    rb.cyl(s, f'{id}__intact_hatbrim', 0.4, 0.05, (0, 0, 1.62), (0.86, 0.66, 0.28))
    rb.cone(s, f'{id}__intact_hattop', 0.26, 0.42, (0, 0, 1.82), (0.9, 0.72, 0.3))
    return p
