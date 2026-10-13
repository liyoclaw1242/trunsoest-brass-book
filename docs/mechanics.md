# 機制清單（M 層）— 規則書解謎引擎

> **權威來源**：本檔照 `src/puzzle/game.js` 的*實際判定*寫成，不是設計稿。與其他文件衝突時以本檔＋程式碼為準。
> **取代** `docs/system.md` 舊的「詞表／物件」段（那些已過時）。設計流程見 `docs/level-design-mda.md`（本檔是其中的 **M** 層基礎）。

**狀態標記**：★現用（現有 12 關實際用到）／💤休眠（引擎完整支援，但現關一個沒放，多為 v2 沙盒遺產）／⚠半實作（有定義但幾乎沒被法條驗證過，啟用前先補測試）。

---

## 1. 裁決核心 ★

一切互動走同一條，無特例：

```
forbidden(verb, 行動者名詞集, 受體?) ：
  掃所有「此刻生效」且 verb 相符的法，其中
    who   比對【行動者名詞集】或【受體名詞集】任一   （null / 任何人 = 全中）
    target比對【受體 type】或【受體名詞集】
    cond  需 has 裡有該項（如「著衣者」才適用）
  有任一 permit → 放行；否則有任一 forbid → 禁止。          ← permit 永遠蓋過 forbid
```

- **身分**：持有某「定義物」(`def`，如名牌)→ 市民；否則外鄉人。見 §4。
- **「此刻生效」** `active(l)`：`src`（廣播/公告）要先聽到/讀到才算；`onNotice` 的法，場上公告牌被毀即失效。無這兩欄的法恆生效。
- **`who` 雙向比對**是深度的關鍵：`圍牆即樹木` 讓牆獲得「樹木」名詞，於是「樹木得破壞」這條 permit 透過**受體**名詞套到牆上 → 可破。

---

## 2. 詞表

字塊相鄰成句即成法（§3）。三類詞：

### 主詞 SUBJ（8）
`外鄉人 outsider`、`市民 citizen`、`任何人 any`、`山羊 goat`、`物 item`、`樹木 tree`、`生物 creature`、`圍牆 wall`
— `任何人` = 不限身分；`物` = 所有實體的共同底層名詞（見 BASE_NOUNS §5）。

### 情態 MODAL / COPULA
`不得 forbid`、`得 permit`、`即 is`（定義：A 即 B，見 §4）。

### 動詞 VERB（9）

| 詞 | 碼 | 判定函式 · 誰是行動者/受體 | 狀態 |
|---|---|---|---|
| 離開 | leave | `forbidden('leave', 玩家名詞)`；踩出口時判，無受體 | ★ |
| 進入 | enter | `forbidden('enter', 玩家名詞)`；踏進**聖所**格時判 | ★ |
| 推 | push | `forbidden('push', 玩家名詞, 被推物)`；who 中玩家**或被推物**（「物不得推」管被推物） | ★ |
| 破壞 | break | `forbidden('break', 玩家名詞, 圍牆)`；who 中玩家**或牆** | ★ |
| 砍伐 | chop | `forbidden('chop', 玩家名詞, 樹)`；需先持斧 | ⚠（砍樹靠物件判定；**無現用法條**管 chop） |
| 持有 | hold | `forbidden('hold', 玩家名詞)`；撿裝備(斧)時判，生效會強制卸下 | ⚠ 無現用法條 |
| 吃 | eat | `forbidden('eat', 山羊名詞)`；行動者是**山羊**（山羊被推到公告上吃掉它＝刪法） | 💤 |
| 搬書 | move | `moveForbidden`：verb `move`/`lead`、target 指定物（書/牲口）；「外鄉人不得搬書/牽牲口」 | 💤 |
| 兩格 | double | 屬性非動作：`得兩格`→該主詞一步走 2；`不得兩格`→壓回 1（也用來減速追逐者） | 💤⚠ |

---

## 3. 字塊系統 ★

- 法條由**可推字塊**排成「主詞 → 情態 → 動詞」或「主詞 → 即 → 主詞」而生效；玩家推字塊 = 改規則（Baba 式）。
- **只讀兩個方向**：從主詞往**右**、或往**下**各取相鄰三格（`parseTiles` 只掃 +x 與 +y）。主詞必須在最左/最上。**設計 gadget 要照這個朝向擺。**
- 字塊 `fixed:true` = 刻死推不動（當錨點）；鬆動的 `得/不得/即`（legend 的 `d/F/J`）供玩家自己湊法／拆法／下定義。
- 字塊被推進**河/洞穴/火** → **永久消失**（soft-lock 的來源，見 §7）。

