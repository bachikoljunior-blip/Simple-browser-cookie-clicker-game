# YouTube 宣伝用ツール

クッキーストラテジャーの宣伝動画を YouTube に上げるための一式です。
Node.js 18 以上があれば動きます。外部パッケージのインストールは不要です。

## ファイル

| ファイル | 中身 |
|---|---|
| `setup.sh` | 下ごしらえ。`.env` と `video/` を作ります |
| `yt.mjs` | 本体。`check` / `auth` / `upload` / `metadata` |
| `metadata.md` | 投稿するタイトル・説明・タグ。**ここを編集します** |
| `.env.example` | 認証情報の雛形 |
| `.env` | 実際の認証情報。git には入りません |
| `video/` | 動画の置き場所。git には入りません |

## はじめかた

```sh
bash promo/youtube/setup.sh
```

そのあと `setup.sh` が最後に出す手順（Google Cloud での準備 → `auth` → `upload`）に従ってください。

## コマンド

```sh
cd promo

node youtube/yt.mjs check              # いま投稿できる状態か確かめる
node youtube/yt.mjs check --offline    # 通信せずローカルの確認だけ
node youtube/yt.mjs auth               # ブラウザでログインして更新トークンを取る
node youtube/yt.mjs metadata           # metadata.md の解釈結果を JSON で見る
node youtube/yt.mjs upload --dry-run   # 送信せず、投稿内容だけ表示する
node youtube/yt.mjs upload             # 実際に投稿する
```

`upload` のオプション:

| オプション | 意味 |
|---|---|
| `--video <path>` | `.env` の `YT_VIDEO` の代わりに使う動画 |
| `--thumbnail <path>` | サムネイル画像（2MB まで） |
| `--privacy <private\|unlisted\|public>` | 公開設定。既定は `.env` の `YT_PRIVACY` |
| `--dry-run` | 何も送らずに内容だけ表示する |

## 設定値の優先順位

同じキーが両方にある場合、**`.env` に書いた空でない値が勝ちます**。

| 順位 | 場所 | 使いどころ |
|---|---|---|
| 1 | `promo/youtube/.env` | 手元ですぐ直したいとき |
| 2 | 環境変数 | CI や Claude Code のクラウド環境設定から渡すとき |

クラウド環境の環境変数は**セッション起動時に一度だけ**読み込まれます。
設定を書き換えても、動いているセッションには反映されません（次に始めたセッションから効きます）。
すぐ直したいときは `.env` に書いてください。`check` がどちらの値を使ったか表示し、
食い違っていれば警告します。

## 文字数の上限

`check` が `metadata.md` を読んで検証します。

| 項目 | 上限 |
|---|---|
| タイトル | 100 文字 |
| 説明 | 5000 文字 |
| タグ（合計） | 500 文字 |
| サムネイル | 2 MB |

タイトルと説明に `<` `>` は使えません（YouTube 側で拒否されます）。`check` が見つけます。

## つまずきやすいところ

**`auth` で「このアプリは確認されていません」と出る**
自分のアカウントで自分の動画を上げるだけなので、そのまま「詳細」→「（安全ではないページ）に移動」で進めて構いません。
Google Cloud の OAuth 同意画面で公開ステータスが「テスト」の場合は、
テストユーザーに自分の Google アカウントを追加しておいてください。

**`check` で「更新トークンが失効している可能性があります」と出る**
公開ステータスが「テスト」のままだと、更新トークンは 7 日で切れます。
`node youtube/yt.mjs auth` をやり直すか、同意画面を「本番環境」に切り替えてください。

**アップロードの上限に当たる**
YouTube Data API には 1 日あたりのクォータがあり、動画 1 本の投稿でかなりの割り当てを使います。
1 日に何本も上げる用途には向きません。手で上げた方が早いこともあります。

**動画をコミットしてしまわないように**
`video/` と `*.mp4` `*.mov` `*.webm` は `.gitignore` で除外済みです。
このリポジトリは GitHub Pages で `cookiestrateger.com` を配信しているので、
大きなファイルを入れないでください。
