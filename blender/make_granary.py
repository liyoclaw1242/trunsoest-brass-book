# 穀倉：收成存放處。擋路（單格）。木桶身＋圓錐頂＋黃銅束帶，看得出是儲糧的倉。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('granary', ['use'], ['granary', 'store', 'building']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_base', (1.5, 1.5, 0.12), (0, 0, 0.06), rb.DARKWOOD)
    rb.cyl(s, f'{id}__intact_body', 0.65, 2.0, (0, 0, 1.1), rb.WOOD)
    rb.cyl(s, f'{id}__intact_band1', 0.68, 0.12, (0, 0, 0.5), rb.BRASS)
    rb.cyl(s, f'{id}__intact_band2', 0.68, 0.12, (0, 0, 1.6), rb.BRASS)
    rb.cone(s, f'{id}__intact_roof', 0.85, 0.7, (0, 0, 2.45), (0.4, 0.3, 0.22))
    rb.box(s, f'{id}__intact_door', (0.4, 0.05, 0.7), (0, -0.63, 0.45), rb.DARKWOOD)
    rb.col(p, (1.0, 1.0, 2.4), (0, 0, 1.2))
    return p
