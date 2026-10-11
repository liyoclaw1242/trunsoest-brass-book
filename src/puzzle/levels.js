// levels.js —— 手工設計的「鑽規則漏洞」關卡（Baba 式）。答案不直接給，靠玩家自己想。
// 難度曲線：先各自學一招（定義當鑰匙→定義是陷阱→脫下定義→代勞→躲耳朵→撕掉依據），最後兩關把招式組合起來。
// 地圖圖例：# 牆、. 地板、@ 起點、E 出口門、N 名牌、C 衣物、K 公告牌、S 廣播器、G 山羊、B 黃銅書、H 脫衣處、x 荒野(範圍外終點)
// 法條欄位：text、verb、who(any|citizen|outsider)、mode(forbid|permit)、def(此定義成立者為市民)、target、src(notice|speaker：讀到／聽到才綁你)、onNotice(寫在公告上，牌子毀即失效)

export const LEVELS = [
  {
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
    name: '五、聽不到',
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
    name: '六、撕掉它',
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
    name: '七、繞路領名',
    teach: '還是得當市民才走得了。但廣播器喊著一條新規矩——聽到它的人，連名字都不准領。那就別讓它聽見你。',
    speakerRadius: 1,
    map: ['#########', '#@.....N#', '#...S...#', '#.......#', '#......E#', '#########'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid' },
      { text: '市民得自由離去。', verb: 'leave', who: 'citizen', mode: 'permit' },
      { text: '領受本村之名者，即為市民。', def: 'name' },
      { text: '聽過此廣播者，不得領受名字。', verb: 'accept', target: 'name', who: 'any', mode: 'forbid', src: 'speaker' },
    ],
    goal: 'leave',
    hintWin: '你繞開廣播、沒聽見那條禁令，才領得到名字；領了名就成市民，大方走出去。先躲聲音、再拿鑰匙——兩手都要對。',
  },
  {
    name: '八、名正言順',
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
    name: '九、雙喇叭',
    teach: '還是得領名當市民才走得了，而兩座廣播器都喊著「聽到的人不准領名」。它們的聲音之間，有條縫。',
    speakerRadius: 1,
    map: ['#########', '#@.....N#', '#..S.S..#', '#.......#', '#.......#', '#......E#', '#########'],
    laws: [
      { text: '外鄉人不得離開本村。', verb: 'leave', who: 'outsider', mode: 'forbid' },
      { text: '市民得自由離去。', verb: 'leave', who: 'citizen', mode: 'permit' },
      { text: '領受本村之名者，即為市民。', def: 'name' },
      { text: '聽過廣播者，不得領受名字。', verb: 'accept', target: 'name', who: 'any', mode: 'forbid', src: 'speaker' },
    ],
    goal: 'leave',
    hintWin: '你沿著兩座喇叭聲音的外圍繞到名字那裡，沒被任何一座聽見，才領得了名、成了市民、走得出去。',
  },
  {
    name: '十、兩道鎖',
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
    name: '十一、請人開門',
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
    name: '十二、名與門',
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
    name: '十三、改寫',
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
    name: '十四、以上規則無效',
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
    name: '十五、活書不停筆',
    teach: '這本書還活著，會一直寫新規則。等它寫出來，用它自己的字反將它一軍——湊出一句矛盾，逼它全部作廢。',
    map: ['###########', '#@.........#', '#.........#', '#.........#', '###########'],
    laws: [],
    tiles: [
      { word: '外鄉人', x: 2, y: 2 }, { word: '不得', x: 3, y: 2 }, { word: '離開', x: 4, y: 2 },
      { word: '外鄉人', x: 2, y: 3 }, { word: '得', x: 3, y: 3 },
    ],
    livingBook: { everyN: 2, writes: [[{ word: '離開', x: 6, y: 3 }], [{ word: '不得', x: 8, y: 2 }]] },
    goal: 'reset',
    hintWin: '書一邊寫，你一邊把它寫下的「離開」推去補成「外鄉人得離開」——和它的「外鄉人不得離開」撞個正著。它越寫越給你材料，最後自打嘴巴、全盤作廢。',
  },
  {
    name: '十六、大議會',
    teach: '滿牆的法你一條條拆不完（刻死的字塊推不動）。但只要逼出一個矛盾，它就得把「全部」作廢。找一句能被你反過來說的法。',
    map: ['#############', '#@..........#', '#...........#', '#...........#', '#...........#', '#...........#', '#############'],
    laws: [],
    tiles: [
      // 滿牆刻死的法（複合、推不動）
      { word: '外鄉人', x: 1, y: 2, fixed: true }, { word: '不得', x: 2, y: 2, fixed: true }, { word: '離開', x: 3, y: 2, fixed: true },
      { word: '市民', x: 1, y: 3, fixed: true }, { word: '不得', x: 2, y: 3, fixed: true }, { word: '離開', x: 3, y: 3, fixed: true },
      { word: '山羊', x: 1, y: 4, fixed: true }, { word: '不得', x: 2, y: 4, fixed: true }, { word: '離開', x: 3, y: 4, fixed: true },
      // 一句可被你補成「准」的法：外鄉人 _ 離開（兩端刻死，中間缺情態）
      { word: '外鄉人', x: 7, y: 4, fixed: true }, { word: '離開', x: 9, y: 4, fixed: true },
      // 唯一推得動的字塊：得（把它推進上面那句的缺口）
      { word: '得', x: 8, y: 3 },
    ],
    livingBook: { everyN: 3, writes: [
      [{ word: '任何人', x: 5, y: 5, fixed: true }, { word: '不得', x: 6, y: 5, fixed: true }, { word: '進入', x: 7, y: 5, fixed: true }],
    ] },
    goal: 'reset',
    hintWin: '你把唯一推得動的「得」推進「外鄉人 _ 離開」，湊成「外鄉人得離開」，和刻在牆上的「外鄉人不得離開」正面衝突。一個矛盾，就讓整牆的法一起作廢。以少勝多。',
  },
  {
    name: '十七、步步進逼',
    teach: '書是活的：你每動一步，它就刻下一個字（三字成一條法），專挑貼牆的地方下筆。貼牆的字還能沿牆推，只有被逼進角落才真的卡死。趁它寫完前，湊出你的矛盾。',
    map: ['################', '#@.............#', '#.外不離.........#', '#.外得.離........#', '#......G.......#', '################'],
    laws: [],
    tiles: [
      { word: '外鄉人', x: 2, y: 2, fixed: true }, { word: '不得', x: 3, y: 2, fixed: true }, { word: '離開', x: 4, y: 2, fixed: true },
      { word: '外鄉人', x: 2, y: 3, fixed: true }, { word: '得', x: 3, y: 3, fixed: true }, { word: '離開', x: 5, y: 3 },
    ],
    livingBook: { everyN: 1, writes: [
      [{ word: '市民', x: 10, y: 1 }], [{ word: '不得', x: 11, y: 1 }], [{ word: '離開', x: 12, y: 1 }],
    ] },
    goal: 'reset',
    hintWin: '書一步一字地刻它的法，你趕在它圍死你之前，把活動的「離開」推進缺口，湊成「外鄉人得離開」，與刻死的「外鄉人不得離開」對撞——它只好把全部作廢。快，而且準。',
  },
  {
    name: '十八、活棋',
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
];
