# 界石：intact。沿影響範圍邊緣排一圈，佔一格。
import rb

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('boundary', [], ['marker']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_stone', (0.7, 0.7, 1.4), (0, 0, 0.7), rb.STONE)
    rb.box(s, f'{id}__intact_cap', (0.8, 0.8, 0.2), (0, 0, 1.5), rb.DARKSTONE)
    rb.box(s, f'{id}__intact_band', (0.74, 0.74, 0.15), (0, 0, 0.9), rb.BRASS)
    rb.col(p, (0.8, 0.8, 1.6), (0, 0, 0.8))
    return p
