# 村民：puppet / half / awake 三種同化程度，外觀分得出來，且依職業戴不同帽子／圍裙。
#   puppet 人偶：灰白、方頭、僵直無手臂、無職業配件（還不是「人」）。
#   half 半同化：身體帶主人色、圓頭、戴職業帽、有手臂。
#   awake 已喚醒：全身主人色、圓頭、頭髮、手臂、職業配件最完整。
# 比例走可愛（chibi）：大圓頭、小身體、短腿、連指手。
import rb

GREY = (0.82, 0.82, 0.80)
SKIN = (0.96, 0.84, 0.72)

# 職業 → 帽色
ROLE_HAT = {
    'farmer': rb.THATCH, 'merchant': rb.ROOF_RED, 'sheriff': rb.ROOF_BLUE,
    'scribe': rb.ROOF_PLUM, 'keeper': (0.74, 0.62, 0.42), 'logistics': rb.TRUNK,
}

def _legs(s, id, st, color):
    rb.box(s, f'{id}__{st}_legL', (0.17, 0.2, 0.42), (-0.12, 0, 0.21), color)
    rb.box(s, f'{id}__{st}_legR', (0.17, 0.2, 0.42), (0.12, 0, 0.21), color)
    rb.box(s, f'{id}__{st}_shoeL', (0.2, 0.26, 0.12), (-0.12, -0.04, 0.06), rb.DARKWOOD)
    rb.box(s, f'{id}__{st}_shoeR', (0.2, 0.26, 0.12), (0.12, -0.04, 0.06), rb.DARKWOOD)

def _hat(s, id, st, role, z, head_color):
    """職業帽／配件。"""
    hc = ROLE_HAT.get(role)
    if not hc:
        return
    if role == 'farmer':   # 寬邊草帽
        rb.cyl(s, f'{id}__{st}_hatbrim', 0.42, 0.05, (0, 0, z + 0.02), hc)
        rb.cyl(s, f'{id}__{st}_hattop', 0.24, 0.22, (0, 0, z + 0.14), hc)
    elif role == 'sheriff':  # 警帽＋銅星
        rb.cyl(s, f'{id}__{st}_hatbrim', 0.32, 0.05, (0, -0.05, z + 0.02), hc)
        rb.cyl(s, f'{id}__{st}_hattop', 0.26, 0.2, (0, 0, z + 0.13), hc)
        rb.box(s, f'{id}__{st}_badge', (0.12, 0.04, 0.12), (0, -0.26, z + 0.14), rb.BRASS)
    else:   # 一般圓帽／便帽
        rb.cyl(s, f'{id}__{st}_hatbrim', 0.3, 0.05, (0, -0.03, z + 0.02), hc)
        rb.cyl(s, f'{id}__{st}_hattop', 0.25, 0.18, (0, 0, z + 0.12), hc)

def _apron(s, id, st, role, color):
    if role == 'merchant':
        rb.box(s, f'{id}__{st}_apron', (0.46, 0.06, 0.6), (0, -0.19, 0.72), rb.CREAM)
    elif role == 'keeper':
        rb.box(s, f'{id}__{st}_sack', (0.34, 0.3, 0.34), (0, 0.28, 1.0), rb.THATCH)   # 背上的糧袋

def make(id, pos, color=(0.9, 0.3, 0.5), state='puppet', role=None, **kw):
    p = rb.parent_empty(id, pos, rb.props('villager', ['induce'], ['actor'], color=','.join(str(round(c, 2)) for c in color), role=role or ''))

    # puppet：灰白木偶，無職業配件
    s = rb.state_root(p, 'puppet')
    _legs(s, id, 'puppet', GREY)
    rb.box(s, f'{id}__puppet_body', (0.5, 0.34, 0.66), (0, 0, 0.78), GREY)
    rb.box(s, f'{id}__puppet_head', (0.44, 0.44, 0.44), (0, 0, 1.33), GREY)
    rb.box(s, f'{id}__puppet_badge', (0.14, 0.05, 0.14), (0, -0.19, 0.88), color)

    # half：半同化，戴職業帽
    s = rb.state_root(p, 'half')
    _legs(s, id, 'half', (color[0] * 0.7, color[1] * 0.7, color[2] * 0.7))
    rb.box(s, f'{id}__half_body', (0.5, 0.34, 0.66), (0, 0, 0.78), color)
    _apron(s, id, 'half', role, color)
    rb.box(s, f'{id}__half_armL', (0.13, 0.13, 0.52), (-0.33, 0, 0.82), color)
    rb.box(s, f'{id}__half_armR', (0.13, 0.13, 0.52), (0.33, 0, 0.82), color)
    rb.sphere(s, f'{id}__half_handL', 0.1, (-0.33, 0, 0.54), SKIN)
    rb.sphere(s, f'{id}__half_handR', 0.1, (0.33, 0, 0.54), SKIN)
    rb.sphere(s, f'{id}__half_head', 0.3, (0, 0, 1.4), SKIN)
    _hat(s, id, 'half', role, 1.62, SKIN)

    # awake：已喚醒，手臂上揚、職業配件最完整、有頭髮
    s = rb.state_root(p, 'awake')
    _legs(s, id, 'awake', color)
    rb.box(s, f'{id}__awake_body', (0.5, 0.34, 0.66), (0, 0, 0.78), color)
    _apron(s, id, 'awake', role, color)
    rb.box(s, f'{id}__awake_armL', (0.13, 0.13, 0.54), (-0.35, -0.08, 0.92), color, rot=(-0.6, 0, 0))
    rb.box(s, f'{id}__awake_armR', (0.13, 0.13, 0.54), (0.35, -0.08, 0.92), color, rot=(-0.6, 0, 0))
    rb.sphere(s, f'{id}__awake_handL', 0.1, (-0.35, -0.32, 1.16), SKIN)
    rb.sphere(s, f'{id}__awake_handR', 0.1, (0.35, -0.32, 1.16), SKIN)
    rb.sphere(s, f'{id}__awake_head', 0.3, (0, 0, 1.4), SKIN)
    rb.sphere(s, f'{id}__awake_hair', 0.26, (0, 0.06, 1.54), rb.INK)
    _hat(s, id, 'awake', role, 1.62, SKIN)
    return p
