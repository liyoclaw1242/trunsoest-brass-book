# 黃銅書：closed / writing。影響範圍的圓心。放在書台上（書台另做）。
import rb

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('book', ['read', 'move'], ['range-center']))
    z = kw.get('z', 1.05)  # 書台高度
    s = rb.state_root(p, 'closed')
    rb.box(s, f'{id}__closed_cover', (0.7, 0.5, 0.14), (0, 0, z + 0.07), rb.BRASS)
    rb.box(s, f'{id}__closed_spine', (0.08, 0.5, 0.16), (-0.33, 0, z + 0.08), rb.DARKWOOD)
    s = rb.state_root(p, 'writing')
    rb.box(s, f'{id}__writing_left', (0.36, 0.5, 0.06), (-0.19, 0, z + 0.03), rb.BRASS)
    rb.box(s, f'{id}__writing_right', (0.36, 0.5, 0.06), (0.19, 0, z + 0.03), rb.BRASS)
    rb.box(s, f'{id}__writing_pageL', (0.3, 0.44, 0.03), (-0.17, 0, z + 0.075), rb.PAPER)
    rb.box(s, f'{id}__writing_pageR', (0.3, 0.44, 0.03), (0.17, 0, z + 0.075), rb.PAPER)
    rb.cyl(s, f'{id}__writing_pen', 0.03, 0.5, (0.1, -0.05, z + 0.33), rb.INK, rot=(0.5, 0.3, 0))
    return p
