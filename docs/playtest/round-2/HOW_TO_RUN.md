# 怎麼跑（優化回合材料）
- 啟動：`npm run dev`，開 http://localhost:5173/?seed=<種子>（或在開始畫面輸入種子）。
- 引擎測試：`npm test`。條文驗證：`node tools/validate-rules.js`。平衡：`node tools/balance.js`。
- 六結局：`node tools/playtest-r5.js`。介面：`node tools/playtest-r3.js`。經濟：`node tools/playtest-r4.js`。
- 本資料夾：`01..06-*.png`（開場、砸廣播器、書寫條文、接受舒適、設計者視角、後期）、`status.json`、`rulebook.json`（條文與等級／漏洞／誰認知）、`events.txt`。
- 設計：`docs/design.md`、條文池 `docs/rule-pools.md` 與 `engine/rules.v2.js`、計畫 `docs/plan-v2.md`。
