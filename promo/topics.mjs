// The long-form videos: one system per video.
//
// The Shorts cuts all share a body and differ only in their opening seconds,
// which works because 45 seconds cannot hold two ideas anyway. Posting daily at
// three minutes needs a different answer — six hooks on one body would be six
// near-duplicates — so a long-form video takes one system and follows it to the
// end. The supply of videos is then the supply of systems, and this game has
// more of those than it has room to explain in a Short.
//
// A topic is a list of beats. A beat is one screen, built by `run`, opened with
// a hard cut, and then held while `lines` plays over it: each line is a caption,
// the sentence spoken under it, and how long it stays. Cutting every six seconds
// is a Shorts habit; applied to three minutes it produces something that
// flinches rather than explains. Changing the line over a held screen is how an
// explanation actually reads, and it gives the narration room to be a sentence
// instead of a slogan.
//
// 素材の入手先を「モンスターだけ」と書かないこと。gainMaterial は注文報酬からも
// 呼ばれる（play.html の注文報酬ブロック）。正しく言えるのは「クッキーでは買えない・
// クッキーに変換できない」ほうで、これは 6747 行の設計コメントと実装の両方で裏が取れる。
//
// Numbers quoted in captions are checked against the game, not remembered:
// SKILLS.length is 71, equip2Items is 486, 正 is the tenth unit above 万 so 100正
// is 10^42. Anything that cannot be checked does not go in — and neither does
// anything the screen is not currently showing, which cost this script its
// closing beat on the quota topic. See the note there.

const TAGS = ['放置ゲーム', '放置ゲーム 作り方', 'クリッカーゲーム',
  'クリッカーゲーム 作り方', 'ゲーム開発', 'ゲームデザイン', '個人開発',
  'ブラウザゲーム', 'インディーゲーム', 'クッキーストラテジャー'];

