# 門：closed / open。rb_parent 所屬住宅。放在住宅正面牆的門洞格。
import rb

def make(id, pos, parent=None, **kw):
    p = rb.parent_empty(id, pos, rb.props('door', ['open', 'break'], ['breakable'], parent=parent))
    s = rb.state_root(p, 'closed')
    rb.box(s, f'{id}__closed_leaf', (0.9, 0.12, 1.9), (0, 0, 0.95), rb.DARKWOOD)
    rb.box(s, f'{id}__closed_knob', (0.1, 0.1, 0.1), (0.3, -0.1, 0.95), rb.BRASS)
    s = rb.state_root(p, 'open')
    rb.box(s, f'{id}__open_leaf', (0.12, 0.9, 1.9), (-0.45, -0.45, 0.95), rb.DARKWOOD)
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_plank1', (0.9, 0.12, 0.6), (0.1, -0.3, 0.06), rb.DARKWOOD, rot=(1.5708, 0, 0.3))
    rb.box(s, f'{id}__broken_plank2', (0.4, 0.12, 1.0), (-0.3, 0.05, 0.5), rb.DARKWOOD, rot=(0, 0.3, 0))
    rb.col(p, (1.0, 0.4, 1.9), (0, 0, 0.95))
    return p
