# layout.py —— 原型三的佈局：100×100，書在 (49,52)，影響半徑 32，出生點 (50,48) 書台正門前廣場。
import math

CENTER = (49, 52)
RADIUS = 32
START = (50, 48)
MAP = 100

VILLAGER_COLORS = {
    'villager_01': (0.9, 0.35, 0.3), 'villager_02': (0.3, 0.55, 0.9), 'villager_03': (0.95, 0.75, 0.2),
    'villager_04': (0.35, 0.75, 0.4), 'villager_05': (0.7, 0.4, 0.8), 'villager_06': (0.95, 0.55, 0.25),
}

# 村道矩形 [x0, y0, x1, y1]（含）；住宅與其門前自動算村道；其餘是野地
ROADS = [
    [18, 46, 82, 49],      # 東西主街
    [48, 18, 51, 82],      # 南北主街
    [26, 56, 74, 58],      # 北街
    [26, 38, 74, 40],      # 南街
    [26, 38, 29, 58],      # 西環
    [71, 38, 74, 58],      # 東環
]

def boundary_ring(n=16):
    return [(round(CENTER[0] + RADIUS * math.cos(2 * math.pi * i / n)), round(CENTER[1] + RADIUS * math.sin(2 * math.pi * i / n))) for i in range(n)]

OBJECTS = [
    dict(type='book', id='book_01', pos=(49, 52), radius=RADIUS),
    dict(type='lectern', id='lectern_01', pos=(49, 52)),
    dict(type='house', id='house_01', pos=(50, 52), owner='villager_01', color_index=0),
    dict(type='house', id='house_02', pos=(30, 62), owner='villager_02', color_index=1),
    dict(type='house', id='house_03', pos=(70, 62), owner='villager_03', color_index=2),
    dict(type='house', id='house_04', pos=(50, 72), owner='villager_04', color_index=3),
    dict(type='house', id='house_05', pos=(34, 34), owner='villager_05', color_index=0),
    dict(type='house', id='house_06', pos=(66, 34), owner='villager_06', color_index=1),
    *[dict(type='door', id=f'door_0{i}', pos=(x, y - 2), parent=f'house_0{i}') for i, (x, y) in enumerate([(50, 52), (30, 62), (70, 62), (50, 72), (34, 34), (66, 34)], 1)],
    # 廣播器 r10
    dict(type='speaker', id='speaker_01', pos=(53, 46), radius=12),
    dict(type='speaker', id='speaker_02', pos=(33, 50), radius=12),
    dict(type='speaker', id='speaker_03', pos=(66, 50), radius=12),
    dict(type='speaker', id='speaker_04', pos=(40, 66), radius=12),
    dict(type='speaker', id='speaker_05', pos=(60, 66), radius=12),
    dict(type='speaker', id='speaker_06', pos=(50, 31), radius=12),
    dict(type='speaker', id='speaker_07', pos=(28, 36), radius=12),
    dict(type='speaker', id='speaker_08', pos=(72, 36), radius=12),
    dict(type='notice', id='notice_01', pos=(45, 47), state='written'),
    dict(type='notice', id='notice_02', pos=(56, 57), state='written'),
    dict(type='notice', id='notice_03', pos=(44, 39), state='written'),
    # 圍籬：南北出口與西邊各擋一段
    *[dict(type='fence', id=f'fence_{i+1:02d}', pos=(46 + i, 26), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+7:02d}', pos=(47 + i, 77), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+13:02d}', pos=(22, 45 + i), dir='y') for i in range(5)],
    dict(type='cart', id='cart_01', pos=(54, 27)),
    dict(type='cart', id='cart_02', pos=(45, 75)),
    dict(type='cart', id='cart_03', pos=(24, 52)),
    # 信物（都在廣播範圍內）
    dict(type='keepsake', id='keepsake_01', pos=(28, 44), owner='villager_01'),
    dict(type='keepsake', id='keepsake_02', pos=(72, 44), owner='villager_02'),
    dict(type='keepsake', id='keepsake_03', pos=(36, 70), owner='villager_03'),
    dict(type='keepsake', id='keepsake_04', pos=(56, 29), owner='villager_04'),
    dict(type='keepsake', id='keepsake_05', pos=(64, 70), owner='villager_05'),
    dict(type='keepsake', id='keepsake_06', pos=(41, 31), owner='villager_06'),
    # 燈柱（夜間照亮 r4）
    *[dict(type='lamppost', id=f'lamppost_{i+1:02d}', pos=p, radius=4) for i, p in enumerate([(40, 47), (60, 47), (50, 42), (50, 59), (30, 47), (70, 47), (50, 30), (50, 70)])],
    # 市民衣物（晾衣繩）
    dict(type='clothes', id='clothes_01', pos=(37, 59), owner='villager_02'),
    dict(type='clothes', id='clothes_02', pos=(63, 59), owner='villager_03'),
    dict(type='clothes', id='clothes_03', pos=(50, 35), owner='villager_05'),
    # 提燈
    dict(type='lamp', id='lamp_01', pos=(52, 49), state='unlit'),
    dict(type='lamp', id='lamp_02', pos=(31, 59), state='unlit'),
    dict(type='lamp', id='lamp_03', pos=(69, 41), state='unlit'),
    *[dict(type='boundary', id=f'boundary_{i+1:02d}', pos=p) for i, p in enumerate(boundary_ring())],
    # 村民：人偶是守夜人，家＝崗位
    dict(type='villager', id='villager_01', pos=(55, 43), state='half'),
    dict(type='villager', id='villager_02', pos=(31, 55), state='puppet'),
    dict(type='villager', id='villager_03', pos=(69, 55), state='half'),
    dict(type='villager', id='villager_04', pos=(50, 67), state='awake'),
    dict(type='villager', id='villager_05', pos=(35, 41), state='half'),
    dict(type='villager', id='villager_06', pos=(66, 41), state='puppet'),
    dict(type='outsider', id='outsider', pos=START),
    # 區域的假物件：條文要指得到「野地」
    dict(type='wild', id='wild', pos=None),
]
