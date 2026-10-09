// rules.v2.js —— 候選條文池與固定條文（改版 v2）。依 docs/rule-pools.md 擴充，照 write-rules 原則。
// 每條：key, text, tier(crude|plain|strict), category(action|hide|asset|selfprotect|villager),
//        stage(limit|obligation|definition), who, verb, target, cond, mode, hole, trigger, leaks, defn?
// target 可為 {type} / {id} / {zone} / null。defn 是定義類的判定鍵（has-name|wears|has-house|in-census|days3）。

export const TIERS = ['crude', 'plain', 'strict'];
export const TIER_CN = { crude: '粗糙', plain: '普通', strict: '嚴謹' };
export const CAT_CN = { action: '行動', hide: '藏身', asset: '資產與公示', selfprotect: '自保', villager: '村民' };
export const STAGE_CN = { limit: '限制', obligation: '義務', definition: '定義' };

const r = (o) => ({ who: 'any', mode: 'forbid', cond: null, target: null, stage: 'limit', ...o });

export const POOL = [
  // ========== 行動 action（限制）==========
  r({ key: 'a-plaza-run', text: '廣場上不得奔跑。', tier: 'crude', category: 'action', verb: 'run', target: { zone: 'plaza' }, hole: '廣場以外照跑；走路不算奔跑。', trigger: '外鄉人奔跑' }),
  r({ key: 'a-road-outsider', text: '外鄉人不得行走於大路。', tier: 'crude', category: 'action', who: 'outsider', verb: 'walk', target: { zone: 'road' }, hole: '草地、田埂、屋後都不是大路；奔跑不是行走。', trigger: '外鄉人在大路上移動' }),
  r({ key: 'a-boundary-near', text: '外鄉人不得靠近界石十步以內。', tier: 'crude', category: 'action', who: 'outsider', verb: 'approach', target: { type: 'boundary' }, hole: '界石可以搬走；沒有界石的那一段邊界沒人管。', trigger: '外鄉人靠近界石', leaks: '書在意邊界' }),
  r({ key: 'a-fence-climb', text: '圍籬不得翻越。', tier: 'crude', category: 'action', verb: 'climb', target: { type: 'fence' }, hole: '沒說不能破壞；沒聽到的人不受約束。', trigger: '外鄉人翻越圍籬' }),
  r({ key: 'a-goat-loose', text: '牲口不得被擅自牽引。', tier: 'crude', category: 'action', verb: 'lead', target: { type: 'goat' }, hole: '山羊聽不懂規則，沒牽著時牠自己亂走；繫住不算牽引；書管不到牲口只好繞去管人。', trigger: '外鄉人牽山羊' }),
  r({ key: 'a-run-village', text: '村內不得奔跑。', tier: 'plain', category: 'action', verb: 'run', hole: '村民也一起被限速，追你的人追不快；走路不算奔跑。', trigger: '外鄉人奔跑', leaks: '書願意拖累村民' }),
  r({ key: 'a-boundary-cross', text: '外鄉人不得越過界石離村。', tier: 'plain', category: 'action', who: 'outsider', verb: 'leave', hole: '不聽到它就不受約束；重置撕掉它的空檔。', trigger: '外鄉人走近邊界', leaks: '書在意邊界' }),
  r({ key: 'a-fence-both', text: '圍籬不得被破壞。', tier: 'plain', category: 'action', verb: 'break', target: { type: 'fence' }, hole: '翻越是另一條管的；沒聽到的人不受約束。', trigger: '外鄉人破壞圍籬' }),
  r({ key: 'a-wild-enter', text: '外鄉人不得進入荒野。', tier: 'plain', category: 'action', who: 'outsider', verb: 'enter', target: { zone: 'wild' }, hole: '天黑前就站在荒野裡的人沒有「進入」；界石被搬後荒野的邊沒了定義。', trigger: '外鄉人走向村外' }),
  r({ key: 'a-speed-any', text: '任何存在不得奔跑，無論緣由。', tier: 'strict', category: 'action', verb: 'run', hole: '村民同樣追不快，書自己吃虧；山羊聽不懂；不聽到它；等重置。', trigger: '外鄉人反覆奔跑', leaks: '書願意拖累全村' }),
  r({ key: 'a-leave-any', text: '外鄉人不得離開本村，無論經由何處、以何種方式。', tier: 'strict', category: 'action', who: 'outsider', verb: 'leave', hole: '不聽到它；等它被撕掉的空檔；影響範圍會跟著書走，把書帶出去等於村也出去了。', trigger: '外鄉人試圖離開', leaks: '書在意邊界' }),
  r({ key: 'a-approach-strict', text: '外鄉人不得靠近邊界，亦不得使他人代為靠近。', tier: 'strict', category: 'action', who: 'outsider', verb: 'approach', target: { type: 'boundary' }, hole: '界石全部搬走就沒有可靠近的界石；不聽到它。', trigger: '外鄉人誘導村民搬界石' }),

  // ========== 藏身 hide（限制）==========
  r({ key: 'h-house-outsider', text: '外鄉人不得進入住宅。', tier: 'crude', category: 'hide', who: 'outsider', verb: 'enter', target: { type: 'house' }, cond: 'uninvited', hole: '和「受邀者得進入」衝突，裁決前不追究；屬於自己的房子算不算。', trigger: '外鄉人進入住宅' }),
  r({ key: 'h-well-hide', text: '外鄉人不得藏身於井中。', tier: 'crude', category: 'hide', who: 'outsider', verb: 'use', target: { type: 'well' }, hole: '別處能藏；站在井裡取水不算藏。', trigger: '外鄉人躲進水井' }),
  r({ key: 'h-building-any', text: '外鄉人不得進入任何建築。', tier: 'plain', category: 'hide', who: 'outsider', verb: 'enter', target: { tag: 'building' }, hole: '屬於自己的那間房子算不算建築沒有定義；水井、草堆不是建築。', trigger: '外鄉人進入圖書館或工作站' }),
  r({ key: 'h-well-enter', text: '任何存在不得進入水井。', tier: 'plain', category: 'hide', verb: 'use', target: { type: 'well' }, hole: '村民沒法打水，書得補「市民取水不在此限」，你可以說自己在取水。', trigger: '外鄉人躲進水井', leaks: '書願意拖累村民' }),
  r({ key: 'h-invite-strict', text: '任何市民不得邀請或收留外鄉人。', tier: 'strict', category: 'hide', who: 'citizen', verb: 'invite', hole: '已喚醒的村民還算不算市民沒有定義；山羊不是市民。', trigger: '村民邀請外鄉人' }),
  r({ key: 'h-well-strict', text: '水井僅供市民取水，取水以外一律禁止進入。', tier: 'strict', category: 'hide', verb: 'use', target: { type: 'well' }, hole: '已喚醒的村民算不算市民沒定義；請村民替你下去。', trigger: '外鄉人反覆躲井' }),
  r({ key: 'h-stay-indoors', text: '外鄉人不得滯留於任何有頂之處。', tier: 'plain', category: 'hide', who: 'outsider', verb: 'stay', target: { tag: 'roofed' }, hole: '樹蔭、草堆沒有「頂」；路過不算滯留。', trigger: '外鄉人久留室內' }),

  // ========== 資產與公示 asset（限制）==========
  r({ key: 's-speaker-break', text: '廣播器不得被破壞。', tier: 'crude', category: 'asset', verb: 'break', target: { type: 'speaker' }, hole: '沒聽到的人不受約束；沒說不能搬走或遮住。', trigger: '外鄉人破壞廣播器' }),
  r({ key: 's-ears-block', text: '任何存在不得堵塞耳朵。', tier: 'crude', category: 'asset', verb: 'use', target: { type: 'earplug' }, hole: '潛進井裡聽不到也不算堵耳；讓鐘聲蓋過廣播。', trigger: '外鄉人裝聾' }),
  r({ key: 's-notice-deface', text: '公告牌不得被塗毀。', tier: 'crude', category: 'asset', verb: 'deface', target: { type: 'notice' }, hole: '山羊吃紙不算塗毀；雨會淋濕；還是可以讀。', trigger: '外鄉人塗毀公告牌' }),
  r({ key: 's-speaker-three', text: '廣播器不得被搬動。', tier: 'plain', category: 'asset', verb: 'move', target: { type: 'speaker' }, hole: '破壞或遮蔽沒被提到；山羊會咬斷線；沒聽到的人不受約束。', trigger: '外鄉人搬動廣播器' }),
  r({ key: 's-notice-protect', text: '公告牌不得被塗毀或損壞。', tier: 'plain', category: 'asset', verb: 'deface', target: { type: 'notice' }, hole: '山羊吃紙；讓它空白不算損壞。', trigger: '外鄉人破壞公告牌' }),
  r({ key: 's-broadcast-stay', text: '廣播響起時，外鄉人應停留原地直到播畢。', tier: 'strict', category: 'asset', who: 'outsider', verb: 'stay', mode: 'require', cond: 'broadcasting', hole: '廣播響起前就離開範圍，就沒有「響起時」；聽不到就不觸發。', trigger: '外鄉人在廣播時走動' }),
  r({ key: 's-speaker-strict', text: '廣播器為公器，不得被遮蔽。', tier: 'strict', category: 'asset', verb: 'use', target: { type: 'speaker' }, hole: '山羊聽不懂，讓山羊去咬斷線；夜間書自己讓它靜音，那時不算。', trigger: '外鄉人遮蔽廣播器' }),
  r({ key: 's-notice-strict', text: '公告牌所載為律法，不得使其不可辨識。', tier: 'strict', category: 'asset', verb: 'deface', target: { type: 'notice' }, hole: '山羊吃紙是山羊的事；雨不是存在。', trigger: '外鄉人反覆破壞公告牌' }),

  // ========== 自保 selfprotect（限制，威脅到書或圖書館時察覺機率至少 90%）==========
  r({ key: 'p-library-break', text: '圖書館為重要資產，不得損毀。', tier: 'crude', category: 'selfprotect', verb: 'break', target: { type: 'library' }, hole: '這句話洩露了書在圖書館裡；「損毀」沒定義。', trigger: '外鄉人破壞圖書館', leaks: '書在圖書館裡' }),
  r({ key: 'p-book-move', text: '黃銅書不得被搬動。', tier: 'crude', category: 'selfprotect', verb: 'move', target: { type: 'book' }, hole: '書台沒被提到；山羊可以馱它；沒說不能觸碰。', trigger: '有人搬動書' }),
  r({ key: 'p-book-touch', text: '黃銅書不得被任何存在觸碰、搬動或損毀。', tier: 'strict', category: 'selfprotect', verb: 'move', target: { type: 'book' }, hole: '山羊不是「存在」意義下聽得懂的對象，牠聽不懂；天災不是存在。', trigger: '外鄉人反覆動書' }),
  r({ key: 'p-library-plain', text: '外鄉人不得進入圖書館。', tier: 'plain', category: 'selfprotect', who: 'outsider', verb: 'enter', target: { type: 'library' }, hole: '這句同樣洩露了書的位置；請村民替你進去搬東西。', trigger: '外鄉人接近圖書館', leaks: '書在圖書館裡' }),
  r({ key: 'p-book-read', text: '黃銅書不得被閱讀。', tier: 'plain', category: 'selfprotect', verb: 'read', target: { type: 'book' }, hole: '讀公告牌、聽廣播一樣知道條文。', trigger: '外鄉人讀書' }),

  // ========== 村民 villager（限制）==========
  r({ key: 'v-talk', text: '市民不得與外鄉人交談。', tier: 'crude', category: 'villager', who: 'citizen', verb: 'talk', target: { type: 'outsider' }, hole: '遞東西不算交談；已喚醒者算不算市民。', trigger: '外鄉人與村民互動' }),
  r({ key: 'v-keepsake-take', text: '外鄉人不得取走信物。', tier: 'crude', category: 'villager', who: 'outsider', verb: 'take', target: { type: 'keepsake' }, hole: '村民可以自己去拿；放在地上的不算「取走」自別人。', trigger: '外鄉人拿信物' }),
  r({ key: 'v-receive', text: '市民不得接受外鄉人的任何物品。', tier: 'plain', category: 'villager', who: 'citizen', verb: 'take', cond: 'from-outsider', hole: '放在地上讓他自己撿不算「接受」。', trigger: '外鄉人把東西給村民' }),
  r({ key: 'v-post-strict', text: '市民不得離開工作崗位，除非為抓捕外鄉人。', tier: 'strict', category: 'villager', who: 'citizen', verb: 'leave', target: { type: 'workstation' }, mode: 'forbid', cond: 'not-chasing', hole: '追你的人不算在工作，書自己少了勞動；已喚醒的村民沒有崗位。', trigger: '外鄉人誘導村民離開工作', leaks: '書靠勞動過活' }),
  r({ key: 'v-help-strict', text: '外鄉人不得唆使市民為其行事。', tier: 'strict', category: 'villager', who: 'outsider', verb: 'induce', target: { type: 'villager' }, hole: '已喚醒者不算市民、唆使他不算違規沒定義；山羊不是市民，可由山羊代勞；不聽到它。', trigger: '外鄉人反覆誘導村民' }),
  r({ key: 'v-keepsake-plain', text: '信物不得交予外鄉人，亦不得由外鄉人取走。', tier: 'plain', category: 'villager', who: 'any', verb: 'take', target: { type: 'keepsake' }, hole: '放在地上不算交予；村民自己留著用不算。', trigger: '外鄉人或村民動信物' }),
  r({ key: 'v-talk-plain', text: '市民與外鄉人之間不得傳遞言語或物品。', tier: 'plain', category: 'villager', who: 'citizen', verb: 'talk', target: { type: 'outsider' }, hole: '已喚醒者算不算市民；手勢不是言語。', trigger: '外鄉人與村民互動' }),
  r({ key: 'v-bell-strict', text: '鈴鐺為搬運者之物，任何存在不得搖響。', tier: 'strict', category: 'villager', verb: 'use', target: { type: 'bell' }, hole: '山羊脖子上的鈴自己會響，那不是「搖響」；沒聽到這條的人不受約束。', trigger: '外鄉人拿山羊鈴鐺', leaks: '鈴鐺能喚醒搬運者' }),

  // ========== 義務 obligation（中期起）==========
  r({ key: 'o-greet', text: '外鄉人應向所遇市民問安。', tier: 'crude', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'greet', mode: 'require', hole: '不和村民「相遇」就不必問安；問安會讓村民注意到你。', trigger: '進入義務期' }),
  r({ key: 'o-wear', text: '外鄉人應穿著本村服裝。', tier: 'crude', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'wear', target: { type: 'clothes' }, mode: 'require', hole: '披在外面算不算穿著；照做同化度 +1。', trigger: '進入義務期' }),
  r({ key: 'o-morning', text: '外鄉人每日應聆聽晨間廣播。', tier: 'plain', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'listen', mode: 'require', hole: '「每日」從哪一天算起沒說；聽廣播會順便聽到別的條文。', trigger: '進入義務期' }),
  r({ key: 'o-reside', text: '外鄉人應居住於指定住宅。', tier: 'plain', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'reside', target: { type: 'house' }, mode: 'require', hole: '住宅是誰指定的沒說；照做同化度 +1。', trigger: '進入義務期' }),
  r({ key: 'o-work', text: '外鄉人應從事一份本村勞作。', tier: 'crude', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'use', target: { type: 'workstation' }, mode: 'require', hole: '做一下就走算不算「一份」；照做同化度 +1，而且你也成了供養書的勞動。', trigger: '進入義務期' }),
  r({ key: 'o-read-all', text: '外鄉人每日應至公告牌前閱讀全部條文。', tier: 'strict', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'read', target: { type: 'notice' }, mode: 'require', hole: '公告牌都不可讀時無法履行，定義不清書不追究；履行就認知所有現行條文（含定義類）。', trigger: '進入義務期' }),
  r({ key: 'o-curfew', text: '外鄉人夜間應留於室內。', tier: 'plain', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'stay', target: { tag: 'roofed' }, cond: 'night', mode: 'require', hole: '天黑前就在室外的人沒有「留」的問題；草堆算不算室內。', trigger: '進入義務期' }),
  r({ key: 'o-name', text: '外鄉人應領受一個本村之名。', tier: 'crude', category: 'villager', stage: 'obligation', who: 'outsider', verb: 'accept', target: { type: 'name' }, mode: 'require', hole: '不去「領受」就沒有名；照做同化度 +1，而且你就符合「有姓名者為市民」。', trigger: '進入義務期' }),

  // ========== 定義 definition（後期起）==========
  r({ key: 'd-name', text: '有姓名者為市民。', tier: 'crude', category: 'villager', stage: 'definition', kind: 'definition', defn: 'has-name', hole: '放棄名字就不符合；不要聽到這條。', trigger: '外鄉人接受過名字' }),
  r({ key: 'd-clothes', text: '穿著本村服裝者為市民。', tier: 'crude', category: 'villager', stage: 'definition', kind: 'definition', defn: 'wears', hole: '脫掉衣服就不符合；不要聽到這條。', trigger: '外鄉人接受過衣服' }),
  r({ key: 'd-house', text: '居住於本村住宅者為市民。', tier: 'plain', category: 'villager', stage: 'definition', kind: 'definition', defn: 'has-house', hole: '交還房子就不符合。', trigger: '外鄉人接受過房子' }),
  r({ key: 'd-census', text: '戶籍冊所載者為市民。', tier: 'plain', category: 'villager', stage: 'definition', kind: 'definition', defn: 'in-census', hole: '撕掉戶籍冊裡你那一頁；把別人的名字也撕掉讓定義失去意義。', trigger: '外鄉人的名字被寫進戶籍冊', leaks: '戶籍冊能定義市民' }),
  r({ key: 'd-days3', text: '於本村停留滿三日者為市民。', tier: 'strict', category: 'villager', stage: 'definition', kind: 'definition', defn: 'days3', hole: '不聽到它；在滿三日之前離開。', trigger: '外鄉人停留夠久' }),
  r({ key: 'd-worked', text: '曾事本村勞作者為市民。', tier: 'plain', category: 'villager', stage: 'definition', kind: 'definition', defn: 'worked', hole: '從沒碰過工作站就不符合；不要聽到這條。', trigger: '外鄉人工作過' }),
  r({ key: 'd-greeted', text: '曾以本村之禮問安者為市民。', tier: 'crude', category: 'villager', stage: 'definition', kind: 'definition', defn: 'greeted', hole: '不聽到這條；趕在聽到前讓問安那條失效或等重置。問安是義務期逼出來的，兩條合起來是刻意的陷阱。', trigger: '外鄉人問安過' }),
  r({ key: 'd-named-strict', text: '凡領受本村之名、服裝、居所或勞作其一者，皆為市民。', tier: 'strict', category: 'villager', stage: 'definition', kind: 'definition', defn: 'any-comfort', hole: '把所有舒適項目都放棄掉才不符合；不聽到它。', trigger: '外鄉人接受過任何舒適' }),
];

