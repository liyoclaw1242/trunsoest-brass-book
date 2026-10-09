# 繩子：intact（盤著）/ frayed（磨斷，放逐痕跡）。不擋路。
import rb
def make(id, pos, state='intact', **kw):
    p = rb.parent_empty(id, pos, rb.props('rope', ['take'], ['portable']))
    s = rb.state_root(p, 'intact')
    rb.cyl(s, f'{id}__intact_coilA', 0.3, 0.08, (0, 0, 0.06), (0.75, 0.62, 0.4))
    rb.cyl(s, f'{id}__intact_coilB', 0.22, 0.08, (0, 0, 0.14), (0.7, 0.58, 0.38))
    s = rb.state_root(p, 'frayed')
    rb.box(s, f'{id}__frayed_a', (0.6, 0.06, 0.05), (-0.2, 0, 0.03), (0.6, 0.5, 0.34), rot=(0, 0, 0.3))
    rb.box(s, f'{id}__frayed_b', (0.5, 0.06, 0.05), (0.25, 0.1, 0.03), (0.6, 0.5, 0.34), rot=(0, 0, -0.5))
    return p
