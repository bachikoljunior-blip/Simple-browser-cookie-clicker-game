#!/usr/bin/env node
// The per-video diagnosis, compact enough to print on every run.
//
// This exists because writing 「次の運転から維持率を見る」 in a journal did not
// make it happen. yt.mjs has returned retention, likes and subscribers gained
// since it was written, and five days of runs went by without any of it being
// read -- part 2 said analytics were "3-4 days behind, unusable", and that
// sentence was consulted instead of the data. A note that asks a future run to
// remember something is the same shape as a check that prints a warning: it
// leaves the work to whoever is reading.
//
// So it goes in preflight, which runs every time and is not optional.
//
// Deliberately small. Six rows and one line of traffic split; this is read
// hourly, and a diagnosis nobody can take in at a glance stops being read.
import { videoStats, trafficSources } from './yt.mjs';

const LABEL = {
  SHORTS: 'Shortsフィード', YT_SEARCH: '検索', SUBSCRIBER: '登録者フィード',
  YT_CHANNEL: 'チャンネルページ', RELATED_VIDEO: '関連動画', EXT_URL: '外部',
  NO_LINK_OTHER: '直接', YT_OTHER_PAGE: 'その他ページ',
};

const n = Number(process.argv[2] || 6);

try {
  const all = (await videoStats(28)).filter(v => v.views > 20);
  all.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  const rows = all.slice(0, n);
  if (rows.length) {
    console.log('診断        : 直近 ' + rows.length + '本（再生 / 維持% / いいね / 登録者増）');
    for (const v of rows) {
      console.log('              '
        + String(v.views).padStart(5)
        + String(v.avgViewPercent ?? '-').padStart(8) + '%'
        + String(v.likes ?? 0).padStart(5)
        + String(v.subscribersGained ?? 0).padStart(5)
        + '  ' + (v.title || '').slice(0, 22));
    }
    const subs = rows.reduce((a, v) => a + (v.subscribersGained || 0), 0);
    const likes = rows.reduce((a, v) => a + (v.likes || 0), 0);
    // The two numbers that say whether anything compounds. Flat zero here means
    // every video is still being distributed from scratch, which is the reason
    // the growth rate is linear -- see part 2.
    if (subs === 0) console.log('              ※ 登録者増 0 —— 前の動画が次を助けていない。伸びは線形のまま');
    if (likes === 0) console.log('              ※ いいね 0 —— 戻ってくる理由が作れていない');
  }
} catch (e) {
  console.log('診断        : 取得できず —', String(e.message || e).slice(0, 60));
}

try {
  const t = await trafficSources(28);
  const tot = t.reduce((a, r) => a + (r.views || 0), 0) || 1;
  const top = [...t].sort((a, b) => b.views - a.views).slice(0, 3)
    // The dimension comes back as insightTrafficSourceType, not `label` --
    // guessing the field name printed "? 97%" on the first run.
    .map(r => `${LABEL[r.insightTrafficSourceType] || r.insightTrafficSourceType} ${Math.round(100 * r.views / tot)}%`)
    .join(' / ');
  console.log('流入        : ' + top);
} catch (e) {
  console.log('流入        : 取得できず —', String(e.message || e).slice(0, 50));
}
