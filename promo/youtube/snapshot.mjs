#!/usr/bin/env node
// Append one line of per-video view counts to views.jsonl.
//
// The goal is a growth *rate*, and a rate cannot be read off a single reading.
// Analytics lags ~2 days, which is longer than the entire life of a Short's
// distribution — by the time a number arrives there the decision it should have
// informed has already been made six times. So the counts come from the
// realtime videos.list endpoint and the history is kept here.
//
//   node youtube/snapshot.mjs          record one sample
//   node youtube/snapshot.mjs --rate   record, then print per-video velocity
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { channelVideos } from './yt.mjs';

const FILE = new URL('./views.jsonl', import.meta.url).pathname;

export function history() {
  if (!existsSync(FILE)) return [];
  return readFileSync(FILE, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

export async function record() {
  const vs = await channelVideos();
  const row = {
    at: new Date().toISOString(),
    total: vs.reduce((n, v) => n + (v.views || 0), 0),
    v: Object.fromEntries(vs.map(v => [v.id, v.views || 0])),
  };
  appendFileSync(FILE, JSON.stringify(row) + '\n');
  return row;
}

/**
 * Views per hour for each video between the newest sample and the newest
 * sample at least `minGapHours` older. Returns null when the history is too
 * short to support a rate — an honest null beats a number divided by a gap so
 * small that rounding dominates it.
 */
export function rates(minGapHours = 0.5) {
  const h = history();
  if (h.length < 2) return null;
  const now = h[h.length - 1];
  const t1 = new Date(now.at);
  let prev = null;
  for (let i = h.length - 2; i >= 0; i--) {
    if ((t1 - new Date(h[i].at)) / 36e5 >= minGapHours) { prev = h[i]; break; }
  }
  if (!prev) return null;
  const hours = (t1 - new Date(prev.at)) / 36e5;
  const per = {};
  for (const id of Object.keys(now.v)) {
    per[id] = { views: now.v[id], gained: now.v[id] - (prev.v[id] ?? 0) };
    per[id].perHour = +(per[id].gained / hours).toFixed(2);
  }
  return { hours: +hours.toFixed(2), from: prev.at, to: now.at,
    total: now.total, totalGained: now.total - prev.total,
    totalPerHour: +((now.total - prev.total) / hours).toFixed(2), per };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const row = await record();
  console.log(`${row.at}  total=${row.total}`);
  if (process.argv.includes('--rate')) {
    const r = rates();
    if (!r) { console.log('(履歴が足りない。次の記録を待つ)'); }
    else {
      console.log(`\n${r.hours}時間で 合計 +${r.totalGained} (${r.totalPerHour}/h)`);
      for (const [id, p] of Object.entries(r.per)) {
        if (p.gained) console.log(`  ${id}  ${p.views}v  +${p.gained}  ${p.perHour}/h`);
      }
    }
  }
}
