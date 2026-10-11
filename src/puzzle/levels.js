// levels.js —— 手工設計的「鑽規則漏洞」關卡（Baba 式）。答案不直接給，靠玩家自己想。
// 兩章：
//   教學（chapter:'tut'，第 1–10 關）——每關只教一招：身分（名／衣／脫）→ 代勞（羊／村民）→ 公示（聲音／公告）→ 字塊（改寫／矛盾）→ 活書（會看你下筆的對手）。
//   負荷（chapter:'load'，第 11 關起）——把學過的招式與物件疊起來的大型關：多條複合法、活書不停筆、滿牆刻死的律法，最後一步鑽一個漏洞把它們一起推翻。
// 地圖圖例：# 牆、. 地板、@ 起點、E 出口門、N 名牌、C 衣物、K 公告牌、S 廣播器、G 山羊、B 黃銅書、V 村民、H 脫衣處、D 村門、x 荒野(範圍外終點)
// 法條欄位：text、verb、who(any|citizen|outsider)、mode(forbid|permit)、def(此定義成立者為市民)、target、src(notice|speaker：讀到／聽到才綁你)、onNotice(寫在公告上，牌子毀即失效)
// 字塊：tiles[{word,x,y,fixed?}]（fixed=刻死推不動）；活書：livingBook{everyN,writes}；即時對手：reactiveBook{everyN,agenda}

