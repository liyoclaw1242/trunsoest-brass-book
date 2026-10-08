# layout.py —— 村子的佈局（純資料）。改佈局改這裡，再重跑 build_scene.py。
# 座標是格子 [x, y]，書在 (29, 32)，影響範圍半徑 20。地圖 60×60。
import math

CENTER = (29, 32)
RADIUS = 20
START = (30, 28)          # 外鄉人出生點／被抓後送回的「村子中心」：書台正門前

VILLAGER_COLORS = {
    'villager_01': (0.9, 0.35, 0.3),   # 紅
    'villager_02': (0.3, 0.55, 0.9),   # 藍
    'villager_03': (0.95, 0.75, 0.2),  # 黃
    'villager_04': (0.35, 0.75, 0.4),  # 綠
}

def boundary_ring(n=12):
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        out.append((round(CENTER[0] + RADIUS * math.cos(a)), round(CENTER[1] + RADIUS * math.sin(a))))
    return out

OBJECTS = [
    # 書與書台：在 house_01 室內（室內格 29..30 × 31..32）
    dict(type='book', id='book_01', pos=(29, 32), radius=RADIUS),
    dict(type='lectern', id='lectern_01', pos=(29, 32)),
    # 住宅（門在 (x, y-2)）
    dict(type='house', id='house_01', pos=(30, 32), owner='villager_01', color_index=0),
    dict(type='house', id='house_02', pos=(16, 38), owner='villager_02', color_index=1),
    dict(type='house', id='house_03', pos=(44, 38), owner='villager_03', color_index=2),
    dict(type='house', id='house_04', pos=(30, 46), owner='villager_04', color_index=3),
    dict(type='door', id='door_01', pos=(30, 30), parent='house_01'),
    dict(type='door', id='door_02', pos=(16, 36), parent='house_02'),
    dict(type='door', id='door_03', pos=(44, 36), parent='house_03'),
    dict(type='door', id='door_04', pos=(30, 44), parent='house_04'),
    # 廣播器
    dict(type='speaker', id='speaker_01', pos=(30, 27), radius=8),
    dict(type='speaker', id='speaker_02', pos=(17, 30), radius=8),
    dict(type='speaker', id='speaker_03', pos=(40, 30), radius=11),
    dict(type='speaker', id='speaker_04', pos=(23, 43), radius=8),
    dict(type='speaker', id='speaker_05', pos=(38, 43), radius=8),
    dict(type='speaker', id='speaker_06', pos=(30, 17), radius=10),
    # 公告牌
    dict(type='notice', id='notice_01', pos=(25, 26), state='written'),
    dict(type='notice', id='notice_02', pos=(36, 39), state='written'),
    # 圍籬（擋南邊與西邊的直路一部分）
    *[dict(type='fence', id=f'fence_{i+1:02d}', pos=(27 + i, 22), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+7:02d}', pos=(21, 26 + i), dir='y') for i in range(4)],
    # 推車
    dict(type='cart', id='cart_01', pos=(34, 23)),
    dict(type='cart', id='cart_02', pos=(22, 35)),
    # 信物（都在廣播範圍內，離主人的家有一段距離）
    dict(type='keepsake', id='keepsake_01', pos=(14, 24), owner='villager_01'),
    dict(type='keepsake', id='keepsake_02', pos=(45, 25), owner='villager_02'),
    dict(type='keepsake', id='keepsake_03', pos=(20, 47), owner='villager_03'),
    dict(type='keepsake', id='keepsake_04', pos=(37, 15), owner='villager_04'),
    # 界石
    *[dict(type='boundary', id=f'boundary_{i+1:02d}', pos=p) for i, p in enumerate(boundary_ring())],
    # 角色
    dict(type='villager', id='villager_01', pos=(35, 23), state='half'),
    dict(type='villager', id='villager_02', pos=(21, 31), state='puppet'),
    dict(type='villager', id='villager_03', pos=(40, 33), state='half'),
    dict(type='villager', id='villager_04', pos=(30, 41), state='awake'),
    dict(type='outsider', id='outsider', pos=START),
]
