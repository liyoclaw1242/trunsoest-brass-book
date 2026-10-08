# Changelog

## 交接時的狀態（2026-10-09）

- 規則引擎完成，`npm test` 8 項通過。
- Blender 場景、畫面端、村民、輸贏都還沒做。

## M0 環境確認（2026-10-09）

- 把交接的 zip 內容放進 repo（引擎、文件、critic 子代理設定）。
- Node v25.9.0、npm 11.12.1；`npm test` 8 項 PASS。
- Blender 5.2.2 LTS（內建 Python 3.13）在 `/Applications/Blender.app/Contents/MacOS/Blender`，不在 PATH。
- 已驗證：`--background --python` 可跑最小 bpy 腳本；`export_scene.gltf(export_format='GLB', export_extras=True)` 會把父物件的 `rb_*` 自訂屬性寫進節點 `extras`；Workbench 引擎可無介面算出 PNG。
- npm registry 可取得 three 0.186.1、vite 8.3.4、@playwright/test 1.64.0；本機已有 Playwright 的 chromium 快取。
- 技術選擇與各里程碑的驗證方式見 M0 回報，等使用者確認後開始 M1。

## 無人看管前使用者給的決定（2026-10-09，列為「這一版預設」）

1. **子代理**：若 session 不認得 `playtest-critic`，用 general-purpose 代替，model 指定 fable，把 `.claude/agents/playtest-critic.md` 內容原樣當指令，並要求它不得修改任何檔案。
2. **抓捕判定**：村民與外鄉人同格或「走得過去的相鄰格」持續 0.5 秒（隔著圍籬、牆、關著的門不算）。抓捕走引擎 `attempt(…, 'capture', …)`。被送回中心後 3 秒內不會再被抓。
3. **門與住宅**：門 `open` 或 `broken` 才能 `enter`。`uninvited` ＝不是屋主、也沒被屋主邀請；邀請只對那一棟有效，離開後失效。村民進不去時等幾秒就放棄、回到日常行動。
4. **推車墊腳**：視為 `use` 推車而不是 `climb` 圍籬（設計要的漏洞）。同一招第 2 次，書寫補丁「推車不得用於越過圍籬」。`move` 的目的地合法性由畫面端在呼叫 `attempt` 前檢查。
5. **廣播節奏**：4 秒一條不動。複誦順序改為優先唸「範圍內有人還沒聽過」的條文，都聽過了才輪流複誦（引擎改動，補測試）。
6. **glTF 座標**：格子 `[x, y]` 對應 three 的 `(x, -z)`，M2 用已知物件對照。
7. **匯出參數**：已確認 `export_extras`、`export_apply` 存在。

補充要求：規則邏輯（村民狀態、同化度、範圍、尋路）一律放 `engine/` 並用 node 測試；書的備用條文 4–6 條、每條有可讀出的漏洞；M1 佈局多檢查「從中心出發全程不進廣播範圍能否到邊界」。

## M1 Blender 場景（2026-10-09）

- `blender/rb.py` 共用工具 + 十二支 `make_<type>.py` + `layout.py`（純資料）+ `build_scene.py`。`npm run scene` 產出 `public/village.glb`、`public/scene.json`、`public/scene.meta.json`（中心、半徑、出生點）並算 `docs/playtest/m1/top.png`、`iso.png`。
- `engine/grid.js`：從 scene.json 推格子地圖（住宅牆／室內／門洞、擋路、影響範圍、BFS 尋路、0-1 BFS）。畫面端與村民尋路共用。
- `tools/validate-scene.js`：欄位、id、動詞、owner/parent、數量範圍；另解析 glb 確認每個 id 有同名節點、每個 `__col` 的佔地與 grid.js 算法逐格一致（81 格）。
- `tools/check-layout.js`：印 ASCII 地圖；檢查覆蓋率（84%）、≥12 格的安靜區 6 塊、信物與公告牌都在廣播內、中心到邊界互不重疊的路線 5 條、路線至少四成在廣播內。
- **補充要求 C（安靜逃脫路）**：第一版佈局有一條沿東側的全程安靜路（排除出生點所在廣播器後代價 0）。處理：把南邊 `speaker_06` 半徑由 8 改為 10。改後最少要經過 7 格廣播範圍（不排除任何廣播器則 11 格）。
- 佈局：地圖 60×60，書在 `house_01` 室內 (29,32)，影響半徑 20，出生點 (30,26) 在書台正門前的廣場；6 台廣播器、4 棟住宅（各一村民、一門、一信物）、10 段圍籬（南排 6、西列 4）、2 推車、2 公告牌、12 界石。村民：v1 半同化（紅）、v2 人偶（藍）、v3 半同化（黃）、v4 已喚醒（綠）。
- 修過的坑：所有方塊共用同一份 mesh 時材質會串，改為每個物件複製 mesh；Workbench 算圖要把 view transform 改 Standard 顏色才對。
- 門多做了 `broken` 狀態（規格只列 closed/open 但動詞有 break）。
- 驗證：`node tools/validate-scene.js` 通過、`node tools/check-layout.js` 通過；兩張圖我自己打開看過，十二類在斜上方圖互相分得出來；俯視圖看不到書（在屋內、被屋頂蓋住），其餘十一類分得出來。
- 未驗證：在 three.js 裡載入後的座標對應（M2 做）。
