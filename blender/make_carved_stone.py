# 刻字石：intact。矮石碑，表面刻字（放逐痕跡）。擋路。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('carved-stone', ['read'], ['marker']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_stone', (1.0, 0.5, 1.0), (0, 0, 0.5), rb.STONE, rot=(0.08, 0, 0.05))
    for i in range(4):
        rb.box(s, f'{id}__intact_line{i}', (0.7, 0.04, 0.05), (0, -0.27, 0.75 - i * 0.16), rb.INK)
    rb.col(p, (1.0, 0.6, 1.0), (0, 0, 0.5))
    return p
