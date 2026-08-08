#!/usr/bin/env node
// Tokens spent in this container's transcripts, and nothing more.
//
//   node youtube/usage.mjs            since midnight JST
//   node youtube/usage.mjs 16:00      since 16:00 JST today
//
// This used to convert tokens into a share of the weekly plan allowance, and
// that machinery is gone. Two things killed it, both from the user:
//
//   1. 2026-08-08 「別セッション間含めての使用量だからね」 -- the cap counts the
//      whole account, and other sessions run in other containers. Only this
//      project's transcripts exist here (checked: /root/.claude/projects holds
//      exactly one directory), so any total computed here is a fraction of the
//      real one by an unknown amount. It cannot be fixed from inside.
//   2. 2026-08-08 「換算当てになんないから考えなくていいよ」 -- and the two
//      reported percentages never reconciled anyway: one implied 320-640M
//      tokens per percent, the other 35.3M, and no weighting closed a ~10x gap.
//
// Before that it converted to dollars, which was wrong by an unknown factor
// too. Three units tried, three failures. So this prints tokens, says what it
// cannot see, and stops.
//
// What is still worth reading is the ratio at the bottom. Cache reads run
// 150-400x the output tokens, which does not depend on any conversion: the cost
// is set by how long the conversation grew, not by how much was written. The
// lever is folding a session early. Writing tersely is not the lever.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = '/root/.claude/projects';
const arg = process.argv[2];

// JST wall-clock in, UTC out, so "today" means the same thing it does
// everywhere else in this project.
const jst = new Date(Date.now() + 9 * 3600_000);
const [h, m] = (arg || '00:00').split(':').map(Number);
const cut = new Date(Date.UTC(
  jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), h - 9, m || 0, 0));

const tot = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0 };
let n = 0, first = null, last = null;
const dirs = readdirSync(root);

for (const d of dirs)
  for (const f of readdirSync(path.join(root, d)).filter(f => f.endsWith('.jsonl')))
    for (const line of readFileSync(path.join(root, d, f), 'utf8').split('\n')) {
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const u = o.message?.usage;
      if (!u || !o.timestamp) continue;
      const t = new Date(o.timestamp);
      if (t < cut) continue;
      n++; first ??= t; last = t;
      tot.in += u.input_tokens || 0;
      tot.out += u.output_tokens || 0;
      tot.cacheWrite += u.cache_creation_input_tokens || 0;
      tot.cacheRead += u.cache_read_input_tokens || 0;
    }

if (!n) { console.log('その時刻以降の応答は記録されていません'); process.exit(0); }
const fmt = t => t.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
console.log(`${fmt(first)} → ${fmt(last)}  応答${n}回  （このコンテナの ${dirs.length} プロジェクト）`);
for (const [k, v] of Object.entries(tot)) console.log(`  ${k.padEnd(11)} ${v.toLocaleString().padStart(13)}`);
console.log(`  ${'合計'.padEnd(10)} ${Object.values(tot).reduce((a, b) => a + b, 0).toLocaleString().padStart(13)}`);

console.log(`\n  キャッシュ読込 / 出力 = ${(tot.cacheRead / (tot.out || 1)).toFixed(0)}倍`);
console.log('  → コストを決めるのは書いた量ではなく会話の長さ。効かせる手は「短く畳む」。');
console.log('\n  ※ %には換算しない（ユーザー指示 2026-08-08）。ドルにも換算しない。');
console.log('  ※ 予算の上限は全セッション合計に対するもので、他セッションは別コンテナ。');
console.log('     ここで見えるのは一部だけなので、残量はこのコンテナから出せない。');
