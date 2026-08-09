// The different cuts of the promo.
//
// Posting the same 44 seconds every day is a re-upload, and YouTube treats near
// duplicates as such. Each variant opens on a different screen with a different
// claim, and carries its own title and description — the opening seconds and the
// title are what decide whether a Short gets watched, so those are what vary.
//
// The body of the video (rewind → ノルマ → 討伐 → 工房 → 研究/一覧 → 転生 → CTA)
// is the same in every cut. It is the part that has been tuned; the hook is the
// part worth testing.
//
// `id` is stable and appears in the description as `#cut-<id>`, which is how
// autopost.mjs matches a published video back to the cut that produced it.

// Numbers that may be said out loud, with what they actually count. Anything not
// on this list has not been checked, and an array length is not automatically the
// number a player would see — STAGES has five entries but the game has six
// stages, because the last one is built outside the array. The full derivation is
// in youtube/JOURNAL.md ("言い切れる数字の確定表").
//
//   71   skill tree nodes            486  equipment recipes
//   21   research items (13 go to a third stage)
//   26   materials                   7    dishes
//   6    stages — the sixth, 深層領域, keeps going in layers
//   10^42 = 100正
const TAGS = ['Shorts', '放置ゲーム', 'クリッカー', 'インクリメンタル',
  '個人開発', 'インディーゲーム', 'Androidゲーム', 'クッキーストラテジャー'];

/**
 * The browser build. Free, no install, and it runs on the phone the viewer is
 * already holding — which is the whole reason it leads.
 */
const PLAY_URL = 'https://cookiestrateger.com/play.html';

/**
 * The call to action every description carries.
 *
 * The browser link goes first, and that ordering is the point. Measured
 * 2026-08-08: 2,435 lifetime views, 1 subscriber. Every description asked for
 * a 14-day Android closed test — three steps, an install, and a fortnight of
 * commitment — off a 13-second Short. The note below correctly observed that
 * most Shorts viewers are on a phone that cannot take part; the response was to
 * tell them so sooner. Telling half the audience "not you" faster is not a
 * funnel. They now get the thing they can actually do, in one tap, first.
 *
 * Two things this has to get right, because the video makes promises the
 * description has to keep:
 *
 *   * The terms must match what the channel actually asks of testers — 14 days
 *     installed *and* launching it now and then. Stating something lighter here
 *     than the channel states elsewhere means whoever shows up was told a
 *     different deal than the one waiting for them.
 *   * Most Shorts viewers are on a phone that cannot take part at all. Saying
 *     "Android" is not the same as saying "not iPhone"; the second one is what
 *     stops someone spending a tap finding out — and it must hand them the
 *     browser build in the same breath, or it is just a dead end stated early.
 *
 * Step ① is not decoration. Play's opt-in page turns away anyone who is not
 * already in the group, and that rejection reads like the test being closed.
 *
 * The URLs are here to be read and copied, not tapped. Until the channel earns
 * advanced features, YouTube renders external links in a description as plain
 * text — which is why the video sends people to the channel page, where the
 * links section is real buttons. Saying so here costs one line and saves the
 * viewer who taps a URL, gets nothing, and concludes the test is closed.
 */
const cta = ({ groupUrl, optInUrl, contact }) => `
▶ ブラウザ版をいますぐ無料で遊べます（インストール不要・iPhone でも遊べます）
${PLAY_URL}

■ テスターを募集しています（Android専用・無料）

※ 下のURLがタップできない場合は、チャンネルの概要欄にリンクがあります。

Google Play で公開するのに、14日間のクローズドテストが必要です。
その期間つきあってくださる方を探しています。
※ テストへの参加は Android 端末のみです。iPhone / iPad の方は上のブラウザ版をどうぞ。

【お願いすること】
・14日間、アンインストールせずに置いておく
・ときどき起動して遊ぶ
・不具合や気になった点があれば教えてください

【参加手順】※ ①を飛ばすと②で弾かれます
① テスターグループに参加する
${groupUrl}
② 「テストに参加」を押す
${optInUrl}
③ 表示されたリンクからインストール

${contact ? `うまくいかないときは ${contact} まで。` : 'うまくいかないときはコメントで教えてください。'}`;

