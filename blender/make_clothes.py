# 市民衣物：掛在晾衣繩上。intact（掛著）/ worn（被穿走，隱藏）。rb_owner 是誰的衣服。不擋路。
import rb

def make(id, pos, owner=None, color=(0.6, 0.6, 0.9), **kw):
    p = rb.parent_empty(id, pos, rb.props('clothes', ['take', 'wear', 'drop'], ['portable', 'disguise'], owner=owner))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_postA', (0.1, 0.1, 1.8), (-0.5, 0, 0.9), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_postB', (0.1, 0.1, 1.8), (0.5, 0, 0.9), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_line', (1.0, 0.03, 0.03), (0, 0, 1.7), rb.INK)
    rb.box(s, f'{id}__intact_shirt', (0.6, 0.08, 0.7), (0, 0, 1.3), color)
    rb.box(s, f'{id}__intact_sleeveL', (0.2, 0.08, 0.3), (-0.4, 0, 1.5), color)
    rb.box(s, f'{id}__intact_sleeveR', (0.2, 0.08, 0.3), (0.4, 0, 1.5), color)
    s = rb.state_root(p, 'worn')
    rb.box(s, f'{id}__worn_postA', (0.1, 0.1, 1.8), (-0.5, 0, 0.9), rb.DARKWOOD)
    rb.box(s, f'{id}__worn_postB', (0.1, 0.1, 1.8), (0.5, 0, 0.9), rb.DARKWOOD)
    rb.box(s, f'{id}__worn_line', (1.0, 0.03, 0.03), (0, 0, 1.7), rb.INK)
    return p
