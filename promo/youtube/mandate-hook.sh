#!/usr/bin/env bash
# Re-injects the standing mandate into the model's context.
#
# CLAUDE.md is read when a session starts. That is not enough: a long session
# gets summarised, and what the summary drops is exactly the part that is not
# being actively worked on — which is how, on 2026-08-04, a whole afternoon went
# into permissions and API keys while the goal (grow the channel) sat untouched.
# The instruction had not been withdrawn; it had faded.
#
# So `.claude/settings.json` wires this to UserPromptSubmit and PostCompact, and
# it prints the mandate section back into context at both points. The mandate
# lives in CLAUDE.md and only there — this reads it, so editing CLAUDE.md is
# still the one way to change what is enforced.
#
#   bash promo/youtube/mandate-hook.sh UserPromptSubmit
#
# Fails open, always. A hook that errors could block the prompt, and a guard that
# can stop the work it guards is worse than no guard: it prints an empty context
# and exits 0 rather than taking the session down with it.
set -u

event="${1:-UserPromptSubmit}"

file="${CLAUDE_PROJECT_DIR:-.}/CLAUDE.md"
[ -f "$file" ] || file="CLAUDE.md"
[ -f "$file" ] || file="$(dirname "$0")/../../CLAUDE.md"

# Part 1 only, and deliberately.
#
# This used to inject everything from the heading to end of file — part 1 (the
# user's instructions) and part 2 (my own working notes) together. Two problems.
# It grows without bound as part 2 accumulates findings, and it is re-sent on
# every single prompt, which spends the weekly budget on re-reading my own notes.
# And it flattens the distinction the file exists to draw: instructions and
# inferences arriving as one undifferentiated block is how my own decisions
# started reading like rules nobody could revise.
#
# What must survive summarisation, a new session, and a rebuilt container is
# part 1. Part 2 stays in CLAUDE.md and gets read while working; the pointer
# below is enough to find it.
body=""
if [ -f "$file" ]; then
  body="$(sed -n '/^# YouTube 投稿の恒久指令/,/^# 第2部/p' "$file" 2>/dev/null \
          | sed '$d' || true)"
  [ -n "$body" ] && body="$body
（第2部「私が決めたこと」は CLAUDE.md にある。**恒久指示ではないので、
根拠が変われば自分の判断で変えてよい**——— 指示13。作業前に読むこと。）"
fi

# jq -Rs is what makes this safe: the mandate is Japanese prose full of quotes,
# backslashes and newlines, and hand-built JSON would break on the first one.
if [ -n "$body" ] && command -v jq >/dev/null 2>&1; then
  printf '%s' "$body" | jq -Rs --arg ev "$event" \
    '{hookSpecificOutput:{hookEventName:$ev,additionalContext:.}}' 2>/dev/null || true
fi
exit 0
