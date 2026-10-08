# 推車：intact / broken。可推去擋路或墊腳。佔一格。
import rb

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('cart', ['move', 'break'], ['breakable', 'step']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_body', (0.9, 0.7, 0.4), (0, 0, 0.55), rb.WOOD)
    rb.cyl(s, f'{id}__intact_wheelL', 0.25, 0.08, (-0.5, 0, 0.25), rb.DARKWOOD, rot=(0, 1.5708, 0))
    rb.cyl(s, f'{id}__intact_wheelR', 0.25, 0.08, (0.5, 0, 0.25), rb.DARKWOOD, rot=(0, 1.5708, 0))
    rb.box(s, f'{id}__intact_handle', (0.08, 0.6, 0.06), (0.3, 0.6, 0.6), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_handle2', (0.08, 0.6, 0.06), (-0.3, 0.6, 0.6), rb.DARKWOOD)
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_body', (0.9, 0.7, 0.4), (0.1, 0, 0.3), rb.WOOD, rot=(0.5, 0, 0.2))
    rb.cyl(s, f'{id}__broken_wheelL', 0.25, 0.08, (-0.6, 0.4, 0.04), rb.DARKWOOD, rot=(0, 0, 0))
    rb.cyl(s, f'{id}__broken_wheelR', 0.25, 0.08, (0.5, 0, 0.25), rb.DARKWOOD, rot=(0, 1.5708, 0))
    rb.col(p, (0.9, 0.8, 0.8), (0, 0.05, 0.4))
    return p
