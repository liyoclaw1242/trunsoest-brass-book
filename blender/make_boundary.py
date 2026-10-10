# 界石：intact。沿影響範圍邊緣排一圈，佔一格。刻著黃銅符文、頂著一顆發亮的銅珠，看得出是封印的界石。
import rb

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('boundary', ['approach', 'move'], ['marker']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_plinth', (0.9, 0.9, 0.2), (0, 0, 0.1), rb.DARKSTONE)
    rb.box(s, f'{id}__intact_stone', (0.66, 0.66, 1.5), (0, 0, 0.9), rb.STONE)
    rb.box(s, f'{id}__intact_cap', (0.8, 0.8, 0.18), (0, 0, 1.68), rb.DARKSTONE)
    # 黃銅符文：正面的環與直線
    rb.box(s, f'{id}__intact_rune1', (0.5, 0.04, 0.5), (0, -0.34, 1.05), rb.BRASS)
    rb.box(s, f'{id}__intact_rune2', (0.3, 0.06, 0.06), (0, -0.34, 1.05), rb.BRASS)
    rb.box(s, f'{id}__intact_rune3', (0.06, 0.06, 0.34), (0, -0.34, 1.05), rb.BRASS)
    rb.box(s, f'{id}__intact_band', (0.72, 0.72, 0.12), (0, 0, 0.5), rb.BRASS)
    # 頂上的發亮銅珠（封印的信號）
    rb.sphere(s, f'{id}__intact_orb', 0.22, (0, 0, 1.95), rb.BRASS)
    # 推倒：石柱橫躺在基座旁，銅珠黯淡——這一段的「界」沒了
    t = rb.state_root(p, 'toppled')
    rb.box(t, f'{id}__toppled_plinth', (0.9, 0.9, 0.2), (0, 0, 0.1), rb.DARKSTONE)
    rb.box(t, f'{id}__toppled_stone', (0.66, 0.66, 1.5), (0, 0.75, 0.33), rb.STONE, rot=(1.5708, 0, 0))
    rb.box(t, f'{id}__toppled_cap', (0.8, 0.8, 0.18), (0, 1.45, 0.33), rb.DARKSTONE, rot=(1.5708, 0, 0))
    rb.sphere(t, f'{id}__toppled_orb', 0.2, (0, 1.75, 0.3), (0.4, 0.34, 0.16))
    rb.col(p, (0.8, 0.8, 1.6), (0, 0, 0.8))
    return p
