// rules.v3.js —— 原型三的條文：憲法五條、觸發條文（取自 docs/rules-brainstorm.md 的優先 20 條）、備用條文。
// 開場沒有抓捕令：村民只追「被看見違規」的人（憲法第五條）。

export const CONSTITUTION = [
  { key: 'no-leave', text: '任何存在不得離開此地。', verb: 'leave', target: null, hole: '沒聽到這條的人不受約束；被重置撕掉的那幾秒，沒有人不得離開。' },
  { key: 'invite-only', text: '未經邀請不得進入他人住宅。', verb: 'enter', target: { type: 'house' }, cond: 'uninvited', hole: '受邀就可以；倉庫、井屋不是住宅。' },
  { key: 'guest-ok', text: '受市民邀請者，得進入該市民的住宅。', verb: 'enter', target: { type: 'house' }, cond: 'invited', mode: 'permit', hole: '和「外鄉人不得進入住宅」衝突時，裁決寫下前不追究。' },
  { key: 'curfew', text: '夜間市民必須待在住宅內，守夜人除外。', who: 'citizen', verb: 'stay', target: { type: 'house' }, cond: 'night', mode: 'require', hole: '只管市民；守夜人（人偶）在外面；外鄉人沒被管。' },
  { key: 'capture', text: '所有市民必須抓捕被看見違規者。', who: 'citizen', verb: 'capture', target: { type: 'outsider' }, mode: 'require', hole: '沒被看見的不算；夜裡看不遠；已喚醒的人不執行。' },
];

/** 同一招用到第 count 次，就被寫成條文。 */
export const TRIGGERS = [
  { verb: 'approach', type: 'boundary', by: 'outsider', count: 2,
    rule: { key: 'boundary-approach', text: '任何存在不得靠近界石。', verb: 'approach', target: { type: 'boundary' }, hole: '沒聽到的人不受約束；夜裡沒人看見你靠近。' } },
  { verb: 'enter', type: 'wild', by: 'outsider', count: 2,
    rule: { key: 'wild-night', text: '夜間不得走出村道。', verb: 'enter', target: { type: 'wild' }, cond: 'night', hole: '白天隨便走；天黑前就站在野地裡的人沒有「走出」。' } },
  { verb: 'open', type: 'door', by: 'outsider', count: 2,
    rule: { key: 'door-open', text: '外鄉人不得開啟任何門。', who: 'outsider', verb: 'open', target: { type: 'door' }, hole: '只禁止「開啟」，沒說不能破壞門；市民開的門走進去就好。' } },
  { verb: 'light', type: 'lamp', by: 'outsider', count: 2,
    rule: { key: 'no-light-night', text: '夜間不得點燈。', verb: 'light', target: { type: 'lamp' }, cond: 'night', hole: '白天點亮、帶進夜裡的燈不算「點燈」；和「夜間必須持燈」衝突。' } },
  { verb: 'walk', type: '-', by: 'outsider', count: 3,
    rule: { key: 'lamp-night', text: '夜間不得不持燈行走。', verb: 'walk', target: null, cond: 'night&!lit', hole: '站著不動不是行走；和「夜間不得點燈」衝突，裁決寫下前不追究。' } },
  { verb: 'break', type: 'speaker', by: 'outsider', count: 2,
    rule: { key: 'speaker-break', text: '廣播器不得被破壞。', verb: 'break', target: { type: 'speaker' }, hole: '沒聽到的人不受約束（站在壞掉的廣播器旁就聽不到）；已經壞掉的不會因此修好。' } },
  { verb: 'take', type: 'keepsake', by: 'outsider', count: 1,
    rule: { key: 'keepsake-take', text: '外鄉人不得取走信物。', who: 'outsider', verb: 'take', target: { type: 'keepsake' }, hole: '村民可以自己去拿。' } },
  { verb: 'wear', type: 'clothes', by: 'outsider', count: 1,
    rule: { key: 'no-disguise', text: '外鄉人不得穿著市民的衣物。', who: 'outsider', verb: 'wear', target: { type: 'clothes' }, hole: '只有認得出你是外鄉人的人，才知道你違規——穿著衣物的你很難被認出。' } },
  { verb: 'climb', type: 'fence', by: 'outsider', count: 3,
    rule: { key: 'fence-climb', text: '圍籬不得翻越。', verb: 'climb', target: { type: 'fence' }, hole: '沒說不能破壞。' } },
  { verb: 'break', type: 'fence', by: 'outsider', count: 1, requires: 'fence-climb',
    rule: { key: 'fence-break', text: '圍籬不得被破壞。', verb: 'break', target: { type: 'fence' }, hole: '推車可以墊腳。' } },
  { verb: 'induce', type: 'villager', by: 'outsider', count: 3,
    rule: { key: 'no-errand', text: '市民不得替外鄉人跑腿。', who: 'citizen', verb: 'induce', target: { type: 'villager' }, hole: '只管「市民」，已喚醒的人算不算市民沒說；邀請進屋算不算跑腿也沒說。' } },
  { verb: 'run', type: '-', by: 'outsider', count: 3,
    rule: { key: 'no-run-night', text: '夜間不得奔跑。', verb: 'run', target: null, cond: 'night', hole: '走路可以；白天隨便跑。' } },
  { verb: 'leave', type: 'house', by: 'outsider', count: 2,
    rule: { key: 'stay-night', text: '日出前不得離開住宅。', verb: 'leave', target: { type: 'house' }, cond: 'night', hole: '天黑時不在住宅裡的人沒被管。' } },
  { verb: 'use', type: 'cart', by: 'outsider', count: 2,
    rule: { key: 'cart-use', text: '推車不得用於越過圍籬。', verb: 'use', target: { type: 'cart' }, hole: '只禁止用於越過圍籬；推去擋路沒說。' } },
  { verb: 'move', type: 'book', count: 2,
    rule: { key: 'book-move', text: '黃銅書不得被搬動。', verb: 'move', target: { id: 'book_01' }, hole: '沒聽到這條的人不受約束：聽不到廣播的村民會替你搬。' } },
];

