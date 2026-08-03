// The long-form videos: one system per video.
//
// The Shorts cuts all share a body and differ only in their opening seconds,
// which works because 45 seconds cannot hold two ideas anyway. Posting daily at
// three minutes needs a different answer — six hooks on one body would be six
// near-duplicates — so a long-form video takes one system and follows it to the
// end. The supply of videos is then the supply of systems, and this game has
// more of those than it has room to explain in a Short.
//
// A topic is a list of beats. Each beat gets a hard cut, a screen built by
// `run`, a caption, and a spoken line anchored to the moment the screen was
// ready — see director-wide.mjs. `hold` is how long the beat sits there once
// everything is up; the narration for the beat has to fit inside it.
//
// Numbers quoted in captions are checked against the game, not remembered:
// SKILLS.length is 71, equip2Items is 486, 正 is the 10th unit above 万 so 100正
// is 10^42. Anything that cannot be checked does not go in.

const TAGS = ['放置ゲーム', 'クリッカー', 'インクリメンタル', '個人開発',
  'インディーゲーム', 'Androidゲーム', 'クッキーストラテジャー', 'ゲーム解説'];

export const TOPICS = [
  {
    id: 'quota',
    title: '放置しても伸びない放置ゲーの仕組み【生産ノルマ】',
    chapter: { n: '仕組み 01', head: '生産ノルマ', sub: '放置ゲーに締め切りをつけたらどうなるか' },
    description:
      'このゲームには生産ペースのノルマがあります。遅れるとその周回はモンスターが出なくなり、' +
      '素材が手に入らなくなります。置いておくだけでもクッキーは増えますが、' +
      '伸ばしたいなら管理が要る、という設計の話です。',
    tags: TAGS,
    beats: [
      { id: 'intro', hold: 5200,
        caption: ['放置ゲーなのに、<em>締め切り</em>があります'],
        narration: 'このゲームには、生産ペースのノルマがあります。放置ゲーなのに締め切りがある。',
        run: async s => { await s.setMidGame(); await s.showTab('shopTab'); await s.setPlayFullscreen(true); } },
      { id: 'gauge', hold: 6000,
        caption: ['画面上部の<em>モンスター生成ノルマ</em>', 'これが進まないと何も出てこない'],
        narration: '画面の上にあるのがそのノルマです。生産が足りていれば進み、足りなければ止まります。',
        run: async s => { await s.setPlayFullscreen(true); await s.tapBurst('#cookie', 5, 300); } },
      { id: 'buy', hold: 6000,
        caption: ['設備を買って<em>毎秒</em>を上げる', 'これがノルマへの回答'],
        narration: '答えは単純で、設備を買って毎秒の生産を上げることです。ここまでは普通の放置ゲーと同じ。',
        run: async s => { await s.setPlayFullscreen(false); await s.showTab('shopTab'); await s.tapBurst('#shop .item', 6, 260); } },
      { id: 'fail', hold: 6500,
        caption: ['間に合わないと<em>その周回は</em>', 'モンスターが出なくなります'],
        narration: '間に合わなかった場合、その周回はモンスターが出なくなります。生産は止まりませんが、素材が手に入らなくなる。',
        run: async s => { await s.setPlayFullscreen(true); await s.ev(() => { state.quotaFailed = true; try { renderActiveTab(); } catch (e) {} }); } },
      { id: 'why', hold: 6500,
        caption: ['素材が止まる ＝ <em>装備が作れない</em>', '次の周回が遅くなる'],
        narration: '素材が止まると装備が作れず、次の周回が遅くなります。ノルマは、放置と管理のどちらを選ぶかを毎周回きいてくる仕組みです。',
        run: async s => { await s.ev(() => { state.quotaFailed = false; }); await s.setMaterials(); await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); } },
      { id: 'relief', hold: 6500,
        caption: ['ただし<em>料理</em>でノルマは緩められます', '詰みはしません'],
        narration: '対抗手段もあります。料理を使うとノルマの進行を遅らせられるので、詰むことはありません。',
        run: async s => { await s.showCooking(); await s.autoScroll('workshopTab', 0.22, 2600); } },
    ],
  },
  {
    id: 'hunt',
    title: 'クッキーをタップするゲームにボスがいる【討伐と素材】',
    chapter: { n: '仕組み 02', head: '討伐', sub: 'クリッカーにモンスターを置いた理由' },
    description:
      'クッキーモンスターを殴ると素材が落ちます。群れで来ることもあれば、ステージボスも来ます。' +
      '素材は装備の材料で、装備は次の周回を速くします。クリッカーに戦闘を足すと何がつながるのか、という話です。',
    tags: TAGS,
    beats: [
      { id: 'intro', hold: 5200,
        caption: ['クッキーの画面に<em>モンスター</em>が出ます'],
        narration: 'クッキーをタップするゲームですが、盤面にモンスターが出ます。',
        run: async s => { await s.setLateGame(); await s.hideRewardModal(); await s.showTab('shopTab'); await s.setPlayFullscreen(true); await s.ev(() => { try { showMonster('normal'); } catch (e) {} state.huntFocusLv = 20; }); } },
      { id: 'hit', hold: 6000,
        caption: ['殴ると<em>素材</em>が落ちる'],
        narration: '殴ると素材が落ちます。落ちた素材は装備の材料になります。',
        run: async s => { await s.hitMonsters(8, 260); } },
      { id: 'swarm', hold: 6000,
        caption: ['<em>群れ</em>で来ることもあります'],
        narration: '群れで来ることもあります。数が増えるぶん、タップの速さがそのまま効きます。',
        run: async s => { await s.ev(() => { try { showMonster('swarm'); } catch (e) {} }); await s.hitMonsters(10, 200); } },
      { id: 'boss', hold: 7000,
        caption: ['ステージごとに<em>ボス</em>'],
        narration: 'ステージごとにボスがいます。HPが桁違いなので、装備を整えないと削り切れません。',
        run: async s => { await s.ev(() => { try { showMonster('boss'); } catch (e) {} }); await s.hitMonsters(12, 220); } },
      { id: 'craft', hold: 6500,
        caption: ['素材 → <em>装備486種類</em>'],
        narration: '集めた素材から装備を作ります。レシピは486種類あります。',
        run: async s => { await s.setPlayFullscreen(false); await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); await s.autoScroll('workshopTab', 0.3, 2800); } },
      { id: 'loop', hold: 6500,
        caption: ['装備が強くなる → <em>ボスが倒せる</em>', '→ もっと良い素材'],
        narration: '装備が強くなればボスが倒せて、もっと良い素材が出ます。討伐はこの輪を回すためにあります。',
        run: async s => { await s.autoScroll('workshopTab', { by: 1 }, 2600); } },
    ],
  },
  {
    id: 'prestige',
    title: '転生スキルツリーが71ノードある放置ゲー【周回設計】',
    chapter: { n: '仕組み 03', head: '転生', sub: '進行を捨てて何を持ち越すのか' },
    description:
      '転生すると生産はリセットされますが、ポイントが入り、71ノードのスキルツリーに振れます。' +
      '取り方は何度でも組み直せます。周回のたびに何が変わるのか、という話です。',
    tags: TAGS,
    beats: [
      { id: 'intro', hold: 5200,
        caption: ['<em>転生</em>＝ここまでの生産を捨てる'],
        narration: '転生という仕組みがあります。ここまでの生産を捨てて、最初からやり直します。',
        run: async s => { await s.setLateGame(); await s.showTab('shopTab'); await s.setPlayFullscreen(true); } },
      { id: 'points', hold: 6000,
        caption: ['捨てた量に応じて<em>ポイント</em>が入る'],
        narration: '捨てた量に応じてポイントが入ります。これは周回をまたいで残ります。',
        run: async s => { await s.setPlayFullscreen(false); await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); } },
      { id: 'tree', hold: 7500,
        caption: ['<em>71ノード</em>のスキルツリー'],
        narration: 'ポイントの行き先がこれです。ノードは71個あります。',
        run: async s => { await s.openTree(); } },
      { id: 'pan', hold: 7000,
        caption: ['取る順番で<em>次の周回</em>が変わる'],
        narration: '全部は取れないので、どこから取るかで次の周回の形が変わります。',
        run: async s => { await s.panTree(0.75); } },
      { id: 'respec', hold: 6500,
        caption: ['取り方は<em>何度でも組み直せます</em>'],
        narration: '組み直しは何度でもできます。一度の選択で詰むことはありません。',
        run: async s => { await s.panTree(0.2); } },
      { id: 'result', hold: 6500,
        caption: ['効いている倍率は<em>全部数字で見えます</em>'],
        narration: '振った結果はすべて数字で確認できます。なんとなく強くなった、で終わりません。',
        run: async s => { await s.closeTree(); await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); await s.autoScroll('infoTab', { by: 0.8 }, 3000); } },
    ],
  },
  {
    id: 'numbers',
    title: '効いてる倍率が全部見える放置ゲー【研究と一覧】',
    chapter: { n: '仕組み 04', head: '研究と一覧', sub: '計算式を隠さないという選択' },
    description:
      '研究を買うと生産の計算式が変わります。そして今どの倍率がいくつ乗っているのかは、' +
      'すべて一覧画面で確認できます。数字を隠さないとどうなるか、という話です。',
    tags: TAGS,
    beats: [
      { id: 'intro', hold: 5200,
        caption: ['放置ゲーの<em>数字</em>の話です'],
        narration: '放置ゲーの数字の話をします。何をすると何倍になるのか、という部分です。',
        run: async s => { await s.setLateGame(); await s.showTab('shopTab'); await s.setPlayFullscreen(true); } },
      { id: 'research', hold: 6500,
        caption: ['<em>研究</em>は計算式そのものを変えます'],
        narration: '研究は、生産量を足すのではなく計算式そのものを変えます。',
        run: async s => { await s.setPlayFullscreen(false); await s.showTab('researchTab', true); await s.waitForImages('researchTab'); } },
      { id: 'scroll', hold: 6500,
        caption: ['買うほど<em>係数が増える</em>'],
        narration: '買うほど係数が増えていきます。順番によって伸び方が変わります。',
        run: async s => { await s.autoScroll('researchTab', 0.45, 3000); } },
      { id: 'list', hold: 7000,
        caption: ['いま効いている倍率は<em>全部見られます</em>'],
        narration: 'そして、いま効いている倍率は全部この画面で見られます。',
        run: async s => { await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); } },
      { id: 'wall', hold: 7000,
        caption: ['x13351.000 / x590157.128 …'],
        narration: 'この壁のような数字が、いま自分にかかっている倍率です。',
        run: async s => { await s.autoScroll('infoTab', { by: 0.7 }, 3200); } },
      { id: 'why', hold: 6500,
        caption: ['<em>なんとなく強くなった</em>で終わらせない'],
        narration: '隠さないことにしたのは、なんとなく強くなった、で終わらせたくなかったからです。',
        run: async s => { await s.autoScroll('infoTab', { by: 0.7 }, 3000); } },
    ],
  },
  {
    id: 'craft',
    title: '装備のレシピが486種類あるクリッカー【工房】',
    chapter: { n: '仕組み 05', head: '工房', sub: 'クリッカーに装備を置くとどうなるか' },
    description:
      '討伐で集めた素材から装備を作れます。レシピは486種類。作った装備はタップ力と生産の両方に効きます。' +
      'クリッカーに装備を足すと何が起きるのか、という話です。',
    tags: TAGS,
    beats: [
      { id: 'intro', hold: 5200,
        caption: ['クリッカーのはずなんですが'],
        narration: 'クリッカーのはずなんですが、装備があります。',
        run: async s => { await s.setLateGame(); await s.setPlayFullscreen(false); await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); } },
      { id: 'count', hold: 6500,
        caption: ['レシピは<em>486種類</em>'],
        narration: 'レシピは486種類あります。素材の組み合わせでできるものが変わります。',
        run: async s => { await s.autoScroll('workshopTab', 0.25, 3000); } },
      { id: 'mats', hold: 6500,
        caption: ['素材は<em>討伐</em>から'],
        narration: '素材はモンスターから落ちます。だから討伐と工房は別の遊びではありません。',
        run: async s => { await s.setPlayFullscreen(true); await s.ev(() => { try { showMonster('swarm'); } catch (e) {} state.huntFocusLv = 20; }); await s.hitMonsters(8, 240); } },
      { id: 'make', hold: 6500,
        caption: ['作ると<em>タップ力と生産</em>の両方に効く'],
        narration: '作った装備はタップ力にも生産にも効きます。片方だけではありません。',
        run: async s => { await s.setPlayFullscreen(false); await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); await s.autoScroll('workshopTab', { by: 1 }, 2800); } },
      { id: 'cook', hold: 6500,
        caption: ['<em>料理</em>も同じ素材から'],
        narration: '料理も同じ素材から作ります。こちらはノルマを緩める方向に効きます。',
        run: async s => { await s.showCooking(); } },
      { id: 'why', hold: 6500,
        caption: ['集める理由が<em>常にある</em>状態にする'],
        narration: '素材に行き先を二つ用意したのは、集める理由が常にある状態にしたかったからです。',
        run: async s => { await s.autoScroll('workshopTab', { by: 1 }, 2800); } },
    ],
  },
  {
    id: 'scale',
    title: '10の42乗まで増える放置ゲーの単位【正・載・極】',
    chapter: { n: '仕組み 06', head: '桁', sub: '兆の先に何があるのか' },
    description:
      '所持クッキーは兆をはるかに超えて伸びます。正は10の40乗、100正で10の42乗。' +
      'その先には載・極・恒河沙と続きます。桁が増え続けるゲームで何が起きるか、という話です。',
    tags: TAGS,
    beats: [
      { id: 'intro', hold: 5200,
        caption: ['所持クッキー <em>100正</em>'],
        narration: '所持クッキーが100正あります。正、という単位です。',
        run: async s => { await s.setLateGame(); await s.showTab('shopTab'); await s.setPlayFullscreen(true); } },
      { id: 'unit', hold: 6500,
        caption: ['正 ＝ 10の<em>40</em>乗', '100正 ＝ 10の<em>42</em>乗'],
        narration: '正は10の40乗です。100正なので、10の42乗。兆が10の12乗なので、その30桁上になります。',
        run: async s => { await s.tapBurst('#cookie', 5, 300); } },
      { id: 'ladder', hold: 6500,
        caption: ['万 → 億 → 兆 → 京 → 垓 → …', '→ 正 → 載 → 極'],
        narration: '万、億、兆、京、垓と続いて、10番目が正です。その先は載、極とまだ続きます。',
        run: async s => { await s.setPlayFullscreen(false); await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); } },
      { id: 'why', hold: 7000,
        caption: ['桁が増えるのは<em>掛け算が積み重なる</em>から'],
        narration: 'ここまで伸びるのは、設備と研究と装備と転生の倍率が全部掛け算で乗るからです。',
        run: async s => { await s.autoScroll('infoTab', { by: 0.7 }, 3000); } },
      { id: 'rewind', hold: 6500,
        caption: ['最初は<em>クッキー25枚</em>'],
        narration: '最初はクッキー25枚から始まります。同じ画面です。',
        run: async s => { await s.setFresh(); await s.setPlayFullscreen(true); await s.tapBurst('#cookie', 5, 280); } },
      { id: 'back', hold: 6000,
        caption: ['ここから <em>10の42乗</em> まで'],
        narration: 'ここから10の42乗まで持っていく、というのがこのゲームの全体像です。',
        run: async s => { await s.setLateGame(); await s.setPlayFullscreen(true); } },
    ],
  },
];

export const byId = id => TOPICS.find(t => t.id === id);
export const MARK = id => `#topic-${id}`;
