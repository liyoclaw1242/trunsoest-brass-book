# 抄寫台：intact。書記在這裡抄書、把成品送進圖書館。木書桌＋凳＋成疊書卷＋墨水與立燈。擋路（單格）。
import rb
def make(id, pos, kind='paper', owner=None, **kw):
    p = rb.parent_empty(id, pos, rb.props('workstation', ['use'], ['station'], owner=owner, kind=kind))
    s = rb.state_root(p, 'intact')
    # 書桌
    rb.box(s, f'{id}__intact_top', (1.5, 0.9, 0.12), (0, 0.1, 0.82), rb.WOOD)
    for i, (dx, dy) in enumerate([(-0.65, 0.45), (0.65, 0.45), (-0.65, -0.3), (0.65, -0.3)]):
        rb.box(s, f'{id}__intact_leg{i}', (0.1, 0.1, 0.8), (dx, dy, 0.4), rb.DARKWOOD)
    # 斜面抄寫板＋紙
    rb.box(s, f'{id}__intact_slope', (1.1, 0.7, 0.06), (0, 0.1, 0.98), rb.DARKWOOD, rot=(0.3, 0, 0))
    rb.box(s, f'{id}__intact_sheet', (0.8, 0.5, 0.03), (0, 0.02, 1.02), rb.PAPER, rot=(0.3, 0, 0))
    # 成疊的書與書卷
    rb.box(s, f'{id}__intact_book1', (0.4, 0.3, 0.1), (-0.5, 0.2, 0.93), rb.ROOF_RED)
    rb.box(s, f'{id}__intact_book2', (0.4, 0.28, 0.1), (-0.5, 0.2, 1.03), rb.ROOF_BLUE)
    rb.cyl(s, f'{id}__intact_scroll', 0.07, 0.5, (0.5, 0.25, 0.95), rb.PAPER, rot=(0, 1.5708, 0))
    # 墨水瓶
    rb.cyl(s, f'{id}__intact_inkpot', 0.08, 0.14, (0.35, -0.1, 0.9), rb.INK)
    # 凳子
    rb.box(s, f'{id}__intact_stool', (0.5, 0.5, 0.08), (0, -0.7, 0.5), rb.WOOD)
    for i, (dx, dy) in enumerate([(-0.18, -0.55), (0.18, -0.55), (-0.18, -0.85), (0.18, -0.85)]):
        rb.box(s, f'{id}__intact_sleg{i}', (0.07, 0.07, 0.5), (dx, dy, 0.25), rb.DARKWOOD)
    rb.col(p, (1.8, 1.2, 1.0), (0, 0, 0.5))
    return p
