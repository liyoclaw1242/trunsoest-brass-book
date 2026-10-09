# 店鋪：商人的市集攤位。擋路（單格）。木櫃台＋條紋遮陽棚＋貨物，商人站在旁邊迎客。
import rb
AWN = (0.78, 0.2, 0.18); AWN2 = (0.92, 0.9, 0.82)
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('shop', ['use'], ['shop', 'market', 'building']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_counter', (1.4, 0.7, 0.8), (0, -0.3, 0.4), rb.WOOD)
    rb.box(s, f'{id}__intact_counttop', (1.5, 0.8, 0.08), (0, -0.3, 0.84), rb.DARKWOOD)
    # 立柱與遮陽棚
    for i, dx in enumerate((-0.65, 0.65)):
        rb.box(s, f'{id}__intact_post{i}', (0.1, 0.1, 1.8), (dx, 0.35, 0.9), rb.DARKWOOD)
    for i in range(5):
        rb.box(s, f'{id}__intact_awn{i}', (0.28, 1.0, 0.08), (-0.56 + i * 0.28, 0.0, 1.75), AWN if i % 2 == 0 else AWN2, rot=(-0.35, 0, 0))
    # 貨物
    rb.box(s, f'{id}__intact_crate1', (0.35, 0.35, 0.35), (-0.4, -0.3, 1.0), rb.PAPER)
    rb.box(s, f'{id}__intact_crate2', (0.3, 0.3, 0.3), (0.4, -0.25, 1.0), (0.8, 0.7, 0.4))
    rb.col(p, (1.0, 1.0, 1.0), (0, 0, 0.5))
    return p
