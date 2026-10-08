# 外鄉人：intact。藍色、背著包，和村民一眼分得出來。
import rb

BLUE = (0.2, 0.4, 0.85)

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('outsider', ['capture'], ['actor', 'player']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_legL', (0.18, 0.2, 0.5), (-0.12, 0, 0.25), (0.2, 0.2, 0.3))
    rb.box(s, f'{id}__intact_legR', (0.18, 0.2, 0.5), (0.12, 0, 0.25), (0.2, 0.2, 0.3))
    rb.box(s, f'{id}__intact_body', (0.5, 0.32, 0.7), (0, 0, 0.85), BLUE)
    rb.box(s, f'{id}__intact_pack', (0.4, 0.25, 0.5), (0, 0.28, 0.9), rb.WOOD)
    rb.box(s, f'{id}__intact_armL', (0.14, 0.14, 0.6), (-0.33, 0, 0.9), BLUE)
    rb.box(s, f'{id}__intact_armR', (0.14, 0.14, 0.6), (0.33, 0, 0.9), BLUE)
    rb.sphere(s, f'{id}__intact_head', 0.24, (0, 0, 1.45), (0.95, 0.85, 0.75))
    rb.cone(s, f'{id}__intact_hat', 0.34, 0.35, (0, 0, 1.75), (0.9, 0.75, 0.3))
    return p
