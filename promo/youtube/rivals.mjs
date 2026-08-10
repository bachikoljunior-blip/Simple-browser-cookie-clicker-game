#!/usr/bin/env node
// 同ジャンルの Shorts を実際に見るための道具。
//
// なぜ要るか: 流入の97%が Shorts フィードなのに、そのフィードで自分の隣に何が
// 並んでいるかを一度も見ていなかった（diag.mjs が毎回「未着手」と印字していた）。
// WebSearch でも記事は読めるが、**再生数が入った実データ**が要る。検索の
// スニペットは「伸びている」と書いてあっても数字を出さない。
//
// 使い方:
//   node promo/youtube/rivals.mjs                 # 既定の問い合わせ語で90日
//   node promo/youtube/rivals.mjs 30 "放置ゲーム"  # 日数と語を指定
//
// 注意: search.list は 1回 100 units。既定で5語なので 500 units 使う。
// 1日の割当は 10,000 なので、**毎回の運転で撃たないこと。** 探索の回だけ。

import { accessToken } from './yt.mjs';

const DATA_API = 'https://www.googleapis.com/youtube/v3';

const DEFAULT_QUERIES = [
  '放置ゲーム',
  'クッキークリッカー',
  'インクリメンタルゲーム',
  '個人開発 ゲーム',
  '放置ゲー 紹介',
];

async function api(path) {
  const token = await accessToken();
  const res = await fetch(`${DATA_API}/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path.split('?')[0]} -> ${res.status}: ${body?.error?.message || ''}`);
  return body;
}

// ISO8601 の PT#M#S を秒に。Shorts の判定は尺なので、ここは落とせない。
function seconds(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(iso || '');
  if (!m) return null;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

async function search(q, days) {
  const after = new Date(Date.now() - days * 86400_000).toISOString();
  const r = await api('search?' + new URLSearchParams({
    part: 'snippet', type: 'video', q,
    videoDuration: 'short',            // 4分未満。Shorts だけの絞りは API に無い
    order: 'viewCount', regionCode: 'JP', relevanceLanguage: 'ja',
    publishedAfter: after, maxResults: '25',
  }));
  return (r.items || []).map((i) => i.id.videoId).filter(Boolean);
}

async function details(ids) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const r = await api('videos?' + new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(i, i + 50).join(','),
    }));
    for (const v of r.items || []) {
      const sec = seconds(v.contentDetails?.duration);
      out.push({
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        published: v.snippet.publishedAt,
        sec,
        views: +v.statistics?.viewCount || 0,
        likes: +v.statistics?.likeCount || 0,
        comments: +v.statistics?.commentCount || 0,
      });
    }
  }
  return out;
}

const days = Number(process.argv[2]) || 90;
const queries = process.argv.length > 3 ? process.argv.slice(3) : DEFAULT_QUERIES;

const seen = new Map();
for (const q of queries) {
  let ids = [];
  try { ids = await search(q, days); } catch (e) { console.log(`  ! "${q}" 失敗: ${e.message}`); continue; }
  for (const v of await details(ids)) {
    // 60秒以下だけを Shorts として扱う。videoDuration=short は4分未満まで拾う。
    if (v.sec == null || v.sec > 60) continue;
    if (!seen.has(v.id)) seen.set(v.id, { ...v, queries: [] });
    seen.get(v.id).queries.push(q);
  }
}

const rows = [...seen.values()].sort((a, b) => b.views - a.views);
const now = Date.now();

console.log(`同ジャンルの Shorts（60秒以下・直近${days}日・JP・再生数順）  ${rows.length}本`);
console.log(`問い合わせ語: ${queries.join(' / ')}\n`);
console.log('     再生    /日   尺  いいね コメ  チャンネル / タイトル');
for (const v of rows.slice(0, 30)) {
  const ageDays = Math.max(1, (now - Date.parse(v.published)) / 86400_000);
  console.log(
    `${String(v.views).padStart(9)}${String(Math.round(v.views / ageDays)).padStart(7)}`
    + `${String(v.sec).padStart(5)}s${String(v.likes).padStart(7)}${String(v.comments).padStart(5)}  `
    + `${v.channel.slice(0, 14)} / ${v.title.slice(0, 42)}`,
  );
}

if (rows.length) {
  const med = rows[Math.floor(rows.length / 2)].views;
  const secs = rows.map((r) => r.sec).sort((a, b) => a - b);
  console.log(`\n中央値 ${med}回 / 尺の中央値 ${secs[Math.floor(secs.length / 2)]}s`
    + ` / 尺の範囲 ${secs[0]}〜${secs[secs.length - 1]}s`);
  const band = (lo, hi) => {
    const g = rows.filter((r) => r.sec >= lo && r.sec <= hi);
    if (!g.length) return null;
    return `${lo}-${hi}s: n=${g.length} 中央値 ${g.map((r) => r.views).sort((a, b) => a - b)[Math.floor(g.length / 2)]}回`;
  };
  console.log('尺の帯ごと: ' + [band(0, 15), band(16, 30), band(31, 45), band(46, 60)].filter(Boolean).join(' / '));
}
