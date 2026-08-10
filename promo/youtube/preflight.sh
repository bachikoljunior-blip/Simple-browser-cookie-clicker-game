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
# The hourly runs check out on a detached HEAD, so `git branch --show-current`
# is empty and this printed '? ← ズレている' every time — a warning that said
# nothing about whether the branch was actually behind. When detached, the
# branch is the single local ref HEAD descends from (the checkout's origin).
branch=$(git branch --show-current 2>/dev/null)
if [ -z "$branch" ]; then
  branch=$(git for-each-ref --format='%(refname:short)' refs/heads 2>/dev/null \
    | while read -r b; do git merge-base --is-ancestor "$b" HEAD 2>/dev/null && echo "$b"; done)
  [ "$(echo "$branch" | wc -w)" = 1 ] || branch=''
fi
head=$(git rev-parse --short HEAD 2>/dev/null || echo '?')
[ -n "$branch" ] && git fetch -q origin "$branch" 2>/dev/null
remote=$(git rev-parse --short "origin/$branch" 2>/dev/null || echo '?')
echo "git HEAD    : $head"
echo "git 枝      : ${branch:-?（detached で特定できない。push は refs/heads/<枝> を明示すること）}"
dirty=$(git status --porcelain 2>/dev/null | wc -l)
echo "git origin  : $remote  $([ "$head" = "$remote" ] && echo '(一致)' || echo '← ズレている。fetch して確かめること')"
echo "未コミット  : ${dirty}件"

# Process names, never command lines: `pgrep -f` matches this script itself.
pgrep -x node >/dev/null && echo "撮影        : node が動いている。新しい撮影を始めないこと" \
                         || echo "撮影        : 走っていない"
pgrep -x sh   >/dev/null && echo "サンプラー  : 生存" \
                         || echo "サンプラー  : 停止 ← 再起動する（README 参照）"

code=$(curl -sf -o /dev/null -w '%{http_code}' http://localhost:8765/play.html 2>/dev/null || echo 000)
[ "$code" = "200" ] && echo "ローカル鯖  : 200" \
                    || echo "ローカル鯖  : 落ちている（$code）（autopost が必要なとき自分で起動します。手で起動しないこと）"

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
# The diagnosis, every run. Retention, likes and subscribers gained sat unread
# for five days because reading them was a note in a journal rather than a line
# in this file. Anything decided to be checked every run belongs here.
node youtube/diag.mjs 2>/dev/null

# 参加型の問いを、公開済みでまだ置いていない本に置く（2026-08-10 の探索）。
#
# なぜ手順書ではなくここか: 予約済み(private)には commentThreads.insert が 403 を返す
# ので、問いは「公開されたあと」に置くしかない。それを回の判断に任せると、
# `yt.mjs` の comment() が書かれてから一度も呼ばれなかったのと同じことになる
# （書いてあるだけの関数は、印字するだけの検査と同じで仕組みではない —— 指示7）。
# ここに置けば、公開された本は次の1時間以内に必ず問いを持つ。
#
# --limit=6 は連投で迷惑コメント扱いされないため。溜まっている分は数時間で片づき、
# そのあとは1日2本ぶんしか出ない。二重投稿は asked.json が止める。
node youtube/ask.mjs --pending --limit=6 2>/dev/null | sed 's/^/  参加型      : /' | grep -v 'skip' || true

# Tokens only. The %-conversion this used to print was retired 2026-08-08: the
# cap counts every session on the account and the others live in other
# containers, so no honest remaining-balance can be computed here.
node youtube/usage.mjs 2>/dev/null | tail -8 | sed 's/^/  /'
echo "───────────────────────────────────────────"