export const LEVELS = [
  // ───────────────────────── 教學 ─────────────────────────
  {
    chapter: 'tut',
    name: '一、名',
    teach: '那扇門只讓「市民」通過。書親口定義了誰算市民——它自己的話，也許就是你的鑰匙。',
    map: ['#######', '#@...E#', '#.....#', '#..N..#', '#######'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid' },
      { text: '市民得自由離去。', verb: 'leave', who: 'citizen', mode: 'permit' },
      { text: '領受本村之名者，即為市民。', def: 'name' },
    ],
    goal: 'leave',
    hintWin: '你領了名字——書的定義把你變成了市民，於是它自己的法放你走。你用成為它想要的樣子，換到了出去。',
  },
  {
    chapter: 'tut',
    name: '二、別上當',
    teach: '這一次，法條反過來了。別急著重施上一招——先把牆上的字讀清楚。',
    map: ['#######', '#@...E#', '#.....#', '#..N..#', '#######'],
    laws: [
      { text: '外鄉人得自由離去。', verb: 'leave', who: 'outsider', mode: 'permit' },
      { text: '市民不得離開本村。', verb: 'leave', who: 'citizen', mode: 'forbid' },
      { text: '領受本村之名者，即為市民。', def: 'name' },
    ],
    goal: 'leave',
    hintWin: '這次名字是陷阱：領了就成市民，反而走不了。你忍住沒拿，以外鄉人的身分大方走出去。同一個東西，上一關是鑰匙，這一關是鎖。',
  },
  {
    chapter: 'tut',
    name: '三、脫身',
    teach: '你已經穿上了這裡的衣服，被當成市民——而市民走不了。你看看牆上，誰才走得了。（🧺 可以脫下）',
    has: ['clothes'],
    map: ['#######', '#@..H.#', '#.....#', '#....E#', '#######'],
    laws: [
      { text: '外鄉人得自由離去。', verb: 'leave', who: 'outsider', mode: 'permit' },
      { text: '市民不得離開本村。', verb: 'leave', who: 'citizen', mode: 'forbid' },
      { text: '著本村衣者，即為市民。', def: 'clothes' },
    ],
    goal: 'leave',
    hintWin: '你把衣服脫了（🧺）——不再是市民，就不再被「市民不得離開」綁住。定義是雙面刃：穿上它綁你，脫下它放你。',
  },
  {
    chapter: 'tut',
    name: '四、代勞',
    teach: '書管得到的只有「人」。你搬不動那本書——但牲口聽不懂它的法。把書弄進荒野（🌲），封印就散了。',
    map: ['########', '#@G.B.x#', '########'],
    laws: [
      { text: '外鄉人不得搬動黃銅書。', verb: 'move', who: 'outsider', target: 'book', mode: 'forbid' },
      { text: '書被帶出村界，封印便隨之消散。', note: true },
    ],
    goal: 'bookOut',
    hintWin: '你推山羊去馱書——山羊不是書管得到的「人」，於是法管不著。書被馱進荒野，封印散了。你沒碰書，書卻離開了。',
  },
  {
    chapter: 'tut',
    name: '五、請人開門',
    teach: '那道門（🚧）你開不了——法只准市民開。村裡就有一個市民（👷），把他帶到門邊。',
    map: ['########', '#@..D.E#', '#.V..#.#', '########'],
    laws: [
      { text: '外鄉人不得開啟村門。', verb: 'open', who: 'outsider', target: 'door', mode: 'forbid' },
      { text: '（市民走到門邊，門自會為他而開。）', note: true },
    ],
    goal: 'leave',
    hintWin: '你把市民推到門邊，門為他而開，你就跟著穿過去。你開不了的門，讓本來就有權的人去開。',
  },
  {
    chapter: 'tut',
    name: '六、聽不到',
    teach: '那條「不得離開」的法，是廣播器喊出來的——聽到了才綁得住你。離它遠一點。',
    speakerRadius: 1,
    map: ['#########', '#@......#', '#.......#', '#...S...#', '#.......#', '#......E#', '#########'],
    laws: [
      { text: '聽到此廣播者，不得離開本村。', verb: 'leave', who: 'any', mode: 'forbid', src: 'speaker' },
    ],
    goal: 'leave',
    hintWin: '你繞開了廣播器的聲音——沒聽到那條法，它就綁不住你。公示才生效：你不在場，它對你就不算數。',
  },
  {
    chapter: 'tut',
    name: '七、撕掉它',
    teach: '綁住你的那條法，就寫在那面公告牌上。沒了那面牌子，那條法還站得住嗎？有誰愛啃紙。',
    map: ['#######', '#@.GK.#', '#....E#', '#######'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid', onNotice: true },
      { text: '市民不得離開本村。', verb: 'leave', who: 'citizen', mode: 'forbid' },
      { text: '（此法載於公告牌上，牌子沒了便失其據。）', note: true },
    ],
    goal: 'leave',
    hintWin: '你讓山羊啃了公告牌——綁住外鄉人的那條法失去了依據，便不再算數。而你始終沒變成市民，所以另一條也套不到你身上。釜底抽薪。',
  },
  {
    chapter: 'tut',
    name: '八、改寫',
    teach: '地上那三個字塊，排成一句就是一條法。它是書寫的——但字塊你推得動。把那句話拆了，法就不成立。',
    map: ['#########', '#@.....E#', '#.......#', '#.......#', '#########'],
    laws: [],
    tiles: [
      { word: '外鄉人', x: 2, y: 2 }, { word: '不得', x: 3, y: 2 }, { word: '離開', x: 4, y: 2 },
    ],
    goal: 'leave',
    hintWin: '你把「不得」推出那一行，「外鄉人不得離開」就斷了句、不再成立——這一次你不是鑽法的漏洞，是直接改了法。這就是你比書強的地方：它寫，你能改。',
  },
  {
    chapter: 'tut',
    name: '九、以上規則無效',
    teach: '這本書一直立法，你鬥不過它的量——除非逼它自打嘴巴。讓同一件事既「不得」又「得」，看它怎麼辦。',
    map: ['##########', '#@.......#', '#........#', '#........#', '##########'],
    laws: [],
    tiles: [
      { word: '外鄉人', x: 2, y: 2 }, { word: '不得', x: 3, y: 2 }, { word: '離開', x: 4, y: 2 },
      { word: '外鄉人', x: 2, y: 3 }, { word: '得', x: 3, y: 3 }, { word: '離開', x: 5, y: 3 },
    ],
    goal: 'reset',
    hintWin: '你把「離開」推進第二句，讓「外鄉人不得離開」和「外鄉人得離開」同時成立。書自相矛盾，只能寫下『以上規則無效』，把自己立的法全撕了——這就是大型關卡的勝法。',
  },
  {
    chapter: 'tut',
    name: '十、活棋',
    teach: '這本書會「看你站哪」臨場下筆——每隔一步就在你身旁、貼著牆刻一個字，想把你圍死、堵你的路。手腳要快：趁它還沒圍上，湊出你的矛盾。',
    map: ['#########', '#@......#', '#.......#', '#.......#', '#.......#', '#########'],
    laws: [],
    tiles: [
      { word: '外鄉人', x: 2, y: 2, fixed: true }, { word: '不得', x: 3, y: 2, fixed: true }, { word: '離開', x: 4, y: 2, fixed: true },
      { word: '外鄉人', x: 2, y: 3, fixed: true }, { word: '得', x: 3, y: 3, fixed: true }, { word: '離開', x: 6, y: 3 },
    ],
    reactiveBook: { everyN: 2, agenda: [['市民', '不得', '離開']] },
    goal: 'reset',
    hintWin: '它盯著你下筆、步步進逼，但你更快：把活動的「離開」推進「外鄉人得＿」的缺口，湊成「外鄉人得離開」，和它刻死的「外鄉人不得離開」對撞，逼它寫下「以上規則無效」。對手是活的，你也是。',
  },

  // ───────────────────────── 負荷 ─────────────────────────
  {
    chapter: 'load',
    name: '十一、名與門',
    teach: '出村要過一道只有市民開得了的門（🚧），而且外鄉人根本不准離開。名字、市民（👷），你都用得上。',
    map: ['#########', '#@.N.D.E#', '#...V..##', '#########'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid' },
      { text: '市民得自由離去。', verb: 'leave', who: 'citizen', mode: 'permit' },
      { text: '領受本村之名者，即為市民。', def: 'name' },
      { text: '外鄉人不得開啟村門。（市民方可）', verb: 'open', who: 'outsider', target: 'door', mode: 'forbid' },
    ],
    goal: 'leave',
    hintWin: '你領了名字好讓自己有資格離開，又把市民帶到門邊替你開門——兩道關卡、兩種身分，一次解開。',
  },
  {
    chapter: 'load',
    name: '十二、名正言順',
    teach: '要把書弄進荒野，得靠山羊代勞。可是「外鄉人不得牽引牲口」——那就先別當外鄉人。',
    map: ['#########', '#@N.....#', '#.GB...x#', '#########'],
    laws: [
      { text: '外鄉人不得搬動黃銅書。', verb: 'move', who: 'outsider', target: 'book', mode: 'forbid' },
      { text: '外鄉人不得牽引牲口。', verb: 'lead', who: 'outsider', target: 'goat', mode: 'forbid' },
      { text: '領受本村之名者，即為市民。', def: 'name' },
      { text: '書被帶出村界，封印便隨之消散。', note: true },
    ],
    goal: 'bookOut',
    hintWin: '你先領了名字成為市民——市民牽牲口不犯法。於是你趕著山羊馱書出村。你用它給的身分，鑽了它自己的法。',
  },
  {
    chapter: 'load',
    name: '十三、兩道鎖',
    teach: '外鄉人走不了，市民也走不了——兩條法把兩種身分都鎖死。但其中一條，寫在公告牌上。',
    map: ['########', '#@.N..E#', '#.GK...#', '########'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid' },
      { text: '市民不得離開本村。', verb: 'leave', who: 'citizen', mode: 'forbid', onNotice: true },
      { text: '領受本村之名者，即為市民。', def: 'name' },
      { text: '（市民那條載於公告牌上，牌子沒了便失其據。）', note: true },
    ],
    goal: 'leave',
    hintWin: '你兩手並用：領了名字躲開「外鄉人不得離開」，又讓山羊啃掉公告牌、廢掉「市民不得離開」。兩道鎖各有鑰匙，你都找到了。',
  },
  {
    chapter: 'load',
    name: '十四、作繭自縛',
    teach: '封住你的那條「不得離開」寫在公告牌上——讓山羊吃掉它就失效。可是書又立了「山羊不得吃」擋著。那條法也是字塊排的，先把它拆了。',
    map: ['##############', '#@..........E#', '#...........#', '#...G.K......#', '#...........#', '##############'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid', onNotice: true },
    ],
    tiles: [
      { word: '山羊', x: 2, y: 2 }, { word: '不得', x: 3, y: 2 }, { word: '吃', x: 4, y: 2 },
    ],
    goal: 'leave',
    hintWin: '你先把「山羊不得吃」拆了句，山羊才啃得動公告牌；牌子一沒，寫在上面的「外鄉人不得離開」失去依據，你就走得出門了。你不是硬闖，是先改了管牲口的那條法。',
  },
  {
    chapter: 'load',
    name: '十五、破門而出',
    teach: '這關要真的走出門（🚪）。但「外鄉人不得離開」刻在牆上，而且活書還想再寫一條封你。唯一的辦法：湊出矛盾讓「全部規則作廢」，趁空檔衝出去。',
    map: ['#############', '#@.........E#', '#.外不離......#', '#.外得.離....#', '#...........#', '#############'],
    laws: [],
    tiles: [
      { word: '外鄉人', x: 2, y: 2, fixed: true }, { word: '不得', x: 3, y: 2, fixed: true }, { word: '離開', x: 4, y: 2, fixed: true },
      { word: '外鄉人', x: 2, y: 3, fixed: true }, { word: '得', x: 3, y: 3, fixed: true }, { word: '離開', x: 6, y: 3 },
    ],
    reactiveBook: { everyN: 2, agenda: [['外鄉人', '不得', '進入']] },
    goal: 'leave',
    hintWin: '你先湊出「外鄉人得離開」與「外鄉人不得離開」對撞——書寫「以上規則無效」，全場規則連同那道封印一起消失。趁它還沒重新立法，你一步跨出門外。矛盾不只是勝利，是你逃跑的空檔。',
  },
  {
    chapter: 'load',
    name: '十六、萬法庭',
    teach: '整座議事廳刻滿了法——外鄉人、市民、山羊、物，連「吃」「推」「進入」都管死了。你一條條拆不完。但滿廳的法只要出一個矛盾，就得「全部作廢」。找那句你能反過來說的。',
    map: [
      '#############',
      '#.....@.....#',
      '#...........#',
      '#...........#',
      '#...........#',
      '#...........#',
      '#...........#',
      '#############',
    ],
    laws: [],
    tiles: [
      // 左牆：刻死的四條（推不動）
      { word: '外鄉人', x: 1, y: 1, fixed: true }, { word: '不得', x: 2, y: 1, fixed: true }, { word: '離開', x: 3, y: 1, fixed: true },
      { word: '市民', x: 1, y: 2, fixed: true }, { word: '不得', x: 2, y: 2, fixed: true }, { word: '離開', x: 3, y: 2, fixed: true },
      { word: '山羊', x: 1, y: 3, fixed: true }, { word: '不得', x: 2, y: 3, fixed: true }, { word: '離開', x: 3, y: 3, fixed: true },
      { word: '任何人', x: 1, y: 4, fixed: true }, { word: '不得', x: 2, y: 4, fixed: true }, { word: '進入', x: 3, y: 4, fixed: true },
      // 右牆：刻死的四條（推不動）
      { word: '物', x: 8, y: 1, fixed: true }, { word: '不得', x: 9, y: 1, fixed: true }, { word: '推', x: 10, y: 1, fixed: true },
      { word: '山羊', x: 8, y: 2, fixed: true }, { word: '不得', x: 9, y: 2, fixed: true }, { word: '吃', x: 10, y: 2, fixed: true },
      { word: '市民', x: 8, y: 3, fixed: true }, { word: '不得', x: 9, y: 3, fixed: true }, { word: '進入', x: 10, y: 3, fixed: true },
      { word: '山羊', x: 8, y: 4, fixed: true }, { word: '不得', x: 9, y: 4, fixed: true }, { word: '推', x: 10, y: 4, fixed: true },
      // 廳中缺一個情態的半句：外鄉人 ＿ 離開（兩端刻死）
      { word: '外鄉人', x: 4, y: 6, fixed: true }, { word: '離開', x: 6, y: 6, fixed: true },
      // 唯一推得動的字塊：得（把它推進半句的缺口 (5,6)，湊成「外鄉人得離開」與左牆對撞）
      { word: '得', x: 5, y: 4 },
    ],
    reactiveBook: { everyN: 2, agenda: [['任何人', '不得', '吃']] },
    goal: 'reset',
    hintWin: '滿廳十條法，你只動了一個字：把「得」推進「外鄉人 ＿ 離開」的缺口，湊成「外鄉人得離開」，和刻在左牆的「外鄉人不得離開」正面對撞。一個矛盾，整座議事廳的律法一起作廢。以一克萬。',
  },
];