---

## 4. 身分與「即」★

- **基礎身分**：`has` 裡有某法的 `def` 物（如名牌）→ 市民；否則外鄉人。踩「脫衣處」清空 `has` → 變回外鄉人（💤 未放）。
- **`即`（is / define）**：`A 即 B` ⇒ 凡「是 A」者也「是 B」。`applyIs` 做**遞移閉包**：A即B、B即C ⇒ A 也是 C。
- `playerNouns()` / `nounsOf(物件)` 都先取 BASE_NOUNS 再跑 applyIs。**這是組合深度的唯一來源**——借名分、矛盾、鏈式定義都從這來。

---

## 5. 物件

地圖字元 → type，每型「天生名詞」(BASE_NOUNS)，與互動：

| 字元 | type | 天生名詞 | 互動 | 狀態 |
|---|---|---|---|---|
| `E` | exit | item | 踩上且 `leaveAllowed` → 勝（leave 關） | ★ |
| `r` | rock | item | 可推；推入河 → **填成橋**（可走）；推入洞/火 → 沉沒 | ★ |
| `W` | wall(可破) | wall | 撞上且非 `breakForbidden` → 砸開 | ★ |
| `T` | tree | tree, item | 需持斧；非 `chopForbidden` → 砍倒 | ★ |
| `X` | axe | item | 撿起→`has.axe`；`equipForbidden` 時撿不起/被卸 | ★ |
| `Y` | key | item | 撿起→`has.key` | ★ |
| `D` | door | item | 有鑰匙→開；或市民走到門旁→開 | ★ |
| `N` | name | item | 領取→`has.name`（配 `def:'name'` ＝市民）；`takeForbidden` 可擋 | ★ |
| `%`(地形) | 聖所 | — | 踏入受 `enter` 管（「X不得進入」把 X 擋在界外；**只擋進入、不擋已在裡面**） | ★ |
| `C` | clothes | item | 領取→`has.clothes`（另一種定義物） | 💤 |
| `K` | notice | item | 讀→把 `src:'notice'` 的法加進 `heard`（讀到才綁你） | 💤 |
| `S` | speaker | item | 在 `radius` 內 → 把它的法加進 `heard`（聽到才綁你） | 💤 |
| `G` | goat | goat, item, creature | 可推；推到公告上→吃掉(刪法，`eatForbidden` 可擋)；推到書上→馱書 | 💤（**山羊*名詞*有用，山羊*物件*未放**） |
| `B` | book | item | 可推；被山羊馱到荒野 → `bookOut` 勝 | 💤 |
| `V` | villager | citizen | 走到門旁自動開門（代勞） | 💤 |
| `H` | shed | — | 踩上→`has.clear()`，脫回外鄉人 | 💤 |
| `Z` | chaser | creature, item | 每回合朝你走 `chaserSteps()` 格；撲到你→判負；`生物不得兩格` 可減速 | 💤 |
| `x` | wilddeep | — | 可走；`bookOut` 的終點（荒野） | 💤 |

`speaker` 物件的 `law` 指向 `src:'speaker'` 的靜態法；`radius` 由 `level.speakerRadius ?? 1`。

---

## 6. 地形

| 字元 | 名稱 | 效果 | 狀態 |
|---|---|---|---|
| `#` | 牆 | 實心 | ★ |
| `~` | 河 | 擋路；石頭推入→填成橋（該格變可走）；其餘可推物推入→沉沒消失 | ★ |
| `O` | 洞穴 | 擋路；可推物推入→永久消失 | ★ |
| `%` | 聖所 | 可走，除非 `enterForbidden()`（見 §5） | ★ |
| `^` | 火堆 | 擋路；每回合沿**木地板**蔓延，燒毀被波及的字塊/物件（出口除外）；站在火上→判負 | 💤 |
| `=` | 木地板 | 可走；火會沿它擴散 | 💤 |

河/木/火會隨局變動；`reset` 以 `water0/wood0/fire0` 還原。

---

## 7. 不可逆與摧毀 ★（張力來源）

- 把可推物/字塊推進 **河（非石）／洞穴／火** → **永久消失**，無法復原（除非 undo/reset）。
- 這是**真 soft-lock** 的機制根源：必要字塊/石頭一旦誤推入摧毀地形就解不出 → 乙案下當刻意張力（須可見＋易撤銷）。`tools/analyze.js` 的可達性精算會把「能被推去卡死的必要資源」標出來。
- 石頭推入河是**例外**：不是消失，而是填成橋（永久可走）。填錯格（對岸是牆）＝橋沒用＋石頭沒了＝自困。

