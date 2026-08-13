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
import { videoStats, trafficSources, trafficDetail, retention, byHour, channel,
  yppProgress, accessToken } from './yt.mjs';

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

  // The curve as a curve, not two endpoints. Reducing it to 開始→終了 was my
  // own shortcut and it threw away the only thing a curve says that an average
  // does not: WHERE people leave. A beat that loses a third of the audience is
  // a beat that can be rewritten; "51.2% on average" is not.
  //
  // 40 columns of ▁▂▃▄▅▆▇█ over the whole video, scaled to that video's own
  // maximum so the shape reads regardless of level. Above 1.00 is loop
  // rewatching, which is why the scale is printed rather than assumed to be 1.
  // A plotted curve, not a one-row sparkline.
  //
  // The sparkline was the second version of this. The first reduced the whole
  // curve to 開始→終了, which threw away the only thing a curve says that an
  // average does not: WHERE people leave. The sparkline kept the shape but put
  // each video on its own row, scaled to its own maximum — so two curves could
  // not be compared, which is the question actually being asked ("which cut
  // holds better, and from when"). Two rows of ▂▃▄ next to each other look
  // similar whatever they are.
  //
  // This draws one grid with a real y axis in retention units and a real x axis
  // in seconds, and overlays the videos on it. Shared axes are the whole point:
  // the comparison is read off the picture instead of off my summary of it.
  const MARKS = ['#', 'o', 'x', '+'];
  const plot = (series, rows = 14, cols = 56) => {
    const hi = Math.max(1, ...series.flatMap(s => s.pts.map(p => p.watch)));
    const maxT = Math.max(...series.map(s => s.seconds || 1));
    const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));
    series.forEach((s, si) => {
      const ch = MARKS[si % MARKS.length];
      for (const p of s.pts) {
        const x = Math.min(cols - 1, Math.round((p.at / maxT) * (cols - 1)));
        const y = Math.min(rows - 1, Math.max(0, Math.round((1 - p.watch / hi) * (rows - 1))));
        // First writer wins, so an earlier (higher-placed in the legend) series
        // is never erased by a later one drawing over the same cell. Overlap is
        // reported in the legend order rather than hidden.
        if (grid[y][x] === ' ') grid[y][x] = ch;
      }
    });
    const lines = grid.map((r, i) => {
      const v = hi * (1 - i / (rows - 1));
      const label = (i === 0 || i === rows - 1 || i % 3 === 0) ? v.toFixed(2).padStart(5) : '     ';
      return `            ${label} │${r.join('')}`;
    });
    lines.push(`                  └${'─'.repeat(cols)}`);
    lines.push(`                   0s${' '.repeat(Math.max(1, cols - 10))}${maxT.toFixed(0)}s`);
    return lines;
  };
  // Where the audience actually goes, expressed as the steepest fall between
  // adjacent columns and the second it happens at.
  const worstDrop = (pts, seconds) => {
    let at = 0, d = 0;
    const step = Math.max(1, Math.floor(pts.length / 40));
    for (let i = step; i < pts.length; i += step) {
      const f = pts[i - step].watch - pts[i].watch;
      if (f > d) { d = f; at = pts[i].at ?? (i / pts.length) * seconds; }
    }
    return { d, at };
  };

  const series = [];
  for (const v of stats.slice(0, 4)) {
    try {
      const c = await retention(v.id);
      const p = (c.points || []).filter(x => typeof x.watch === 'number');
      if (p.length) series.push({ title: v.title || '', views: v.views, seconds: c.seconds, pts: p });
    } catch {}
  }
  if (series.length) {
    row('維持曲線', `直近${series.length}本を同じ軸に重ねたもの（縦=維持率・1.00超はループ再視聴、横=秒）`);
    out.push(...plot(series));
    for (const [i, s] of series.entries()) {
      const w = worstDrop(s.pts, s.seconds);
      // The reading, not just the picture. A curve I print and do not conclude
      // from is the same failure as a check that prints instead of stopping:
      // it leaves the work to whoever reads the log. 0.15 over one sampling
      // step is the line between "a beat lost them" and "they bled out evenly"
      // — every curve measured so far has come in at 0.12–0.18, which is why
      // 「離脱しているビートを直す」 is not currently an available move.
      const shape = w.d >= 0.15 ? `崖あり @${w.at.toFixed(1)}s ← ここは直せる場所` : '崖なし（全体で薄く漏れている）';
      out.push(`            ${MARKS[i % MARKS.length]} ${(s.title || '').slice(0, 14).padEnd(16)}`
        + `${String(s.views).padStart(4)}回 ${s.seconds}s  `
        + `開始 ${s.pts[0].watch.toFixed(2)} → 終了 ${s.pts[s.pts.length - 1].watch.toFixed(2)}  `
        + `最大の落ち ${w.d.toFixed(2)}  ${shape}`);
    }
    // The comparison the shared axis exists to make, stated in one line so it
    // cannot be skipped: retention and reach have not tracked each other on
    // this channel, and that fact is easy to forget while looking at a curve.
    const best = [...series].sort((a, b) => b.pts.reduce((x, p) => x + p.watch, 0) / b.pts.length
      - a.pts.reduce((x, p) => x + p.watch, 0) / a.pts.length)[0];
    const most = [...series].sort((a, b) => b.views - a.views)[0];
    out.push(`            ※ いちばん見られたのは「${(most.title || '').slice(0, 12)}」(${most.views}回)、`
      + `いちばん維持が高いのは「${(best.title || '').slice(0, 12)}」`
      + `${best === most ? ' —— 今回は一致した' : ' —— 一致していない。維持を上げても配信は増えていない'}`);
  }
}

