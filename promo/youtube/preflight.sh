#!/usr/bin/env bash
# Prints the state of everything this project assumes, in one screen.
#
# Every mistake worth naming in this session came from the same place: acting on
# remembered state after the environment had moved underneath. `cd promo` twice
# from a directory that was already promo, so two renders silently never ran. A
# push reported as failed when it had actually landed, because the local git
# history rolled back while origin kept the commit. Frames described as checked
# when only one of three had been opened. `pgrep -f` matching its own command
# line, three separate times.
#
# None of those were hard problems. They were all confident answers to questions
# nobody re-asked. A long session makes memory feel like observation, and the
# container is rebuilt underneath it — background processes die, the server
# stops, uncommitted state disappears.
#
# So this asks the questions again, cheaply, and prints answers rather than
# assumptions. Run it at the start of a run and after anything that could have
# restarted the machine.
#
#   bash promo/youtube/preflight.sh
set -u
cd "$(dirname "$0")/.." || exit 1

echo "── いまの状態 ─────────────────────────────"
echo "cwd(promo)  : $(pwd)"
echo "時刻        : $(TZ=Asia/Tokyo date '+%m/%d %H:%M JST')"

# Local vs origin, because the local log alone has lied here before.
head=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
git fetch -q origin "$(git branch --show-current)" 2>/dev/null
remote=$(git rev-parse --short "origin/$(git branch --show-current)" 2>/dev/null || echo '?')
dirty=$(git status --porcelain 2>/dev/null | wc -l)
echo "git HEAD    : $head"
echo "git origin  : $remote  $([ "$head" = "$remote" ] && echo '(一致)' || echo '← ズレている。fetch して確かめること')"
echo "未コミット  : ${dirty}件"

# Process names, never command lines: `pgrep -f` matches this script itself.
pgrep -x node >/dev/null && echo "撮影        : node が動いている。新しい撮影を始めないこと" \
                         || echo "撮影        : 走っていない"
pgrep -x sh   >/dev/null && echo "サンプラー  : 生存" \
                         || echo "サンプラー  : 停止 ← 再起動する（README 参照）"

code=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:8765/play.html 2>/dev/null || echo 000)
[ "$code" = "200" ] && echo "ローカル鯖  : 200" \
                    || echo "ローカル鯖  : 落ちている（$code）← setup.sh を背後で起動する"

for v in YT_CLIENT_ID YT_CLIENT_SECRET YT_REFRESH_TOKEN GOOGLE_TTS_API_KEY; do
  [ -n "${!v:-}" ] || echo "認証        : $v が無い ← 投稿できない"
done

# The one number that says whether publishing survives an outage.
node -e "
import('./youtube/yt.mjs').then(async m => {
  const t = await m.accessToken();
  const vs = await m.channelVideos();
  const r = await fetch('https://www.googleapis.com/youtube/v3/videos?part=status&id=' + vs.map(v=>v.id).join(','), {headers:{Authorization:'Bearer '+t}});
  const q = (await r.json()).items.filter(i => i.status.publishAt).map(i => i.status.publishAt).sort();
  if (!q.length) return console.log('予約        : 0本 ← 途切れる');
  const last = new Date(q[q.length-1]);
  const days = ((last - Date.now()) / 86400000).toFixed(1);
  console.log(\`予約        : \${q.length}本、最後は \${last.toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})}（あと\${days}日）\`);
  console.log('              ※ 直後にアップした分は検索索引の遅れで数分間ここに出ない。');
  console.log('                 足りないように見えても、作り直す前に videos?id=<id> で直接見ること。');
}).catch(e => console.log('予約        : 取得できず —', String(e.message||e).slice(0,60)));
" 2>/dev/null
echo "───────────────────────────────────────────"
