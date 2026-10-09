# 山羊：intact。白色身體、四腳、角、脖子的鈴。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('goat', ['tie', 'lead'], ['animal']))
    s = rb.state_root(p, 'intact')
    body = (0.92, 0.9, 0.85)
    rb.box(s, f'{id}__intact_body', (0.9, 0.45, 0.5), (0, 0, 0.7), body)
    for i, (dx, dy) in enumerate([(-0.3, -0.15), (0.3, -0.15), (-0.3, 0.15), (0.3, 0.15)]):
        rb.box(s, f'{id}__intact_leg{i}', (0.12, 0.12, 0.45), (dx, dy, 0.22), (0.7, 0.68, 0.62))
    rb.box(s, f'{id}__intact_head', (0.35, 0.3, 0.35), (0, -0.4, 0.85), body)
    rb.cone(s, f'{id}__intact_hornL', 0.06, 0.25, (-0.1, -0.45, 1.1), (0.5, 0.45, 0.4))
    rb.cone(s, f'{id}__intact_hornR', 0.06, 0.25, (0.1, -0.45, 1.1), (0.5, 0.45, 0.4))
    rb.sphere(s, f'{id}__intact_bell', 0.08, (0, -0.35, 0.6), rb.BRASS)
    return p
