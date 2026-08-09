#!/usr/bin/env node
// Every source this project can obtain, read on every run.
//
// The failure this replaces happened three times in one day: a data source
// existed, went unread for days, and only surfaced when someone asked whether
// everything was being used. Retention, likes, subscribers gained, traffic
// split, and then the retention curve — each found by being asked, not by the
// design.
//
// So the inventory itself is the mechanism. SOURCES below is the list of what
// is obtainable; every entry prints either its number or 未取得 with the reason,
// and the footer counts how many are unread. A gap is visible every hour
// instead of whenever it occurs to someone to check.
//
// Adding a capability means adding a row here. A row that cannot be fetched
// stays in the list saying why — 削除しないこと: a removed row is a gap that
// stops being visible, which is how the analytics dismissal survived five days.
import { videoStats, trafficSources, trafficDetail, retention, byHour, channel, accessToken } from './yt.mjs';

const LABEL = {
  SHORTS: 'Shortsフィード', YT_SEARCH: '検索', SUBSCRIBER: '登録者フィード',
  YT_CHANNEL: 'チャンネルページ', RELATED_VIDEO: '関連動画', EXT_URL: '外部',
  NO_LINK_OTHER: '直接', YT_OTHER_PAGE: 'その他ページ',
};
const pad = (s, n) => String(s).padEnd(n, '　');
const out = [];
let missing = 0;
const row = (name, text) => out.push(`  ${pad(name, 8)}: ${text}`);
const gap = (name, why) => { missing++; out.push(`  ${pad(name, 8)}: ★未取得 — ${why}`); };

let stats = [];
try {
  stats = (await videoStats(28)).filter(v => v.views > 20)
    .sort((a, b) => (Date.parse(b.publishedAt || 0) || 0) - (Date.parse(a.publishedAt || 0) || 0));
} catch (e) { gap('動画別', String(e.message || e).slice(0, 40)); }

if (stats.length) {
  const newest = new Date(stats[0].publishedAt)
    .toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
  row('動画別', `${stats.length}本（最新 ${newest} 公開・Analytics は約2日遅れ）`);
  out.push('            再生   維持%  いいね 登録者増');
  for (const v of stats.slice(0, 5)) {
    out.push('            ' + String(v.views).padStart(5) + String(v.avgViewPercent ?? '-').padStart(8) + '%'
      + String(v.likes ?? 0).padStart(5) + String(v.subscribersGained ?? 0).padStart(5)
      + '  ' + (v.title || '').slice(0, 20));
  }
  const subs = stats.slice(0, 5).reduce((a, v) => a + (v.subscribersGained || 0), 0);
  const likes = stats.slice(0, 5).reduce((a, v) => a + (v.likes || 0), 0);
  if (!subs) out.push('            ※ 登録者増 0 —— 前の動画が次を助けていない。伸びは線形のまま');
  if (!likes) out.push('            ※ いいね 0 —— 戻ってくる理由が作れていない');

  // The curve, not just the average: the average cannot tell "held the opening"
  // from "held the ending", and a theory about hooks lives or dies on that.
  // 1.00 超はループ再視聴。
  const curves = [];
  for (const v of stats.slice(0, 3)) {
    try {
      const p = (await retention(v.id)).points.filter(x => typeof x.watch === 'number');
      if (p.length) curves.push(`${(v.title || '').slice(0, 10)} ${p[0].watch.toFixed(2)}→${p[p.length - 1].watch.toFixed(2)}`);
    } catch {}
  }
  curves.length ? row('維持曲線', '開始→終了  ' + curves.join(' / ')) : gap('維持曲線', '取れなかった');
}

try {
  const t = await trafficSources(28);
  const tot = t.reduce((a, r) => a + (r.views || 0), 0) || 1;
  row('流入', [...t].sort((a, b) => b.views - a.views).slice(0, 3)
    .map(r => `${LABEL[r.insightTrafficSourceType] || r.insightTrafficSourceType} ${Math.round(100 * r.views / tot)}%`).join(' / '));
} catch (e) { gap('流入', String(e.message || e).slice(0, 40)); }

try {
  const d = await trafficDetail('YT_SEARCH', 28);
  row('検索語', d.length ? d.slice(0, 4).map(r => `${r.insightTrafficSourceDetail}(${r.views})`).join(' / ') : 'なし');
} catch (e) { gap('検索語', String(e.message || e).slice(0, 40)); }

try {
  // Fields read from byHour's source, not guessed: {hour, n, views, best}.
  // views is already the per-video mean. Three wrong field-name guesses in one
  // evening is why this comment names them.
  const h = await byHour(90, 9);
  h.length
    ? row('公開時刻', h.slice(0, 4).map(r => `${r.hour}時 ${r.views}/本(n=${r.n})`).join(' / '))
    : gap('公開時刻', '90日以内の公開が無い');
} catch (e) { gap('公開時刻', String(e.message || e).slice(0, 40)); }

try {
  // {subscribers, views, videos} — not the raw statistics field names.
  const c = await channel();
  row('チャンネル', `登録者 ${c.subscribers} / 総再生 ${c.views.toLocaleString()} / 本数 ${c.videos}`);
} catch (e) { gap('チャンネル', String(e.message || e).slice(0, 40)); }

// Comments have been zero every time they were looked at, which is exactly why
// this belongs in the loop: the first one to arrive is the first direct thing a
// viewer has ever said, and nothing else would surface it.
try {
  const tok = await accessToken();
  let n = 0, sample = [];
  for (const v of stats.slice(0, 8)) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=10&videoId=${v.id}`,
      { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) continue;
    for (const it of ((await r.json()).items || [])) {
      n++; if (sample.length < 2) sample.push(it.snippet.topLevelComment.snippet.textOriginal.slice(0, 40));
    }
  }
  row('コメント', n ? `${n}件 ★読むこと: ${sample.join(' / ')}` : '0件（直近8本）');
} catch (e) { gap('コメント', String(e.message || e).slice(0, 40)); }

// Kept in the list although it cannot be fetched. Removing it would remove the
// reminder that distribution is unmeasured, which is the gap most likely to be
// filled with a story.
row('配信量', '取得不可 —— impressions / impressionsCtr は Analytics API に無い（8/9 実測）');
row('同ジャンル', '未着手 —— 他チャンネルの Shorts を一度も見ていない（API 外・要 WebSearch）');

console.log('── 材料（全部読む）─────────────────────');
console.log(out.join('\n'));
// A summary that says "all read" while rows show ? or "cannot compare" is the
// exact failure this file exists to prevent, and the first version of this
// footer did it. So the rows are re-read here rather than trusting the counter.
const suspect = out.filter(l => /[?？]|まだ比較できない|★未取得/.test(l)).length;
console.log(suspect
  ? `  ★ 読めていない行が ${suspect} 件ある。埋めるか、埋められない理由を行に書くこと。`
  : '  取れるものは全部読んだ。取得不可のものは理由つきで上に残してある。');
