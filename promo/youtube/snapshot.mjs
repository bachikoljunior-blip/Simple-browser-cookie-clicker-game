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
      // Signed, because the total genuinely goes down. YouTube audits view
      // counts after the fact and removes ones it decides were not real: on
      // 2026-08-05 a video dropped 768 -> 751 with nothing published in between.
      // A hard-coded "+" printed that as "+-17", which reads as a glitch rather
      // than as the measurement it is.
      const sgn = n => (n >= 0 ? '+' : '') + n;
      console.log(`\n${r.hours}時間で 合計 ${sgn(r.totalGained)} (${r.totalPerHour}/h)`);
      if (r.totalGained < 0) {
        console.log('  ※ 合計が減っています。YouTube の再生数の事後監査（無効な再生の取り消し）です。');
        console.log('     成長率は投稿と無関係に負になりうるので、1回の負の値で判断を変えないこと。');
      }
      for (const [id, p] of Object.entries(r.per)) {
        if (p.gained) console.log(`  ${id}  ${p.views}v  ${sgn(p.gained)}  ${p.perHour}/h`);
      }
    }
  }
}

// --- the file commits itself -----------------------------------------------
// views.jsonl is appended every ten minutes by the sampler, so a run that
// changes nothing still ends with a dirty tree. Three runs in a row ended with
// the stop hook asking for the same commit, and preflight printing 未コミット
// did not help — printing a problem and leaving it to whoever reads the line is
// the shape instruction 7 rules out.
//
// So the sampler commits its own data. Once an hour at most: this file grows by
// six lines an hour and a commit per append would bury the branch, while an
// hourly one keeps the tree clean at every point a run could stop.
//
// Only ever stages views.jsonl. A blanket `git add -A` here would sweep up
// whatever else happened to be in flight, which is how automation starts
// committing things nobody looked at.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function autoCommit() {
  const repo = path.resolve(import.meta.dirname, '../..');
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8' }).trim();
  try {
    if (!git('status', '--porcelain', '--', 'promo/youtube/views.jsonl')) return;
    const last = Number(git('log', '-1', '--format=%ct', '--', 'promo/youtube/views.jsonl') || 0);
    if (Date.now() / 1000 - last < 55 * 60) return;      // at most hourly
    git('add', '--', 'promo/youtube/views.jsonl');
    git('commit', '-q', '-m', 'Record the view samples\n\nAppended by the sampler and committed by it, so a run that changes\nnothing still leaves a clean tree.');
    git('push', '-q', 'origin', 'HEAD');
    console.log('  views.jsonl をコミットして push した');
  } catch (e) {
    // Never let bookkeeping break the measurement: the sample is already on
    // disk, and a push can fail for reasons that have nothing to do with it.
    console.log('  views.jsonl の自動コミットに失敗（測定自体は済んでいる）:', String(e.message || e).slice(0, 60));
  }
}
autoCommit();
