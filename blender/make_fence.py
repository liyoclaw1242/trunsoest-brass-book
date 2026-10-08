# 圍籬段：intact / broken。rb_dir 'x' 或 'y'：這段沿哪個軸。佔一格。
import rb

def make(id, pos, dir='x', **kw):
    p = rb.parent_empty(id, pos, rb.props('fence', ['break', 'climb'], ['breakable'], dir=dir))
    rot = (0, 0, 0) if dir == 'x' else (0, 0, 1.5708)
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_postA', (0.12, 0.12, 1.1), (-0.44, 0, 0.55), rb.DARKWOOD, rot)
    rb.box(s, f'{id}__intact_postB', (0.12, 0.12, 1.1), (0.44, 0, 0.55), rb.DARKWOOD, rot)
    rb.box(s, f'{id}__intact_railT', (1.0, 0.08, 0.14), (0, 0, 0.9), rb.WOOD, rot)
    rb.box(s, f'{id}__intact_railB', (1.0, 0.08, 0.14), (0, 0, 0.45), rb.WOOD, rot)
    if dir == 'y':
        for o in s.children:
            o.location = (o.location.y, o.location.x, o.location.z)
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_postA', (0.12, 0.12, 1.1), (-0.44, 0, 0.55), rb.DARKWOOD, rot)
    rb.box(s, f'{id}__broken_stump', (0.12, 0.12, 0.3), (0.44, 0, 0.15), rb.DARKWOOD, rot)
    rb.box(s, f'{id}__broken_rail', (1.0, 0.08, 0.14), (0.1, 0.2, 0.08), rb.WOOD, (0, 0, 0.4))
    if dir == 'y':
        for o in s.children:
            o.location = (o.location.y, o.location.x, o.location.z)
    rb.col(p, (1.0, 0.3, 1.1) if dir == 'x' else (0.3, 1.0, 1.1), (0, 0, 0.55))
    return p
