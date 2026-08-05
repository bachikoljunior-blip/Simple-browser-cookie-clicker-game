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

// --- 予算に対する位置 -----------------------------------------------------------
// The budget is denominated in a share of the user's weekly plan allowance, and
// on 2026-08-05 they supplied a provisional conversion — 1% = 47M tokens — which
// is the first figure here that can be checked against something. It is written
// to budget.json rather than into this file so the next run reads a number
// instead of remembering one: the remaining share moves every conversation, and
// a container rebuild takes memory with it.
//
// Still no dollars. Percent of plan is the unit the instruction is written in;
// dollars is the unit that was guessed at and came out wrong by an unknown
// factor.
const bPath = new URL('./budget.json', import.meta.url);
let b = null;
try { b = JSON.parse(readFileSync(bPath, 'utf8')); } catch {}
if (b) {
  const since = new Date(b.since);
  const s = { in: 0, out: 0, cw: 0, cr: 0 };
  for (const f of readdirSync(dir).filter(f => f.endsWith('.jsonl'))) {
    for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      const u = d.message?.usage;
      if (!u || !d.timestamp || new Date(d.timestamp) < since) continue;
      s.in += u.input_tokens || 0; s.out += u.output_tokens || 0;
      s.cw += u.cache_creation_input_tokens || 0; s.cr += u.cache_read_input_tokens || 0;
    }
  }
  // Cache reads are counted. They are 300-400x the output tokens here, so a
  // total that leaves them out would say almost nothing was spent.
  const used = s.in + s.out + s.cw + s.cr;
  const cap = b.limitPct * b.tokensPerPct;
  const pct = used / b.tokensPerPct;
  const left = Math.max(0, cap - used);
  console.log(`\n── 予算 ${b.limitPct}% (${b.sinceLabel} から) ──`);
  console.log(`  使った   ${used.toLocaleString().padStart(13)} tok = ${pct.toFixed(2)}%`);
  console.log(`  残り     ${left.toLocaleString().padStart(13)} tok = ${(b.limitPct - pct).toFixed(2)}%  (${(100 * used / cap).toFixed(0)}% 消化)`);
  if (b.tokensPerPctProvisional) {
    console.log(`  ※ 1% = ${(b.tokensPerPct / 1e6)}M はユーザーの暫定値。実測が出たら budget.json を直すこと。`);
  }
  if (used >= cap) console.log('  ※ 超過。畳んで終わること。');
} else {
  console.log('  ※ budget.json が読めないので残量は出せない。ドル換算はしないこと。');
}