export const TOPICS = [
  {
    id: 'quota',
    title: '放置ゲームの作り方：ただ放置では伸びない「生産ノルマ」の設計',
    chapter: { n: '仕組み 01', head: '生産ノルマ', sub: '放置ゲーに締め切りをつけたらどうなるか' },
    description:
      'このゲームには生産ペースのノルマがあります。遅れるとその周回はモンスターが出なくなり、' +
      '素材が手に入らなくなります。置いておくだけでもクッキーは増えますが、' +
      '伸ばしたいなら管理が要る。その設計の話です。',
    tags: TAGS,
    thumb: { at: 'fail_0', lines: ['放置だけだと伸びない', '放置ゲーを作った'] },
    beats: [
      { id: 'intro',
        run: async s => { await s.setMidGame(); await s.showTab('shopTab'); },
        lines: [
          { hold: 7000, caption: ['放置ゲーなのに、<em>締め切り</em>があります'],
            narration: '放置クリッカーを作っています。今日は生産ノルマという仕組みの話です。' },
          { hold: 7000, caption: ['ふつうの放置ゲーは<em>置いておけば増える</em>'],
            narration: 'ふつうの放置ゲーは、置いておけば増えます。このゲームでも増えます。ただ、増えるだけでは進まないようにしてあります。' },
        ] },
      { id: 'gauge',
        run: async s => { await s.tapBurst('#cookie', 5, 300); },
        lines: [
          { hold: 7500, caption: ['画面上部の<em>モンスター生成ノルマ</em>'],
            narration: '画面の上にあるのがそのノルマです。生産量がここに書かれた数字に届いていれば進み、届いていなければ止まります。' },
          { hold: 7000, caption: ['これが進まないと<em>何も出てこない</em>'],
            narration: '止まっている間、盤面には何も出てきません。クッキーは増え続けますが、それだけです。' },
        ] },
      { id: 'buy',
        run: async s => { await s.showTab('shopTab'); await s.tapBurst('#shop .item', 6, 260); },
        lines: [
          { hold: 7000, caption: ['答えは<em>設備を買って毎秒を上げる</em>'],
            narration: '答えそのものは単純で、設備を買って毎秒の生産を上げることです。ここまでは普通の放置ゲーと変わりません。' },
          { hold: 7500, caption: ['違うのは<em>間に合わせる必要がある</em>こと'],
            narration: '違うのは、それを間に合わせる必要があることです。ノルマは進行とともに上がっていくので、放っておくと差が開きます。' },
        ] },
      // This beat used to say the lost spawns were the *only* penalty. They are
      // not: quotaFailed also switches off the shield's hold bonus
      // (equip2HoldMul) and stops quotaHold order progress (tickOrderProgress).
      // What is still true — and all this now claims — is that production keeps
      // running and nothing already earned is taken away.
      { id: 'fail',
        run: async s => { await s.ev(() => { state.quotaFailed = true; try { renderActiveTab(); } catch (e) {} }); },
        lines: [
          { hold: 7500, caption: ['間に合わないと<em>その周回は</em>', 'モンスターが出なくなります'],
            narration: '間に合わなかった場合、その周回はモンスターが出なくなります。ただ、生産そのものは止まりませんし、進行が消えることもありません。' },
          { hold: 7000, caption: ['止まるのは<em>素材の供給</em>だけ'],
            narration: '止まるのは素材の供給です。オフラインでもクッキーは貯まりますし、次の周回になればまた出てきます。' },
        ] },
      { id: 'why',
        run: async s => { await s.setMaterials(); await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); },
        lines: [
          { hold: 7500, caption: ['素材が止まる ＝ <em>装備が作れない</em>'],
            narration: 'ただ、素材が止まると装備が作れません。素材はクッキーでは買えないので、増やしたいなら盤面に出るのが基本になります。' },
          { hold: 7500, caption: ['装備が作れない → <em>次の周回が遅くなる</em>'],
            narration: '装備が揃わないと次の周回が遅くなり、その周回のノルマにも間に合いにくくなります。遅れが後ろに残る形にしてあります。' },
        ] },
      // The cooking panel would be the natural close here — it is the answer to
      // the quota — but its section switch does not respond in the wide layout
      // (see showCooking in stage.mjs), and showing the crafting list while
      // talking about cooking is the exact mismatch this script avoids. So the
      // beat closes on what is actually on screen, which is true and still lands
      // the point: the quota exists to send you out to fight.
      { id: 'close',
        run: async s => { await s.autoScroll('workshopTab', { by: 1 }, 2600); },
        lines: [
          { hold: 7500, caption: ['ノルマを追う理由は<em>素材</em>'],
            narration: 'つまりノルマを追いかける理由は、最終的には素材です。数字を伸ばすためではなく、戦うための材料を切らさないためにあります。' },
          { hold: 7500, caption: ['<em>置いておくだけでも増える</em>', 'でも伸ばすなら管理が要る'],
            narration: '置いておくだけでも増えるけれど、伸ばしたいなら管理が要る。放置ゲーとして、そのくらいの緊張感がちょうどいいと思って作りました。' },
        ] },
    ],
  },
  {
    id: 'hunt',
    title: 'クリッカーゲームの作り方：タップとボス戦を成長ループにつなぐ設計',
    chapter: { n: '仕組み 02', head: '討伐', sub: 'クリッカーにモンスターを置いた理由' },
    description:
      'クッキーモンスターを殴ると素材が落ちます。群れで来ることもあれば、ステージボスも来ます。' +
      '素材は装備の材料で、装備は次の周回を速くします。' +
      'クリッカーに戦闘を足すと何がつながるのか、という話です。',
    tags: TAGS,
    thumb: { at: 'boss_0', lines: ['クッキーをタップしてたら', 'ボスが出てきた'] },
    beats: [
      { id: 'intro',
        run: async s => { await s.setLateGame(); await s.hideRewardModal(); await s.showTab('shopTab'); await s.ev(() => { try { showMonster('normal'); } catch (e) {} state.huntFocusLv = 20; }); },
        lines: [
          { hold: 7000, caption: ['クッキーの画面に<em>モンスター</em>が出ます'],
            narration: 'クッキーをタップして増やすゲームなんですが、盤面にモンスターが出ます。今日はこれを置いた理由の話です。' },
          { hold: 7000, caption: ['クリッカーに<em>戦闘</em>を足すとどうなるか'],
            narration: 'クリッカーに戦闘を足すと、たいていは別のゲームが二つ並んでいるだけになります。そうならないようにした、という話でもあります。' },
        ] },
      { id: 'hit',
        run: async s => { await s.hitMonsters(10, 260); },
        lines: [
          { hold: 7000, caption: ['殴ると<em>素材</em>が落ちる'],
            narration: '殴ると素材が落ちます。与えるダメージは、そのままクッキーのタップ力です。別のステータスにはしていません。' },
          { hold: 7500, caption: ['タップ力＝<em>そのまま攻撃力</em>'],
            narration: 'クッキーを強くタップできる人がそのまま強い、という形にすることで、二つの遊びが一本につながります。' },
        ] },
      { id: 'swarm',
        run: async s => { await s.ev(() => { try { showMonster('swarm'); } catch (e) {} }); await s.hitMonsters(12, 200); },
        lines: [
          { hold: 7000, caption: ['<em>群れ</em>で来ることもあります'],
            narration: '群れで来ることもあります。数が増えるぶん、手の速さがそのまま結果に出ます。' },
          { hold: 7000, caption: ['数が多いほど<em>手の速さ</em>が効く'],
            narration: 'ここは自動化していません。放置で回る部分と、自分で触ったぶんだけ増える部分を分けたかったからです。' },
        ] },
      { id: 'boss',
        run: async s => { await s.ev(() => { try { showMonster('boss'); } catch (e) {} }); await s.hitMonsters(14, 220); },
        lines: [
          { hold: 7500, caption: ['ステージごとに<em>ボス</em>'],
            narration: 'ステージごとにボスがいます。HPが桁違いなので、タップの速さだけでは削り切れません。' },
          { hold: 7500, caption: ['タップだけでは<em>削り切れない</em>'],
            narration: '装備を整えて一撃を上げる必要があります。ここで工房に戻ることになります。' },
        ] },
      { id: 'craft',
        run: async s => { await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); await s.autoScroll('workshopTab', 0.3, 3000); },
        lines: [
          { hold: 7000, caption: ['素材 → <em>装備486種類</em>'],
            narration: '集めた素材から装備を作ります。レシピは486種類あります。クリッカーの数としては多いほうだと思います。' },
          { hold: 7500, caption: ['素材の<em>入手先はモンスターだけ</em>'],
            narration: '素材はクッキーで買えません。クッキーに変換することもできない別勘定なので、討伐を飛ばすと装備が止まります。' },
        ] },
      { id: 'loop',
        run: async s => { await s.autoScroll('workshopTab', { by: 1 }, 2800); },
        lines: [
          { hold: 7500, caption: ['装備が強くなる → <em>ボスが倒せる</em>'],
            narration: '装備が強くなればボスが倒せて、もっと良い素材が出ます。出た素材でまた装備を作る。' },
          { hold: 7500, caption: ['クリッカーと戦闘を<em>一本の輪にする</em>'],
            narration: 'モンスターを置いたのは、この輪を作るためです。戦闘のために戦うのではなく、クッキーを増やすために戦う形にしています。' },
        ] },
    ],
  },
  {
    id: 'prestige',
    title: '放置ゲームの転生設計：71ノードのスキルツリーと周回バランス',
    chapter: { n: '仕組み 03', head: '転生', sub: '進行を捨てて何を持ち越すのか' },
    description:
      '転生すると生産はリセットされますが、ポイントが入り、71ノードのスキルツリーに振れます。' +
      '取り方は何度でも組み直せます。周回のたびに何が変わるのか、という話です。',
    tags: TAGS,
    thumb: { at: 'tree_0', crop: null, lines: ['放置ゲーのスキルツリーが', '71ノードある'] },
    beats: [
      { id: 'intro',
        run: async s => { await s.setLateGame(); await s.showTab('shopTab'); },
        lines: [
          { hold: 7000, caption: ['<em>転生</em>＝ここまでの生産を捨てる'],
            narration: '転生という仕組みがあります。ここまで積み上げた生産を捨てて、最初からやり直します。' },
          { hold: 7500, caption: ['ジャンル外の人には<em>損に見える</em>'],
            narration: 'このジャンルを知らない人には、ただ損をしているように見えます。実際に何が残るのかを見てもらうのが今日の話です。' },
        ] },
      { id: 'points',
        run: async s => { await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); },
        lines: [
          { hold: 7000, caption: ['捨てた量に応じて<em>ポイント</em>が入る'],
            narration: '捨てた量に応じてポイントが入ります。これは周回をまたいで残る、数少ないものの一つです。' },
          { hold: 7000, caption: ['素材と装備と解放段階も<em>残ります</em>'],
            narration: '素材と装備、それとステージの解放段階も残ります。消えるのは生産まわりだけです。' },
        ] },
      { id: 'tree',
        run: async s => { await s.openTree(); },
        lines: [
          { hold: 8000, caption: ['<em>71ノード</em>のスキルツリー'],
            narration: 'ポイントの行き先がこれです。ノードは71個あります。' },
          { hold: 7500, caption: ['一周では<em>全部取れません</em>'],
            narration: '一周では全部取れません。取れる数のほうがずっと少ないので、どこに寄せるかを決めることになります。' },
        ] },
      { id: 'pan',
        run: async s => { await s.panTree(0.75, 4200); },
        lines: [
          { hold: 7500, caption: ['取る順番で<em>次の周回</em>が変わる'],
            narration: '生産に寄せるか、タップに寄せるか、素材に寄せるか。取る順番で次の周回の形が変わります。' },
          { hold: 7500, caption: ['縦に長いのは<em>枝が交わらない</em>から'],
            narration: '縦に長いのは、枝どうしを無理につなげていないからです。選んだ方向がそのまま伸びる形にしています。' },
        ] },
      { id: 'respec',
        run: async s => { await s.panTree(0.2, 3800); },
        lines: [
          { hold: 7500, caption: ['取り方は<em>何度でも組み直せます</em>'],
            narration: '組み直しは何度でもできます。取り返しのつかない選択にはしていません。' },
          { hold: 7000, caption: ['一度の選択で<em>詰みません</em>'],
            narration: '詰む可能性を残すと、調べてから遊ぶことになります。それは避けたかったので、試して戻せる形にしました。' },
        ] },
      { id: 'result',
        run: async s => { await s.closeTree(); await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); },
        lines: [
          { hold: 7500, caption: ['振った結果は<em>全部数字で見えます</em>'],
            narration: '振った結果はすべて数字で確認できます。どのノードが今いくつ効いているかが、この画面に並びます。' },
          { hold: 7500, caption: ['<em>なんとなく強くなった</em>で終わらせない'],
            narration: '周回ものは、なんとなく強くなった、で終わりがちです。そこを見せるようにしたのがこの画面です。' },
        ] },
    ],
  },
  {
    id: 'numbers',
    title: '放置ゲームの数値設計：倍率と計算式をプレイヤーに見せる方法',
    chapter: { n: '仕組み 04', head: '研究と一覧', sub: '計算式を隠さないという選択' },
    description:
      '研究を買うと生産の計算式が変わります。そして今どの倍率がいくつ乗っているのかは、' +
      'すべて一覧画面で確認できます。数字を隠さないとどうなるか、という話です。',
    tags: TAGS,
    thumb: { at: 'list_0', lines: ['効いてる倍率が', '全部見える放置ゲー'] },
    beats: [
      { id: 'intro',
        run: async s => { await s.setLateGame(); await s.showTab('shopTab'); },
        lines: [
          { hold: 7000, caption: ['放置ゲーの<em>数字</em>の話です'],
            narration: '今日は数字の話です。何をすると何倍になるのか、という部分をどう扱ったか。' },
          { hold: 7000, caption: ['何が効いているのか<em>分かりますか</em>'],
            narration: '放置ゲーを遊んでいて、いま自分の生産が何のおかげで伸びているか、はっきり言える人は少ないと思います。' },
        ] },
      { id: 'research',
        run: async s => { await s.showTab('researchTab', true); await s.waitForImages('researchTab'); },
        lines: [
          { hold: 7500, caption: ['<em>研究</em>は計算式そのものを変えます'],
            narration: '研究は、生産量を足すのではなく計算式そのものを変えます。設備の効果に係数が掛かる形です。' },
          { hold: 7000, caption: ['設備は<em>足し算</em>、研究は<em>掛け算</em>'],
            narration: '設備は足し算、研究は掛け算。だから同じコストでも、買う順番で伸び方がかなり変わります。' },
        ] },
      { id: 'scroll',
        run: async s => { await s.autoScroll('researchTab', 0.45, 3600); },
        lines: [
          { hold: 7500, caption: ['買うほど<em>係数が増える</em>'],
            narration: '買うほど係数が増えていきます。ここまでは、よくある作りだと思います。' },
          { hold: 7500, caption: ['問題は<em>それが見えないこと</em>'],
            narration: '問題はそこではなく、増えた係数がプレイヤーから見えないことです。伸びているのは分かるけれど、何のおかげかは分からない。' },
        ] },
      { id: 'list',
        run: async s => { await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); },
        lines: [
          { hold: 7500, caption: ['いま効いている倍率は<em>全部見られます</em>'],
            narration: 'なので、いま効いている倍率を全部この画面に出しました。設備、研究、装備、料理、転生。' },
          { hold: 7500, caption: ['設備・研究・装備・料理・転生'],
            narration: 'どれが何倍かかっているかが、そのまま数字で並びます。丸めていません。' },
        ] },
      { id: 'wall',
        run: async s => { await s.autoScroll('infoTab', { by: 0.7 }, 3800); },
        lines: [
          { hold: 7500, caption: ['x13351.000 / x590157.128 …'],
            narration: 'この壁のような数字が、いま自分にかかっている倍率です。見づらいとは思います。' },
          { hold: 7500, caption: ['見づらさより<em>分からなさ</em>を減らす'],
            narration: 'ただ、見づらいことより分からないことのほうが困ると考えました。' },
        ] },
      { id: 'why',
        run: async s => { await s.autoScroll('infoTab', { by: 0.7 }, 3600); },
        lines: [
          { hold: 7500, caption: ['数字が好きな人は<em>ここを読む</em>'],
            narration: '数字を見て積み上げたい人は、この画面を読んで次に何を買うか決められます。' },
          { hold: 7500, caption: ['読まなくても<em>遊べます</em>'],
            narration: '読まなくても遊べます。開かなければ存在しない画面なので、置いておくぶんには邪魔にならないはずです。' },
        ] },
    ],
  },
  {
    id: 'craft',
    title: 'クリッカーゲームの装備設計：486種類を成長ループにつなぐ方法',
    chapter: { n: '仕組み 05', head: '工房', sub: 'クリッカーに装備を置くとどうなるか' },
    description:
      '討伐で集めた素材から装備を作れます。レシピは486種類。' +
      '作った装備はタップ力と生産の両方に効きます。' +
      'クリッカーに装備を足すと何が起きるのか、という話です。',
    tags: TAGS,
    thumb: { at: 'intro_1', lines: ['クリッカーなのに', '装備が486種類'] },
    beats: [
      { id: 'intro',
        run: async s => { await s.setLateGame(); await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); },
        lines: [
          { hold: 7000, caption: ['クリッカーのはずなんですが'],
            narration: 'クッキーをタップして増やすゲームなんですが、装備があります。' },
          { hold: 7000, caption: ['<em>486種類</em>あります'],
            narration: 'レシピは486種類。武器、盾、防具、手、帽子、靴、アクセサリー。ひととおり揃っています。' },
        ] },
      { id: 'count',
        run: async s => { await s.autoScroll('workshopTab', 0.25, 3600); },
        lines: [
          { hold: 7500, caption: ['素材の<em>組み合わせ</em>で変わる'],
            narration: '素材の組み合わせでできるものが変わります。同じ枠でも、使う素材によって別のものになります。' },
          { hold: 7500, caption: ['作れるものは<em>倒した相手で決まる</em>'],
            narration: 'つまり何が作れるかは、どのモンスターを倒したかで決まります。工房だけ見ていても増えません。' },
        ] },
      { id: 'mats',
        run: async s => { await s.ev(() => { try { showMonster('swarm'); } catch (e) {} state.huntFocusLv = 20; }); await s.hitMonsters(10, 240); },
        lines: [
          { hold: 7000, caption: ['素材は<em>討伐</em>から'],
            narration: '素材はモンスターから落ちます。クッキーで買うことはできません。' },
          { hold: 7500, caption: ['買えないので<em>戦うしかない</em>'],
            narration: 'クッキーがいくらあっても素材は増えないので、装備を進めたいなら盤面に出て戦うことになります。' },
        ] },
      { id: 'make',
        run: async s => { await s.showTab('workshopTab', true); await s.waitForImages('workshopTab'); await s.autoScroll('workshopTab', { by: 1 }, 3200); },
        lines: [
          { hold: 7500, caption: ['作ると<em>タップ力と生産</em>の両方に効く'],
            narration: '作った装備はタップ力にも生産にも効きます。戦闘用と生産用に分けていません。' },
          { hold: 7500, caption: ['戦闘用と生産用に<em>分けていない</em>'],
            narration: '分けると、戦うのが好きな人と放置したい人で装備が二系統に割れます。それだと一本のゲームになりません。' },
        ] },
      { id: 'keep',
        run: async s => { await s.autoScroll('workshopTab', { by: 1 }, 3200); },
        lines: [
          { hold: 7500, caption: ['装備は<em>転生しても残ります</em>'],
            narration: '装備は転生しても残ります。生産はリセットされますが、集めたものは持ち越します。' },
          { hold: 7500, caption: ['集めたものは<em>捨てなくていい</em>'],
            narration: '周回するたびに集め直しになると、二周目で飽きます。捨てるものと残すものを分けた結果がこれです。' },
        ] },
      { id: 'why',
        run: async s => { await s.autoScroll('workshopTab', 0.5, 3200); },
        lines: [
          { hold: 7500, caption: ['素材の行き先を<em>二つ</em>用意する'],
            narration: '素材の行き先は装備だけではなく、料理もあります。こちらはノルマの進行を緩める方向に効きます。' },
          { hold: 7500, caption: ['集める理由が<em>常にある</em>状態にする'],
            narration: '行き先を二つ用意したのは、素材を集める理由が常にある状態にしたかったからです。' },
        ] },
    ],
  },
  {
    id: 'scale',
    // タイトルの形を変えた。8/3 に伸びた1本（768回）は問いかけと具体的な数字で、
    // 伸びなかった2本（各1回）はどちらも「〜を作った話」だった。1本ずつの比較なので
    // 分布の偶然かもしれないが、変える側に費用が無いので合わせる。
    // 「10の42乗まで増える」は上限があるように読めるのもやめた理由 —— 実際は
    // その先も続く。
    title: '放置ゲームの巨大数設計：兆を超える17個の単位と10の42乗',
    chapter: { n: '仕組み 06', head: '桁', sub: '兆の先に何があるのか' },
    description:
      '所持クッキーは兆をはるかに超えて伸びます。正は10の40乗、100正で10の42乗。' +
      'その先も載・極・恒河沙と続き、名前が用意してあるのは無量大数までの17個です。' +
      '桁が増え続けるゲームで何が起きるか、という話です。',
    tags: TAGS,
    thumb: { at: 'unit_0', lines: ['所持クッキー100正', '＝10の42乗'] },
    beats: [
      { id: 'intro',
        run: async s => { await s.setLateGame(); await s.showTab('shopTab'); },
        lines: [
          { hold: 7000, caption: ['所持クッキー <em>100正</em>'],
            narration: '所持クッキーが100正あります。しょう、という単位です。読める人は少ないと思います。' },
          { hold: 7000, caption: ['読める人は<em>少ない</em>と思います'],
            narration: '放置ゲーの数字が大きくなること自体は珍しくないんですが、どこまで行くのかという話をします。' },
        ] },
      { id: 'unit',
        run: async s => { await s.tapBurst('#cookie', 6, 300); },
        lines: [
          { hold: 7500, caption: ['正 ＝ 10の<em>40</em>乗'],
            narration: 'しょうは10の40乗です。100しょうなので、10の42乗になります。' },
          { hold: 7500, caption: ['兆は10の12乗 → <em>30桁上</em>'],
            narration: '兆が10の12乗なので、そこからさらに30桁上ということになります。' },
        ] },
      { id: 'ladder',
        run: async s => { await s.showTab('infoTab', true); await s.scrollToHeading('infoTab', '現在の倍率・状態'); },
        lines: [
          { hold: 7500, caption: ['万 → 億 → 兆 → 京 → 垓 → …'],
            narration: '万、億、兆、京、垓、と続いて、十番目がしょうです。' },
          // 「使い切ることはまずない」と言っていたが、これは裏が取れていなかった。
          // play.html の JAPANESE_NUMBER_UNITS は無量大数（10の68乗）で終わり、
          // その先は generateHugeUnit が桁名をその場で作る。使い切る前提のコードが
          // 書いてある以上、使い切らないとは言えない。数えられる事実に差し替えた。
          { hold: 7500, caption: ['名前があるのは <em>無量大数</em> まで — 17個'],
            narration: 'その先も、さい、ごく、こうがしゃ。名前が用意してあるのは無量大数までの17個です。' },
        ] },
      { id: 'why',
        run: async s => { await s.autoScroll('infoTab', { by: 0.7 }, 3600); },
        lines: [
          { hold: 7500, caption: ['桁が増えるのは<em>掛け算が積み重なる</em>から'],
            narration: 'ここまで伸びるのは、設備と研究と装備と転生の倍率が全部掛け算で乗るからです。' },
          { hold: 7500, caption: ['足し算なら<em>ここまで来ません</em>'],
            narration: '足し算で積んでいたら、この桁には届きません。掛け算にした時点で、単位の側を用意する必要が出ました。' },
        ] },
      { id: 'rewind',
        run: async s => { await s.setFresh(); await s.tapBurst('#cookie', 6, 280); },
        lines: [
          { hold: 7000, caption: ['最初は<em>クッキー25枚</em>'],
            narration: '最初はクッキー25枚から始まります。同じ画面です。' },
          { hold: 7000, caption: ['同じ画面、同じ場所の数字'],
            narration: '数字の位置も同じです。変わっているのは桁だけ。' },
        ] },
      { id: 'back',
        run: async s => { await s.setLateGame(); },
        lines: [
          { hold: 7500, caption: ['ここから <em>10の42乗</em> まで'],
            narration: 'ここから10の42乗まで持っていく、というのがこのゲームの全体像です。' },
          { hold: 7500, caption: ['桁が増えること自体を<em>見せたい</em>'],
            narration: '桁が増えていくこと自体が気持ちいいと思っているので、そこを隠さず出すようにしています。' },
        ] },
    ],
  },
];

export const byId = id => TOPICS.find(t => t.id === id);
export const MARK = id => `#topic-${id}`;
