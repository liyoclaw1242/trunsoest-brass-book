# 店鋪：商人的市集攤位。擋路（單格）。木櫃台＋條紋遮陽棚＋貨物＋吊牌＋貨籃木桶，看得出是市集。
import rb
AWN = (0.80, 0.26, 0.22); AWN2 = (0.95, 0.92, 0.84)
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('shop', ['use'], ['shop', 'market', 'building']))
    s = rb.state_root(p, 'intact')
    # 櫃台
    rb.box(s, f'{id}__intact_counter', (1.4, 0.7, 0.78), (0, -0.3, 0.39), rb.WOOD)
    rb.box(s, f'{id}__intact_counttop', (1.52, 0.82, 0.08), (0, -0.3, 0.82), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_front', (1.4, 0.06, 0.4), (0, -0.64, 0.4), rb.TIMBER)
    # 立柱與條紋遮陽棚
    for i, dx in enumerate((-0.68, 0.68)):
        rb.box(s, f'{id}__intact_post{i}', (0.1, 0.1, 1.9), (dx, 0.38, 0.95), rb.DARKWOOD)
    for i in range(5):
        rb.box(s, f'{id}__intact_awn{i}', (0.29, 1.05, 0.08), (-0.58 + i * 0.29, 0.0, 1.78), AWN if i % 2 == 0 else AWN2, rot=(-0.38, 0, 0))
    rb.box(s, f'{id}__intact_awnlip', (1.5, 0.12, 0.16), (0, -0.5, 1.58), AWN)
    # 吊牌
    rb.box(s, f'{id}__intact_signbar', (0.06, 0.06, 0.4), (0.0, -0.55, 1.5), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_sign', (0.5, 0.05, 0.3), (0.0, -0.58, 1.3), rb.WOOD)
    # 貨物：櫃上蔬果籃
    rb.box(s, f'{id}__intact_basket1', (0.34, 0.3, 0.16), (-0.42, -0.3, 0.94), rb.THATCH)
    rb.box(s, f'{id}__intact_basket2', (0.34, 0.3, 0.16), (0.42, -0.3, 0.94), rb.THATCH)
    for j, (bx, col) in enumerate([(-0.5, rb.ROOF_RED), (-0.34, (0.96, 0.76, 0.24)), (0.34, (0.80, 0.45, 0.76)), (0.5, rb.LEAF2)]):
        rb.sphere(s, f'{id}__intact_goods{j}', 0.1, (bx, -0.3, 1.06), col)
    # 旁邊的木桶與麻袋
    rb.cyl(s, f'{id}__intact_barrel', 0.26, 0.6, (0.62, -0.72, 0.3), rb.WOOD)
    rb.cyl(s, f'{id}__intact_barrelband', 0.28, 0.08, (0.62, -0.72, 0.42), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_sack', (0.34, 0.34, 0.4), (-0.62, -0.72, 0.2), rb.THATCH)
    rb.col(p, (1.0, 1.0, 1.0), (0, 0, 0.5))
    return p
