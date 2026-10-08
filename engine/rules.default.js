// rules.default.js
// 原型二的預設條文：烏托邦的憲法、抓捕令、以及第一批由玩家行為觸發的測試條文。

/** 開場就在書裡的舊規則。市民全都認知；外鄉人從沒被告知過，所以一開始不受約束。 */
export const CONSTITUTION = [
  { key: 'hide', text: '此地不為外界所知。' },
  { key: 'no-harm', text: '不得傷害他人。' },
  { key: 'invite-only', text: '未經邀請不得進入他人住宅。', verb: 'enter', target: { type: 'house' }, cond: 'uninvited' },
  { key: 'guest-ok', text: '受市民邀請者，得進入該市民的住宅。', verb: 'enter', target: { type: 'house' }, cond: 'invited', mode: 'permit' },
];

/** 抓捕令。每次被重置撕掉後，書會重寫一次，措辭一次比一次不客氣。 */
export const CAPTURE = [
  { who: 'citizen', text: '請所有市民一起抓捕外鄉人，可採用一切手段。' },
  { who: 'citizen', text: '所有市民必須抓捕外鄉人。' },
  { who: 'any', text: '任何存在必須抓捕外鄉人。' },
];

/** 同一招用到第 count 次，就被寫成條文。hole 是這條留下的漏洞，給設計者視角顯示用。 */
export const TRIGGERS = [
  { verb: 'break', type: 'speaker', by: 'outsider', count: 2,
    rule: { key: 'speaker-break', text: '廣播器不得被破壞。', verb: 'break', target: { type: 'speaker' }, hole: '沒聽到的人不受約束；沒說不能搬走。' } },
  { verb: 'enter', type: 'house', by: 'outsider', count: 2,
    rule: { key: 'house-outsider', text: '外鄉人不得進入住宅。', who: 'outsider', verb: 'enter', target: { type: 'house' }, hole: '和「受邀者得進入」衝突，裁決寫下前不追究。' } },
  { verb: 'climb', type: 'fence', by: 'outsider', count: 3,
    rule: { key: 'fence-climb', text: '圍籬不得翻越。', verb: 'climb', target: { type: 'fence' }, hole: '沒說不能破壞。' } },
  { verb: 'break', type: 'fence', by: 'outsider', count: 1, requires: 'fence-climb',
    rule: { key: 'fence-break', text: '圍籬不得被破壞。', verb: 'break', target: { type: 'fence' }, hole: '推車可以墊腳。' } },
  { verb: 'take', type: 'keepsake', by: 'outsider', count: 1,
    rule: { key: 'keepsake-take', text: '外鄉人不得取走信物。', who: 'outsider', verb: 'take', target: { type: 'keepsake' }, hole: '村民可以自己去拿。' } },
  { verb: 'use', type: 'cart', by: 'outsider', count: 2,
    rule: { key: 'cart-use', text: '推車不得用於越過圍籬。', verb: 'use', target: { type: 'cart' }, hole: '只禁止「用於越過圍籬」；推去擋路、推去墊別的東西都沒說。' } },
  { verb: 'move', type: 'book', count: 1,
    rule: { key: 'book-move', text: '黃銅書不得被搬動。', verb: 'move', target: { id: 'book_01' }, hole: '書台沒被提到。' } },
];

/** 書閒著沒事時自己動筆的備用條文（50 秒沒有新條文就寫一條）。每條的漏洞都能從條文文字讀出來。 */
export const BACKUP = [
  { key: 'door-open', text: '外鄉人不得開啟任何門。', who: 'outsider', verb: 'open', target: { type: 'door' }, hole: '只禁止「開啟」，沒說不能破壞門；也沒禁止市民開門（開著的門走進去就好）。' },
  { key: 'book-approach', text: '外鄉人不得靠近黃銅書。', who: 'outsider', verb: 'approach', target: { type: 'book' }, hole: '只管「靠近」，沒說市民不能把書搬走（請村民搬書）；書離開原位之後靠近的是新位置，條文照樣算，但沒說不能遠遠地看。' },
  { key: 'cart-move', text: '推車不得被搬動。', verb: 'move', target: { type: 'cart' }, hole: '沒說不能破壞，也沒說不能踩上去。' },
  { key: 'notice-deface', text: '公告牌不得被塗毀。', verb: 'deface', target: { type: 'notice' }, hole: '只管塗毀；公告牌還是可以讀，而且沒聽到這條的人不受約束。' },
  { key: 'notice-read', text: '外鄉人不得閱讀公告牌。', who: 'outsider', verb: 'read', target: { type: 'notice' }, hole: '沒說不能讀規則書本身，也沒說不能聽廣播。' },
];

function captureDef(world) {
  const v = CAPTURE[Math.min(world.resets, CAPTURE.length - 1)];
  return { key: 'capture', verb: 'capture', mode: 'require', ...v };
}

/** 在所有角色都加入之後呼叫一次。 */
export function setup(world) {
  const citizens = [...world.actors.values()].filter(a => a.kind === 'citizen').map(a => a.id);
  for (const def of CONSTITUTION) world.write(def, { silent: true, knownBy: citizens });
  for (const tr of TRIGGERS) world.addTrigger(tr);
  let arrived = false;
  world.on('afterReset', () => { if (arrived) world.write(captureDef(world)); });
  /** 外鄉人第一次踏入時呼叫：書頒布抓捕令。 */
  world.outsiderArrived = () => { arrived = true; return world.write(captureDef(world)); };
  return world;
}
