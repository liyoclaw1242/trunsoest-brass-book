# 書台：只有 intact。書的預設位置，擋路。
import rb

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('lectern', []))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_base', (0.8, 0.8, 0.12), (0, 0, 0.06), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_post', (0.3, 0.3, 0.8), (0, 0, 0.52), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_top', (0.9, 0.7, 0.12), (0, 0, 0.98), rb.WOOD, rot=(0.25, 0, 0))
    rb.col(p, (0.9, 0.9, 1.1), (0, 0, 0.55))
    return p
