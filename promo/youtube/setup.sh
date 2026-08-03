#!/usr/bin/env bash
# promo/youtube/setup.sh — YouTube に宣伝動画を上げるための下ごしらえ。
#
# 使い方: bash promo/youtube/setup.sh
#
# やること:
#   1. Node.js のバージョンを確かめる
#   2. promo/youtube/.env を雛形から作る（既にあれば触りません）
#   3. 動画の置き場所 promo/youtube/video/ を作る
#   4. いまの状態を check で表示する
#
# 何度実行しても同じ結果になります（作成済みのものは上書きしません）。

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

say() { printf '%s\n' "$*"; }
step() { printf '\n== %s ==\n' "$*"; }

step "Node.js を確認します"
if ! command -v node >/dev/null 2>&1; then
  say "エラー: node が見つかりません。https://nodejs.org/ から Node.js 18 以上を入れてください。"
  exit 1
fi
NODE_VERSION="$(node --version)"
NODE_MAJOR="$(printf '%s' "$NODE_VERSION" | sed 's/^v\([0-9]*\).*/\1/')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  say "エラー: Node.js $NODE_VERSION です。18 以上が必要です（fetch を使うため）。"
  exit 1
fi
say "OK   Node.js $NODE_VERSION"

step "設定ファイルを用意します"
if [ -f "$HERE/.env" ]; then
  say "OK   promo/youtube/.env は既にあります（上書きしません）"
else
  cp "$HERE/.env.example" "$HERE/.env"
  say "OK   promo/youtube/.env を作りました"
fi
chmod 600 "$HERE/.env" 2>/dev/null || true

step "動画の置き場所を用意します"
mkdir -p "$HERE/video"
touch "$HERE/video/.gitkeep"
say "OK   promo/youtube/video/"

step "いまの状態"
cd "$ROOT/promo"
node youtube/yt.mjs check --offline || true

cat <<'EOS'

== 次にやること ==

1. Google Cloud コンソールで「YouTube Data API v3」を有効にする
   https://console.cloud.google.com/apis/library/youtube.googleapis.com

2. 同じプロジェクトで OAuth クライアントを作る（種類は「デスクトップアプリ」）
   https://console.cloud.google.com/apis/credentials
   ※ 公開ステータスが「テスト」のままの場合は、OAuth 同意画面の
     「テストユーザー」に自分の Google アカウントを追加してください。

3. 出てきたクライアント ID とシークレットを promo/youtube/.env に貼る
     YT_CLIENT_ID=...
     YT_CLIENT_SECRET=...

4. ログインして更新トークンを取る（ブラウザが開きます）
     cd promo && node youtube/yt.mjs auth

5. 宣伝動画を promo/youtube/video/promo.mp4 に置く

6. 確認して投稿する
     cd promo && node youtube/yt.mjs check
     cd promo && node youtube/yt.mjs upload --dry-run   # 送信せず内容だけ表示
     cd promo && node youtube/yt.mjs upload

投稿するタイトル・説明・タグは promo/youtube/metadata.md を編集してください。
詳しくは promo/youtube/README.md にあります。
EOS
