// Minimal YouTube client: refresh an access token, read Analytics, upload a video.
//
// Credentials come from the environment (see SETUP.md) and are never written to
// disk or logged. Everything here uses plain fetch against the public REST APIs;
// there is no SDK to install.
//
//   node yt.mjs check                 connectivity + channel + last 28 days
//   node yt.mjs stats [days]          per-video report, most viewed first
//   node yt.mjs upload <file> <json>  upload; json holds title/description/tags
import fs from 'node:fs';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_API = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/youtube/v3/videos';
const ANALYTICS_API = 'https://youtubeanalytics.googleapis.com/v2/reports';

/**
 * Credentials get typed into a settings box by hand, usually on a phone, and the
 * two ways that goes wrong are both silent: surrounding whitespace, and a value
 * pasted twice head-to-tail (autocomplete fires again on the second tap). Google
 * answers the second one with "invalid_client — The OAuth client was not found",
 * which reads like the client was deleted rather than mistyped. Both are
 * unambiguous to undo, so undo them rather than fail a scheduled run over a
 * stray keystroke.
 */
const clean = v => (v || '').trim()
  .replace(/^(\d+-)\1/, '$1')
  .replace(/(\.apps\.googleusercontent\.com)\1$/, '$1');

export function credentials() {
  const id = clean(process.env.YT_CLIENT_ID);
  const secret = clean(process.env.YT_CLIENT_SECRET);
  const refresh = clean(process.env.YT_REFRESH_TOKEN);
  const missing = [
    !id && 'YT_CLIENT_ID',
    !secret && 'YT_CLIENT_SECRET',
    !refresh && 'YT_REFRESH_TOKEN',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `YouTube credentials missing: ${missing.join(', ')}.\n` +
      'Set them as environment variables — see promo/youtube/SETUP.md.');
  }
  return { id, secret, refresh };
}

let cachedToken = null;

export async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const { id, secret, refresh } = credentials();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: id, client_secret: secret,
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The usual causes are worth naming: they are not obvious from Google's text.
    const hint = body.error === 'invalid_grant'
      ? '\nA refresh token expires after 7 days while the OAuth consent screen is still'
        + ' in "testing". Publish the consent screen, then re-issue the token.'
      : '';
    throw new Error(`token refresh failed (${res.status}): ${body.error || ''} ` +
      `${body.error_description || ''}${hint}`);
  }
  cachedToken = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return cachedToken.value;
}

async function api(url, opts = {}) {
  const token = await accessToken();
  const res = await fetch(url, {
    ...opts,
    headers: { authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const msg = body?.error?.message || String(body).slice(0, 300);
    throw new Error(`${opts.method || 'GET'} ${url.split('?')[0]} -> ${res.status}: ${msg}`);
  }
  return body;
}

export async function channel() {
  const r = await api(`${DATA_API}/channels?part=snippet,statistics&mine=true`);
  const c = r.items?.[0];
  if (!c) throw new Error('no channel on this account');
  return {
    id: c.id,
    title: c.snippet.title,
    subscribers: Number(c.statistics.subscriberCount || 0),
    views: Number(c.statistics.viewCount || 0),
    videos: Number(c.statistics.videoCount || 0),
  };
}

/**
 * The channel's About text. Read-only on purpose: the scopes here cover reading
 * and uploading, not editing the channel, so this can be checked but not fixed
 * from code — which is exactly why the video points at its own description
 * instead.
 */
export async function about() {
  const r = await api(`${DATA_API}/channels?part=snippet,brandingSettings&mine=true`);
  const c = r.items?.[0];
  if (!c) throw new Error('no channel on this account');
  return c.brandingSettings?.channel?.description || c.snippet.description || '';
}

const ymd = d => d.toISOString().slice(0, 10);

/** Per-video performance over the last `days`, most viewed first. */
export async function videoStats(days = 28) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start), endDate: ymd(end),
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,subscribersGained',
    dimensions: 'video',
    sort: '-views',
    maxResults: '50',
  });
  const r = await api(`${ANALYTICS_API}?${q}`);
  const cols = (r.columnHeaders || []).map(h => h.name);
  const rows = (r.rows || []).map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  if (!rows.length) return [];

  // Analytics only gives ids; titles come from the Data API.
  const ids = rows.map(r => r.video).slice(0, 50).join(',');
  const meta = await api(`${DATA_API}/videos?part=snippet,contentDetails&id=${ids}`);
  const byId = Object.fromEntries((meta.items || []).map(v => [v.id, v]));
  return rows.map(r => ({
    id: r.video,
    title: byId[r.video]?.snippet?.title || '(unavailable)',
    publishedAt: byId[r.video]?.snippet?.publishedAt || null,
    description: byId[r.video]?.snippet?.description || '',
    views: r.views,
    avgViewSeconds: Math.round(r.averageViewDuration || 0),
    avgViewPercent: Math.round((r.averageViewPercentage || 0) * 10) / 10,
    likes: r.likes,
    subscribersGained: r.subscribersGained,
  }));
}

