# 背景制作指示書(注文ボード / 工房)

新規背景 2 枚(**注文ボード** と **工房**)の制作指示です。
既存のスクリーン背景(`images/01_screen_play.jpg`〜`05_screen_info.jpg`)と
世界観・タッチ・構図をそろえてください。

---

## 共通仕様(全背景に共通)

| 項目 | 指定 |
| --- | --- |
| 向き / サイズ | 縦長ポートレート **864 × 1536px**(既存の研究・強化・一覧背景と同一) |
| 形式 | JPG(不透明)。ファイルは `images/` に配置 |
| 画風 | 既存背景と同じ **重厚なスチームパンク × ファンタジー・ベーカリー**。手描き風のライティングと質感、金彩の装飾フレーム |
| 配色 | 温かみのある **ブラウン〜ゴールド**基調。差し色に暗い青緑・深紅を少量 |
| フレーム | 画面四辺を囲む**金彩の装飾額縁**。上部にアーチ状のヘッダー飾り、四隅にクッキー紋章 |
| 中央 | UI(カード・テキスト)を重ねるため、**中央の広い面はやや暗く・情報量控えめ**に保つ。模様は薄く沈める |
| 明度設計 | 実装側で暗いグラデーションを重ねる前提。**中央〜下部はやや暗め**でよい |
| モチーフ | クッキー、チョコチップ、焼き菓子。ロゴ・実在ブランド・読める文字は入れない |

> 実装メモ:タブ背景には CSS 側で
> `linear-gradient(180deg, rgba(24,14,8,0.90), rgba(9,5,3,0.97))` 相当の暗幕を重ねます。
> 見出し文字(上部)が乗るため、**上端付近は装飾を置きつつも文字が埋もれない**構図にしてください。

---

## 1. 注文ボード背景(`images/06_screen_order.jpg` を想定)

**用途:** 「注文ボード」タブ。短期目標(注文)カードと残り時間バーが中央に並ぶ。

**シーン:** ベーカリー工房の一角にある**受注掲示板(オーダーボード)**。

- 中央上寄りに、金彩フレームで縁取られた**木製の掲示板**を大きく配置。
  掲示板の面は暗めの木肌+薄い羊皮紙で、UI カードを乗せても読めるトーン。
- 掲示板には**羊皮紙の注文票が数枚ピン留め**(文字は判読不能なダミー・かすれた飾り)。
  麻ひも・真鍮ピン・封蝋のシールなどでにぎやかに。
- フレーム上部のアーチには**真鍮の呼び鈴(サービスベル)** と砂時計を配し、
  「時間制限のある注文」を象徴。
- 左右の縁には、伝票束・インク壺と羽根ペン・焼き上がりクッキーの皿・木箱を小物として置く。
- 下部四隅は既存同様、クッキー紋章の金彩装飾で締める。
- 全体は温かいランタン光。中央面は情報が乗るので**装飾を薄く、やや暗く**。

**登録手順(実装側):**
- `images/06_screen_order.jpg` として保存。
- `index.html` の背景変数定義に `--screen-order` を追加し、
  `#orderTab { background-image: linear-gradient(180deg, rgba(24,14,8,0.90), rgba(9,5,3,0.97)), var(--screen-order); }` を追記。

---

## 2. 工房背景(`images/00_screen_workshop.jpg` を想定)

**用途:** タイトル/ホーム(工房)の背景。ロゴと開始ボタンが中央に乗る。
現状タイトルは `--screen-play` を流用しているため、専用の「工房」絵に差し替える想定。

**シーン:** クッキーを焼き上げる**魔法仕掛けのベーカリー工房**の全景。

- 奥に**大きな石窯・真鍮のオーブン**。焚き口からオレンジの熱光が漏れ、湯気が立つ。
- 手前左右に**作業台**:ミキシングボウル、麺棒、天板に並ぶクッキー、
  歯車やパイプ(スチームパンク要素)、計量器など。
- 天井付近から**ランタン**や吊り下げ看板(文字なし)を下げ、暖色の点光源で奥行きを出す。
- 中央は**ロゴと開始ボタンが乗る空間**として、窯の光がふわっと集まる**明るめの抜け**を作る
  (ただしテキストが読めるよう、光は柔らかく)。
- 画面四辺は共通仕様の**金彩フレーム**で囲み、四隅にクッキー紋章。
- 全体トーンは他背景と統一した温かいブラウン〜ゴールド。ほこりっぽい空気感と光の粒子を少々。

**登録手順(実装側):**
- `images/00_screen_workshop.jpg` として保存。
- `--screen-workshop` を追加し、`.titleScreen` の背景 `var(--screen-play)` を
  `var(--screen-workshop)` に差し替え(ドリフト演出はそのまま流用可)。

---

## 生成 AI 向け英語プロンプト(参考)

**注文ボード:**
> Ornate steampunk-fantasy bakery order board, portrait 864x1536, gilded ornate
> frame with arched header and cookie crest corners, central dark wooden notice
> board with pinned aged parchment order slips, brass service bell and hourglass,
> ink pot and quill, plates of cookies, warm brown and gold palette, soft lantern
> light, uncluttered darker center for UI overlay, hand-painted game UI background,
> no readable text, no logos.

**工房:**
> Ornate steampunk-fantasy magical bakery workshop interior, portrait 864x1536,
> large brass oven with glowing orange firelight and steam, workbenches with mixing
> bowls, rolling pins, trays of cookies, gears and pipes, hanging lanterns, gilded
> ornate frame with cookie crest corners, warm brown and gold palette, soft glowing
> open space in the center for logo and button, hand-painted game title background,
> no readable text, no logos.
