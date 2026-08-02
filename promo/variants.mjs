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

const CTA = `
現在 Google Play でクローズドテスト中です。
Android版の公開に必要なテスターを募集しています。
やることは14日間インストールしたままにするだけ、毎日プレイする必要はありません。
参加方法はチャンネルの概要欄をご覧ください。`;

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
    description: `放置クリッカーの所持数が、兆のはるか上まで来ました。${CTA}`,
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
    description: `生産ペースにノルマがあって、遅れるとその周回はモンスターが出なくなります。置いておくだけでも増えますが、伸ばしたいなら管理が要ります。${CTA}`,
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
    description: `モンスターを倒して素材を集め、装備を作れます。レシピは486種類。料理もあります。${CTA}`,
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
    description: `クッキーモンスターを倒すと素材が落ちます。群れで来ることもあれば、ステージボスも来ます。${CTA}`,
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
    description: `転生するとポイントが入り、71ノードのスキルツリーに振れます。取り方は何度でも組み直せて、次の周回は確実に速くなります。${CTA}`,
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
    description: `研究を買うと生産の計算式が変わります。今どの倍率がいくつ乗っているのかは、すべて一覧画面で確認できます。${CTA}`,
    tags: TAGS,
  },
];

export const byId = id => VARIANTS.find(v => v.id === id);
export const MARK = id => `#cut-${id}`;
