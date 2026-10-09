# 哨口：治安官巡邏路線上的崗亭。擋路（單格）。深木亭身＋黃銅燈＋旗。
import rb
FLAG = (0.3, 0.5, 0.75)
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('post', ['use'], ['post', 'guard']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_base', (0.9, 0.9, 0.12), (0, 0, 0.06), rb.DARKSTONE)
    rb.box(s, f'{id}__intact_booth', (0.8, 0.8, 1.6), (0, 0, 0.9), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_opening', (0.5, 0.1, 1.0), (0, -0.4, 0.95), (0.1, 0.08, 0.06))
    rb.box(s, f'{id}__intact_roof', (1.1, 1.1, 0.18), (0, 0, 1.78), (0.4, 0.3, 0.22))
    rb.box(s, f'{id}__intact_pole', (0.07, 0.07, 1.2), (0.42, 0.42, 2.3), rb.METAL)
    rb.box(s, f'{id}__intact_flag', (0.02, 0.5, 0.35), (0.42, 0.68, 2.6), FLAG)
    rb.sphere(s, f'{id}__intact_lamp', 0.14, (0, -0.4, 1.7), rb.BRASS)
    rb.col(p, (1.0, 1.0, 1.7), (0, 0, 0.85))
    return p
