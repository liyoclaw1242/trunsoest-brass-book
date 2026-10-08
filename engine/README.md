# 規則書 原型二：規則引擎

純邏輯的規則引擎，給本地的 three.js 原型使用。世界觀見專案裡的 `規則書-設計文件.md`，場景物件怎麼做見 `原型二-場景物件規格.md`。

## 檔案

| 檔案 | 內容 |
|---|---|
| `rulebook-engine.js` | 引擎本體：條文、重置、廣播與認知、判定、觸發。沒有 DOM，也沒有 three.js |
| `rules.default.js` | 烏托邦的憲法、抓捕令、第一批測試條文與觸發條件 |
| `scene.sample.json` | 場景資料的範例，格式同規格文件。之後由 Blender 腳本產生的 `scene.json` 取代 |
| `engine.test.js` | 對照五個驗證目標的測試，在 repo 根目錄用 `npm test` 執行 |

## 畫面端要做的事

1. 讀 `scene.json` 建立 `new World(scene)`，用 `addActor` 加入外鄉人和村民，再呼叫 `setup(world)`。
2. 用 GLTFLoader 載入 `village.glb`，以節點名稱對應 `scene.json` 的 `id`。
3. 每幀呼叫 `world.tick(dt)`，並把角色的格子座標寫回 `actor.pos`。
4. 玩家按 E 或村民行動時呼叫 `world.attempt(actorId, verb, targetId, ctx)`。移動類的動詞（`enter`、`climb`）也走這裡，回傳 `done` 才放行。
5. 監聽事件更新畫面：
   - `object`：切換 `<id>__<狀態>` 子物件的顯示。
   - `write`、`reset`：更新規則書介面，重置時顯示「以上規則無效」。
   - `broadcastStart`、`broadcastEnd`：顯示廣播中的條文與完好廣播器的範圍圈。`broadcastEnd` 的 `learned` 是這次新認知到的角色。
   - `violation`：外鄉人違反了自己認知到的規則，後果由畫面端決定。
   - `refuse`：市民因規則拒絕行動。
   - `conflict`：兩條規則衝突，這次不追究，書會多寫一條裁決。
6. 用 `world.protectedBy(id, 'outsider')` 決定哪些物件要畫「受規則保護」的外框。不帶第二個參數是客觀狀態，可用於設計者視角。
7. 用 `world.notes('outsider')` 畫玩家的筆記：只有 `known` 的條文才顯示內容。
8. 外鄉人第一次踏進影響範圍時呼叫 `world.outsiderArrived()`。

ES module 和 glb 都要透過 http 載入，直接開檔案不行。在資料夾裡跑 `npx serve` 或 `python3 -m http.server` 即可。

## 引擎的規則

- 生效上限 10 條，寫滿時清掉最舊的 5 條（`max`、`keep` 可調）。
- 條文要被認知才對該角色生效。認知的途徑：在完好廣播器的範圍內從頭聽完一條（預設 4 秒）、讀規則書、讀公告牌。
- 沒有新條文時，廣播器每隔幾秒輪流複誦現行條文。
- 市民不會違反自己認知到的規則。外鄉人可以違反，但會發出 `violation`。
- 「不得」和「得」同時適用且沒有裁決時不追究，書會寫一條裁決，以較新的條文為準。裁決也要被認知才生效。
- 重置後，依附已失效條文的裁決變成廢文（`patch: 'solo'` 可改成照常生效）。
- 抓捕令被重置撕掉時，書會立刻重寫，措辭依重置次數升級。

## 還沒做的

- 村民的行為（追捕、巡邏、被誘導）、同化度、喚醒。
- 條文的 `where`、`when` 欄位。
- 「沒有條文時依周圍生靈的普遍認知」這條底層規則。
- 影響範圍與勝利判定。
