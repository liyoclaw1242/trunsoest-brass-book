# 規則書 原型二

一個俯視視角的遊戲原型：外鄉人誤入烏托邦，那裡藏著一本會自己寫律法的活規則書。這個 repo 要做出可玩的第二版原型，用來驗證機制，不是做成品。

## 先讀

- `docs/design.md`：世界觀與機制。分成「已定案」和「這一版先採用的預設」。
- `docs/scene-spec.md`：Blender 場景物件怎麼做，規則引擎才指得到它們。
- `docs/plan.md`：里程碑、驗收條件、優化回合的流程。
- `engine/README.md`：規則引擎的介面，以及畫面端要接的事件。

## 結構

```
engine/     規則引擎（純邏輯）與測試。已完成並通過測試
blender/    bpy 腳本：每類物件一支，加上 build_scene.py（待建）
public/     village.glb、scene.json（由 blender/ 產生，待建）
src/        three.js 畫面端（待建）
docs/       設計、規格、計畫、changelog、open-questions、playtest 紀錄
.claude/agents/playtest-critic.md   優化回合用的評論子代理
```

## 指令

- `npm test`：規則引擎測試，任何時候都要通過。
- Blender 無介面執行：`blender --background --python blender/<腳本>.py`。本機 Blender 5.2.2 不在 PATH，執行檔在 `/Applications/Blender.app/Contents/MacOS/Blender`（`npm run` 腳本裡用 `BLENDER` 環境變數覆寫）。
- 畫面端的開發指令在 M2 建立後補在這裡。

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
