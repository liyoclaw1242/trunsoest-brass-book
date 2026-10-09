# layout.py —— 改版 v2 佈局：100×100，書在中央的圖書館裡，影響半徑 32，出生點在圖書館門前廣場。
import math
CENTER = (49, 52); RADIUS = 32; START = (50, 48); MAP = 100
PLAZA = (43, 45, 55, 50)              # 廣場（出生點一帶）
WILDDEEP = (84, 84, 98, 98)           # 荒野深處（放逐結局）：遠在東北角、範圍外

VILLAGER_COLORS = {
    'villager_01': (0.9, 0.35, 0.3), 'villager_02': (0.3, 0.55, 0.9), 'villager_03': (0.95, 0.75, 0.2),
    'villager_04': (0.35, 0.75, 0.4), 'villager_05': (0.7, 0.4, 0.8), 'villager_06': (0.6, 0.55, 0.5),
}
ROADS = [
    [17, 46, 83, 49], [48, 17, 51, 83],       # 東西／南北主街
    [26, 56, 72, 58], [26, 38, 72, 40],       # 北街／南街
    [26, 38, 29, 58], [70, 38, 73, 58],       # 西環／東環
    [72, 46, 90, 49], [48, 72, 51, 90],       # 通往荒野深處的東路與北路
]
def boundary_ring(n=16):
    return [(round(CENTER[0] + RADIUS * math.cos(2 * math.pi * i / n)), round(CENTER[1] + RADIUS * math.sin(2 * math.pi * i / n))) for i in range(n)]

OBJECTS = [
    # 圖書館與書（書在圖書館內）
    dict(type='library', id='library_01', pos=(49, 54)),
    dict(type='book', id='book_01', pos=(48, 54), radius=RADIUS),
    dict(type='lectern', id='lectern_01', pos=(48, 54)),
    # 住宅（六棟）
    dict(type='house', id='house_01', pos=(30, 44), owner='villager_01', color_index=0),
    dict(type='house', id='house_02', pos=(68, 44), owner='villager_02', color_index=1),
    dict(type='house', id='house_03', pos=(30, 64), owner='villager_03', color_index=2),
    dict(type='house', id='house_04', pos=(68, 64), owner='villager_04', color_index=3),
    dict(type='house', id='house_05', pos=(40, 70), owner='villager_05', color_index=0),
    dict(type='house', id='house_06', pos=(58, 70), owner='villager_06', color_index=1),
    *[dict(type='door', id=f'door_0{i}', pos=(x, y - 2), parent=f'house_0{i}') for i, (x, y) in enumerate([(30, 44), (68, 44), (30, 64), (68, 64), (40, 70), (58, 70)], 1)],
    # 工作站：紙坊、墨坊（村民的崗位，看得到勞動送進圖書館）
    dict(type='workstation', id='ws_01', pos=(34, 48), kind='paper', owner='villager_01'),
    dict(type='workstation', id='ws_02', pos=(64, 48), kind='ink', owner='villager_02'),
    dict(type='workstation', id='ws_03', pos=(34, 60), kind='paper', owner='villager_03'),
    dict(type='workstation', id='ws_04', pos=(64, 60), kind='ink', owner='villager_05'),
    # 廣播器 r12
    *[dict(type='speaker', id=f'speaker_0{i+1}', pos=p, radius=12) for i, p in enumerate([(49, 46), (33, 50), (65, 50), (40, 62), (58, 62), (49, 36), (28, 42), (70, 42)])],
    dict(type='notice', id='notice_01', pos=(45, 47), state='written'),
    dict(type='notice', id='notice_02', pos=(54, 57), state='written'),
    dict(type='notice', id='notice_03', pos=(49, 40), state='written'),
    dict(type='census', id='census_01', pos=(53, 47)),   # 戶籍冊在廣場邊
    dict(type='well', id='well_01', pos=(44, 56)),
    dict(type='goat', id='goat_01', pos=(40, 54)),
    dict(type='rope', id='rope_01', pos=(42, 55), state='intact'),
    # 圍籬（南北出口與西邊各擋一段）
    *[dict(type='fence', id=f'fence_{i+1:02d}', pos=(46 + i, 26), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+7:02d}', pos=(47 + i, 78), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+13:02d}', pos=(22, 45 + i), dir='y') for i in range(5)],
    # 信物（都在廣播範圍內）
    *[dict(type='keepsake', id=f'keepsake_0{i+1}', pos=p, owner=f'villager_0{i+1}') for i, p in enumerate([(26, 48), (72, 48), (29, 58), (69, 58), (44, 66)])],
    # 燈柱
    *[dict(type='lamppost', id=f'lamppost_{i+1:02d}', pos=p, radius=4) for i, p in enumerate([(40, 47), (58, 47), (49, 44), (49, 60), (30, 50), (68, 50), (49, 30), (49, 70)])],
    dict(type='clothes', id='clothes_01', pos=(37, 45), owner='villager_01'),
    dict(type='clothes', id='clothes_02', pos=(61, 45), owner='villager_02'),
    dict(type='clothes', id='clothes_03', pos=(49, 66), owner='villager_05'),
    dict(type='lamp', id='lamp_01', pos=(51, 49), state='unlit'),
    dict(type='lamp', id='lamp_02', pos=(35, 58), state='unlit'),
    dict(type='lamp', id='lamp_03', pos=(63, 41), state='unlit'),
    *[dict(type='boundary', id=f'boundary_{i+1:02d}', pos=p) for i, p in enumerate(boundary_ring())],
    # 村民：v6 是上一次放逐的搬運者（純人偶，只有山羊鈴鐺喚醒得了）
    dict(type='villager', id='villager_01', pos=(34, 46), state='half'),
    dict(type='villager', id='villager_02', pos=(64, 46), state='puppet'),
    dict(type='villager', id='villager_03', pos=(34, 58), state='half'),
    dict(type='villager', id='villager_04', pos=(64, 58), state='half'),
    dict(type='villager', id='villager_05', pos=(42, 66), state='half'),
    dict(type='villager', id='villager_06', pos=(49, 24), state='puppet', carrier=True),
    dict(type='outsider', id='outsider', pos=START),
    # 入口（南邊）上一次放逐的痕跡
    dict(type='carved-stone', id='carved_stone_01', pos=(47, 22)),
    dict(type='rope', id='rope_02', pos=(49, 22), state='frayed'),
    dict(type='bell', id='bell_01', pos=(51, 22), owner='villager_06'),
    # 區域假物件
    dict(type='wild', id='wild', pos=None),
]
