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
 * 「また来て」の一行。**説明欄と、既存の本への追記と、両方がこれを使う。**
 *
 * 2026-08-11 に足した。それまで**20本のあいだ、どこにも登録の依頼が無かった**
 * （`grep -rn 'チャンネル登録' promo/` が0件）。そのあいだの登録者は**生涯1**。
 * 台帳「戻ってくる理由」には「続きもの」と「固定コメント」が並んでいて、
 * **いちばん安い形＝ただ頼む、が項目になっていなかった。**
 *
 * `SUB_CTA_MARK` は追記済みかを見分けるための部分文字列。**文面を変えるときは
 * マークが前の文面にも一致するかを考えること** ——— 一致しなくなると、
 * `yt.mjs subcta` が同じ本にもう一行足す。
 *
 * 頻度は約束しない。「毎日出します」は自動実行が止まった日に嘘になり、
 * 動画の説明欄はそのとき誰も直しに来ない（指示11）。
 */
export const SUB_CTA_MARK = 'チャンネル登録';
export const SUB_CTA_LINE =
  '■ このゲームの答え合わせを1本ずつ投稿中。次の問題を逃さないようチャンネル登録。';

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
${SUB_CTA_LINE}
■ この問題、答えられましたか？「当たった」「外れた」をコメントで教えてください。
■ 次に見たい仕組みもコメントへ。

▶ ブラウザ版をいますぐ無料で遊べます（インストール不要・iPhoneでも可）
${PLAY_URL}

