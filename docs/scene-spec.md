# 場景物件規格

場景物件要怎麼做，規則引擎才指得到它們。

## 物件清單

| 類型 `rb_type` | 數量 | 模型狀態 | 支援的動詞 | 屬性 |
|---|---|---|---|---|
| `book` 黃銅書 | 1 | `closed` `writing` | read, move | 影響範圍圓心 |
| `lectern` 書台 | 1 | `intact` | 無 | 書的預設位置 |
| `speaker` 廣播器 | 4–6 | `intact` `broken` | break, repair | `rb_radius` 廣播半徑（公尺） |
| `notice` 公告牌 | 2 | `blank` `written` `defaced` | read, deface | 第二種公示手段，要走近才讀得到 |
| `house` 住宅 | 4 | `intact` | enter | `rb_owner` 屋主村民 id |
| `door` 門 | 每屋 1 | `closed` `open` | open, break | `rb_parent` 所屬住宅 |
| `fence` 圍籬段 | 6–10 | `intact` `broken` | break, climb | 擋路用 |
| `cart` 推車 | 2 | `intact` `broken` | move, break, use | 可推去擋路或墊腳（墊腳＝`use`，這一版預設） |
| `keepsake` 信物 | 每村民 1 | `intact` | take, give | `rb_owner` |
| `boundary` 界石 | 8–12 | `intact` | 無 | 沿影響範圍邊緣排一圈 |
| `villager` 村民 | 3–6 | `puppet` `half` `awake` | induce（誘導，第 2 輪加的預設） | 三種同化程度要從外觀分得出來 |
| `outsider` 外鄉人 | 1 | `intact` | 無（玩家） | |

動詞是固定清單（引擎的 `VERBS`），條文裡的每個動詞都要對應到其中一個：`enter` 進入、`use` 使用、`open` 開啟、`take` 取走、`give` 歸還、`break` 破壞、`repair` 修復、`move` 搬動、`climb` 翻越、`read` 閱讀、`deface` 塗毀、`approach` 靠近、`run` 奔跑、`capture` 抓捕、`induce` 誘導（第 2 輪加）。

## 建模規範

- **單位與格子**：1 Blender 單位＝1 公尺。佔地對齊 1 公尺格，角色佔 1 格，住宅約 4×4 格。
- **原點**：底部中心。物件放在 Z＝0 的地面上。
- **朝向**：正面朝 −Y。
- **風格**：低面數、純色材質、不貼圖。重點是從正上方或斜上方看，各類物件的輪廓分得出來。
- **命名**：`<類型>_<兩位數編號>`，例如 `speaker_01`、`house_03`。
- **狀態用子物件**：每個狀態一個 mesh，掛在同名空物件底下，命名為 `<id>__<狀態>`。例如 `speaker_01` 底下有 `speaker_01__intact` 和 `speaker_01__broken`，原點相同，由畫面端切換顯示。
- **碰撞**：每個會擋路的物件附一個簡單方塊 `<id>__col`，匯出時保留，畫面端讀取後隱藏。
- **「受規則保護」不要建模**：這個狀態由畫面端統一畫（外框或符號），這樣任何物件被保護時看起來都一致。
- **自訂屬性**：寫在父物件上，全部以 `rb_` 開頭。
  - `rb_type`：上表的類型。
  - `rb_tags`：逗號分隔，例如 `breakable,broadcast`。
  - `rb_verbs`：這個物件支援的動詞，逗號分隔。
  - `rb_radius`、`rb_owner`、`rb_parent`：視類型而定。

## 產出

- **每類物件一支 `bpy` 腳本**，放在 `blender/`（例如 `blender/make_speaker.py`），再用 `blender/build_scene.py` 擺出整個村子。
- **`public/village.glb`**：整個場景匯出成 glTF 二進位檔，匯出時包含自訂屬性（記憶中的腳本參數是 `export_extras=True`，屬性會出現在節點的 `extras`）。
- **`public/scene.json`**：由腳本從場景倒出，規則引擎以這份為準，不必解析 glTF。格式同 `engine/scene.sample.json`：

```json
{
  "id": "speaker_01",
  "type": "speaker",
  "pos": [12, 4],
  "state": "intact",
  "tags": ["breakable", "broadcast"],
  "verbs": ["break", "repair"],
  "radius": 8
}
```

`pos` 是格子座標 `[x, y]`，對應 Blender 的 X 和 Y。Blender 是 Z 朝上，glTF 是 Y 朝上，匯出時會轉換，畫面端對應座標時要留意。

這裡的 Blender 指令與匯出參數是憑記憶寫的，使用前請以本機安裝的版本確認。

## 村子的佈局要求

- 黃銅書放在村子中心附近的一棟住宅或圖書館裡，影響範圍半徑約 20 格。
- 廣播器的範圍合起來要蓋住大部分村子，但要留下至少兩塊聽不到的角落。
- 信物、公告牌、通往邊界的路這些關鍵位置要在廣播範圍內，否則最佳策略就是全程躲在聽不到的地方。
- 圍籬把通往邊界的幾條路擋住一部分，讓「翻越」和「破壞」有用處。
- 從中心到邊界至少要有三條不同的路線。

## 規則怎麼指向物件

條文拆成欄位，空著的欄位就是漏洞。完整說明在 `engine/rulebook-engine.js` 的 `write()` 註解。

```json
{
  "key": "speaker-break",
  "text": "廣播器不得被破壞。",
  "who": "any",
  "verb": "break",
  "target": { "type": "speaker" },
  "cond": null,
  "mode": "forbid"
}
```

- `who`：`any` 任何存在、`citizen` 市民、`outsider` 外鄉人。
- `target`：`{ "type": ... }` 指一整類，`{ "id": ... }` 指單一物件。
- `cond`：情境條件，例如 `invited`。
- `mode`：`forbid` 不得、`permit` 得、`require` 必須。

## 已有的測試條文

定義在 `engine/rules.default.js`。

| 條文 | 觸發 | 留下的漏洞 |
|---|---|---|
| 廣播器不得被破壞。 | 外鄉人破壞第二個廣播器 | 沒聽到的人不受約束；沒說不能搬走 |
| 外鄉人不得進入住宅。 | 外鄉人第二次進入住宅 | 和「受邀者得進入」衝突，裁決寫下前不追究 |
| 圍籬不得翻越。 | 外鄉人翻越三次 | 沒說不能破壞 |
| 圍籬不得被破壞。 | 上一條生效後，外鄉人破壞圍籬 | 推車可以墊腳 |
| 外鄉人不得取走信物。 | 外鄉人拿第一件信物 | 村民可以自己去拿 |
| 黃銅書不得被搬動。 | 有人搬了書 | 書台沒被提到 |
