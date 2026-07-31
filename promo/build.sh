#!/usr/bin/env bash
# プロモ映像(YouTube ショート用 1080×1920)を一気に作り直す。
#
#   bash promo/build.sh              # 収録から書き出しまで全部
#   bash promo/build.sh --skip-capture   # 収録済みの素材を使って合成だけやり直す
#
# 必要なもの: node(playwright-core は同梱), ffmpeg, python3(素材配信用の簡易サーバ)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMO="$ROOT/promo"
BUILD="$PROMO/build"
OUTDIR="$PROMO/out"
PORT="${PROMO_PORT:-8123}"
SKIP_CAPTURE=0
[[ "${1:-}" == "--skip-capture" ]] && SKIP_CAPTURE=1

mkdir -p "$BUILD" "$OUTDIR" "$PROMO/fonts"

# ── 1. 日本語フォント(Noto Sans JP)を用意する ────────────────────────
if [[ ! -f "$PROMO/fonts/NotoSansJP-Black.ttf" ]]; then
  echo "== fetching Noto Sans JP =="
  CSS="$(curl -sS --max-time 60 "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900" -H "User-Agent: Mozilla/4.0")"
  i=0
  for url in $(printf '%s' "$CSS" | grep -o "https://[^)]*\.ttf"); do
    i=$((i + 1))
    case "$i" in
      1) name=Regular ;;
      2) name=Bold ;;
      3) name=Black ;;
      *) continue ;;
    esac
    curl -sS --max-time 180 -o "$PROMO/fonts/NotoSansJP-$name.ttf" "$url"
  done
  ls -la "$PROMO/fonts"
fi

# ── 2. 素材配信用のローカルサーバ ────────────────────────────────────
SERVER_PID=""
if ! curl -s -o /dev/null "http://127.0.0.1:$PORT/play.html"; then
  echo "== starting static server on :$PORT =="
  (cd "$ROOT" && python3 -m http.server "$PORT" >/dev/null 2>&1) &
  SERVER_PID=$!
  trap '[[ -n "$SERVER_PID" ]] && kill "$SERVER_PID" 2>/dev/null || true' EXIT
  sleep 1.5
fi

# ── 3. ゲームプレイ収録 ──────────────────────────────────────────────
if [[ "$SKIP_CAPTURE" -eq 0 ]]; then
  echo "== capturing gameplay =="
  node "$PROMO/capture-gameplay.js" --url "http://127.0.0.1:$PORT/play.html" --out "$BUILD"
else
  echo "== skipping capture (using $BUILD/frames) =="
fi

# ── 4. BGM ───────────────────────────────────────────────────────────
echo "== generating soundtrack =="
node "$PROMO/make-music.js" --out "$BUILD/bgm.wav" --seconds 50

# ── 5. 合成レンダリング ──────────────────────────────────────────────
echo "== rendering composite =="
node "$PROMO/render-video.js" --url "http://127.0.0.1:$PORT/promo/compositor.html" --out "$BUILD"

# ── 6. 書き出し(音あり / 音なし) ─────────────────────────────────────
echo "== muxing =="
SILENT="$BUILD/promo_shorts_1080x1920.mp4"
cp "$SILENT" "$OUTDIR/promo_shorts_1080x1920_silent.mp4"
# YouTube の音量基準(-14 LUFS)に寄せておく
ffmpeg -y -loglevel error \
  -i "$SILENT" -i "$BUILD/bgm.wav" \
  -af "loudnorm=I=-14:TP=-1.5:LRA=11" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest -movflags +faststart \
  "$OUTDIR/promo_shorts_1080x1920.mp4"

# サムネイル(ショートのカスタムサムネ用)
ffmpeg -y -loglevel error -i "$OUTDIR/promo_shorts_1080x1920.mp4" \
  -ss 44.8 -frames:v 1 -q:v 2 "$OUTDIR/thumbnail_1080x1920.jpg"

ls -la "$OUTDIR"
echo "done."
