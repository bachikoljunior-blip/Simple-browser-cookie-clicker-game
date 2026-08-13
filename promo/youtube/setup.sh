#!/usr/bin/env bash
# Installs what the render pipeline needs. Scheduled runs start in a fresh
# container, so ffmpeg and the Japanese speech synthesiser are not there yet;
# the browser is (PLAYWRIGHT_BROWSERS_PATH is already set).
#
# Safe to re-run: everything is skipped if already present.
set -euo pipefail

need() { ! command -v "$1" >/dev/null 2>&1; }

if need ffmpeg || need open_jtalk; then
  echo "installing render dependencies ..."
  apt-get update -qq
  # ffmpeg: the bundled one can only do VP8 and has no audio codecs at all.
  # open-jtalk + dictionary + voice: the narration.
  apt-get install -y -qq ffmpeg open-jtalk open-jtalk-mecab-naist-jdic \
    hts-voice-nitech-jp-atr503-m001
fi

command -v ffmpeg    >/dev/null || { echo "ffmpeg missing after install"; exit 1; }
command -v open_jtalk >/dev/null || { echo "open_jtalk missing after install"; exit 1; }

# The game has to be served over http:// for the capture to load it.
if ! curl -sf -o /dev/null http://localhost:8765/play.html; then
  echo "starting local server on :8765 ..."
  ( cd "$(dirname "$0")/../.." && nohup python3 -m http.server 8765 >/tmp/promo-server.log 2>&1 & )
  for _ in $(seq 1 20); do
    curl -sf -o /dev/null http://localhost:8765/play.html && break
    sleep 0.5
  done
fi
curl -sf -o /dev/null http://localhost:8765/play.html || { echo "server did not come up"; exit 1; }

echo "ready: $(ffmpeg -version | head -1 | cut -d' ' -f1-3), open_jtalk, server on :8765"