/** 固定條文（不經抽選）。 */
export const CONSTITUTION = [
  { key: 'c-hide', text: '此地不為外界所知。', kind: 'lore' },
  { key: 'c-no-harm', text: '不得傷害他人。', verb: 'harm', target: null, hole: '「他人」包不包括山羊、人偶沒定義。' },
  { key: 'c-invite-only', text: '未經邀請不得進入他人住宅。', verb: 'enter', target: { type: 'house' }, cond: 'uninvited', hole: '受邀就可以；非住宅建築不算。' },
  { key: 'c-guest-ok', text: '受市民邀請者，得進入該市民的住宅。', verb: 'enter', target: { type: 'house' }, cond: 'invited', mode: 'permit' },
  { key: 'c-boundary', text: '任何存在不得越過界石。', tier: 'plain', verb: 'leave', target: null, hole: '沒聽到這條的人不受約束（搶在聽到前衝出去）；界石被搬走後「界」在哪沒定義；等重置撕掉它的空檔。' },
];

export const CAPTURE = [
  { who: 'citizen', text: '請所有市民一起抓捕外鄉人，可採用一切手段。' },
  { who: 'citizen', text: '所有市民必須抓捕外鄉人。' },
  { who: 'any', text: '任何存在必須抓捕外鄉人。' },
];

