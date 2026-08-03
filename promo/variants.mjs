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
 */
const cta = ({ groupUrl, optInUrl, contact }) => `
■ テスターを募集しています（Android専用・無料）

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