export const VARIANTS = [
  {
    id: 'unit',
    hook: {
      screen: 'play',
      banner: '“正”って単位、知ってます?',
      caption: ['所持クッキー <em>100正</em>', '= 10の<em>42</em>乗'],
      narration: 'しょうって単位、知ってます?',
      taps: true,
      // No ring here. #cookies stretches the full width, so the box reads as a
      // frame rather than a pointer — and the number it would point at is
      // already the largest thing on screen. Ringing what already dominates adds
      // nothing; the tool is for evidence that is small and missed.
    },
    title: '“正”って単位、知ってますか【10の42乗】',
    description: `放置クリッカーの所持数が、兆のはるか上まで来ました。`,
    tags: TAGS,
  },
  {
    id: 'idle-trap',
    hook: {
      screen: 'quota',
      banner: '放置ゲーの話です',
      caption: ['<em>放置だけだと伸びない</em>放置ゲー'],
      narration: '放置だけだと伸びない放置ゲーを作りました。',
      taps: false,
      // 「放置だけだと伸びない」の理由はノルマ。帯を指しておく。
      spot: '#quotaBox',
    },
    title: '“ただ放置”だと伸びない放置ゲーを作った',
    description: `生産ペースにノルマがあって、遅れるとその周回はモンスターが出なくなります。置いておくだけでも増えますが、伸ばしたいなら管理が要ります。`,
    tags: TAGS,
  },
  {
    id: 'recipes',
    hook: {
      screen: 'craft',
      banner: 'クリッカーのはずなんですが',
      caption: ['装備のレシピが<em>486種類</em>あります'],
      narration: 'クリッカーなのに、装備のレシピが486種類あります。',
      taps: false,
    },
    title: 'クッキーをタップするゲームに装備が486種類ある',
    description: `モンスターを倒して素材を集め、装備を作れます。レシピは486種類。料理もあります。`,
    tags: TAGS,
  },
  {
    id: 'boss',
    hook: {
      screen: 'hunt',
      banner: 'クッキーの画面です',
      caption: ['<em>ボス</em>が出てきます'],
      narration: 'クッキーをタップするゲームに、ボスが出てきます。',
      taps: false,
    },
    title: 'クッキーをタップしてたらボスが出てきた',
    description: `クッキーモンスターを倒すと素材が落ちます。群れで来ることもあれば、ステージボスも来ます。`,
    tags: TAGS,
  },
  {
    id: 'tree',
    hook: {
      screen: 'tree',
      banner: '放置ゲーのスキルツリーです',
      caption: ['ノードは<em>71個</em>', '取る順番で次の周回が変わる'],
      narration: '放置ゲーのスキルツリーです。ノードは71個。',
      taps: false,
    },
    title: '放置ゲーのスキルツリーが71ノードある',
    description: `転生するとポイントが入り、71ノードのスキルツリーに振れます。取り方は何度でも組み直せます。`,
    tags: TAGS,
  },
  {
    id: 'numbers',
    hook: {
      screen: 'info',
      banner: '数字が好きな人向け',
      caption: ['効いてる倍率が<em>全部見られる</em>'],
      narration: '効いている倍率が、全部この画面で見られます。',
      taps: false,
    },
    title: '効いてる倍率が全部見える放置ゲー',
    description: `研究を買うと生産の計算式が変わります。今どの倍率がいくつ乗っているのかは、すべて一覧画面で確認できます。`,
    tags: TAGS,
  },
  // Added 2026-08-04. The six cuts above were nearly exhausted — five were live
  // or scheduled — and once the picker runs out of untried angles it starts
  // repeating them, which is a re-upload. Throughput is bounded by how many
  // distinct openings exist, so this is where it gets raised.
  //
  // Both claims below were checked in play.html itself, not in its comments:
  // the prestige reset copies s.materials / s.equipment / s.skills across from
  // the current save, and materials never change hands for cookies (they are a
  // separate currency by design). Note what is NOT said — "materials only come
  // from monsters" is false, because the order board grants them too.
  {
    id: 'keep',
    hook: {
      screen: 'craft',
      banner: '転生で消えないもの',
      caption: ['生産はリセットされます', 'でも<em>装備と素材は残る</em>'],
      narration: '転生すると生産は消えますが、装備と素材は残ります。',
      taps: false,
    },
    title: '転生しても消えないものを作った放置ゲー',
    description: `転生すると生産まわりはリセットされますが、集めた素材と作った装備、スキルツリーは持ち越します。周回のたびに集め直しになると二周目で飽きるので、捨てるものと残すものを分けています。`,
    tags: TAGS,
  },
  {
    id: 'nobuy',
    hook: {
      screen: 'craft',
      banner: 'クッキーで買えないもの',
      caption: ['クッキーがいくらあっても', '<em>素材は買えません</em>'],
      narration: 'クッキーがいくらあっても、素材は買えません。',
      taps: false,
    },
    title: 'クッキーが何十桁あっても買えないものがある放置ゲー',
    description: `素材はクッキーで買えず、クッキーに変換することもできない別勘定の資源です。だから数字がいくら伸びても、装備を進めたいなら盤面に出ることになります。`,
    tags: TAGS,
  },
  // The stage count is the one number on the verified list with a condition
  // attached, and the condition is the interesting part: STAGES holds five
  // entries, MAX_STAGE_NO is six, and the sixth — 深層領域 — is assembled outside
  // the array and keeps going in layers (play.html:6816, and 6773 calls it the
  // infinite stage). So neither "five stages" nor "endless stages" is true, and
  // the accurate sentence happens to be the better hook.
  {
    id: 'endless',
    hook: {
      screen: 'play',
      banner: 'ステージは6つ',
      caption: ['最後のひとつだけ', '<em>層</em>が続いていきます'],
      narration: 'ステージは6つ。最後のひとつだけ、層が続きます。',
      taps: true,
      // The claim's evidence is the layer counter, which the game draws small at
      // the right end of the quota bar. Ring it so the sentence and the screen
      // are pointing at the same thing.
      spot: '.quotaStageBadge',
    },
    title: '放置ゲーのステージを6つにして、最後だけ終わらなくした',
    description: `ステージは6つ。最後の「深層領域」は層が続いていく作りで、深く届くほど研究の効果が強くなります。`,
    tags: TAGS,
  },
  {
    id: 'beyond',
    // The one cut that has ever been distributed asked whether you know 正.
    // Nobody can place 正, but everybody has heard 無量大数 — and almost nobody
    // knows it is the last one. That makes the same move with a bigger handle.
    hook: {
      screen: 'play',
      banner: '“無量大数”の上、あります?',
      caption: ['日本語の数の単位は<em>17個</em>', '<em>無量大数</em>が最後です'],
      narration: 'むりょうたいすうの上って、あると思います?',
      taps: true,
    },
    // Verified by running play.html's own generateHugeUnit() rather than by
    // counting the array: JAPANESE_NUMBER_UNITS holds 17 named units (万 through
    // 無量大数, plus one empty entry for the ones place), 無量大数 is 10^68, and
    // level 18 — 10^72 — comes back as 火炉, a name the game composed.
    body: 'beyond',
    // Mirrors the one title that has been distributed —— 「“正”って単位、知って
    // ますか【10の42乗】」 —— down to the concrete exponent in the brackets. If
    // the hook form is what carried it, this is the closest thing to a repeat;
    // if it is not, keeping everything else the same is what makes that visible.
    title: '“無量大数”の上、知ってますか【10の68乗】',
    description: `日本語の数の単位は万から無量大数までの17個で、無量大数が10の68乗です。放置クリッカーの所持数はその先まで行くので、単位の名前をゲーム側で組み立てています。10の72乗は「火炉」でした。華厳経に出てくる無辺・不可説不可説転などの大数も、本来の桁の位置にだけ入るようにしてあります。`,
    tags: TAGS,
  },
  {
    id: 'prestige',
    // Same shape as the one cut that has been distributed: a question whose
    // answer the viewer cannot guess, answered by a number the screen is already
    // showing. 転生 is the loop the whole game is built around, and its price is
    // the one number a player meets on day one.
    hook: {
      screen: 'prestige',
      banner: '転生1回目、いくらだと思います?',
      // Up at the top, or it lands squarely on the line that answers the
      // question — the game's own 「転生で所持クッキー 500万 を消費」 row, which is
      // the whole reason this cut opens on this screen.
      bannerPos: 'hi',
      caption: ['転生に必要なクッキー'],
      narration: '転生1回目って、クッキー何枚だと思います?',
      taps: false,
    },
    // Checked by reading play.html's PRESTIGE_COST_TABLE, not from memory: 116
    // entries, [0] = 5,000,000 and [115] = 1e131. Past the table the cost keeps
    // extending three digits a run (capped at 10^300), so there is no cap on the
    // number of runs — which is why nothing here says "116回まで". Both prices
    // are printed on the prestige screen the shot is pointing at.
    body: 'prestige',
    title: '転生1回目のねだん、当てられますか【放置ゲー】',
    description: `転生に要るクッキーは周回が進むほど上がります。1回目は500万、116回目は10の131乗。その先も上がり続ける作りです。`,
    tags: TAGS,
  },
  // Added 2026-08-05, because the eleven cuts above were all spent — every one
  // of them live or scheduled — and reservations were down to 2.1 days. The
  // count of distinct openings is what bounds throughput, and the view data says
  // throughput is the binding constraint right now: seven Shorts, five in three
  // digits, the last three consecutive ones all landing.
  {
    id: 'order',
    // Every other cut says something about scale — how many nodes, how large a
    // number, how many recipes. This one says the opposite thing, and it is the
    // only claim in the set that contradicts what "放置ゲー" promises: there is a
    // clock, and it does not wait. Contradiction is a stronger opening than
    // another count would be, and the screen states the terms itself.
    hook: {
      screen: 'order',
      banner: '放置ゲーなんですが',
      caption: ['依頼に<em>制限時間</em>があります', '<em>選び直しは不可</em>'],
      narration: '放置ゲーなんですが、制限時間のある依頼が来ます。',
      taps: false,
      // The countdown is the evidence and the game draws it as a thin bar in the
      // middle of the card, which is exactly the size of thing __spot is for.
      spot: '.orderTimeBar',
    },
    // Read out of play.html rather than remembered: renderOrder() prints
    // 「依頼が1件ずつ届く。制限時間内に達成で報酬。時間切れは次へ、選び直し不可。」
    // above the card, ORDER_DEFS holds seven kinds, v4 §19 removed the reroll,
    // and 制限時間 = 240+4×√総プレイ秒. Note what is NOT claimed: nothing here
    // says orders are the only way to get materials, because the monsters drop
    // them too.
    title: '放置ゲーに制限時間のある依頼を入れた【選び直し不可】',
    description: `注文ボードには依頼が1件ずつ届きます。制限時間内に達成すれば報酬、時間切れならそのまま次の依頼へ。選び直しはできません。依頼は7種類で、内容は倒す・タップする・設備を増やす・ノルマを維持するなど、ふだんの遊び方に重なるものです。`,
    tags: TAGS,
  },
  {
    id: 'quest',
    // The two videos that have travelled furthest on this channel (744 and 298)
    // are the same move: ask something the viewer cannot guess, and answer it
    // with a number the screen is already displaying. Both used magnitude units.
    // This applies the form to material that is not a unit at all, which is the
    // point -- if the form is what carries, it should carry here too, and if it
    // only worked because 正 and 無量大数 are inherently interesting, that shows up
    // as a miss. Either answer is worth more than a third unit cut.
    hook: {
      screen: 'quest',
      banner: '次のステージ、何体だと思います?',
      caption: ['<em>205体</em>倒すと', '次のステージが開きます'],
      narration: '次のステージって、モンスター何体倒すと開くと思います?',
      taps: false,
      // The quest box is the second .orderBoardBox on the page; the first is the
      // timed-request half, which this cut is not about.
      spot: '.orderBoardBox:nth-of-type(2)',
    },
    // QUEST_KILLS_NEED = [205, 190, 250, 350, 410] in play.html, so 205 is the
    // first stage's requirement and the counts do not simply climb -- stage 2
    // asks for fewer. The board prints the whole sentence itself, stage names
    // included: 「バター草原」でモンスターを 205 体討伐(0/205) → 「チョコレート火山」解放.
    // Note what is NOT claimed: nothing about the sixth stage, whose layers do
    // not work this way.
    title: '次のステージ、何体倒すと開くと思いますか【放置ゲー】',
    description: `ステージはクエストで開きます。最初は「バター草原」でモンスターを205体。次からは190体、250体、350体、410体と、まっすぐには増えません。倒した数は転生をまたいで積み上がるので、周回の途中で止まっても消えません。`,
    tags: TAGS,
  },
  {
    id: 'facilities',
    // Question form, because the split is no longer subtle: the three question
    // hooks sit at 740 / 287 / 237 and the nine statement hooks at 126-193
    // (order 193 and costs 144 came in on 8/9 and landed in that band again).
    // Roughly double, on n=3 against n=9 -- and doubling per-video views raises
    // the growth rate rather than just the total, which is what instruction 1
    // asks for. New cuts use the question form until that stops holding.
    hook: {
      screen: 'shop',
      banner: 'クッキーを焼く設備、最後は何?',
      caption: ['<em>反物質オーブン</em>', '設備は<em>16種類</em>あります'],
      narration: 'クッキーを焼く設備、最後は何だと思います?',
      taps: false,
    },
    // UPGRADES holds 16, read out of play.html: 強い指 → おばあちゃん → オーブン →
    // 工場 → クッキー銀行 → 香料棚 → 異世界クッキー炉 → 月面ベーカリー → 時空オーブン
    // → 銀河工場 → ブラックホールミキサー → 宇宙焼成炉 → 神の指 → クッキー特異点 →
    // 量子ベーカリー → 反物質オーブン. The shot scrolls to the last row so the
    // answer is on screen, and the director refuses to post if it is not.
    title: 'クッキーを焼く設備、最後は何だと思いますか【放置ゲー】',
    description: `設備は16種類あります。強い指、おばあちゃん、オーブン、工場……と増えていって、最後は反物質オーブンです。どれも買うほど安くならないので、どこで次の段に移るかを選ぶことになります。`,
    tags: TAGS,
  },
  // Added 2026-08-09. quest came in at 228 — the question form applied to a
  // subject that is not a magnitude unit — which settles what prestige only
  // suggested: the form carries, not the subject.
  //
  //   問い     740 / 287 / 236 / 228
  //   言い切り 126 〜 193（9本）
  //
  // So every cut below is a question, and `layers` deliberately re-asks the
  // subject `endless` already covered in statement form (127). Same claim, same
  // screen, different hook shape: the one comparison in this whole set where
  // only the form moves.
  {
    id: 'formula',
    // The untried combination the retention data pointed at. `numbers` opens on
    // this same screen with a statement hook — 「効いてる倍率が全部見られる」 —
    // and holds 84.3% of a 14s watch, the highest on the channel, for 184 views.
    // Highest retention, near-bottom reach. If the first second is what decides
    // distribution, then this subject has been carrying a hook that never
    // stopped anyone, and the question form is exactly what is missing from it.
    //
    // Deliberately the same screen as `numbers`, not a new one. Holding the
    // subject fixed is what makes the comparison mean anything -- the same test
    // `layers` was meant to be before its evidence turned out not to render.
    hook: {
      screen: 'info',
      banner: '生産の式、見せてもらえます?',
      caption: ['効いている倍率が', '<em>全部この画面に出ます</em>'],
      narration: '放置ゲーの生産の式って、見せてもらえると思います?',
      taps: false,
      expect: { text: '現在の倍率', root: '#infoPanel' },
    },
    title: '放置ゲーの生産の式、全部見せてもらえると思いますか',
    description: `研究や設備を買うと生産の計算式そのものが変わります。いまどの倍率が何倍で乗っているのかは、隠さず一覧画面に全部出しています。何を買えば伸びるのかを推測ではなく確認して決められるようにしたかったからです。`,
    tags: TAGS,
  },
  {
    id: 'restart',
    hook: {
      screen: 'skill',
      skillId: 'start_2',
      banner: '転生したらゼロからだと思います?',
      caption: ['スキルを取ると', '<em>1475万</em>から始まります'],
      narration: '転生したら、クッキーはゼロからだと思います?',
      taps: false,
      // The node writes it out: 「転生後 計1475万クッキーで開始、放置上限+4時間。」
      expect: { text: '1475万クッキーで開始', root: '#skillChoiceScreen' },
    },
    title: '転生したらゼロからだと思いますか【放置ゲー】',
    description: `転生すると生産はリセットされますが、スキル「帰還神殿」を取ると次の周回を1475万クッキーから始められます。周回のたびに序盤をやり直す時間が短くなっていく作りです。`,
    tags: TAGS,
  },
  {
    id: 'stages',
    hook: {
      screen: 'research',
      banner: '研究って買ったら終わり?',
      // 段階3 was in this line and had to come out: the frame shows 段階2 rows
      // (銀行クリック配当 段階2, 工場ネットワーク 段階2) and no 段階3 card at all,
      // so saying both asserted something the picture does not carry. It stays
      // in the description, where it is explained rather than pointed at.
      //
      // The abort did not catch this, and that is the lesson: expect declared
      // 段階2 while the caption claimed more. **expect has to cover everything
      // the caption asserts**, or the check guards a subset and passes a take
      // that overstates.
      caption: ['スキルを取ると', '<em>段階2</em>が出てきます'],
      narration: '放置ゲーの研究って、買ったら終わりだと思います?',
      taps: false,
      expect: { text: '段階2', root: '#research' },
    },
    // RESEARCH の13件が s2/s3 を持つ。画面に出るのは購入カードの「段階2」なので、
    // 数は説明欄に置き、テロップは画面が出している語だけにしてある。
    title: '研究って買ったら終わりだと思いますか【放置ゲー】',
    description: `研究は買って終わりではありません。対応するスキルを取ると段階2、さらに段階3の購入カードが出てきて、同じ研究の効果が作り変わります。21種類のうち13種類が段階3まで伸びます。`,
    tags: TAGS,
  },
  // `layers` belongs here and is still not shipped. It would be the one
  // comparison where only the hook shape moves — `endless` made this same claim
  // in statement form and took 127 — so it is worth getting right rather than
  // forcing.
  //
  // Three refusals so far, all from mustSee, all correct:
  //   play  + root .quotaStageBadge  → その文が画面のどこにも無い
  //   play  + root body              → 画面外 y=0（DOM にはあるがサイズ0）
  //   board + root #quotaBox,.quotaStageBadge → その文が画面のどこにも無い
  //
  // The badge IS drawn in other takes (it reads 第52層 in the `facilities`
  // frame), so the question is what actually renders it — a tick, a different
  // container, or text split across nodes that a leaf-only regex cannot match.
  // **Probe that before writing another variant.** Do not reach the shipped
  // state by relaxing the check; the check has been right every time.
  {
    id: 'offline',
    // The question form is now three for three at the top of the channel --
    // unit 740, beyond 287, prestige 237 -- against a ~170 baseline for the
    // statement-form cuts. prestige is the one that matters most here, because
    // its subject is not a magnitude unit, so the form carries on its own.
    //
    // This asks about the one number every idle game has and nobody expects to
    // be zero: the offline cap. The honest answer is that there isn't one, which
    // is a better payoff than any figure would be.
    hook: {
      screen: 'skill',
      banner: '放置ゲーの放置上限、何時間?',
      caption: ['<em>上限そのものを</em>', '<em>撤廃できます</em>'],
      narration: '放置ゲーの放置上限って、何時間あると思います?',
      taps: false,
    },
    // Not a number pulled from a constant: OFFLINE_LIMIT_SECONDS and the
    // offlineHours skills only matter while a cap exists, and the 終わらぬ焼窯
    // node removes the branch entirely (play.html:16963 -- with it, the elapsed
    // time is used unclamped). The node states this itself in the words the
    // frame shows: 「放置生産の時間上限を撤廃。」
    title: '放置ゲーの放置上限、何時間だと思いますか',
    description: `放置生産には時間の上限があって、スキルで伸ばせます。さらに「終わらぬ焼窯」を取ると上限そのものが無くなり、離れていた時間がそのまま生産になります。どこまで伸ばすかを取り方で決められるようにしています。`,
    tags: TAGS,
  },
  {
    id: 'cook',
    // Same shape as the two cuts in the "a clicker should not have this" family
    // that both landed -- ボスが出てきた (175) and 装備が486種類 (165). Seven is a
    // small number and it is deliberately not the hook: nobody is surprised by
    // seven, they are surprised that a cookie-tapping game has a kitchen at all.
    hook: {
      screen: 'cook',
      banner: 'クッキーをタップするゲームです',
      caption: ['<em>料理</em>が作れます'],
      narration: 'クッキーをタップするゲームで、料理が作れます。',
      taps: false,
    },
    // DISHES holds 7 entries (butterCookie 〜 voidTart), read out of play.html
    // rather than counted on screen -- the array length and the on-screen count
    // have disagreed before. The count stays in the description because the
    // frame shows six of the seven.
    //
    // The rest of the description quotes the panel's own words rather than
    // paraphrasing: it heads the section 「料理(時限バフ・最大3品)」 and prints
    // 効果時間 600秒 on every card.
    title: 'クッキーをタップするゲームで料理が作れる',
    description: `工房では装備のほかに料理も作れます。素材を使って7種類、同時に持てるのは3品まで、効果時間は600秒です。全生産アップ、金クッキーが出やすくなる、モンスターが出やすくなるなど、狙いに合わせて選ぶ作りにしています。`,
    tags: TAGS,
  },
  {
    id: 'costs',
    // This started out as 「研究を21種類作りました」 and the frame killed it. RESEARCH
    // holds 21 entries, but the 研究タブ is not a list of them: it is a shop, and
    // by late game the bought ones are gone and what remains is 熟練I/II cards,
    // 段階2 cards and 深層踏破 — dozens of differently-named rows. Saying "21種類"
    // over that picture is the EQUIPMENT=7 mistake again (array length read as
    // an on-screen count), and it only surfaced because the frame was opened.
    //
    // What the frame does show, in one screenful, is the price column climbing
    // 64兆 → 165兆 → 9800兆 → 7.6京 → 455京 → 1.05垓 → 4150垓. That is the same
    // material as the cut that has travelled furthest on this channel (正/10の42乗,
    // 744回) — Japanese magnitude units nobody can place — except here the units
    // are attached to something the viewer is being asked to afford.
    hook: {
      screen: 'research',
      banner: '研究の値段です',
      caption: ['<em>兆 → 京 → 垓</em>', '買うほど単位が上がります'],
      narration: '放置ゲーの研究の値段です。買うほど、単位のほうが上がっていきます。',
      taps: false,
    },
    title: '放置ゲーの研究、値段が兆から垓まで上がる',
    description: `研究を買うと生産の計算式が変わります。安いものから順に並ぶので、進めるほど値段の単位のほうが先に上がっていきます。兆、京、垓、その先も続きます。`,
    tags: TAGS,
  },
];

export const byId = id => VARIANTS.find(v => v.id === id);
export const MARK = id => `#cut-${id}`;

/**
 * The description a published video carries: the cut's own line, then the
 * recruitment block. Kept out of the variant literals so there is exactly one
 * copy of the terms — six copies drift, and a drifted copy is a viewer being
 * told the wrong deal.
 */
export const describe = (cut, links) => `${cut.description.trim()}
${cta(links)}`;
