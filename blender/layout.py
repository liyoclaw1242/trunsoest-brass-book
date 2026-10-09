# layout.py —— 改版 v2 佈局：100×100，書在中央的圖書館裡，影響半徑 32，出生點在圖書館門前廣場。
# 社會分工（九名村民）：農夫耕田送穀倉、物流拉車把貨運到市集店鋪、商人顧店迎客、治安官沿哨口巡邏、書記在圖書館抄書、穀倉管理員顧倉。
import math
CENTER = (49, 52); RADIUS = 32; START = (50, 48); MAP = 100
PLAZA = (43, 45, 55, 50)              # 廣場（出生點一帶）
WILDDEEP = (84, 84, 98, 98)           # 荒野深處（放逐結局）：遠在東北角、範圍外

# 依職業配色，讓玩家一眼分得出誰在做什麼：農夫綠、物流棕、商人金、治安官藍、書記紫、穀倉管理員土黃。
VILLAGER_COLORS = {
    'villager_01': (0.35, 0.70, 0.40), 'villager_02': (0.30, 0.62, 0.34), 'villager_03': (0.46, 0.68, 0.30),  # 農夫
    'villager_04': (0.60, 0.42, 0.25),                                                                         # 物流
    'villager_05': (0.92, 0.72, 0.20), 'villager_06': (0.86, 0.60, 0.24),                                      # 商人
    'villager_07': (0.30, 0.45, 0.78),                                                                         # 治安官
    'villager_08': (0.55, 0.40, 0.72),                                                                         # 書記
    'villager_09': (0.72, 0.60, 0.42),                                                                         # 穀倉管理員
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
    dict(type='house', id='house_01', pos=(30, 44), owner='villager_05', color_index=0),   # 商人
    dict(type='house', id='house_02', pos=(68, 44), owner='villager_06', color_index=1),   # 商人
    dict(type='house', id='house_03', pos=(30, 64), owner='villager_01', color_index=2),   # 農夫
    dict(type='house', id='house_04', pos=(68, 64), owner='villager_04', color_index=3),   # 物流
    dict(type='house', id='house_05', pos=(40, 70), owner='villager_02', color_index=0),   # 農夫
    dict(type='house', id='house_06', pos=(58, 70), owner='villager_03', color_index=1),   # 農夫
    *[dict(type='door', id=f'door_0{i}', pos=(x, y - 2), parent=f'house_0{i}') for i, (x, y) in enumerate([(30, 44), (68, 44), (30, 64), (68, 64), (40, 70), (58, 70)], 1)],

    # —— 農業：三塊田 + 穀倉（南邊農田帶）——
    dict(type='field', id='field_01', pos=(34, 73)),
    dict(type='field', id='field_02', pos=(46, 73)),
    dict(type='field', id='field_03', pos=(58, 73)),
    dict(type='granary', id='granary_01', pos=(49, 68)),

    # —— 市集：兩間店鋪（圖書館南側、廣場北緣）——
    dict(type='shop', id='shop_01', pos=(42, 52)),
    dict(type='shop', id='shop_02', pos=(56, 52)),

    # —— 治安：四個哨口（繞村的巡邏菱形）——
    dict(type='post', id='post_01', pos=(50, 40)),   # 南
    dict(type='post', id='post_02', pos=(64, 52)),   # 東
    dict(type='post', id='post_03', pos=(49, 64)),   # 北
    dict(type='post', id='post_04', pos=(34, 52)),   # 西

    # —— 物流車（跟著物流業者）——
    dict(type='cart', id='cart_01', pos=(51, 70)),

    # 書記的抄寫台（圖書館門前；勞動直接流向書）
    dict(type='workstation', id='ws_01', pos=(45, 50), kind='paper', owner='villager_08'),

    # 廣播器 r12
    *[dict(type='speaker', id=f'speaker_0{i+1}', pos=p, radius=12) for i, p in enumerate([(49, 46), (33, 50), (65, 50), (40, 62), (58, 62), (49, 36), (28, 42), (70, 42)])],
    dict(type='notice', id='notice_01', pos=(45, 47), state='written'),
    dict(type='notice', id='notice_02', pos=(54, 57), state='written'),
    dict(type='notice', id='notice_03', pos=(49, 42), state='written'),
    dict(type='census', id='census_01', pos=(53, 47)),   # 戶籍冊在廣場邊
    dict(type='well', id='well_01', pos=(44, 56)),
    dict(type='goat', id='goat_01', pos=(40, 54)),
    dict(type='rope', id='rope_01', pos=(42, 55), state='intact'),
    # 圍籬（南北出口與西邊各擋一段）
    *[dict(type='fence', id=f'fence_{i+1:02d}', pos=(46 + i, 26), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+7:02d}', pos=(43 + i, 82), dir='x') for i in range(6)],
    *[dict(type='fence', id=f'fence_{i+13:02d}', pos=(22, 45 + i), dir='y') for i in range(5)],
    # 燈柱
    *[dict(type='lamppost', id=f'lamppost_{i+1:02d}', pos=p, radius=4) for i, p in enumerate([(40, 47), (58, 47), (49, 44), (49, 60), (30, 50), (68, 50), (49, 30), (49, 76)])],
    dict(type='clothes', id='clothes_01', pos=(40, 51), owner='villager_05'),
    dict(type='clothes', id='clothes_02', pos=(58, 51), owner='villager_06'),
    dict(type='lamp', id='lamp_01', pos=(51, 49), state='unlit'),
    dict(type='lamp', id='lamp_02', pos=(35, 58), state='unlit'),
    dict(type='lamp', id='lamp_03', pos=(63, 41), state='unlit'),
    *[dict(type='boundary', id=f'boundary_{i+1:02d}', pos=p) for i, p in enumerate(boundary_ring())],

    # —— 村民（九名，各有職業）——
    dict(type='villager', id='villager_01', pos=(34, 72), state='half',   role='farmer',    field='field_01'),
    dict(type='villager', id='villager_02', pos=(46, 72), state='half',   role='farmer',    field='field_02'),
    dict(type='villager', id='villager_03', pos=(58, 72), state='half',   role='farmer',    field='field_03'),
    dict(type='villager', id='villager_04', pos=(51, 69), state='half',   role='logistics', cart='cart_01'),
    dict(type='villager', id='villager_05', pos=(42, 53), state='half',   role='merchant',  shop='shop_01'),
    dict(type='villager', id='villager_06', pos=(56, 53), state='half',   role='merchant',  shop='shop_02'),
    dict(type='villager', id='villager_07', pos=(50, 41), state='half',   role='sheriff'),
    dict(type='villager', id='villager_08', pos=(45, 51), state='puppet', role='scribe'),
    dict(type='villager', id='villager_09', pos=(50, 68), state='half',   role='keeper'),
    dict(type='outsider', id='outsider', pos=START),

    # 入口（南邊）上一次放逐的痕跡
    dict(type='carved-stone', id='carved_stone_01', pos=(47, 22)),
    dict(type='rope', id='rope_02', pos=(49, 22), state='frayed'),
    # 區域假物件
    dict(type='wild', id='wild', pos=None),
]
