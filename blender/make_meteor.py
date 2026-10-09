# 隕石魔法書：intact。深紅帶裂紋發光，和黃銅書形狀相近但危險。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('meteor', ['take', 'use', 'break'], ['portable', 'dangerous']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_cover', (0.6, 0.45, 0.16), (0, 0, 0.1), (0.35, 0.05, 0.08))
    rb.box(s, f'{id}__intact_glow', (0.5, 0.38, 0.06), (0, 0, 0.2), (0.95, 0.3, 0.15))
    rb.box(s, f'{id}__intact_crack', (0.55, 0.05, 0.1), (0, 0.1, 0.18), (1.0, 0.6, 0.2), rot=(0, 0, 0.4))
    return p
