# 規則書（改版 v2）

一個俯視視角的遊戲原型：外鄉人誤入烏托邦，那裡藏著一本靠村民勞動過活、不斷寫律法要轉化他的活規則書。目前正依 v2 設計重做（活性時鐘、抽條文、勞動經濟、舒適的誘惑、六種結局）。

## 先讀（v2）

- `docs/design.md`：v2 世界觀與機制（寓意、已定案、這一版先採用的預設）。取代舊版。
- `docs/rule-pools.md`：候選條文池與「寫條文的原則」。
- `docs/plan-v2.md`：R0–R6 階段、驗收、優化回合。
- `engine/README.md`：規則引擎的介面與事件。
- 歷史對照：`docs/design-v1.md`（原型一／二基底）、`docs/design-v3.md`＋`docs/plan-v3.md`（原型三，已被 v2 取代）、`docs/rules-brainstorm.md`、`docs/SUMMARY.md`（原型二總結）。

## skill 與子代理

- `write-rules`（`/write-rules`）：替黃銅書寫／擴充候選條文。
- `audit-rules`（`/audit-rules`）：審條文池，由沒寫那批條文的子代理執行。
- `playtest-critic`：優化回合的試玩評論員。

## 指令（v2）

- `npm test`：引擎測試（engine/broadcast/rules.v2/economy/villagers/match）＋ `validate-rules`。
- `npm run scene` / `npm run validate`：Blender 重建場景 / 驗證 scene＋佈局＋條文。
- `npm run dev`：Vite（http://localhost:5173/，`?seed=` 指定種子、`?autostart`、`?nohunt`、`?noidle`）。
- `node tools/playtest-r3.js`…`r5.js`：R3 介面、R4 經濟、R5 六結局驗收。`node tools/balance.js`：平衡快轉量測。

## 結構

```
engine/     規則引擎（純邏輯）與測試：rulebook-engine、grid（格子與尋路）、villagers（村民）、match（輸贏）、session（組一局）
blender/    bpy 腳本：每類物件一支（make_*.py）、layout.py（佈局資料）、scenery.py（星露谷風裝飾：樹／花／草／鋪石等，非互動不擋路）、build_scene.py（組場景＋合併靜態 mesh 降 draw call＋匯出）
public/     village.glb、scene.json、scene.meta.json（由 blender/ 產生）
src/        three.js 畫面端：main（啟動、__game）、view（three）、game（串接與互動）、hud（DOM）、input
tools/      validate-scene、check-layout、pw（Playwright 共用）、playtest（整局）、playtest-m2…m5（里程碑驗收）
docs/       設計、規格、計畫、changelog、open-questions、playtest 紀錄
.claude/agents/playtest-critic.md   優化回合用的評論子代理
```

## 指令

- `npm test`：規則引擎測試，任何時候都要通過。
- Blender 無介面執行：`blender --background --python blender/<腳本>.py`。本機 Blender 5.2.2 不在 PATH，執行檔在 `/Applications/Blender.app/Contents/MacOS/Blender`（`npm run` 腳本裡用 `BLENDER` 環境變數覆寫）。
- `npm run dev`：Vite 開發伺服器（http://localhost:5173/）。試玩腳本都要它先開著。
- `npm run scene`：用 Blender 重做 `public/village.glb`、`scene.json`、`scene.meta.json` 與 `docs/playtest/m1/` 兩張圖。
- `npm run validate`：`tools/validate-scene.js`（欄位、id、動詞、glb 節點與 `__col` 對照）＋ `tools/check-layout.js`（覆蓋率、安靜角落、路線、安靜逃脫路）。
- `node tools/playtest.js [--route keepsake|deaf] [--out dir]`：整局自動試玩，輸出事件紀錄、規則書紀錄、截圖。
- `node tools/playtest-m2.js`…`m5.js`：各里程碑的驗收腳本。
- `node tools/check-sprint.js [N]`：「什麼都不做就贏」檢查（開局直奔、被抓後趁免疫直奔各 N 次）。
- `node tools/playtest-v3.js`：原型三驗收（晝夜、目擊追逐、不得離開＝傳送、偽裝、提燈、重置窗口）。網址參數另有 `&day=`、`&night=`（秒）、`&noidle`。原型三的設計決定見 `docs/design-v3.md`、計畫 `docs/plan-v3.md`、規則候選 `docs/rules-brainstorm.md`。
- 怎麼跑、網址參數、輸出格式見 `docs/playtest/HOW_TO_RUN.md`。

## 工作規則

- **已定案的設計不要改**。遇到做不下去或覺得該改的地方，寫進 `docs/open-questions.md`（現象、你的建議、影響範圍），然後繼續做不受影響的部分。
- **「這一版先採用的預設」可以調整數值**，但要在 changelog 說明改了什麼、為什麼。
- **引擎保持純邏輯**：`engine/` 不碰 DOM、不碰 three.js。新機制先加進引擎並補測試，再接畫面。
- **條文裡的每個動詞都要對應到引擎的 `VERBS`**，而且玩家做得出來、判定得出來。
- **Blender 物件一律用腳本產生**，不手動建模。改尺寸改腳本再重跑。
- **以本機版本為準**：`docs/scene-spec.md` 裡的 Blender 指令與匯出參數是憑記憶寫的，使用前先確認。three.js 的 API 也一樣。
- **遊戲內文字用繁體中文**。
- **每個里程碑結束**：`npm test` 通過，git commit，在 `docs/changelog.md` 加一段。
- **回報時區分已驗證和未驗證**。沒實際跑過或看過的不要說它可以。畫面相關的結論要有截圖。

## 子代理

`playtest-critic` 只在優化回合使用（流程見 `docs/plan.md`）。交給它執行方式和試玩材料，不要給它你自己的評價，否則它只會附和。
