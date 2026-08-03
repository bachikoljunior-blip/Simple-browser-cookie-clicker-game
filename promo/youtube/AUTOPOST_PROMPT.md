# 定期実行のプロンプト

毎日1本の投稿を回すための設定です。`create_trigger` がこの環境では
`requires approval` で通らないので、Routine の作成画面から手で登録してください。

| 項目 | 値 |
|---|---|
| 名前 | クッキーストラテジャー 毎日のShorts投稿 |
| スケジュール | 毎日 **17:40 JST**（UTC なら `40 8 * * *`） |
| 実行方法 | **毎回新しいセッション** |

17:40 なのは、日本の帰宅時間帯に入る手前に出しておくためです。Shorts は
投稿直後の数時間で初動が決まります。

以下をそのままプロンプト欄に貼ってください。

---

```
クッキーストラテジャーのプロモ Shorts を1本作って YouTube に投稿してください。

リポジトリ: /home/user/Simple-browser-cookie-clicker-game
ブランチ: claude/youtube-shorts-promo-video-4vtvqt （まず git checkout すること）

手順:
  1. bash promo/youtube/setup.sh
  2. cd promo && node youtube/autopost.mjs --public

autopost.mjs が YouTube アナリティクスを読んで切り口を選び、ゲームを自動プレイして
録画し、ナレーションを合成し、エンコードし、検査してから投稿します。仕組みの説明は
promo/README.md と promo/youtube/README.md にあります。

この動画の目的は2つだけです:
  - Google Play クローズドテストのテスター募集の案内
  - ゲームそのものの紹介

守ること:
  - 視聴者に誤解を与えないこと。数字・条件・所要時間を盛らない。ブラウザ版には言及
    しない。募集条件の正本は promo/variants.mjs の cta() で、チャンネルの告知と一致
    していること。文言を変える必要が出たら、ゲーム本体のコードで裏を取ってから
    変えること。
  - promo/youtube/tester.json の参加リンクが未設定なら autopost.mjs が投稿を止め
    ます。その場合は投稿せず、リンクが要る旨だけ報告してください。リンクの無い
    募集動画は出しません。
  - 生成物（promo/video/, *.mp4, *.webm, trim.json）はコミットしないこと。
    promo/youtube/posted.json の更新だけをコミットして push してください。

投稿できたら、動画URL・使った切り口・タイトルと、直近28日の切り口ごとの成績
（再生数と平均視聴率）を報告してください。失敗したら原因を報告してください。
勝手に投稿頻度を上げないこと。
```

---

## 必要な環境変数

`YT_CLIENT_ID` / `YT_CLIENT_SECRET` / `YT_REFRESH_TOKEN` の3つ（[SETUP.md](SETUP.md)）。
環境に登録しておけば、毎回立ち上がるセッションに自動で渡ります。

公開は `--public` を明示したときだけ行われます。外すと非公開で上がるので、
様子を見たい日はそちらで。

## この環境でなく GitHub Actions で回す場合

`workflow_dispatch` と `schedule` で同じ2コマンドを実行すれば動きます。必要なのは
上の3つを Secrets に入れること、`apt-get install ffmpeg open-jtalk
open-jtalk-mecab-naist-jdic hts-voice-nitech-jp-atr503-m001`、それと Playwright の
Chromium です。セッションの生存に依存しないぶん、そちらの方が安定します。
