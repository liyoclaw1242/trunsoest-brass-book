# 提燈：unlit / lit / broken。可取走、點亮；持燈者夜間看得遠也被看得遠。不擋路。
import rb

def make(id, pos, **kw):
    p = rb.parent_empty(id, pos, rb.props('lamp', ['take', 'light', 'drop', 'give', 'break'], ['portable', 'light']))
    for st, glow in (('unlit', (0.5, 0.45, 0.35)), ('lit', (1.0, 0.9, 0.45))):
        s = rb.state_root(p, st)
        rb.box(s, f'{id}__{st}_base', (0.3, 0.3, 0.06), (0, 0, 0.03), rb.METAL)
        rb.box(s, f'{id}__{st}_glass', (0.26, 0.26, 0.36), (0, 0, 0.26), glow)
        rb.box(s, f'{id}__{st}_cap', (0.32, 0.32, 0.06), (0, 0, 0.47), rb.METAL)
        rb.cyl(s, f'{id}__{st}_handle', 0.18, 0.03, (0, 0, 0.6), rb.METAL, rot=(1.5708, 0, 0))
    s = rb.state_root(p, 'broken')
    rb.box(s, f'{id}__broken_base', (0.3, 0.3, 0.06), (0.1, 0, 0.03), rb.METAL, rot=(0, 0.4, 0))
    rb.box(s, f'{id}__broken_shard', (0.2, 0.1, 0.1), (-0.2, 0.1, 0.05), (0.5, 0.45, 0.35))
    return p
