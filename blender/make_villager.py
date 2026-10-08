# 村民：puppet / half / awake 三種同化程度，外觀要分得出來。
#   puppet 人偶：全身灰白、方形頭、僵直無手臂。
#   half 半同化：身體有主人色、圓頭、戴灰帽。
#   awake 已喚醒：全身主人色、圓頭、無帽、有手臂。
import rb

GREY = (0.82, 0.82, 0.8)

def _legs(s, id, st, color):
    rb.box(s, f'{id}__{st}_legL', (0.18, 0.2, 0.5), (-0.12, 0, 0.25), color)
    rb.box(s, f'{id}__{st}_legR', (0.18, 0.2, 0.5), (0.12, 0, 0.25), color)

def make(id, pos, color=(0.9, 0.3, 0.5), state='puppet', **kw):
    p = rb.parent_empty(id, pos, rb.props('villager', [], ['actor'], color=','.join(str(round(c, 2)) for c in color)))
    # puppet
    s = rb.state_root(p, 'puppet')
    _legs(s, id, 'puppet', GREY)
    rb.box(s, f'{id}__puppet_body', (0.5, 0.32, 0.7), (0, 0, 0.85), GREY)
    rb.box(s, f'{id}__puppet_head', (0.42, 0.42, 0.42), (0, 0, 1.45), GREY)
    rb.box(s, f'{id}__puppet_badge', (0.14, 0.05, 0.14), (0, -0.18, 0.95), color)
    # half
    s = rb.state_root(p, 'half')
    _legs(s, id, 'half', GREY)
    rb.box(s, f'{id}__half_body', (0.5, 0.32, 0.7), (0, 0, 0.85), color)
    rb.box(s, f'{id}__half_armL', (0.14, 0.14, 0.6), (-0.33, 0, 0.9), GREY)
    rb.box(s, f'{id}__half_armR', (0.14, 0.14, 0.6), (0.33, 0, 0.9), GREY)
    rb.sphere(s, f'{id}__half_head', 0.24, (0, 0, 1.45), (0.95, 0.85, 0.75))
    rb.cyl(s, f'{id}__half_hat', 0.3, 0.08, (0, 0, 1.62), GREY)
    rb.cyl(s, f'{id}__half_hattop', 0.18, 0.22, (0, 0, 1.75), GREY)
    # awake
    s = rb.state_root(p, 'awake')
    _legs(s, id, 'awake', color)
    rb.box(s, f'{id}__awake_body', (0.5, 0.32, 0.7), (0, 0, 0.85), color)
    rb.box(s, f'{id}__awake_armL', (0.14, 0.14, 0.6), (-0.36, -0.1, 1.0), color, rot=(-0.6, 0, 0))
    rb.box(s, f'{id}__awake_armR', (0.14, 0.14, 0.6), (0.36, -0.1, 1.0), color, rot=(-0.6, 0, 0))
    rb.sphere(s, f'{id}__awake_head', 0.24, (0, 0, 1.45), (0.95, 0.85, 0.75))
    rb.sphere(s, f'{id}__awake_hair', 0.2, (0, 0.05, 1.6), rb.INK)
    return p
