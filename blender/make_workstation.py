# 工作站：intact。紙坊(paper)或墨坊(ink)。村民在這裡生產，送進圖書館。擋路。
import rb
def make(id, pos, kind='paper', owner=None, **kw):
    col = (0.9, 0.88, 0.8) if kind == 'paper' else (0.2, 0.18, 0.22)
    p = rb.parent_empty(id, pos, rb.props('workstation', ['use'], ['station'], owner=owner, kind=kind))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_bench', (1.6, 1.0, 0.6), (0, 0, 0.35), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_vat', (1.0, 0.7, 0.5), (0, 0, 0.85), col)
    rb.box(s, f'{id}__intact_frame', (0.1, 0.1, 1.4), (-0.7, -0.4, 0.7), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_frame2', (0.1, 0.1, 1.4), (0.7, -0.4, 0.7), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_sheet', (1.2, 0.02, 0.9), (0, -0.4, 0.9), rb.PAPER if kind == 'paper' else (0.3, 0.3, 0.35))
    rb.col(p, (1.8, 1.2, 1.0), (0, 0, 0.5))
    return p
