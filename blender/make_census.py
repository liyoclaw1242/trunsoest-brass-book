# 戶籍冊：intact / torn。立在台上。
import rb
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('census', ['read', 'deface'], ['record']))
    for st in ('intact', 'torn'):
        s = rb.state_root(p, st)
        rb.box(s, f'{id}__{st}_stand', (0.6, 0.6, 0.9), (0, 0, 0.45), rb.DARKWOOD)
        rb.box(s, f'{id}__{st}_book', (0.7, 0.5, 0.18), (0, 0, 1.0), (0.4, 0.3, 0.2), rot=(0.3, 0, 0))
        rb.box(s, f'{id}__{st}_pages', (0.6, 0.42, 0.1), (0, -0.02, 1.03), rb.PAPER, rot=(0.3, 0, 0))
        if st == 'torn':
            rb.box(s, f'{id}__torn_scrap', (0.2, 0.15, 0.02), (0.4, 0.3, 0.02), rb.PAPER, rot=(0, 0, 0.5))
    rb.col(p, (0.7, 0.7, 1.1), (0, 0, 0.55))
    return p
