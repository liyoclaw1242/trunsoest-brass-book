# 廣播器：intact（直立桿＋喇叭）/ broken（桿折斷、喇叭掉在地上）。rb_radius 廣播半徑。
import rb

def make(id, pos, radius=8, **kw):
    p = rb.parent_empty(id, pos, rb.props('speaker', ['break', 'repair', 'move', 'use'], ['breakable', 'broadcast'], radius=radius))
    s = rb.state_root(p, 'intact')
    rb.box(s, f'{id}__intact_base', (0.56, 0.56, 0.24), (0, 0, 0.12), rb.DARKSTONE)
    rb.box(s, f'{id}__intact_base2', (0.38, 0.38, 0.16), (0, 0, 0.3), rb.STONE)
    rb.cyl(s, f'{id}__intact_pole', 0.08, 2.3, (0, 0, 1.35), rb.DARKWOOD)
    rb.cyl(s, f'{id}__intact_collar', 0.12, 0.14, (0, 0, 2.3), rb.BRASS)
    # 留聲機式黃銅喇叭（美麗卻散布控制，呼應黃銅書）
    rb.cone(s, f'{id}__intact_horn', 0.46, 0.8, (0, -0.42, 2.5), rb.BRASS, rot=(-1.5708, 0, 0))
    rb.cone(s, f'{id}__intact_hornin', 0.3, 0.5, (0, -0.52, 2.5), rb.RED, rot=(-1.5708, 0, 0))
    rb.cyl(s, f'{id}__intact_neck', 0.07, 0.4, (0, 0.0, 2.5), rb.BRASS, rot=(1.5708, 0, 0))
    rb.sphere(s, f'{id}__intact_cap', 0.14, (0, 0.12, 2.5), rb.BRASS)
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_base', (0.5, 0.5, 0.2), (0, 0, 0.1), rb.DARKSTONE)
    rb.cyl(s, f'{id}__broken_stump', 0.07, 0.9, (0, 0, 0.65), rb.METAL)
    rb.cyl(s, f'{id}__broken_fallen', 0.07, 1.5, (0.5, -0.6, 0.12), rb.METAL, rot=(0, 1.45, -0.9))
    rb.cone(s, f'{id}__broken_horn', 0.42, 0.7, (0.9, -1.1, 0.3), rb.RED, rot=(0.4, 1.2, 0))
    rb.col(p, (0.6, 0.6, 2.8), (0, 0, 1.4))
    return p
