# 穀倉：收成存放處。擋路（單格）。木桶身＋奶油色束帶＋紅屋頂＋裝糧口與麥束，看得出是儲糧的倉。
import rb, math
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('granary', ['use'], ['granary', 'store', 'building']))
    s = rb.state_root(p, 'intact')
    rb.cyl(s, f'{id}__intact_base', 0.78, 0.2, (0, 0, 0.1), rb.DARKSTONE)
    rb.cyl(s, f'{id}__intact_body', 0.66, 2.0, (0, 0, 1.15), rb.WOOD)
    # 直向木條（桶板感）
    for i in range(10):
        a = 2 * math.pi * i / 10
        rb.box(s, f'{id}__intact_stave{i}', (0.1, 0.06, 1.95), (0.63 * math.cos(a), 0.63 * math.sin(a), 1.15), rb.TIMBER)
    rb.cyl(s, f'{id}__intact_band1', 0.69, 0.14, (0, 0, 0.55), rb.CREAM)
    rb.cyl(s, f'{id}__intact_band2', 0.69, 0.14, (0, 0, 1.75), rb.CREAM)
    rb.cone(s, f'{id}__intact_roof', 0.9, 0.8, (0, 0, 2.5), rb.ROOF_RED)
    rb.sphere(s, f'{id}__intact_finial', 0.12, (0, 0, 2.95), rb.BRASS)
    # 裝糧口＋小頂棚
    rb.box(s, f'{id}__intact_hatch', (0.5, 0.08, 0.6), (0, -0.66, 1.3), rb.DARKWOOD)
    rb.box(s, f'{id}__intact_awn', (0.7, 0.4, 0.06), (0, -0.85, 1.7), rb.ROOF_RED, rot=(-0.4, 0, 0))
    rb.box(s, f'{id}__intact_win', (0.26, 0.08, 0.26), (0, -0.66, 0.5), rb.WINDOW)
    # 麥束倚在旁邊
    for j, (dx, dy, rz) in enumerate([(0.95, -0.4, 0.2), (1.05, -0.2, -0.15)]):
        rb.cyl(s, f'{id}__intact_sheaf{j}', 0.16, 0.9, (dx, dy, 0.45), rb.THATCH, rot=(0.2, 0.1, rz))
    rb.col(p, (1.0, 1.0, 2.4), (0, 0, 1.2))
    return p