■ Androidテスト参加
① テスターグループ: ${groupUrl}
② テスト参加: ${optInUrl}
${contact ? `問い合わせ: ${contact}` : ''}
`;

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
    // **【】の中を 42→40 に直した**（2026-08-11）。`正` は
    // `JAPANESE_NUMBER_UNITS` の 10番目 ＝ **10の40乗**で、10の42乗なのは
    // キャプションが言っている **100正**のほう。題が「“正”って単位」と聞いて
    // すぐ【10の42乗】と続くので、**正 の値としてそう読める。**
    // キャプション（100正 = 10の42乗）は最初から正しく、**短い題に写すときだけ
    // 「100」が落ちていた** —— `record` の「25体ごと」とまったく同じ経路
    // （短く言い直すときに事実が落ちる）。指示11。
    // **既に予約に入っていた `fzsGXeZ0LJc`（8/12 21:30）は `yt.mjs retitle` で直した。**
    title: '“正”って単位、知ってますか【10の40乗】',
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
      // 2026-08-10 夕、外部レビュアーに2つ同時に指摘されて書き換えた。
      // 元は ['日本語の数の単位は<em>17個</em>', '<em>無量大数</em>が最後です']。
      //
      // (1) **指示11 —— 画面に映っていないものを語っていた。** 掴みの画面に
      //     出ているのは所持数の「100.003正」だけで、17個の一覧も無量大数も
      //     どこにも無い。テロップだけが自己申告していた。
      // (2) **問いを自分で閉じていた。** 帯が「上、あります?」と聞いて、
      //     その下のキャプションが「無量大数が最後です」＝「上は無い」と答える。
      //     本当の答え（火炉＝10の72乗）は9秒後にしか来ないので、
      //     視聴者は途中で誤った答えを渡されたうえに待たされる。
      //
      // 直しは「問いを重ねるだけで、何も主張しない」形。断定していないので
      // 画面と食い違いようがなく、答えは本体（1無量大数 → 1火炉）に残る。
      caption: ['日本語の単位で<em>いちばん大きい</em>のは?'],
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
    // 2026-08-11 新設。**題材は beyond と同じ（単位）。変えたのは掴みの形だけ。**
    // RUNBOOK 3-2「2回続けて落ちたら捨てるのは形のほう。題材は残して、
    // 掴みを別の形にしてもう一度出す」に当たる1本目です。
    // beyond は298再生でチャンネル2位、unit は740で1位 —— 題材は実測で強い。
    // 落ちていたのは掴みで、5人のレビュアーが独立に同じ直しを書きました:
    // 「豆粒カウンターを画面中央の巨大表示に変え、単位名がその場で
    //   書き換わるのを0秒から撮れ。クッキーの絵は捨ててよい」。
    // それを `hook.reveal: { act:'counter' }` として実装したのがこの切り口。
    id: 'unitmake',
    hook: {
      screen: 'play',
      // 帯は問いだけ。**何も主張しないので画面と食い違いようがない**
      // （beyond で踏んだ「テロップだけが自己申告する」を避ける）。
      banner: '日本語の単位が<em>尽きた</em>先は?',
      // 答えはキャプションではなく**カウンターの文字そのもの**が出します。
      // capAt(1500) で出るこの2行は、0.8秒に画面で起きたことの言い直し。
      caption: ['単位の名前を', 'ゲームが<em>作ります</em>'],
      narration: '日本語の単位が尽きた先って、どうなると思います?',
      // 上端2%の豆粒をやめて、画面中央の巨大表示にする。
      // 帯は hi(11%)、カウンターは 24%、キャプションは下端 —— 3つが縦に並ぶ。
      bannerPos: 'hi',
      // 10^68 も 10^72 も level 境界ちょうどなので、**数字は 1.00000 のまま**で
      // 単位名だけが書き換わる（fmtCookieCount の decimals=5 の枝）。
      // 無量大数 = JAPANESE_NUMBER_UNITS の最後(level 17)、
      // level 18 = 10^72 を generateHugeUnit() が「火炉」と組み立てる。
      reveal: { act: 'counter', at: '1e68', next: '1e72', from: '無量大数', to: '火炉' },
      // 共通スクロールは流さない。出来事は reveal のほうで起きる。
      motion: 'reveal',
      // 証拠は掴みの中に在る。カウンターは #cookies にしかないので root を絞る
      // ——— body に 'ク' が入る他の文言と取り違えない。
      expect: { text: '火炉', root: '#cookies' },
    },
    // **最初は `scale` にしていた。外部レビュアーに矛盾を見つけられて変えた**
    // （2026-08-11、1本目の講評）。理由は「掴みで 10^72 まで見せたあと、
    // 本体の目玉が 100正 ＝ 10の42乗。**尽きた先と言いながら、尽きる前の単位を
    // 後から自慢している**」。数の分かる人ほど話が後退して見える、と。
    // **これは好みではなく整合の誤りなので直した**（指示11 の隣）。
    // `beyond` は掴みと同じ書き換えを繰り返す弱さがあるが、
    // **下がって見えるより、同じ話を数で裏づけるほうがまし**と判断した。
    // **見直す条件**: 「本体が掴みの繰り返し」と講評が言ったら、
    // 本体のほうを「火炉の先はどうなるか」に作り替えること（いまその本体は無い）。
    body: 'beyond',
    title: '日本語の単位が尽きた先、どうなると思いますか【放置ゲー】',
    description: `日本語の数の単位は万から無量大数までで、無量大数が10の68乗です。放置クリッカーの所持数はその先まで行くので、単位の名前をゲーム側で組み立てています。10の72乗は「火炉」でした。`,
    tags: TAGS,
  },
  // ---------------------------------------------------------------------------
  // **カウンター reveal の n を増やすための3本**（2026-08-11）。
  //
  // `unitmake` が **swipeAt 3.5** を出して掴みの帯（1.2〜2.5）を初めて破ったが
  // **n=1** で、CLAUDE.md 第2部の「見直す条件」が
  // 「同じ形でもう1〜2本出して 2.5 を超えなければ n=1 の揺れ」と言っている。
  // **絵も画面も題材も変えず、鳴った段だけ変える** —— 変数を1つに保つため。
  //
  // **段の選び方には下限がある**（ここで初めて書く）。`setLateGame` は
  // 26分の周回で 1e42 を作った状態なので、**毎秒およそ 6e38 が乗る**。
  // grant で置いた数はその場から増え続けるので、**段が 1e40 を下回ると
  // 1秒で次の桁へ飛び、「前の単位」が撮れる前に消えます。**
  // → **使えるのは 正(1e40) 以上**。兆→京 のような身近な段は、
  // この形では撮れない（撮ろうとすると `__revealBefore` が落ちる）。
  // **見直す条件**: 生産を止める手を入れたら、この下限は消えます。
  {
    id: 'unitsho',
    hook: {
      screen: 'play',
      // 帯は問いだけ。**何も主張しないので画面と食い違いようがない**（`unitmake` と同じ）。
      banner: '“正”の<em>次</em>の単位、分かります?',
      // 答えを出すのはキャプションではなく**カウンターの文字そのもの**。
      // この2行は、書き換わったあとの言い直し。
      caption: ['<em>載</em>です', '10の<em>44</em>乗'],
      narration: 'しょうの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 正 = JAPANESE_NUMBER_UNITS の10番目 = 10^40、載 = 11番目 = 10^44。
      // どちらも level 境界ちょうどなので数字は 1.00000 のままで、**単位名だけが変わる**。
      reveal: { act: 'counter', at: '1e40', next: '1e44', from: '正', to: '載' },
      motion: 'reveal',
      expect: { text: '載', root: '#cookies' },
    },
    // 掴みが約束したのは「単位の続き」。`beyond` はその続きを上まで辿るので同じ話。
    body: 'beyond',
    title: '“正”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、正が10の40乗、その次の載が10の44乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    id: 'unitgoga',
    hook: {
      screen: 'play',
      banner: '“極”の<em>次</em>の単位、分かります?',
      caption: ['<em>恒河沙</em>です', '10の<em>52</em>乗'],
      narration: 'きょくの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 極 = 12番目 = 10^48、恒河沙 = 13番目 = 10^52。
      reveal: { act: 'counter', at: '1e48', next: '1e52', from: '極', to: '恒河沙' },
      motion: 'reveal',
      expect: { text: '恒河沙', root: '#cookies' },
    },
    body: 'beyond',
    title: '“極”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、極が10の48乗、その次の恒河沙が10の52乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    // **この1本だけ、書き換えを2回にしてある**（`reveal.then`）。
    //
    // 狙いは2つ。**(1)** `unitmake` に残った宿題 ——
    // レビュアーの掴みへの指摘は「0.8秒と1.5秒が完全に同一（答えの後が静止）」
    // だけだった。**書き換えたあとが空いている**ので、同じ二値の出来事をもう一段置く。
    // **(2)** 指が動いたのは **3.5秒＝本体に切り替わった瞬間**だった。
    // 掴みを1.4秒ぶん伸ばして、**なお 3.5 で動くなら壁は「時刻」**、
    // **本体の開始まで持つなら壁は「切り替え」** ——— どちらかが分かる。
    // **見直す条件**: この本の swipeAt を `unitsho` / `unitgoga`（1段だけ）と比べること。
    id: 'unitnayu',
    hook: {
      screen: 'play',
      // 段を2つ上がるので、問いは「次」ではなく「どこまであるか」に寄せる。
      banner: '数の単位、<em>どこまで</em>あると思います?',
      caption: ['<em>那由他</em>', '10の<em>60</em>乗'],
      narration: '数の単位って、どこまであると思いますか?',
      bannerPos: 'hi',
      // 恒河沙(13)=10^52 → 阿僧祇(14)=10^56 → 那由他(15)=10^60。
      reveal: {
        act: 'counter', at: '1e52', next: '1e56', from: '恒河沙', to: '阿僧祇',
        then: [{ next: '1e60', to: '那由他' }],
      },
      motion: 'reveal',
      // 2段目の分だけ掴みが伸びるので、答えのキャプションも後ろへ。
      // 既定 1500 のままだと1段目の途中に乗って、**画面が「阿僧祇」のときに
      // 「那由他」と書いた字が出る**（指示11）。
      // **最初 3200 で撮って、フレームを開いて 2600 に下げた**（2026-08-11）。
      // 鎖は 2.5秒で終わっていて、3200 だと **2.5〜4.0秒が静止**する ———
      // それは `unitmake` に残った宿題（答えの後が静止）を、
      // **自分で作り直しているのと同じ**。答えは最後の書き換えの直後に置く。
      capAt: 2600,
      expect: { text: '那由他', root: '#cookies' },
    },
    body: 'beyond',
    title: '数の単位、どこまであると思いますか【放置ゲー】',
    description: `日本語の数の単位は、恒河沙が10の52乗、阿僧祇が10の56乗、那由他が10の60乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  // ---------------------------------------------------------------------------
  // **「1日3本」を試すための3本**（2026-08-11 夜）。
  //
  // 予約は6.1日先まであり、日ごとは全部2本 —— RUNBOOK §2 のどの条件にも
  // 当たらない回でした。**それでも作ったのは、`yt.mjs perday 90` が
  // 「本数を増やしても1本あたりは落ちない」と言っているからです**:
  //
  //     1本の日: 動画2本  平均220
  //     2本の日: 動画10本 平均216
  //     3本の日: 動画3本  平均229
  //
  // 合計 = 本数 × 1本あたり なので、**1本あたりが3分の2以下に落ちない限り
  // 合計は増えます。** 実測はむしろ上がっている（下がる兆しが無い）。
  // 指示1が最大化しろと言っているのは成長率で、**打席は日ごとに配られます。**
  // RUNBOOK §2(1) の「2本」は私たちが置いた数字で、実測はそれを支持していない。
  // → §2(1) を「3本に満たない日」に直し、8/12〜8/14 の3本目としてこれを出す。
  // **これ自体が探索でもあります** —— 3本の日は n=1（8/5）しか無いので、
  // 3日ぶん足せば n が 1→4 になり、次の回の `perday` が判断に使える。
  // **見直す条件**: 8/12〜8/14 が Analytics に出たら `perday` を撃つこと。
  // **3本の日の平均が 2本の日（216）の3分の2＝144 を下回ったら、そこが上限**
  // なので §2(1) を2本に戻す。上回っているなら4本を試してよい。
  //
  // **型は `unitsho` / `unitgoga` と同じにしました（変数を1つに保つため）。**
  // counter reveal は掴みの帯（1.2〜2.5）を破った唯一の型で、n=4 のうち3本が
  // 3.5。CLAUDE.md 第2部の「見直す条件」がまだ n を求めています。
  // 段は `JAPANESE_NUMBER_UNITS`（play.html:7638）の未使用の3つ:
  // 載(11)=10^44 → 極(12)=10^48 / 那由他(15)=10^60 → 不可思議(16)=10^64 /
  // 不可思議(16) → 無量大数(17)=10^68。**どれも 1e40 以上**なので、
  // 上の「段の選び方には下限がある」を満たします。
  //
  // **本体は3本とも `beyond` です。ここは選べませんでした** —— RUNBOOK §3-1 が
  // 「繋ぐ本体は掴みの問いと同じ話であること」と言い、`prestige` は別の話、
  // `scale`(10^42) は掴みが 10^64 を見せた後だと `unitmake` で指摘された
  // 「尽きる前の単位を後から自慢する」後退になる。**単位の掴みに繋げる本体は
  // 実質 `beyond` しかない**ので、この題材では `--body` で尺を伸ばす手が
  // 塞がっています。**尺を試すなら題材のほうを変えること。**
  {
    id: 'unitkyoku',
    hook: {
      screen: 'play',
      banner: '“載”の<em>次</em>の単位、分かります?',
      caption: ['<em>極</em>です', '10の<em>48</em>乗'],
      narration: 'さいの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 載 = 11番目 = 10^44、極 = 12番目 = 10^48。どちらも level 境界ちょうど
      // なので数字は 1.00000 のままで、**単位名だけが書き換わります。**
      reveal: { act: 'counter', at: '1e44', next: '1e48', from: '載', to: '極' },
      motion: 'reveal',
      expect: { text: '極', root: '#cookies' },
    },
    body: 'beyond',
    title: '“載”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、載が10の44乗、その次の極が10の48乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    id: 'unitfushi',
    hook: {
      screen: 'play',
      banner: '“那由他”の<em>次</em>の単位、分かります?',
      caption: ['<em>不可思議</em>です', '10の<em>64</em>乗'],
      narration: 'なゆたの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 那由他 = 15番目 = 10^60、不可思議 = 16番目 = 10^64。
      reveal: { act: 'counter', at: '1e60', next: '1e64', from: '那由他', to: '不可思議' },
      motion: 'reveal',
      expect: { text: '不可思議', root: '#cookies' },
    },
    body: 'beyond',
    title: '“那由他”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、那由他が10の60乗、その次の不可思議が10の64乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    // **この1本だけ問いの形が違います。**「次は何か」ではなく「最後は何か」。
    // 無量大数は `JAPANESE_NUMBER_UNITS` の**17番目＝配列の最後**なので、
    // 「日本語の単位はここで終わり」は画面の外の知識ではなく**コードの事実**です
    // （指示11）。名前だけは知られている単位なので、
    // 「聞いたことはあるが、それが最後だとは知らない」を狙っています。
    id: 'unitmuryo',
    hook: {
      screen: 'play',
      banner: '日本語の単位、<em>最後</em>は何だと思います?',
      caption: ['<em>無量大数</em>', '10の<em>68</em>乗'],
      narration: '日本語の数の単位で、最後は何だと思いますか?',
      bannerPos: 'hi',
      // 不可思議 = 16番目 = 10^64、無量大数 = 17番目 = 10^68（配列の最後）。
      reveal: { act: 'counter', at: '1e64', next: '1e68', from: '不可思議', to: '無量大数' },
      motion: 'reveal',
      expect: { text: '無量大数', root: '#cookies' },
    },
    body: 'beyond',
    title: '日本語の数の単位、最後は何だと思いますか【放置ゲー】',
    description: `日本語の数の単位は万から無量大数までの17個で、無量大数が10の68乗です。放置クリッカーの所持クッキーはその先まで行くので、単位の名前をゲーム側で組み立てています。`,
    tags: TAGS,
  },
  // ---------------------------------------------------------------------------
  // **桁が回る3本**（2026-08-11 夜）。
  //
  // 互いを知らない3人のレビュアーが、別々の take（載/那由他/不可思議）を見て
  // **4点すべてで一致**した。この台帳で最も強い重なりです。そのうちの1つ:
  // **「数字が終始『1○○』で、桁が一度も回らない ——— 増える実感がゼロ」。**
  // CLAUDE.md 第2部で 2/3 → 5/6 に増えていた、**最も重なりが強く未実装だったもの。**
  //
  // 原因はコードに在りました。上の7本は `at`/`next` に**段の境目ちょうど**
  // （1e44 等）を置いていて、`fmtCookieCount` はそこで `1.00000` に張り付く。
  // **検査を通しやすい形（単位名だけが変わる）が、画のほうを決めていた。**
  // → `__revealRamp` を足して、**境目の手前(0.94倍)から後(1.06倍)へ 1.6秒で
  // 動かす**。表示は 9400恒河沙 → 9700 → 9999 → 1.00阿僧祇 → 1.06阿僧祇 と
  // **桁が回り**、跨いだ瞬間に単位名が書き換わります。
  // 3人が挙げた (a)答えが早すぎる (b)答えの後が静止 (c)桁が回らない が、
  // **1つの出来事で同時に片づく**（動いている最中が答えの前で、跨いだ後も動く）。
  //
  // **変えたのはそこだけです。** 帯・キャプション・ナレーション・本体・
  // `bannerPos` は上の7本と同型のまま ——— counter reveal は n=7 で
  // swipeAt 平均 2.36（それ以前 2.03）と、**差が揺れの範囲に留まっている型**です。
  // 変数を1つに保たないと、この7本ぶんの比較が使えなくなります。
  //
  // **capAt を既定(1500)から 1800 に上げてあります。** 跨ぐのは ramp の中間
  // （およそ 1.25秒）なので、1500 のままだと**画面がまだ前の単位のときに
  // 答えのキャプションが出る**回が揺れで起こりえます（指示11）。
  // ramp が終わるのは約2.05秒なので、1800 は「跨いだ後・まだ動いている間」。
  //
  // **段の選び方**: 上の7本が使っていない**単独の段**を2つ選びました
  // （恒河沙→阿僧祇 と 阿僧祇→那由他 は `unitnayu` の鎖の中にしか無く、
  // 「◯◯の次は?」という単独の問いにはなっていない）。3本目は日本語が尽きた先。
  // **1e40 未満の段（兆→京 など）はまだ使えません** —— `setLateGame` の生産
  // （毎秒およそ 6e38）が ramp の設定値を跨いで乗るので、桁が暴れます。
  // **見直す条件**: ramp の間だけ生産を止める手を入れれば、
  // **兆→京 のような「知っていそうで知らない」段が開きます。**
  // そちらのほうが問いとしては強いはずなので、次に手が空いた回で試すこと。
  {
    id: 'unitasogi',
    hook: {
      screen: 'play',
      banner: '“恒河沙”の<em>次</em>の単位、分かります?',
      caption: ['<em>阿僧祇</em>です', '10の<em>56</em>乗'],
      narration: 'ごうがしゃの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 恒河沙 = JAPANESE_NUMBER_UNITS の13番目 = 10^52、阿僧祇 = 14番目 = 10^56。
      reveal: { act: 'counter', at: '1e52', next: '1e56', from: '恒河沙', to: '阿僧祇' },
      motion: 'reveal',
      capAt: 2300,
      expect: { text: '阿僧祇', root: '#cookies' },
    },
    body: 'beyond',
    title: '“恒河沙”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、恒河沙が10の52乗、その次の阿僧祇が10の56乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    id: 'unitnayuta',
    hook: {
      screen: 'play',
      banner: '“阿僧祇”の<em>次</em>の単位、分かります?',
      caption: ['<em>那由他</em>です', '10の<em>60</em>乗'],
      narration: 'あそうぎの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 阿僧祇 = 14番目 = 10^56、那由他 = 15番目 = 10^60。
      reveal: { act: 'counter', at: '1e56', next: '1e60', from: '阿僧祇', to: '那由他' },
      motion: 'reveal',
      capAt: 2300,
      expect: { text: '那由他', root: '#cookies' },
    },
    body: 'beyond',
    title: '“阿僧祇”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、阿僧祇が10の56乗、その次の那由他が10の60乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    // **日本語が尽きた先の、さらに先。** `unitmake` は 無量大数(10^68) →
    // 火炉(10^72) を見せる本で、そこで「名前はゲームが作る」と言って終わる。
    // **その主張が本当かは、もう一段先を見せたときにしか確かめられません。**
    // `generateHugeUnit(19)`（play.html:7794）を実際に走らせて確認: 10^76 は
    // **「空幽世」**。種は level だけなので毎回同じ名前が出ます（指示11）。
    // **最初は 火炉(10^72) → 空幽世(10^76) で撮って、外部レビューで落ちた**
    // （2026-08-11 深夜、swipeAt 2.5）。理由が構造的だった:
    // **問いを出す前の 0.3秒に、既に答えである「火炉」が画面中央に出ている。**
    // 火炉は日本語の単位ではないので、「日本語が尽きた後どうなる?」の答えは
    // **問いより先に画面に在った**。あとは同じ答えが別の語に変わるだけ。
    // → **跨ぐ手前が日本語の単位で、跨いだ先が造語**になる段は 1つしかない
    // （無量大数 → 火炉）。そこに移した。
    // **`unitmake` と同じ段だが、あちらは跳ぶ形（ramp 以前）。** 同じ段で
    // 跳ぶ本と回る本が並ぶので、**桁送りだけを分離した対照**になります。
    // **見直す条件**: `unitmake`(3.5・跳ぶ) と この本(回る) の swipeAt を比べる。
    // 差が出なければ、桁送りは掴みに効いていない。
    id: 'unitkaro',
    hook: {
      screen: 'play',
      banner: '日本語の単位が<em>尽きたら</em>、次は何と呼ぶ?',
      caption: ['名前は<em>ゲームが</em>作ります', '無量大数の次は「<em>火炉</em>」'],
      narration: '日本語の数の単位が尽きたら、次は何て呼ぶと思いますか?',
      bannerPos: 'hi',
      // 無量大数 = JAPANESE_NUMBER_UNITS の17番目＝配列の最後 = 10^68。
      // 火炉 = level 18 = 10^72 で、これは配列に無く `generateHugeUnit` が
      // 組み立てる名前（play.html:7794。種は level だけなので毎回同じ）。
      reveal: { act: 'counter', at: '1e68', next: '1e72', from: '無量大数', to: '火炉' },
      motion: 'reveal',
      capAt: 2300,
      expect: { text: '火炉', root: '#cookies' },
    },
    body: 'beyond',
    title: '単位の名前が尽きた後、ゲームは何と呼ぶと思いますか【放置ゲー】',
    description: `日本語の数の単位は万から無量大数までの17個で、無量大数が10の68乗です。放置クリッカーの所持クッキーはその先まで行くので、単位の名前をゲーム側で組み立てています。10の72乗は「火炉」でした。`,
    tags: TAGS,
  },
  // **桁を回す2本**（2026-08-11 夜）。`hook.reveal` の1本目と2本目。
  //
  // **3人のレビュアーが互いを知らないまま4点すべてで一致し**、そのうち私たちが
  // 一度も打っていなかったのが「数字が終始『1○○』で桁が一度も回らない ——
  // 増える実感がゼロ」でした（5/6 が同じことを書いていて、台帳で最大の重なり）。
  // counter reveal は段の境目**ちょうど**を grant していたので、仮数が両側とも
  // 1.00000 に張り付き、**動くのは単位名だけ**。境目ちょうどを選んだ理由は
  // 「検査を通しやすいから」で、**検査の都合が画を決めていた。**
  //
  // `roll` は境目の手前から入って、**ゲート自身の生産で跨がせます**（実装は
  // overlay.js の `rollArm` / `__rollGo`、director の reveal 区間）。
  // 検査は「跨ぐ前に何通りの数字が描かれたか」を数え、既定4通り未満なら停止。
  //
  // **段が下がりました。ここが `roll` のもう1つの効きどころです。**
  // これまで「使えるのは 正(1e40) 以上」と書いてありました —— 理由は
  // setLateGame の生産（毎秒 約6e38）が低い段では速すぎて、前の単位が撮れる前に
  // 飛ぶから。`roll` は**段に合わせて生産のほうを較正する**ので、その下限は
  // 消えます。→ **兆・京という、視聴者が実際に知っている単位**が使えるようになった。
  // 恒河沙や那由他は「聞いたこともない」ので問いが成立しにくく、
  // **兆の次は、知らないが知っていておかしくない**という帯にいます。
  //
  // **見直す条件**: この2本の swipeAt を、桁が回らない同型
  // （`unitsho` 1.5 / `unitgoga` 3.5 / `unitkyoku` 1.5 / `unitfushi` 1.5 /
  //  `unitmuryo` 1.5、平均 2.0 前後）と比べること。**動かなければ、
  // 5/6 の重なりでも外れたことになる** —— そのときは掴みではなく本体・尺・題材へ。
  // 段が下がったことと roll が同時に動いているので、**分離はできていません。**
  // 差が出たら、次はどちらか一方だけを戻して測ること。
  {
    id: 'unitkei',
    hook: {
      screen: 'play',
      banner: '“兆”の<em>次</em>の単位、分かります?',
      // 答えを出すのはキャプションではなく**カウンターの文字そのもの**。
      caption: ['<em>京</em>です', '10の<em>16</em>乗'],
      narration: 'ちょうの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 兆 = JAPANESE_NUMBER_UNITS の4番目 = 10^12、京 = 5番目 = 10^16
      // （play.html:7638 を読んで数えた。配列は先頭が空文字なので添字＝段）。
      reveal: {
        act: 'counter', at: '1e12', next: '1e16', from: '兆', to: '京',
      },
      motion: 'reveal',
      // 答えは画面（カウンター）が先に出す。キャプションはその言い直しなので、
      // **跨いだ後**に置く（既定 3800 のままだと1.9秒の出来事から2秒遅れる）。
      capAt: 2400,
      expect: { text: '京', root: '#cookies' },
    },
    body: 'beyond',
    title: '“兆”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、兆が10の12乗、その次の京が10の16乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
    tags: TAGS,
  },
  {
    id: 'unitgai',
    hook: {
      screen: 'play',
      banner: '“京”の<em>次</em>の単位、分かります?',
      caption: ['<em>垓</em>です', '10の<em>20</em>乗'],
      narration: 'けいの次の単位、分かりますか?',
      bannerPos: 'hi',
      // 京 = 5番目 = 10^16、垓 = 6番目 = 10^20。
      reveal: {
        act: 'counter', at: '1e16', next: '1e20', from: '京', to: '垓',
      },
      motion: 'reveal',
      capAt: 2400,
      expect: { text: '垓', root: '#cookies' },
    },
    body: 'beyond',
    title: '“京”の次の単位、分かりますか【放置ゲー】',
    description: `日本語の数の単位は、京が10の16乗、その次の垓が10の20乗です。放置クリッカーの所持クッキーはこのあたりを普通に通過していきます。`,
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
    id: 'drops',
    // A rule rather than a quantity, and one nobody would guess: what drops
    // depends on how the monster died. The 一覧 panel writes the table out —
    // 通常撃破＝基本素材 / 金ブースト中＝黄金粉 / オーバーキル＝レア素材 /
    // 3体連続＝ボス核 / ノルマに余裕＝発酵系 — so the frame carries all of it
    // and the caption only has to point.
    hook: {
      screen: 'drops',
      banner: '素材、倒し方で変わると思います?',
      caption: ['<em>倒し方ごとに</em>', '出る素材が違います'],
      narration: '素材って、倒し方で変わると思います?',
      taps: false,
      // Captions over the play field, clear of the table they are describing.
      capPos: 'high',
      motion: 'still',
      expect: { text: 'オーバーキル', root: '#infoPanel' },
    },
    title: '素材、倒し方で変わると思いますか【放置ゲー】',
    description: `モンスターの倒し方で落ちる素材が変わります。普通に倒せば基本素材、金ブースト中なら黄金粉、残りHPの5倍ダメージで倒すレア素材、3体連続ならボス核、ノルマに余裕を持って倒すと発酵系。狙った素材があるなら倒し方を変えることになります。`,
    tags: TAGS,
  },
  {
    id: 'craftcap',
    // A limit is a stranger thing to find in an idle game than any quantity, and
    // this one the panel prints on itself: 「装備の作成（この周回あと 5/5 個）」.
    // The number is small enough to guess, which is why the hook asks whether
    // there is a cap at all rather than how big it is.
    hook: {
      screen: 'craft',
      banner: '装備、いくつでも作れると思います?',
      // Up over the play field. At the default position the banner sat exactly
      // on 「装備の作成（この周回あと 5/5 個）」 — the line this cut exists to
      // show. mustSee passed, because it asks the DOM whether the element is in
      // the viewport and knows nothing about my own overlay covering it.
      // Both overlays pushed clear of 「装備の作成（この周回あと 5/5 個）」, which
      // sits mid-frame where the panel meets the play field. The banner covered
      // it at the default position; moving the banner up left the caption
      // covering it instead (87%, caught by the occlusion check). Captions go
      // over the play field; the banner takes the default slot, where it lands
      // on the 工房 heading and nothing that matters.
      capPos: 'high',
      // No scroll: the shared craft motion walks down the recipe list and takes
      // the header line with it.
      motion: 'still',
      caption: ['作れるのは', '<em>1周に5個まで</em>'],
      narration: '装備って、いくつでも作れると思います?',
      taps: false,
      // Guards the digit too, not just the phrase — the caption says 5.
      expect: { text: 'この周回あと\\s*5/5', root: '#workshopPanel' },
    },
    // EQUIP2_CFG.craftPerRunCap（既定5）。上限に当たると
    // 「装備の作成はこの周回あと0個(上限5個/周回)」とゲーム自身が言う。
    title: '装備、いくつでも作れると思いますか【放置ゲー】',
    description: `装備の作成は1周につき5個までです。レシピは486種類あるので、周回ごとに何を作るかを選ぶことになります。素材と装備は転生しても持ち越すので、選び直しは次の周回でききます。`,
    tags: TAGS,
  },
  {
    id: 'formula',
    // **捨てた切り口（2026-08-10）。新しく作らないこと。**
    //
    // 外部レビューに2回出して2回とも fail（どちらもスワイプ 1.5秒）。2人が独立に
    // 同じことを言った: **「生産の式」と約束しているのに、映るのは倍率の項目表で、
    // 掛け合わせの式は一行も出ていない。** 言葉のほうが盛れている —— 指示11
    // （画面に映っていないものを語らない）に触れる。予約も外した（hkM7fdWg8vc）。
    //
    // **同じ画面を別の言葉で扱うのは可**（`numbers` は「効いてる倍率が全部見られる」と
    // 言い切って維持 84.3% を出している）。落ちたのは画面ではなく「式」という語。
    // 残してあるのは、次の回が同じ言葉をもう一度発明しないため。
    //
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
      // 2026-08-10。この切り口のレビュアーは 1.2秒でスワイプし、理由に
      // 「冒頭が読めない小文字の一覧表で、何のゲームか分からない」を挙げ、
      // fix に「モンスターの群れがクッキーに群がる絵(t9)で始めろ」と書いた。
      // **絵を名指ししたのはこの人を含めて3人**（restart / record のレビュアーも
      // 独立に同じ方向を書いた）ので、重なったほうを信じて開幕を戦闘にする。
      // 研究一覧は答えの位置（capAt 3800）で開く —— 証拠は消えていない。
      opening: 'battle',
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
      // 2026-08-12 に「量を聞いて量で答えない」形をやめた。
      //
      // 前の版は答えを `上限そのものを / 撤廃できます` の2行だけにしていて、
      // すぐ下の注が「定数から数字を引いてこない」と**わざわざ選んだ理由**を
      // 書いていた（「上限は無い、が どんな数字よりも良いオチ」）。
      // **外部レビュアーは同じ take を見て、そこを1位の理由に挙げた**:
      // 「『何時間?』と数を聞いておきながら、16.7秒のあいだ時間の数字が一度も
      // 画面に出ない。視聴者は頭の中で 2時間かな 8時間かなと数を用意して
      // 待っているのに、答え合わせが起きないので見た報酬がゼロ」。
      //
      // **問いの形が効くのは、答え合わせが起きるからです。** 量を聞いて質で
      // 答えると、オチが強いかどうか以前に、**問いが回収されない。**
      //
      // 数字は画面に在るほうを使う（指示11 ——「画面に映っていないものを語らない」）。
      // `OFFLINE_LIMIT_SECONDS = 60*60*8`（play.html:6197）は**定数で、画面には
      // 出ません**。出るのはスキルの説明文のほうで、`offline_1`「長期保存」が
      // 「放置上限 +4時間。」、`endless_oven`「終わらぬ焼窯」が
      // 「放置生産の時間上限を撤廃。」（play.html:6712, 6714）。
      // **だから答えは「+4時間ずつ」→「最後は上限ごと消える」にした。**
      // 数で答えてから、その数の枠ごと外れる、の順になる。
      //
      // **見直す条件**: これで swipeAt が 1.5 から動かなければ、
      // 効いていないのは「答え合わせの有無」ではなく掴みの画のほう。
      caption: ['答えは<em>「上限なし」</em>', '<b>時間の上限そのものを撤廃</b>'],
      narration: '放置ゲーの放置上限って、何時間あると思います? 答えは、上限なし。時間の上限そのものを撤廃できます。',
      taps: false,
      // **最初は「スキルで+4時間ずつ」と数で答えようとして、検査に落とされました。**
      // `offline_1`「放置上限 +4時間。」と `endless_oven`「放置生産の時間上限を撤廃。」は
      // **スキルツリーの別の場所にあり、同じ画面に同時に映らない**（expect を
      // 両方にかけたら `画面外 y=0` で停止した。**印字ではなく停止**）。
      // → 映っている側だけで答える。**「何時間?」に「上限なし」は量の答えなので、
      // 答え合わせは起きる**（レビュアーが言っていたのは「答えが出ない」ことで、
      // 「数字でない」ことではない）。
      // **見直す条件**: これでも swipeAt が 1.5 なら、問題は答えの中身ではなく
      // 掴みが静止画であること（レビュアーの2番目以降の理由）。そちらは画の話。
      expect: { text: '撤廃' },
    },
    // 上限そのものは 終わらぬ焼窯 が外す（play.html:16963 —— 取っていると
    // 経過時間がクランプされずにそのまま使われる）。ノードは画面に出る言葉で
    // 自分でそう言っている: 「放置生産の時間上限を撤廃。」
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
  // ---------------------------------------------------------------- 8/10 の2本
  // 22切り口を全部使い切ったので、ここから先は素材を探し直したもの。選び方は
  // 8/9 に立てた二軸のうち「当てられない問い」を主にし、`cook`(341) が示した
  // 「見て強い絵」を満たせるものを優先した。
  // ---- 棄却: `bake`（焼き加減）2026-08-10 -------------------------------------
  // 「クッキー、焦げると思いますか」で書き上げて、レンダリングが落ちた。
  // 「焦げ気味」が画面のどこにも無い、と検査が言った。
  //
  // 調べたら、焼き加減はプレイヤーには存在しない。BAKE_STATES（生焼け/ちょうどいい/
  // 香ばしい/焦げ気味）も renderBakeBox() も倍率の計算も play.html に全部在るのに、
  // 表示の条件が hasSkillEffect("unlockSystem", "bakeTemperature") で、
  // **その効果を持つスキルが1つも無い**（unlockSystem の target は
  // economyAnalysis / goldenAnalysis / huntAnalysis / masteryHigh / masteryLow /
  // offlineInfinite / orderBoard / researchAnalysis / researchRemodel /
  // rewardSynergy / runPolicy / workshop / workshopCraft の13個だけ）。
  // play.html:8342 の 「焼き加減廃止(R2)」 がその跡。
  //
  // つまり全スキル解放の setLateGame でも箱は空のまま。**指示11に触れるので出さない。**
  // 「コードに在る」と「遊べる」は違う、という失敗の型は、mustSee が
  // 「DOMに在る」と「画面に映っている」で踏んだものと同じ。今回は一段前で出た。
  //
  // 復活させる条件: どれかのスキルに unlockSystem/bakeTemperature が付いたとき。
  // それまで書き直さないこと ——— 検査を緩める方向で通してはいけない。
  {
    id: 'risk',
    // 報酬モーダルは、料理の棚と並んで「ほぼ絵」の画面。REWARD_POOL の20種は
    // 1つずつ固有の絵を持っている(images/37..54_reward_*.png)。`cook` で効いたのが
    // 文の形ではなく画の強さだった可能性を潰せていないので、そちらの軸を厚くする。
    //
    // 問いのほうは「報酬」という語に対する期待を外しにいく。デメリットつきの
    // 報酬が4種あり、深追いの契約は自分で「ただしHP ×…」と書いている。
    hook: {
      screen: 'risk',
      banner: '報酬、全部いいことだと思いますか?',
      caption: ['<em>反動</em>つきの', '報酬があります'],
      narration: '放置ゲーの報酬って、全部いいことだと思いますか?',
      taps: false,
      // モーダルが枠のまん中を占めるので、帯は上端(11%)、テロップは既定の下端、
      // カードはその間。既定の帯位置(37.5%)はカードとカードの隙間に落ちて、
      // 問いが本文に埋もれた。
      bannerPos: 'hi',
      motion: 'still',
      // 「ただしHP」で最初の take が落ちた。REWARD_POOL の desc はそう書いて
      // いるが、カードが描くのは rewardPreviewText() の別文で、そちらの語は
      // 「反動：敵が硬くなる」。テロップも私の言葉ではなくこの語に寄せてある
      // ので、検査と画面とテロップが同じ1語を指している。
      expect: { text: '反動', root: '#rewardChoices' },
    },
    title: '報酬、全部いいことだと思いますか【放置ゲー】',
    description: `モンスターを倒すと報酬を選びます。20種類あって、そのうち4種類は反動つきです。深追いの契約は報酬レベルの倍率が上がるかわりに敵のHP倍率も上がる、狩猟集中は倒せれば報酬Lv+1で時間切れなら-1、連戦準備は次がすぐ出るかわりに次のHPが上がる。カード自身が「反動」と書いてあるので、取るかどうかをその場で決めることになります。`,
    tags: TAGS,
  },
  // ---- 以下3本は「見て強い絵」の軸を厚くするために足したもの（2026-08-10）
  //
  // `cook`(341) が言い切りの帯(126〜193)を破ったとき、効いたのが文の形なのか
  // 画の強さなのかを分けられなかった。cook だけが「絵が大きく並ぶ画面」で、
  // 他は全部 UI かテキストだったから。`risk` は同じ狙いの1本目で、これが2本目。
  // 3本のうち2本(policy / stagepick)が画像の並ぶ専用画面、1本(record)は
  // 従来どおりのテキスト画面 —— 同じ週に両方出すので、外れ方も比べられる。
  {
    id: 'policy',
    // 「転生で選ぶのは強さ」という期待を外しにいく。実際に選ぶのは方針で、
    // 変わるのは倍率だけでなく討伐で手に入る素材のほう。画面が自分で
    // 「この周回の方針を1つ選択(途中変更不可)」と書いているので、
    // 取り返しがつかないことも frame が言っている。
    hook: {
      screen: 'policy',
      banner: '転生で選ぶのは強さだと思います?',
      caption: ['選ぶのは<em>周回方針</em>', '<em>途中変更できません</em>'],
      // 2.00秒の枠に対し 2.58秒 で 0.58秒はみ出した（--dry-run の実測）。
      // 帯のほうは画面の文字なので長くてよいが、読み上げは枠に収める。
      narration: '転生で選ぶのは強さだと思います?',
      taps: false,
      // 5枚のボタンが画面のほぼ全部を占める。帯は上端、テロップは既定の下端。
      bannerPos: 'hi',
      motion: 'still',
      // テロップが主張するもの全部を覆うこと（`stages` で踏んだ穴）。
      // 「周回方針」は見出しにもボタンにもあるが、「途中変更できません」の
      // 根拠は画面のこの1文しかないので、そちらを検査する。
      expect: { text: '途中変更不可', root: '#policyChoiceScreen' },
    },
    title: '転生で選ぶのは強さだと思いますか【放置ゲー】',
    description: `転生のあとに周回方針を1つ選びます。標準・会心型・焼成型・狩猟型・金色型の5つで、その周回のあいだ変更できません。生産や金クッキーへの常時補正だけでなく、討伐で手に入りやすい素材も方針ごとに変わります。金ブースト中の撃破でしか出ない黄金粉は金色型と相性がよく、万能粉が出るのは標準だけです。`,
    tags: TAGS,
  },
  {
    id: 'record',
    // 「同じ敵を何体倒しても同じ」という期待を外す。種類ごとに累計が
    // 記録されていて、25体で1段・以降4倍ごとに段が上がり、段ごとに
    // ダメージ×0.03 とドロップ+1(2段ごと)が恒久で付く。
    //
    // setLateGame は killRecords を触らないので、素で撮ると全行が
    // 「累計0体 / 記録0段：ボーナスなし」になる —— 規則は書いてあるのに
    // 効いている例が画面に1つも無い状態でテロップが倍率を語ることになるので、
    // director 側で記録を積んでから撮る。
    hook: {
      screen: 'record',
      banner: '同じ敵、何体倒しても同じだと思います?',
      // **「25体ごと」は事実ではない**（2026-08-10、外部レビュアーが画面と突き合わせて
      // 見つけた）。`play.html:9742` は `25 * Math.pow(4, killRecordTier)` なので
      // 25 → 100 → 400 → 1600 → 6400 の**4倍刻み**で、「ごと」なのは1段目だけ。
      // 撮れた記録画面には 100/400/1600/6400 が並んでいて、**テロップだけが 25 と
      // 言っていた。** 説明欄のほうは最初から正しく書いてあったので、
      // 間違っていたのは掴みの1行だけ ——「短く言い直したときに事実が落ちた」形。
      // 指示11（視聴者に誤解を与えない）に真正面からぶつかるので、画面の数字に合わせた。
      caption: ['種類ごとに<em>累計を記録</em>', '<em>100体・400体…で段が上がる</em>'],
      narration: '敵は何体倒しても同じだと思います?',
      taps: false,
      capPos: 'high',
      motion: 'still',
      // 一覧タブだと読み違えていたときの名残で #infoPanel を見ていた。記録欄は
      // 工房パネルの中（renderWorkshop の料理サブタブ側）にある。
      expect: { text: '次の記録', root: '#workshopPanel' },
      // 2026-08-10 夕。この切り口のレビュアーは 2.5秒でスワイプし、外部レビュー
      // 6本中6本が「答えが読めない小文字の一覧表」を理由に挙げた。
      // **一覧を全部映すのをやめて、主張の載る1行に寄る。**
      // 「100体・400体…で段が上がる」を言うので、寄る先は段が2段以上ある行
      // （累計1740体 = 1600の段）—— 主張と同じものが映っている行に寄せる。
      zoom: { root: '#workshopPanel', target: '.infoRow', contains: '次の記録', factor: 2.1 },
    },
    title: '同じ敵、何体倒しても同じだと思いますか【放置ゲー】',
    description: `モンスターは種類ごとに討伐数を記録しています。25体で1段目、そこから4倍ごと（100体・400体・1600体）に段が上がり、段ごとにその種類へのダメージ倍率が上がって、2段ごとに素材のドロップ数も増えます。一覧タブの記録欄に、種類ごとの累計と次の記録までの体数がそのまま出ています。`,
    tags: TAGS,
  },
  {
    id: 'stagepick',
    // `endless` が「ステージを6つにして最後だけ終わらなくした」を言い切りで
    // 扱ったが、選べること自体は扱っていない。周回のたびに解放済みのどれかを
    // 選んで始める —— 進めたら戻れない、という放置ゲーの通例のほうを外す。
    hook: {
      screen: 'stagepick',
      banner: 'ステージ、進んだら戻れないと思います?',
      caption: ['周回のはじめに', '<em>解放済みから選び直せます</em>'],
      narration: 'ステージは戻れないと思います?',
      taps: false,
      bannerPos: 'hi',
      // テロップは既定で下端に出るが、選択肢は縦に5枚並ぶので第5ステージの
      // 行に落ちる。最初の take は遮蔽検査に「根拠の66%を覆っている」で
      // 落とされた —— 画面には映っていて、私のテロップが隠していた。
      capPos: 'high',
      motion: 'still',
      // 一番下の第5ステージが枠に入っていることを見る。1枚しか描かれない
      // 取りこぼし（stageUnlocked を入れ忘れた場合）がここで落ちる。
      expect: { text: '星屑の銀河', root: '#stageChoiceScreen' },
    },
    title: 'ステージ、進んだら戻れないと思いますか【放置ゲー】',
    // 「奥ほどドロップが増える」とは書かない。dropMul は 1/1/2/1/3 で単調では
    // ないし、香料の砂丘の取り柄は報酬Lv +8 のほう。画面はステージごとに
    // 補正を1つずつ書き出しているので、こちらもそう書く。
    description: `周回のはじめに、解放済みのステージから1つ選んで始めます。バター草原・チョコレート火山・ミントの氷河・香料の砂丘・星屑の銀河と、その先の深層領域。奥ほど敵のHPは上がりますが、付く補正はステージごとに違います。ミントの氷河はドロップ×2、香料の砂丘は報酬Lv +8相当、星屑の銀河はドロップ×3とボス周期短縮。選択画面にその内訳がそのまま出ています。`,
    tags: TAGS,
  },
  {
    id: 'stagebuy',
    // 2026-08-10 夕に新設。**切り口を1つ足したのではなく、掴みの型を1つ試す。**
    //
    // 外部レビュー8本のうち**6本**が「掴みの答えが読めない小文字の一覧表」を
    // 挙げ、7本目と8本目は**互いを知らないまま行の選び方まで一致させて**
    // 「上の段が買われた瞬間に下の段が現れるところを撮れ」「その行が挿入される
    // 前→後を0秒目に置け」と書いた。この台帳でいちばん重なりが強い。
    // `hook.zoom`（読める大きさに寄る）は在ったが、**寄れるのは既に在る行**で、
    // 現れる瞬間は撮っていなかった。ここがその「前→後」の1本目。
    //
    // **`stages` の焼き直しではない。** `stages` は同じ研究タブを扱って2回落ち、
    // RUNBOOK 3-2 どおり捨てた。落ちた理由は3つとも「一覧が読めない」
    // 「問いと答えが同時に出る」「変化が画面に無い」で、**主張ではなく型**。
    // ここは (a) 一覧ではなく1枚のカードに寄り、(b) そのカードが**買われて消え、
    // 別のカードが現れる**のをカメラの前で撮り、(c) 答えはその瞬間に乗る。
    // **同じ画面を使う別の型**であって、捨てた切り口を戻したのではない。
    hook: {
      screen: 'research',
      // 言い切り。`cook`(341) が言い切りで問い形の帯を破っているので、
      // 形は二軸のうち「見て強い絵」側に寄せて、絵のほうで勝負する。
      // **帯は自分で答えを出していない** —— 「消えます」で終わって、
      // 消えたあとどうなるかは言わない。答えはキャプション（capAt）。
      // **「消えます」は事実ではなかった**（2026-08-10、外部レビュアーが画面と
      // 突き合わせて見つけた。これで2件目）。私は `renderResearch()` のコードを
      // 読んで「購入済みの研究は購入欄から消す」と書いてあるのを根拠にしたが、
      // **撮れた画面では同じ場所に「オーブン大量焼成 段階2」が座っている。**
      // 名前は残っているので、視聴者から見れば消えていない。置き換わっている。
      // 「コードがそう書いてある」と「画面がそう見える」は別で、
      // **指示11 が言っているのは後者。** `record` の「25体ごと」と同じ経路。
      banner: '研究を買うと、同じ研究がまた出てきます',
      caption: ['<em>段階2</em>になって', '値段も上がります'],
      narration: '放置ゲーの研究を買うと、同じ研究がまた出てきます。',
      taps: false,
      // 開幕を PREROLL（金のクッキー）にしない。**出来事を早い時刻に置くため。**
      // PREROLL は約1.6秒あり、そのあとタブを開いてから寄って買うと、
      // 行が現れるのは3.5秒あたり —— レビュアーが指を動かす 1.2〜2.5秒より後ろ。
      // ここは寄った状態から始めて、**1.0秒でカードをタップ**し、
      // 1.7秒に新しいカードが現れる。n=4 の「開幕の絵」の表（1.5→2.5 で頭打ち）は
      // 4回とも**絵を替えた**もので、**出来事の時刻**は動かしていない。
      // **見直す条件**: それでも swipeAt が 2.5 から動かなければ、
      // 掴みの中では打つ手が尽きたことになる。次は尺・本編・題材を疑うこと。
      preroll: false,
      // 共通のスクロール（researchTab を 1500ms 流す）は流さない。寄せた行が
      // 枠外へ出る（`craftcap` で踏んだ事故）。**`still` ではなく `reveal`** ——
      // still にすると動きの検査ごと降りてしまい、行が現れなかった take が
      // 黙って通る。reveal は検査を残したままスクロールだけ止める。
      motion: 'reveal',
      // 1枚のカードを画面いっぱいに。
      // **2.1 は「画面いっぱい」ではなかった**（2026-08-11、外部レビュー1本目）。
      // 2.1 で撮れたフレームには**研究カードが9枚並んでいて**、レビュアーは
      // 「読めない極小文字の一覧表」と書いて 1.5秒 でスワイプした。
      // カードはビューポート縦の約7%しか占めていない。2.1 の根拠は `record` の
      // 「824x114 まで拡がって読めた」だったが、**それも縦の6%**で、
      // `record` も同じ理由で落ちている。**読めるかを画面で確かめていなかった。**
      // 検査は overlay.js の `__zoom`（縦の 25% 未満は例外）に入れた。
      // **factor は 2.1 → 6。実測でこう決めた**（2026-08-11、3回撮り直した）:
      //
      //     2.1  縦の 7%  カードが9枚並ぶ。レビュアーは「読めない極小文字の一覧表」
      //     4    縦の21%  まだ一覧。`__zoom` の下限25%に落ちる
      //     6    縦の67%  カード1枚が画面を占める
      //
      // **読める大きさと、テロップの居場所は同時に満たす必要がある。**
      // 6 で撮ったら今度は帯が根拠の行を100%覆って mustSee が止めた（遮蔽判定）。
      // カードが 197..1275 を占めるので、テロップに残るのは下の 66%〜80%
      // （上の10%は --uiTop の YouTube chrome 帯）。そこへ帯とキャプションを
      // 縦に積む —— 帯 `lo`(67%)、キャプションは既定（下から23%）。
      zoom: { root: '#research', target: '.item.artCard', contains: 'オーブン大量焼成', factor: 6 },
      // 帯をカードの下へ逃がす。既定の 37.5% も `hi`(11%) も、寄せたカードの上に乗る。
      bannerPos: 'lo',
      // 前→後の本体（director.mjs / overlay.js の `__revealPrep` 〜 `__revealAfter`）。
      // オーブン大量焼成を選んだのは、7本目のレビュアーが名指しした行だから
      // （「オーブンの…段階2 の行だけを画面いっぱいに拡大しろ」）。
      reveal: { act: 'research', id: 'ovenBatch' },
      // 答えは、行が現れた直後に乗せる。既定の 1500 だとタップと同時になり、
      // **買われた瞬間そのものにテロップが重なる。** 1900 なら列が組み替わり
      // きった後。ここは `capAt` を**縮める**方向の1本目でもある ——
      // 私たちは 1500 → 2800 → 3800 と広げてきて、8本目のレビュアーは
      // 「問いを投げてから答えまでの3秒間、画面で何も起きていない」を1位に挙げた。
      // **この本では、その区間で行が入れ替わる。** 空白は残っていない。
      capAt: 1900,
      // 現れたカードの見出しは「オーブン大量焼成 段階2」（play.html:15462）。
      // **「段階2」だけを見ない** —— #research の末尾の研究解析パネルは
      // 効果の式に「狩り窓(段階2)」を常に書いているので、語だけの expect は
      // 何も起きていない take でも通る。見出しの全文で見る。
      expect: { text: 'オーブン大量焼成 段階2', root: '#research' },
    },
    title: '研究を買うと、同じ研究がまた出てくる放置ゲー',
    // 倍率や金額は書かない。段階2の値段は「生涯初か再購入か」で式が変わる
    // （初回=絶対額の表、再購入=段1コスト×1500）ので、1つの数字で言うと
    // どちらかで嘘になる。画面が出しているのは「段階2のカードが出る」ことと
    // その効果文なので、そこだけ書く。
    description: `研究を買うと、対応するスキルを持っている場合は、同じ研究の「段階2」の購入カードが列に出てきます。オーブン大量焼成なら段階2でオーブン強化倍率が上がり、量産品の売上（毎秒収入）が始まります。さらに段階3まで伸びる研究もあります。買って終わりではなく、同じ研究がスキルの取り方で作り変わっていく作りにしています。`,
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
