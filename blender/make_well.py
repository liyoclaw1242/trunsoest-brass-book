# 水井：intact。圓石井口＋頂棚。可躲、可取水。擋路。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('well', ['enter', 'use'], ['roofed']))
    s = rb.state_root(p, 'intact')
    rb.cyl(s, f'{id}__intact_ring', 0.7, 0.8, (0, 0, 0.4), rb.STONE)
    rb.cyl(s, f'{id}__intact_hole', 0.5, 0.82, (0, 0, 0.42), (0.08, 0.08, 0.1))
    rb.box(s, f'{id}__intact_postA', (0.1, 0.1, 1.6), (-0.6, 0, 1.2), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_postB', (0.1, 0.1, 1.6), (0.6, 0, 1.2), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_roof', (1.6, 1.0, 0.12), (0, 0, 2.0), rb.DARKWOOD, rot=(0.2, 0, 0))
    rb.col(p, (1.4, 1.4, 0.9), (0, 0, 0.45))
    return p