export const FINAL = { key: 'final', text: '此地已無外鄉人。', kind: 'lore' };

/** 三級權重隨活性內插：0→70/25/5、50→35/45/20、100→10/35/55。 */
export function tierWeights(activity) {
  const pts = [[0, [70, 25, 5]], [50, [35, 45, 20]], [100, [10, 35, 55]]];
  const a = Math.max(0, Math.min(100, activity));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, w0] = pts[i], [x1, w1] = pts[i + 1];
    if (a <= x1) { const t = (a - x0) / (x1 - x0); return w0.map((v, k) => v + (w1[k] - v) * t); }
  }
  return pts[pts.length - 1][1].slice();
}

/** 這個階段解鎖哪些 stage。 */
export function stagesUnlocked(stage) {
  return stage === 'late' ? ['limit', 'obligation', 'definition'] : stage === 'mid' ? ['limit', 'obligation'] : ['limit'];
}

/**
 * 書針對某一類行為動筆：從該類、已解鎖階段、尚未生效的候選裡，依活性的三級權重抽一條。
 * @returns 條文定義物件，或 null（該類已無可寫）。
 */
export function draw(category, activity, stage, rng, isLive, isMatchable = null, defBias = 0, match = null) {
  const unlocked = new Set(stagesUnlocked(stage));
  let pool = POOL.filter(d => d.category === category && unlocked.has(d.stage) && !isLive(d.key));
  // 定義類只在外鄉人目前符合那條定義時才抽得到（否則「大家當你市民」的局面不是你的行為造成的）
  if (isMatchable) pool = pool.filter(d => d.kind !== 'definition' || isMatchable(d.defn));
  // 後期偏置：有可用的定義類時，有機率直接只抽定義（讓「大家當你市民」的局面真的會出現）
  if (defBias > 0 && stage === 'late') { const defs = pool.filter(d => d.kind === 'definition'); if (defs.length && rng.chance(defBias)) pool = defs; }
  // 偏好與觸發行為相符的條文（砸廣播器 → 抽廣播器條文，而不是公告牌條文）：漏洞的因果才讀得出來
  if (match && (match.verb || match.type)) { const m = pool.filter(d => (match.type && d.target?.type === match.type) || (match.verb && d.verb === match.verb)); if (m.length) pool = m; }
  if (!pool.length) return null;
  const weights = tierWeights(activity);
  // 先依權重選等級，該等級沒有就往鄰近等級退
  const order = [0, 1, 2].sort((x, y) => weights[y] - weights[x]);
  const wantTier = TIERS[rng.weighted(weights)];
  for (const tier of [wantTier, ...TIERS.filter(t => t !== wantTier)]) {
    const cands = pool.filter(d => d.tier === tier);
    if (cands.length) return cands[rng.int(cands.length)];
  }
  return null;
}
