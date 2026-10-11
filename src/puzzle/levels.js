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
];
