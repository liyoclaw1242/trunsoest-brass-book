# 田：農夫耕作的農地。不擋路（人能走上去）。翻好的土壟＋成排作物（含幾顆熟果），看得出在種東西。
import rb

SOIL = (0.46, 0.32, 0.20); SOIL_D = (0.38, 0.26, 0.16); RIDGE = (0.52, 0.38, 0.24)
CROPS = [
    ((0.40, 0.62, 0.26), (0.90, 0.33, 0.30)),   # 綠葉＋紅果（番茄）
    ((0.34, 0.56, 0.28), (0.96, 0.76, 0.24)),   # 綠葉＋黃果（南瓜/玉米）
    ((0.45, 0.60, 0.30), (0.80, 0.45, 0.76)),   # 綠葉＋紫果（茄）
]

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('field', ['use'], ['field', 'ground']))
    s = rb.state_root(p, 'intact')
    # 作物色依 id 末碼變化，讓三塊田不一樣
    try:
        idx = int(''.join(ch for ch in id if ch.isdigit())) % len(CROPS)
    except ValueError:
        idx = 0
    leaf, fruit = CROPS[idx]
    rb.box(s, f'{id}__intact_soil', (2.8, 2.8, 0.08), (0, 0, 0.04), SOIL)
    # 翻土壟（深淺相間）
    for r in range(5):
        y = -1.1 + r * 0.55
        rb.box(s, f'{id}__intact_furrow{r}', (2.6, 0.42, 0.12), (0, y, 0.09), SOIL_D if r % 2 else RIDGE)
    # 田埂外框
    for i, (dx, dy, sx, sy) in enumerate([(0, 1.4, 2.9, 0.14), (0, -1.4, 2.9, 0.14), (1.4, 0, 0.14, 2.9), (-1.4, 0, 0.14, 2.9)]):
        rb.box(s, f'{id}__intact_edge{i}', (sx, sy, 0.16), (dx, dy, 0.08), RIDGE)
    # 作物：成排的葉叢，點綴熟果
    n = 0
    for r in range(4):
        y = -0.95 + r * 0.6
        for cx in (-0.85, -0.3, 0.3, 0.85):
            rb.box(s, f'{id}__intact_stem{n}', (0.05, 0.05, 0.3), (cx, y, 0.2), (0.36, 0.5, 0.24))
            o = rb.sphere(s, f'{id}__intact_leaf{n}', 0.2, (cx, y, 0.42), leaf)
            o.scale = (o.scale[0], o.scale[1], o.scale[2] * 0.7)
            if (r + n) % 3 == 0:
                rb.sphere(s, f'{id}__intact_fruit{n}', 0.1, (cx + 0.08, y + 0.05, 0.4), fruit)
            n += 1
    return p
