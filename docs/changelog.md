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
