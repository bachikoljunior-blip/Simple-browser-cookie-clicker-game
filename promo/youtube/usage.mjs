#!/usr/bin/env node
// Token usage for this session, read out of Claude Code's own transcript.
//
//   node youtube/usage.mjs            since midnight JST
//   node youtube/usage.mjs 16:00      since 16:00 JST today
//
// Reports tokens only, and deliberately stops there. On 2026-08-05 the same
// numbers were multiplied by list API prices and came out at ~$58 for 69
// minutes; the user's actual subscription meter had moved 1-2%. The token
// counts were right and the conversion was wrong by an unknown factor, so a
// dollar figure printed here would be a guess wearing a decimal point.
//
// What the counts are good for is the shape, which does not depend on the
// conversion: on that day cache reads were 419x the output tokens, meaning
// almost nothing was driven by how much was written and almost everything by
// how long the conversation had grown.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const dir = '/root/.claude/projects/-home-user-Simple-browser-cookie-clicker-game';
const arg = process.argv[2];

// JST wall-clock in, UTC out. Anything measured against "today" has to agree
// with the day boundary the rest of this project reports in.
const now = new Date();
const jst = new Date(now.getTime() + 9 * 3600_000);
const [h, m] = (arg || '00:00').split(':').map(Number);
const cut = new Date(Date.UTC(
  jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate(), h - 9, m || 0, 0));

const tot = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0 };
let n = 0, first = null, last = null;

for (const f of readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!line) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    const u = d.message?.usage;
    if (!u || !d.timestamp) continue;
    const t = new Date(d.timestamp);
    if (t < cut) continue;
    n++; first ??= t; last = t;
    tot.in += u.input_tokens || 0;
    tot.out += u.output_tokens || 0;
    tot.cacheWrite += u.cache_creation_input_tokens || 0;
    tot.cacheRead += u.cache_read_input_tokens || 0;
  }
}

if (!n) { console.log('その時刻以降の応答は記録されていません'); process.exit(0); }
const fmt = t => t.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
console.log(`${fmt(first)} → ${fmt(last)}  応答${n}回`);
for (const [k, v] of Object.entries(tot)) console.log(`  ${k.padEnd(11)} ${v.toLocaleString().padStart(12)}`);
console.log(`\n  キャッシュ読込 / 出力 = ${(tot.cacheRead / (tot.out || 1)).toFixed(0)}倍`);
console.log('  ※ ドル換算はしない。2026-08-05 に公開API価格で換算して桁を外した（下記）。');
console.log('     実際の消費はユーザーのプラン残量でしか分からない。聞けたら日誌に記録すること。');
