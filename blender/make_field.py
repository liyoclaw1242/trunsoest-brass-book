# 田：農夫耕作的農地。不擋路（人能走上去），一畦畦作物與田埂。
import rb
SOIL = (0.42, 0.3, 0.18); CROP = (0.42, 0.62, 0.26); CROP2 = (0.55, 0.68, 0.3)
def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('field', ['use'], ['field', 'ground']))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_soil', (2.6, 2.6, 0.06), (0, 0, 0.03), SOIL)
    # 田埂（四邊矮土埂）
    for i, (dx, dy, sx, sy) in enumerate([(0, 1.25, 2.6, 0.12), (0, -1.25, 2.6, 0.12), (1.25, 0, 0.12, 2.6), (-1.25, 0, 0.12, 2.6)]):
        rb.box(s, f'{id}__intact_ridge{i}', (sx, sy, 0.12), (dx, dy, 0.06), (0.5, 0.38, 0.24))
    # 作物列
    for r, y in enumerate((-0.8, -0.27, 0.27, 0.8)):
        col = CROP if r % 2 == 0 else CROP2
        rb.box(s, f'{id}__intact_row{r}', (2.2, 0.2, 0.3), (0, y, 0.2), col)
    return p
