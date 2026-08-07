#!/usr/bin/env node
// Token usage for this session, read out of Claude Code's own transcript.
//
//   node youtube/usage.mjs            since midnight JST
//   node youtube/usage.mjs 16:00      since 16:00 JST today
//
// Still no dollars. On 2026-08-05 these same numbers were multiplied by list
// API prices and came out at ~$58 for 69 minutes, against a subscription meter
// that had moved 1-2%. The token counts were right; the conversion was wrong by
// an unknown factor.
//
// The budget is denominated in a share of the weekly plan allowance, so what is
// needed is tokens -> percent. Every percentage the user has ever reported is
// kept in budget.json under `observations`, and this file re-derives the implied
// rate from each one against the transcript rather than trusting a single
// remembered figure.
//
// As of 2026-08-06 the two observations DO NOT AGREE -- not under raw token
// totals, not under API-style weighting, not under any of the four models
// tested. They are ~10x apart. That disagreement is printed rather than
// averaged away, because an averaged number would look like knowledge.
//
// And the reports themselves are not ground truth. The user said so directly:
// 「私の実測もズレてる可能性もあります」. So there is no correct rate to find here,
// only a range -- which is why the balance prints as a range. Acting on the
// conservative end costs an at-bat if it is wrong; acting on the optimistic end
// breaks instruction 4 if it is wrong, and those are not the same size.
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

// Re-derive tokens-per-percent from every figure the user has ever given, by
// re-counting that window out of the transcript. Adding a new report means
// editing budget.json, not this file.
const window = (from, to) => {
  const a = Date.parse(from), z = Date.parse(to);
  const w = { in: 0, out: 0, cw: 0, cr: 0, n: 0 };
  for (const f of readdirSync(dir).filter(f => f.endsWith('.jsonl')))
    for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) {
      if (!line) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      const u = d.message?.usage, t = Date.parse(d.timestamp || '');
      if (!u || !(t >= a && t <= z)) continue;
      w.in += u.input_tokens || 0; w.out += u.output_tokens || 0;
      w.cw += u.cache_creation_input_tokens || 0; w.cr += u.cache_read_input_tokens || 0; w.n++;
    }
  return w;
};
const total = w => w.in + w.out + w.cw + w.cr;

let rate = b?.tokensPerPct;
if (b?.observations?.length) {
  console.log('\n── 較正の材料（ユーザーが実際に言った%）──');
  const implied = [];
  for (const o of b.observations) {
    const w = window(o.from, o.to);
    const hi = total(w) / o.pctLo, lo = total(w) / o.pctHi;
    implied.push({ o, lo, hi });
    const r = lo === hi ? `${(lo / 1e6).toFixed(1)}M` : `${(lo / 1e6).toFixed(0)}M〜${(hi / 1e6).toFixed(0)}M`;
    console.log(`  ${o.label}`);
    console.log(`    応答${w.n}回 / ${total(w).toLocaleString()} tok → 1% = ${r}`);
  }
  // Overlap test. Two windows that describe the same meter should agree.
  const lo = Math.max(...implied.map(x => x.lo)), hi = Math.min(...implied.map(x => x.hi));
  if (implied.length > 1 && lo > hi) {
    console.log('  ★ 一致しない。同じ計器を測っているなら重なるはずの範囲が重なっていない。');
    console.log('     どちらかの申告か、窓の解釈か、「トークン数に比例する」という前提が誤り。');
    console.log('     → 保守側（いちばん小さい値）を採る。ユーザーが次の数字を出したら再検算すること。');
  }
  rate = Math.min(...implied.map(x => x.lo));            // 保守端＝行動を決める側
  var rateOpt = Math.max(...implied.map(x => x.hi));     // 楽観端＝幅を示す側
  console.log('  ※ ユーザー自身が「私の実測もズレてる可能性もある」と述べている。');
  console.log('     どれも真値ではなく申告。正解は無く、あるのは幅だけ。');
}

if (b && rate) {  const since = new Date(b.since);
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
  const cap = b.limitPct * rate;
  const pct = used / rate;
  const left = Math.max(0, cap - used);
  console.log(`\n── 予算 ${b.limitPct}% (${b.sinceLabel} から) ──`);
  console.log(`  使った   ${used.toLocaleString().padStart(13)} tok = ${pct.toFixed(2)}%`);
  console.log(`  残り     ${left.toLocaleString().padStart(13)} tok = ${(b.limitPct - pct).toFixed(2)}%  (${(100 * used / cap).toFixed(0)}% 消化)`);
  if (typeof rateOpt === 'number' && rateOpt > rate) {
    const pctOpt = used / rateOpt;
    console.log(`\n  幅で言うと: 使ったのは ${pctOpt.toFixed(2)}% 〜 ${pct.toFixed(2)}%、`
      + ` 残りは ${(b.limitPct - pct).toFixed(2)}% 〜 ${(b.limitPct - pctOpt).toFixed(2)}%。`);
    console.log(`  上の行は保守端（1% = ${(rate / 1e6).toFixed(1)}M）で出している。行動はこちらで決める。`);
    console.log('  幅が広いあいだは、%を当てにせず「会話を短く畳む」ほうで効かせること');
    // Ratio from the budget window, not the since-midnight window: run early in
    // a session the latter is empty and printed "0倍", which says the opposite of
    // what the line is for.
    const w = window(b.since, new Date().toISOString());
    console.log(`  （キャッシュ読込は出力の${(w.cr / (w.out || 1)).toFixed(0)}倍。どのモデルでもこの向きは同じ）。`);
  }
  if (used >= cap) console.log('  ※ 超過。畳んで終わること。');
} else {
  console.log('  ※ budget.json が読めないので残量は出せない。ドル換算はしないこと。');
}