---

## 8. 全域與時間機制

| 機制 | 行為 | 狀態 |
|---|---|---|
| **矛盾作廢** | 兩法**同主詞同動詞、一禁一准** → 書寫「以上規則無效」：全場字塊消失、法條全清（`voided`）。`goal:'reset'` 即以此為勝 | ★（tut 十） |
| **活書** livingBook `{everyN,writes[][]}` | 每 everyN 步揭露下一組預置字塊 → 規則隨時間增加 | 💤 |
| **即時對手** reactiveBook `{everyN,agenda}` | 每步在你身旁、最嵌牆角、最難被推散的直線上刻一字，照 agenda 立法堵你；你站住它要寫的格可擋 | 💤 |
| **將軍** deadline `+ killer` | `turn >= deadline` → 判負（書搶先填滿規則） | 💤 |
| **廣播/公告綁定** `src` / `onNotice` | `src:'notice'/'speaker'` 的法要讀到/聽到才生效；`onNotice` 的法，公告牌一毀即失效 | 💤 |

**時間機制註記**：只要關卡有 deadline/livingBook/reactiveBook 或地圖含 `^`/`Z`，求解器就視為「有時間壓力」，`turn` 計入狀態、且只試每個目標的最短路——對這類關 **sound 但不完備**（可能漏需精準踩點的解）。現用關卡皆無時間壓力，故完備。

---

## 9. 勝利條件（goal）

| goal | 條件 | 狀態 |
|---|---|---|
| `leave` | 踩到出口 `E` 且 `leaveAllowed()` | ★（11 關） |
| `reset` | 觸發過「以上規則無效」(`didReset`) | ★（tut 十） |
| `bookOut` | 山羊馱書、或書本身，被送到荒野 `x` | 💤 |

---

## 10. 資料欄位 schema

**關卡 Level**：`map[]`、`tiles[{word,x,y,fixed?}]`、`laws[]`、`goal`、`has[]`（起始持有）、`chapter`、`name`、`teach`、`hintWin`；時間關另有 `livingBook`、`reactiveBook`、`deadline`、`killer`、`speakerRadius`。

**靜態法 Law**：`text`、`who`(outsider|citizen|any|…任一主詞碼)、`mode`(forbid|permit)、`verb`、`target`(受體 type)、`def`(持有此物即市民)、`cond`(持有此項才適用)、`src`(notice|speaker)、`onNotice`。
**字塊解析出的法**：`{who, mode, verb}` 或定義 `{who, verb:'is', toNoun, mode:'define'}`，帶 `fromTiles:true`、`text`。

**字塊 Tile**：`word`、`x`、`y`、`fixed?`。legend 見 `levels.js` 開頭 `TILE_LEGEND`；鬆動碼 `d/F/J`＝可推的 得/不得/即。

---

## 11. 現用 vs 休眠 速查

- **★現用核心**（現有 12 關的全部深度都從這長出來）：統一裁決＋permit蓋forbid／身分＋`即`遞移閉包／字塊改法／動詞 leave·enter·push·break／摧毀地形 河·洞·（燒未用）／物件 出口·石橋·破牆·樹斧·鑰匙門·名牌·聖所／矛盾作廢／goal leave·reset。
- **💤休眠（v2 沙盒遺產，候選調色盤）**：時間壓力（活書·即時對手·將軍·追逐者·火/木）、代勞經濟（村民開門·山羊吃公告刪法·山羊馱書 bookOut）、脫衣重設身分、廣播/公告「讀到才綁你」、衣物。
- **⚠半實作（啟用前補測試）**：動詞 chop·hold·eat·move·double 有定義但現關無法條在管。

> MDA 用法：每設計一關，先定目標美感，再問「現用核心夠嗎？不夠，從💤候選裡調哪一個進來」，而非一次全啟用或全砍。

---

## 12. 已知限制

- 字塊法**只往右/下讀**三連（§3）——gadget 朝向別擺反。
- `兩格/持有/吃/搬書/砍伐` 幾乎沒被法條實測過；要用先補 `tools/puzzle-verify.js` 測試。
- 求解器對時間壓力關不完備（§8 註記）；小關用 `puzzle-verify`、大圖用 `tools/analyze.js`。
- `restore()` 不清 `this.history`（UI 的 undo 靠它累積，正常）；求解器已在 `applyMacro` 開頭自清以免 OOM。
