# 山羊鈴鐺：intact。黃銅小鈴，搬運者的信物。
import rb
def make(id, pos, owner=None, **kw):
    p = rb.parent_empty(id, pos, rb.props('bell', ['take', 'give', 'use'], ['portable', 'keepsake'], owner=owner))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_plinth', (0.4, 0.4, 0.08), (0, 0, 0.04), rb.PAPER)
    rb.cone(s, f'{id}__intact_body', 0.18, 0.3, (0, 0, 0.25), rb.BRASS)
    rb.sphere(s, f'{id}__intact_clapper', 0.05, (0, 0, 0.14), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_loop', (0.08, 0.08, 0.08), (0, 0, 0.42), rb.BRASS)
    return p