// YPP progress uses API-visible proxies. YouTube Studio's Earn tab is the final
// source for "valid public watch hours" and "valid public Shorts views"; those
// counters include adjustments the Analytics API does not expose.
try {
  const p = await yppProgress();
  const after2027 = Date.now() >= Date.parse('2027-02-01T00:00:00Z');
  const watchGoal = after2027 ? 8000 : 4000;
  const shortGoal = after2027 ? 20_000_000 : 10_000_000;
  row('YPP長尺', `${p.qualifiedWatchHoursProxyLowerBound.toFixed(1)}時間/365日 下限proxy（目標 ${watchGoal.toLocaleString()}）`);
  row('YPP短尺', `${p.qualifiedShortsViewsProxy.toLocaleString()}有効視聴/90日 proxy（目標 ${shortGoal.toLocaleString()}）`);
  row('YPP登録', `${p.subscribers.toLocaleString()}人（広告分配目標 1,000）`);
  row('分析遅延', p.analyticsLatestDay
    ? `最新 ${p.analyticsLatestDay}（約${p.analyticsLagDays}日遅れ）`
    : 'Analytics未反映');
} catch (e) { gap('YPP進捗', String(e.message || e).slice(0, 40)); }

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
  // 2026-08-10 から、自分で参加型の問いをコメントとして置いている（ask.mjs）。
  // **自分の問いと視聴者の返答を分けないと、置いた瞬間に「コメントが増えた」に
  // 見えて、いちばん見たい信号（初めて視聴者が何か言った）が消える。**
  // 自分のコメントは channelId で判定する —— 本文の一致では、問いの文面を
  // 変えた瞬間に自分のものが視聴者側へ流れ込む。
  const mine = (await channel()).id;
  let own = 0, theirs = 0, sample = [];
  for (const v of stats.slice(0, 8)) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&maxResults=20&videoId=${v.id}`,
      { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) continue;
    for (const it of ((await r.json()).items || [])) {
      const s = it.snippet.topLevelComment.snippet;
      const byMe = s.authorChannelId?.value === mine;
      if (byMe) { own++; continue; }
      theirs++;
      if (sample.length < 3) sample.push(`${s.authorDisplayName}「${s.textOriginal.slice(0, 30)}」`);
    }
  }
  row('コメント', theirs
    ? `視聴者 ${theirs}件 ★★ 読んで返信すること: ${sample.join(' / ')}`
    : `視聴者 0件（直近8本）／自分の問い ${own}件`);
  // 問いには約束が入っている（「いちばん多かったものを次に作ります」「答え合わせします」）。
  // 票が入ったのに集計しないのは、視聴者に嘘をついたことになる（指示11）。
  if (theirs) row('', '↑ 参加型の問いに返答がある。番号を数えて次の切り口を決め、返信すること');
} catch (e) { gap('コメント', String(e.message || e).slice(0, 40)); }

// Kept in the list although it cannot be fetched. Removing it would remove the
// reminder that distribution is unmeasured, which is the gap most likely to be
// filled with a story.
row('配信量', '取得不可 —— impressions / impressionsCtr は Analytics API に無い（8/9 実測）');
// 8/10 に一度測った（rivals.mjs / 75本）。search.list は1回100 units 使うので
// 毎回は撃たない。数字が古くなったと感じたら探索の回で撃ち直すこと。
row('同ジャンル', '8/10 実測: 上位75本の尺の中央値 28s（全20本が11〜15秒の私たちは最も薄い帯）'
  + '／参加型は同じ題材でコメント1000〜2800（私たちは0）。再測は node promo/youtube/rivals.mjs');

console.log('── 材料（全部読む）─────────────────────');
console.log(out.join('\n'));
// A summary that says "all read" while rows show ? or "cannot compare" is the
// exact failure this file exists to prevent, and the first version of this
// footer did it. So the rows are re-read here rather than trusting the counter.
const suspect = out.filter(l => /[?？]|まだ比較できない|★未取得/.test(l)).length;
console.log(suspect
  ? `  ★ 読めていない行が ${suspect} 件ある。埋めるか、埋められない理由を行に書くこと。`
  : '  取れるものは全部読んだ。取得不可のものは理由つきで上に残してある。');
