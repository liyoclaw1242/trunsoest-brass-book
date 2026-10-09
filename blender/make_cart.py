# 物流車：物流業者從穀倉拉到店鋪的手推車。不擋路（跟著物流走），木車身＋兩輪＋貨箱。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('cart', [], ['cart', 'vehicle']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_bed', (0.9, 1.3, 0.15), (0, 0, 0.5), rb.WOOD)
    rb.box(s, f'{id}__intact_sideL', (0.08, 1.3, 0.4), (-0.45, 0, 0.72), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_sideR', (0.08, 1.3, 0.4), (0.45, 0, 0.72), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_front', (0.9, 0.08, 0.4), (0, 0.63, 0.72), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_crate1', (0.5, 0.5, 0.5), (0, 0.2, 0.9), rb.PAPER)
    rb.box(s, f'{id}__intact_crate2', (0.4, 0.4, 0.4), (0, -0.35, 0.85), (0.8, 0.7, 0.4))
    rb.cyl(s, f'{id}__intact_wheelL', 0.35, 0.1, (-0.5, -0.2, 0.35), rb.DARKWOOD, rot=(0, 1.5708, 0))
    rb.cyl(s, f'{id}__intact_wheelR', 0.35, 0.1, (0.5, -0.2, 0.35), rb.DARKWOOD, rot=(0, 1.5708, 0))
    rb.box(s, f'{id}__intact_handle', (0.08, 0.7, 0.08), (0, -1.0, 0.7), rb.WOOD)
    return p
