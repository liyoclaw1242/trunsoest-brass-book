# 信物：intact。rb_owner 村民 id。小東西，不擋路，顏色與主人一致。
import rb

def make(id, pos, owner=None, color=(0.9, 0.3, 0.5), **kw):
    p = rb.parent_empty(id, pos, rb.props('keepsake', ['take', 'give'], ['portable'], owner=owner))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_plinth', (0.5, 0.5, 0.1), (0, 0, 0.05), rb.PAPER)
    rb.sphere(s, f'{id}__intact_gem', 0.2, (0, 0, 0.45), color)
    rb.cyl(s, f'{id}__intact_ring', 0.3, 0.06, (0, 0, 0.6), rb.BRASS, rot=(0.6, 0, 0))
    return p