/**
 * Second-by-second retention for one video.
 *
 * This is the measurement worth having. Average view percentage says a Short
 * did badly; this says where. Paired with the cut times the director logs, a
 * drop stops being a number and becomes a beat that did not hold — which is the
 * only version of the feedback that can be acted on.
 *
 * Returns [] for a video YouTube has not accumulated enough watch time on yet.
 */
export async function retention(videoId, days = 90) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start), endDate: ymd(end),
    metrics: 'audienceWatchRatio',
    dimensions: 'elapsedVideoTimeRatio',
    filters: `video==${videoId}`,
  });
  const r = await api(`${ANALYTICS_API}?${q}`);
  const meta = await api(`${DATA_API}/videos?part=contentDetails,snippet&id=${videoId}`);
  const iso = meta.items?.[0]?.contentDetails?.duration || 'PT0S';
  const seconds = (+(iso.match(/(\d+)H/)?.[1] || 0)) * 3600
    + (+(iso.match(/(\d+)M/)?.[1] || 0)) * 60
    + (+(iso.match(/(\d+)S/)?.[1] || 0));
  return {
    title: meta.items?.[0]?.snippet?.title || '',
    seconds,
    points: (r.rows || []).map(([ratio, watch]) => ({ at: ratio * seconds, ratio, watch })),
  };
}

/**
 * Resumable upload. Resumable rather than simple because a 20MB body over a
 * proxied connection is exactly the size that fails halfway and leaves no way to
 * tell whether the video landed.
 */
export async function upload(file, { title, description, tags = [], privacy = 'private',
                                     categoryId = '20' } = {}) {
  const token = await accessToken();
  const size = fs.statSync(file).size;
  const metadata = {
    snippet: { title, description, tags, categoryId },
    status: { privacyStatus: privacy, selfDeclaredMadeForKids: false },
  };

  const start = await fetch(`${UPLOAD_API}?uploadType=resumable&part=snippet,status`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(size),
      'x-upload-content-type': 'video/mp4',
    },
    body: JSON.stringify(metadata),
  });
  if (!start.ok) {
    throw new Error(`upload init failed (${start.status}): ${(await start.text()).slice(0, 300)}`);
  }
  const session = start.headers.get('location');
  if (!session) throw new Error('upload init returned no session URL');

  const res = await fetch(session, {
    method: 'PUT',
    headers: { 'content-length': String(size), 'content-type': 'video/mp4' },
    body: fs.readFileSync(file),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`upload failed (${res.status}): ${body?.error?.message || ''}`);
  }
  return { id: body.id, url: `https://www.youtube.com/watch?v=${body.id}`, privacy };
}

// ------------------------------------------------------------------ CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'check') {
      const c = await channel();
      console.log(`channel: ${c.title}`);
      console.log(`  ${c.videos} videos, ${c.subscribers} subscribers, ${c.views} lifetime views`);
      const s = await videoStats(28);
      console.log(`last 28 days: ${s.length} videos with data, ` +
        `${s.reduce((a, v) => a + v.views, 0)} views`);
      s.slice(0, 5).forEach(v =>
        console.log(`  ${String(v.views).padStart(6)} views  ${v.avgViewPercent}%  ${v.title}`));
    } else if (cmd === 'stats') {
      console.log(JSON.stringify(await videoStats(Number(rest[0]) || 28), null, 2));
    } else if (cmd === 'retention') {
      const [videoId] = rest;
      if (!videoId) throw new Error('usage: yt.mjs retention <videoId>');
      const r = await retention(videoId);
      if (!r.points.length) {
        console.log(`${r.title}: no retention data yet (needs more watch time)`);
      } else {
        // The cut times of the take that is on disk. Only meaningful when this
        // video came from that take, so it is shown as a hint, not a label.
        let cuts = [];
        try {
          const t = JSON.parse(fs.readFileSync('trim.json', 'utf8'));
          cuts = (t.flashLog || []).map((at, i) => ({ at, name: `カット${i + 2}` }));
        } catch { /* no take on disk — plain curve */ }
        console.log(`${r.title}  (${r.seconds}s)\n`);
        let prev = null;
        for (const p of r.points) {
          const near = cuts.find(c => Math.abs(c.at - p.at) < 0.6);
          const fall = prev !== null && prev - p.watch >= 0.08 ? `  -${((prev - p.watch) * 100).toFixed(0)}%` : '';
          console.log(`${p.at.toFixed(1).padStart(5)}s ${p.watch.toFixed(2).padStart(5)} ` +
            `${'#'.repeat(Math.round(p.watch * 36))}${fall}${near ? `   <- ${near.name}` : ''}`);
          prev = p.watch;
        }
      }
    } else if (cmd === 'upload') {
      const [file, metaFile] = rest;
      if (!file || !metaFile) throw new Error('usage: yt.mjs upload <file.mp4> <meta.json>');
      const r = await upload(file, JSON.parse(fs.readFileSync(metaFile, 'utf8')));
      console.log(`uploaded ${r.privacy}: ${r.url}`);
    } else {
      console.log('usage: yt.mjs check | stats [days] | retention <videoId> | ' +
        'upload <file.mp4> <meta.json>');
    }
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
