# 怎麼啟動、怎麼跑試玩腳本

## 需求
- Node 18+（本機 v25）。`npm install` 已裝好 three、vite、@playwright/test（都只在本專案）。
- Playwright 用本機快取的 chromium_headless_shell（`tools/pw.js` 會自動找 1248/1223/1217；可用 `PW_CHROME=<路徑>` 覆寫）。
- Blender 只在重做場景時需要：`npm run scene`（執行檔路徑可用 `BLENDER` 環境變數覆寫）。

## 啟動遊戲（人玩）
```
npm run dev          # http://localhost:5173/
```
開始畫面按「開始」。WASD／方向鍵移動，E 互動（數字鍵 2–9 選其他動作），N 收合筆記，Tab 設計者視角（所有條文、漏洞、誰認知到）。

網址參數：`?autostart` 跳過開始畫面；`&noopening` 跳過開場 4 秒聽公告；`&nohunt` 村民不追人；`&noend` 對局不會結束（後兩個只給回歸腳本用）。

## 測試與腳本（dev server 要先開著）
```
npm test                         # 規則引擎 28 項（engine/*.test.js）
npm run validate                 # scene.json 驗證 + 佈局檢查（印 ASCII 地圖）
node tools/playtest.js           # 整局自動試玩：兩條路線（keepsake、deaf），輸出到 docs/playtest/m6/<route>/
node tools/playtest.js --route deaf --out docs/playtest/round-1
node tools/playtest-m2.js        # 各里程碑的驗收腳本（m2–m5），輸出到 docs/playtest/mN/
```

每條路線的輸出：`events.txt`／`events.json`（事件紀錄）、`rulebook.txt`／`rules.json`（規則書：條文、是否撕掉、誰認知、漏洞）、`summary.json`（結果與統計）、`NN-*.png`（關鍵時刻截圖）。

## 兩條路線在做什麼
- **keepsake**：聽完公告 → 砸掉廣場的廣播器 → 進書台所在的住宅躲著 → 誰到門口就「請他去拿信物」→ 信物到手就還給主人（隔著門洞遞）→ 四個村民都醒了就走出範圍。
- **deaf**：同樣開場 → 趁追捕者跑腿或離遠時衝出去砸掉另外三台廣播器（中間被抓就從中心再來）→ 回屋裡等村民因為 30 秒聽不到廣播而醒 → 走出範圍。
