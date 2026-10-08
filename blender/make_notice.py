# 公告牌：blank / written / defaced。走近閱讀就認知全部現行條文。
import rb

def _board(s, id, st):
    rb.box(s, f'{id}__{st}_postL', (0.12, 0.12, 1.9), (-0.6, 0, 0.95), rb.DARKWOOD)
    rb.box(s, f'{id}__{st}_postR', (0.12, 0.12, 1.9), (0.6, 0, 0.95), rb.DARKWOOD)
    rb.box(s, f'{id}__{st}_board', (1.5, 0.1, 1.0), (0, 0, 1.3), rb.WOOD)
    rb.box(s, f'{id}__{st}_paper', (1.3, 0.04, 0.8), (0, -0.07, 1.3), rb.PAPER)

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('notice', ['read', 'deface'], ['notice']))
    s = rb.state_root(p, 'blank'); _board(s, id, 'blank')
    s = rb.state_root(p, 'written'); _board(s, id, 'written')
    for i in range(5):
        rb.box(s, f'{id}__written_line{i}', (1.0 - (i % 2) * 0.25, 0.03, 0.07), (-0.05 + (i % 2) * 0.1, -0.1, 1.6 - i * 0.14), rb.INK)
    s = rb.state_root(p, 'defaced'); _board(s, id, 'defaced')
    rb.box(s, f'{id}__defaced_x1', (1.4, 0.04, 0.12), (0, -0.11, 1.3), rb.RED, rot=(0, 0.6, 0))
    rb.box(s, f'{id}__defaced_x2', (1.4, 0.04, 0.12), (0, -0.11, 1.3), rb.RED, rot=(0, -0.6, 0))
    rb.col(p, (1.5, 0.4, 2.0), (0, 0, 1.0))
    return p
