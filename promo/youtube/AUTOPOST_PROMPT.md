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

autopost.mjs は、まず YouTube アナリティクスと直近の離脱を読み、それから切り口を
選び、ゲームを自動プレイして録画し、ナレーションを合成し、エンコードし、検査して
から投稿します。分析が先なのは、読みが次の1本に間に合わないと意味がないからです。
仕組みの説明は promo/README.md と promo/youtube/README.md にあります。

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

実行の最初に出る「直近の離脱」を必ず読んでください。離脱の秒数は trim.json の
カット時刻と突き合わせると、どのカットで抜けられたのかが分かります。同じ箇所で
2本以上続けて落ちているなら、そのカットを直してから録画してください（台本や
文言を変える場合は、ゲーム本体のコードで裏を取ってから）。

投稿できたら、動画URL・使った切り口・タイトルと、直近28日の切り口ごとの成績
（再生数と平均視聴率）、離脱の読みと、それを受けて何か直したかを報告してください。
失敗したら原因を報告してください。勝手に投稿頻度を上げないこと。
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
