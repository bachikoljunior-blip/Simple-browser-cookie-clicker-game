#!/usr/bin/env bash
# RETIRED 2026-08-04 — not wired to anything, and the behaviour it enforced is
# gone. This blocked the Stop event to ask whether ending was really best, back
# when the mandate said to ask that every single turn. The mandate now says the
# opposite: one run a day, three steps, then stop. Ending is allowed.
#
# It was never registered in .claude/settings.json, so removing it changes
# nothing at runtime. Kept only so that a future reader who finds it does not
# wire it back up.
# Asks, at the moment of stopping, whether stopping is the best move.
#
# The instruction to ask that lives in CLAUDE.md, and instructions fade — that is
# the whole reason the mandate is re-injected every turn. This is the version
# with teeth: a Stop hook can refuse the stop and hand back a reason, so the
# question gets asked by the runtime instead of by memory.
#
# It only refuses when there is something objectively unfinished:
#
#   * a render is still running    — the usual reason for stopping is "waiting
#                                    for it", and waiting is the thing to avoid;
#                                    there is always work that does not touch
#                                    video/frames
#   * work is uncommitted          — an unpushed change is invisible to every
#                                    future run, and this session is not durable
#   * 現在の作業 names a next step  — the journal's own pointer says what to do
#
# Otherwise it allows the stop and only prints the question.
#
# RATE LIMITED ON PURPOSE. Blocking is a loop: refuse, work, try to stop, refuse.
# Without a floor between refusals a single stop turns into an unbounded run, so
# it declines to block twice inside the window and lets the stop through.
# Failing open everywhere else, for the same reason: a guard that can wedge the
# session is worse than no guard.
set -u

STAMP="${TMPDIR:-/tmp}/promo-stop-check.stamp"
WINDOW=180          # seconds; at most one refusal per window

root="${CLAUDE_PROJECT_DIR:-.}"
[ -d "$root/promo" ] || root="$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)" || root="."
cd "$root" 2>/dev/null || exit 0

now=$(date +%s 2>/dev/null) || exit 0
last=0
[ -f "$STAMP" ] && last=$(cat "$STAMP" 2>/dev/null || echo 0)
case "$last" in (*[!0-9]*) last=0;; esac
if [ $((now - last)) -lt "$WINDOW" ]; then exit 0; fi

reasons=""

# Match the node invocation, not any shell whose command line happens to
# mention the script — a `until ! pgrep -f autopost.mjs` waiter matches itself,
# which would make this block forever.
if pgrep -f 'node .*(director|autopost|narrate|encode).*\.mjs' >/dev/null 2>&1; then
  reasons="${reasons}・撮影／エンコードが動いている。完了を待つために止まるのは空白を作る行為。台本・コード・日誌・数字の読み直しなど、video/frames に触らない仕事を進めること。"$'\n'
fi

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  reasons="${reasons}・コミットしていない変更がある。push しなければ次の実行からは存在しないのと同じ。"$'\n'
fi

step=$(sed -n '/^## 現在の作業/,/^### /p' promo/youtube/JOURNAL.md 2>/dev/null \
  | grep -m1 '次の1歩' | sed 's/^[[:space:]-]*//' | cut -c1-160)
if [ -n "$step" ]; then
  reasons="${reasons}・日誌の現在の作業: ${step}"$'\n'
fi

if [ -z "$reasons" ]; then exit 0; fi

printf '%s' "$now" > "$STAMP" 2>/dev/null || true

# jq keeps the multi-line Japanese reason valid as JSON; without it the first
# quote or newline would break the hook and it would fail silently.
if command -v jq >/dev/null 2>&1; then
  printf '%s' "終わる前に、終わることが目標に対して最善か考えること（CLAUDE.md の恒久指令）。いま止まらない理由が挙がっている:

${reasons}
これらを片付けるか、片付けない判断の理由を述べてから終わること。目標は総再生数の成長率の最大化であって、区切りをつけることではない。" \
    | jq -Rs '{decision:"block", reason:.}' 2>/dev/null || true
fi
exit 0