/** 閒著沒事書自己寫的（25 秒沒新條文）。前兩條在保護玩家，是重置的雙面刃。 */
export const BACKUP = [
  { key: 'no-night-capture', text: '市民不得在夜間追捕。', who: 'citizen', verb: 'capture', target: { type: 'outsider' }, cond: 'night', hole: '只管夜間；守夜的人偶算不算市民沒說——這一版算。' },
  { key: 'citizen-def', text: '條文所稱「市民」包括人偶、半同化者與已喚醒者。', kind: 'definition', hole: '已喚醒的人也必須抓捕——但他們已經不聽廣播了，所以不會認知到這一條。' },
  { key: 'notice-read', text: '外鄉人不得閱讀公告牌。', who: 'outsider', verb: 'read', target: { type: 'notice' }, hole: '沒說不能讀規則書本身，也沒說不能聽廣播。' },
  { key: 'book-approach', text: '外鄉人不得靠近黃銅書。', who: 'outsider', verb: 'approach', target: { type: 'book' }, hole: '只管外鄉人「靠近」，沒說市民不能把書搬走；想知道規則還可以讀公告牌、聽廣播。' },
  { key: 'cart-move', text: '推車不得被搬動。', verb: 'move', target: { type: 'cart' }, hole: '沒說不能破壞，也沒說不能踩上去。' },
  { key: 'door-break', text: '任何存在不得破壞門。', verb: 'break', target: { type: 'door' }, hole: '門還是可以開；沒提圍籬和推車。' },
  { key: 'lamp-take', text: '提燈不得被取走。', verb: 'take', target: { type: 'lamp' }, hole: '已經在手上的不是取走；燈柱不是提燈。' },
  { key: 'clothes-take', text: '衣物不得被取走。', verb: 'take', target: { type: 'clothes' }, hole: '穿上和取走是兩件事（穿要先拿——這條和「不得穿著」一起才堵得住）。' },
  { key: 'speaker-repair', text: '外鄉人不得修復廣播器。', who: 'outsider', verb: 'repair', target: { type: 'speaker' }, hole: '沒說不能破壞；市民可以修。' },
  { key: 'notice-deface', text: '公告牌不得被塗毀。', verb: 'deface', target: { type: 'notice' }, hole: '只管塗毀；公告牌還是可以讀。' },
];

/** 條文裡的「市民」包不包括已喚醒者：寫下「市民」定義條文後才包括。 */
export function citizenIncludesAwake(world) { return !!world.live('citizen-def'); }

/** 在所有角色都加入之後呼叫一次。 */
export function setup(world) {
  const citizens = [...world.actors.values()].filter(a => a.kind === 'citizen').map(a => a.id);
  for (const def of CONSTITUTION) world.write(def, { silent: true, knownBy: citizens });
  for (const tr of TRIGGERS) world.addTrigger(tr);
  // 被撕掉的憲法：書立刻重寫「不得離開」與「抓捕」（重新公示才生效——這段空檔就是出口）
  world.on('afterReset', ({ gone }) => {
    for (const key of ['no-leave', 'capture']) if (gone.some(r => r.key === key) && !world.live(key)) world.write({ ...CONSTITUTION.find(c => c.key === key) });
  });
  /** 外鄉人踏入：書把「不得離開」公告給他（開場聽完就認知）。 */
  world.outsiderArrived = () => { world.announce(world.live('no-leave').no); return world.live('no-leave'); };
  return world;
}
