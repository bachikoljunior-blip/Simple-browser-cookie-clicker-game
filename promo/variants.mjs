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
 * The recruitment block every description ends with.
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
 *     stops someone spending a tap finding out.
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
■ テスターを募集しています（Android専用・無料）

※ 下のURLがタップできない場合は、チャンネルの概要欄にリンクがあります。

Google Play で公開するのに、14日間のクローズドテストが必要です。
その期間つきあってくださる方を探しています。
※ iPhone / iPad からは参加できません。Android 端末のみです。

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
