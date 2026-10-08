# 怎麼開始

## 準備（一次）

1. 把這個資料夾放到你想放的位置，在終端機進入它。
2. 執行 `git init && git add -A && git commit -m "init"`。之後 Claude Code 每個里程碑都會 commit，做壞了可以退回。
3. 確認 `node --version`（需要 18 以上）和 `npm test`（應該看到 8 行 PASS）。
4. 確認終端機找得到 Blender：`blender --version`。找不到的話，把 Blender 執行檔的完整路徑告訴 Claude Code。
5. 在這個資料夾執行 `claude`。

`CLAUDE.md` 會自動載入，`.claude/agents/playtest-critic.md` 會被辨識成可用的子代理。
如果你的 Claude Code 不認得 `model: fable`，把那一行改成 `model: inherit`。

## 第一則訊息（直接貼上）

```
請先讀 CLAUDE.md 和 docs/ 裡的 design.md、scene-spec.md、plan.md，以及 engine/README.md。

然後照 docs/plan.md 執行：
1. 先做 M0，回報環境狀況和你的實作計畫（技術選擇、每個里程碑怎麼驗證、你看到的風險）。等我確認後再開始 M1。
2. 之後每完成一個里程碑：跑 npm test、commit、更新 docs/changelog.md，並用三行以內回報。
3. M6 完成後進入優化回合，每一輪用 playtest-critic 子代理提意見，最多三輪。只把執行方式和試玩材料交給它，不要給它你自己的評價。
4. 需要改動「已定案」設計的問題一律寫進 docs/open-questions.md，不要自己決定，繼續做不受影響的部分。
5. 全部結束後給我一份總結：哪些已驗證、哪些沒驗證、每一輪 critic 說了什麼而你怎麼處理、還有哪些問題等我決定。
```

## 之後可以用的指令

- 想先看計畫再讓它動手：開頭那則訊息已經要求它在 M0 停下來等你。
- 想單獨叫評論員：`用 playtest-critic 子代理評論目前的 build`，或輸入 `@` 從選單挑它。
- 想加一輪優化：`再做一輪優化回合，這次請 critic 專看村民的行為`。
- 想改設計：先改 `docs/design.md`，再請它依新版調整。
