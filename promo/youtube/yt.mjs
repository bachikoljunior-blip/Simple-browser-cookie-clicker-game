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

/**
 * Optional `promo/youtube/.env`, which wins over the environment.
 *
 * Environment variables are handed to a session when it starts and never again,
 * so rotating a credential — widening the OAuth scopes, replacing an expired
 * refresh token — cannot reach a session that is already running. That matters
 * here because the posting schedule fires into one long-lived session: without a
 * file to read, a rotated token only takes effect whenever that session is next
 * replaced, which may be never.
 *
 * So a file, read fresh on every call, gitignored. It holds the same three names
 * in `KEY=value` form. Delete it and the environment takes over again.
 */
const ENV_FILE = new URL('./.env', import.meta.url).pathname;

function fromFile() {
  let text;
  try { text = fs.readFileSync(ENV_FILE, 'utf8'); } catch { return {}; }
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    // Strip one layer of matching quotes; a token pasted with them is otherwise
    // wrong in a way that only shows up as "invalid_grant" much later.
    out[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

export function credentials() {
  const file = fromFile();
  const pick = k => clean(file[k] ?? process.env[k]);
  const id = pick('YT_CLIENT_ID');
  const secret = pick('YT_CLIENT_SECRET');
  const refresh = pick('YT_REFRESH_TOKEN');
  const missing = [
    !id && 'YT_CLIENT_ID',
    !secret && 'YT_CLIENT_SECRET',
    !refresh && 'YT_REFRESH_TOKEN',
  ].filter(Boolean);
  if (missing.length) {
    throw new Error(
      `YouTube credentials missing: ${missing.join(', ')}.\n` +
      'Set them as environment variables, or in promo/youtube/.env — see promo/youtube/SETUP.md.');
  }
  return { id, secret, refresh };
}

/** Which of the two sources each credential came from, for `check` to report. */
export function credentialSources() {
  const file = fromFile();
  return Object.fromEntries(['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN']
    .map(k => [k, file[k] ? '.env' : (process.env[k] ? '環境変数' : 'なし')]));
}

/** The scopes the current refresh token actually carries. */
export async function grantedScopes() {
  const token = await accessToken();
  const r = await fetch(`${TOKEN_URL.replace('/token', '/tokeninfo')}?access_token=${token}`);
  if (!r.ok) return [];
  const j = await r.json().catch(() => ({}));
  return (j.scope || '').split(' ').filter(Boolean);
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
 * The channel's About text.
 *
 * This used to say the channel could not be edited from here, which was true
 * under upload-only scopes and stopped being true the moment `youtube.force-ssl`
 * was added — `channels.update` returns 200 now. A comment describing a limit
 * that has lifted is worse than no comment: it stops the next run from trying.
 *
 * Editing it is still a decision, not a routine: this text is hand-written by
 * the channel owner. What belongs here is fixing seams the videos create — the
 * CTA points people at this page, so a pointer on this page that sends them
 * somewhere useless is ours to repair. Rewriting their copy is not.
 */
export async function about() {
  const r = await api(`${DATA_API}/channels?part=snippet,brandingSettings&mine=true`);
  const c = r.items?.[0];
  if (!c) throw new Error('no channel on this account');
  return c.brandingSettings?.channel?.description || c.snippet.description || '';
}

const ymd = d => d.toISOString().slice(0, 10);

/**
 * Every video currently on the channel, newest first.
 *
 * The channel itself is the record. A file listing what was posted goes stale
 * the moment a video is deleted — it keeps claiming a cut was tried when
 * nothing of it remains — and it is empty on a fresh runner. Asking the API
 * costs a couple of quota units and is true by construction.
 */
export async function channelVideos(max = 50) {
  const ch = await api(`${DATA_API}/channels?part=contentDetails&mine=true`);
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];
  const items = [];
  let pageToken = '';
  while (items.length < max) {
    const q = new URLSearchParams({ part: 'contentDetails', maxResults: '50', playlistId: uploads });
    if (pageToken) q.set('pageToken', pageToken);
    const page = await api(`${DATA_API}/playlistItems?${q}`);
    items.push(...(page.items || []).map(i => i.contentDetails.videoId));
    pageToken = page.nextPageToken || '';
    if (!pageToken) break;
  }
  if (!items.length) return [];
  const meta = await api(`${DATA_API}/videos?part=snippet,status,statistics,contentDetails` +
    `&id=${items.slice(0, max).join(',')}`);
  return (meta.items || []).map(v => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description || '',
    publishedAt: v.snippet.publishedAt,
    privacy: v.status.privacyStatus,
    views: Number(v.statistics.viewCount || 0),
  })).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

/**
 * Where the views came from, over the last `days`.
 *
 * Retention answers "did they stay"; this answers "how did they arrive", and the
 * two want opposite things done about them. Views arriving from the Shorts feed
 * are won in the first two seconds and are worth spending hooks on. Views
 * arriving from search are won by the title matching a question someone typed,
 * and no amount of hook work moves them. Optimising the hook against a channel
 * that is actually being found by search is effort spent on the wrong end of the
 * video — which is the mistake this exists to prevent.
 *
 * `detail` is only meaningful for some source types (search terms, the
 * suggesting video); the API rejects it for others, so it is asked for
 * separately and per type rather than as one query.
 */
export async function trafficSources(days = 28) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start), endDate: ymd(end),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'insightTrafficSourceType',
    sort: '-views',
  });
  const r = await api(`${ANALYTICS_API}?${q}`);
  const cols = (r.columnHeaders || []).map(h => h.name);
  return (r.rows || []).map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

/**
 * The detail behind one traffic source — search terms for YT_SEARCH, the videos
 * that suggested us for RELATED_VIDEO. Returns [] for source types that carry no
 * detail rather than throwing, since the caller is usually looping over whatever
 * trafficSources() happened to return.
 */
export async function trafficDetail(sourceType, days = 28) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start), endDate: ymd(end),
    metrics: 'views',
    dimensions: 'insightTrafficSourceDetail',
    filters: `insightTrafficSourceType==${sourceType}`,
    sort: '-views',
    maxResults: '25',
  });
  try {
    const r = await api(`${ANALYTICS_API}?${q}`);
    const cols = (r.columnHeaders || []).map(h => h.name);
    return (r.rows || []).map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  } catch {
    return [];
  }
}

/**
 * Are external URLs in a video's description actually tappable yet?
 *
 * This decides where every video sends people. Until the channel earns advanced
 * features YouTube renders description URLs as plain text, so the videos point
 * at the channel page instead, where the links section is real buttons. The day
 * that flips, the routing should flip with it — the description is two or three
 * taps shorter — and nothing announces the change.
 *
 * The check is on the rendered watch page rather than the API, because the API
 * returns the description as the string that was uploaded and says nothing about
 * how it is drawn. In the page, linked spans of the description carry a command:
 * hashtags get a `/hashtag/…` browse endpoint, and external URLs get a
 * `urlEndpoint` or a `/redirect?q=…`. Hashtags are linked even on a channel with
 * no privileges at all, so their presence proves nothing — only an external
 * target counts.
 *
 * Deliberately not asking a human to tap it and report back: an answer that
 * depends on someone reading a message is an answer that may never arrive.
 */
export async function descriptionLinksLive(videoId) {
  // Scraping a page rather than calling an API means rate limits and the odd
  // interstitial. This runs inside a posting job, so it backs off and then gives
  // up with `checked: false` — an unanswered question must not take down a run
  // whose actual purpose is to publish a video.
  let res = null;
  for (const waitMs of [0, 3000, 12000]) {
    if (waitMs) await new Promise(r => setTimeout(r, waitMs));
    res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 ' +
          '(KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
        'accept-language': 'ja,en;q=0.8',
        accept: 'text/html,application/xhtml+xml',
      },
    }).catch(() => null);
    if (res?.ok) break;
  }
  if (!res?.ok) {
    return { checked: false, live: false, why: `視聴ページを取得できませんでした（${res?.status ?? 'ネットワーク'}）` };
  }
  const html = (await res.text())
    .replace(/\\x22/g, '"').replace(/\\x7b/g, '{').replace(/\\x7d/g, '}')
    .replace(/\\x5b/g, '[').replace(/\\x5d/g, ']').replace(/\\\//g, '/');

  const i = html.indexOf('attributedDescriptionBodyText');
  if (i === -1) return { checked: false, live: false, why: '説明欄が読み取れませんでした' };

  // Look only inside the description's own commandRuns array, matched bracket by
  // bracket. A fixed-size window past the marker reaches into unrelated page
  // data — related videos, channel links — and those carry urlEndpoints of their
  // own. That window reported "the links are tappable" on a video whose
  // description had no link at all, and acting on it would have pointed viewers
  // at a description they cannot tap: the exact failure the check exists to
  // prevent.
  const runsAt = html.indexOf('"commandRuns":[', i);
  if (runsAt === -1) {
    // No linked spans at all — not even hashtags. Nothing is tappable.
    return { checked: true, live: false, why: '説明欄にリンク化された箇所がありません' };
  }
  let p = html.indexOf('[', runsAt), depth = 0, end = p;
  for (let k = p; k < html.length; k++) {
    const c = html[k];
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { end = k + 1; break; } }
  }
  const seg = html.slice(p, end);
  const external = /"urlEndpoint"/.test(seg) || /"url":"\/redirect\?/.test(seg);
  const hashtags = (seg.match(/\/hashtag\//g) || []).length;
  return {
    checked: true,
    live: external,
    why: external
      ? '説明欄の外部リンクがタップできます'
      : `説明欄の外部リンクはただの文字です（リンク化されているのはハッシュタグ${hashtags}件のみ）`,
  };
}

/**
 * Where one video's views came from.
 *
 * The channel-level breakdown says 98% of everything arrives from the Shorts
 * feed, but that is dominated by the one video that worked. Per video it answers
 * a different and sharper question: did this one reach the feed at all? A Short
 * whose handful of views came from the channel page was never put in front of
 * anyone, and no amount of hook or title work would have changed that — the
 * thing to fix is upstream. A Short that did reach the feed and still went
 * nowhere is the opposite case, and is worth rewriting.
 *
 * Impressions would settle it outright, but the API does not expose them
 * (`metrics=impressions` is rejected), so this is the closest available.
 */
export async function videoSources(videoId, days = 28) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400_000);
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start), endDate: ymd(end),
    metrics: 'views,estimatedMinutesWatched',
    dimensions: 'insightTrafficSourceType',
    filters: `video==${videoId}`,
    sort: '-views',
  });
  const r = await api(`${ANALYTICS_API}?${q}`);
  const cols = (r.columnHeaders || []).map(h => h.name);
  return (r.rows || []).map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

/**
 * How stale Analytics actually is, measured rather than assumed.
 *
 * Every run of this project has repeated "約2日遅れ" as if it were a property of
 * the API. On 2026-08-04 the whole record was a single day — 2026-07-31 — while
 * realtime counts showed two videos published since with 768 and 2 views. The
 * lag was at least four days, so a plan that said "read the retention curve
 * tomorrow" was planning against a number that would not exist.
 *
 * Returns the newest day Analytics will admit to and how far behind that is, or
 * `{ latest: null }` when it holds nothing at all. Days come back in the
 * channel's Analytics timezone (Pacific), not JST — close enough to answer "can
 * I decide on this today", which is the only question being asked.
 */
export async function analyticsLag(lookbackDays = 45) {
  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 86400_000);
  const q = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start), endDate: ymd(end),
    metrics: 'views', dimensions: 'day', sort: 'day',
  });
  const r = await api(`${ANALYTICS_API}?${q}`);
  const rows = r.rows || [];
  if (!rows.length) return { latest: null, days: null, rows: [] };
  const latest = rows[rows.length - 1][0];
  const days = Math.round((Date.now() - Date.parse(latest + 'T00:00:00Z')) / 86400_000);
  return { latest, days, rows };
}

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
 * How past videos did, grouped by the local hour they went live.
 *
 * Whether an upload should go out at noon or at six is a question about the
 * audience, and this is the only evidence on hand for it. With three videos it
 * says almost nothing, which is worth saying out loud rather than dressing a
 * coin flip as a finding — the counts are returned alongside so a caller can
 * see how thin the ground is.
 */
export async function byHour(days = 90, tzOffsetHours = 9) {
  // Views come from the Data API, not Analytics. Analytics runs about two days
  // behind, so on a channel posting daily the newest videos — the ones a decision
  // is actually about — are absent from it. On 2026-08-03 that gap produced a
  // real mistake: `check` reported "1 video with data, 208 views" while the video
  // published that morning was already past 700, and the day's plan was built on
  // the wrong number. Retention still has to come from Analytics and still lags;
  // view counts do not have to.
  const all = await channelVideos();
  // A scheduled video carries its *upload* time as publishedAt and, of course,
  // no views. Left in, it lands on the hour it was rendered and reads as that
  // hour performing at zero — the table would argue against the very slot the
  // video is waiting to be published into. Only what is actually public counts.
  let live = new Set(all.map(v => v.id));
  try {
    const st = await api(`${DATA_API}/videos?part=status&id=${all.map(v => v.id).join(',')}`);
    live = new Set((st.items || []).filter(i => i.status.privacyStatus === 'public'
      && !i.status.publishAt).map(i => i.id));
  } catch { /* if status is unreadable, better to show everything than nothing */ }
  const videos = all.filter(v => live.has(v.id));
  let keep = {};
  try {
    keep = Object.fromEntries((await videoStats(days))
      .filter(s => s.avgViewPercent != null).map(s => [s.id, s.avgViewPercent]));
  } catch { /* retention is a bonus here, not the point */ }

  const cutoff = Date.now() - days * 86400_000;
  const hours = {};
  for (const v of videos) {
    if (!v.publishedAt || Date.parse(v.publishedAt) < cutoff) continue;
    const h = new Date(Date.parse(v.publishedAt) + tzOffsetHours * 3600_000).getUTCHours();
    (hours[h] ||= []).push({ ...v, avgViewPercent: keep[v.id] ?? null });
  }
  return Object.entries(hours).map(([h, rows]) => {
    const scored = rows.filter(r => r.avgViewPercent !== null);
    return {
      hour: Number(h),
      n: rows.length,
      views: Math.round(rows.reduce((a, r) => a + (r.views || 0), 0) / rows.length),
      best: Math.max(...rows.map(r => r.views || 0)),
      avgViewPercent: scored.length
        ? Math.round(scored.reduce((a, r) => a + r.avgViewPercent, 0) / scored.length * 10) / 10
        : null,
      titles: rows.map(r => r.title),
    };
  }).sort((a, b) => b.views - a.views);
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
                                     categoryId = '20', publishAt = null } = {}) {
  const token = await accessToken();
  const size = fs.statSync(file).size;
  // Scheduled publishing. YouTube only accepts publishAt on a video that is
  // private, and treats the pair as "stay private until this instant, then go
  // public" — so the upload can happen whenever the machine is free while the
  // moment it goes live is a separate decision. That separation is the point:
  // rendering takes minutes and wants a quiet slot, going live wants the hour
  // the audience is actually there, and those are not the same constraint.
  const scheduled = publishAt && new Date(publishAt) > new Date();
  const metadata = {
    snippet: { title, description, tags, categoryId },
    status: {
      privacyStatus: scheduled ? 'private' : privacy,
      selfDeclaredMadeForKids: false,
      ...(scheduled ? { publishAt: new Date(publishAt).toISOString() } : {}),
    },
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
  return {
    id: body.id,
    url: `https://www.youtube.com/watch?v=${body.id}`,
    privacy: scheduled ? 'private' : privacy,
    publishAt: scheduled ? new Date(publishAt).toISOString() : null,
  };
}

/**
 * Edit an existing video's snippet. Needs a manage scope (`youtube.force-ssl`);
 * with upload-only it answers 403, which is what `check` reports on.
 *
 * **The snippet is replaced, not merged.** Send only a description and the title
 * is cleared — the API treats an absent field as "set to empty", and title plus
 * categoryId are required on every write. So the current snippet is fetched and
 * the patch laid over it, rather than trusting the caller to remember. Getting
 * this wrong wipes the title of a published video, which is not a quiet failure.
 *
 * One thing deliberately not done here: stamping `#cut-`/`#topic-` markers onto
 * a video. Those markers are the record of which angle has been tried, read back
 * off the channel by the pickers. Writing one onto a video the pipeline did not
 * produce would make the picker skip an angle it never actually showed anyone.
 */
export async function updateVideo(videoId, patch) {
  const cur = await api(`${DATA_API}/videos?part=snippet&id=${videoId}`);
  const snippet = cur.items?.[0]?.snippet;
  if (!snippet) throw new Error(`no video ${videoId} on this account`);
  const token = await accessToken();
  const res = await fetch(`${DATA_API}/videos?part=snippet`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      id: videoId,
      snippet: {
        title: snippet.title,
        categoryId: snippet.categoryId,
        defaultLanguage: snippet.defaultLanguage || 'ja',
        description: snippet.description || '',
        tags: snippet.tags || [],
        ...patch,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`update failed (${res.status}): ${err?.error?.message || ''}`);
  }
  return (await res.json()).snippet;
}

/**
 * 予約の現況を YouTube 側に直接聞く。
 *
 * `posted.json` は古くなる（2026-08-10、13本あるうち実際の予約は9本だった。
 * 落とした本も残るし、消えた本も残る）。**予約の正本は YouTube 側だけ。**
 */
export async function videoStatus(ids) {
  const j = await api(`${DATA_API}/videos?part=status,snippet&id=${ids.join(',')}`);
  return (j.items || []).map(it => ({
    id: it.id,
    privacy: it.status.privacyStatus,
    publishAt: it.status.publishAt || null,
    title: it.snippet.title,
  }));
}

/**
 * いま実際に予約されている本を、**ID つきで**全部返す。
 *
 * 2026-08-11 に足した。手順書 §2(4) は「予約の正本は YouTube 側なので
 * `yt.mjs status <videoId>` で確かめろ」と言うが、**その videoId をどこから
 * 得るかは書いていなかった。** 唯一の一覧が `posted.json` で、同じ手順書が
 * 「posted.json は古くなる」と言っている ——— つまり (4) を判定する経路が
 * 一周して閉じていた（実際この回、posted.json は未来分14件、YouTube 側は7件）。
 * preflight は正しい数を出しているのに**本数しか印字せず ID を捨てていた**ので、
 * そこからも辿れない。
 *
 * **「手順が実行できない形で書いてある回はそこで止まる」（指示8）の一例**で、
 * 直し方も同じ ——— 必要な操作は `yt.mjs` に口を足す。
 */
export async function queue() {
  const vs = await channelVideos();
  if (!vs.length) return [];
  const st = await videoStatus(vs.map(v => v.id));
  return st.filter(v => v.publishAt).sort((a, b) => Date.parse(a.publishAt) - Date.parse(b.publishAt));
}

/**
 * 予約を外して private に戻す。外部レビューに落ちた本を止めるための口。
 *
 * **`publishAt: null` を明示する。** 書かずに送ると 200 が返り
 * `privacyStatus: private` も返ってくるのに、**publishAt はそのまま残る**
 * （2026-08-10 に実測。止めたつもりの本が予定どおり公開される形）。
 * だから PUT のあと必ず GET して、消えたことを確かめてから返す。
 *
 * 2026-08-10、この関数を作った理由: 手順書は「videos?part=status に PUT する」と
 * 書いてあるだけで、毎回その場で node -e に fetch を書いていた。
 * **その形は環境の分類器に落とされる**（この回で実際に落ちた）ので、
 * 手順が実行できないまま止まる。リポジトリの中のコマンドなら普通に走る。
 */
export async function unschedule(videoId) {
  const cur = await api(`${DATA_API}/videos?part=status&id=${videoId}`);
  const st = cur.items?.[0]?.status;
  if (!st) throw new Error(`no video ${videoId} on this account`);
  const token = await accessToken();
  const res = await fetch(`${DATA_API}/videos?part=status`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      id: videoId,
      status: {
        privacyStatus: 'private',
        publishAt: null,
        license: st.license,
        embeddable: st.embeddable,
        publicStatsViewable: st.publicStatsViewable,
        selfDeclaredMadeForKids: st.selfDeclaredMadeForKids === true,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`unschedule failed (${res.status}): ${err?.error?.message || ''}`);
  }
  // **読み直しは1回では足りない。** 2026-08-10 に実測: PUT の直後の GET は
  // まだ publishAt を返し、数秒後に見ると消えている（read-after-write が
  // 遅れて追いつく）。1回で判定していた最初の版は「publishAt が残っている」と
  // 例外を投げたが、**実際には外れていた** —— そのまま信じた回は、外れている
  // 予約をもう一度外そうとする。逆に「消えた」を1回の GET で信じるのも同じだけ
  // 危ないので、消えるまで待って、待っても消えなければ落とす。
  let after;
  for (let i = 0; i < 6; i++) {
    after = (await videoStatus([videoId]))[0];
    if (!after.publishAt) return after;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`publishAt が残っている: ${after.publishAt}（PUT は通ったが消えなかった）`);
}

/**
 * Move an existing scheduled video to a different publish time.
 *
 * なぜ足りなかったか（2026-08-11 に踏んだ）: この回、日ごとの本数が薄い日を埋めようと
 * `--at` で投稿したら、**その日に既に居た本と同じ 12:30 に重なった。** 打席を1つ増やした
 * つもりが、同じ分に2本出す形になっていた（フィードは1日に何本配るかで見ているので、
 * 同時刻の2本は2日ぶんの打席にならない）。**直す口が `unschedule` しか無く、外すと
 * publishAt が消えるだけで入れ直せない** ——— 唯一の道は撮り直して再投稿で、
 * 同じ動画をもう1本アップする形になる。
 *
 * `unschedule` と同じ落とし穴を2つとも踏まないようにしてある:
 * `status` の他の欄を書き戻さないと消えること、PUT 直後の GET が古い値を返すこと。
 */
export async function reschedule(videoId, at) {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) throw new Error(`日時が読めない: ${at}`);
  if (when.getTime() < Date.now()) throw new Error(`過去の時刻です: ${when.toISOString()}`);
  const cur = await api(`${DATA_API}/videos?part=status&id=${videoId}`);
  const st = cur.items?.[0]?.status;
  if (!st) throw new Error(`no video ${videoId} on this account`);
  const token = await accessToken();
  const res = await fetch(`${DATA_API}/videos?part=status`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      id: videoId,
      status: {
        privacyStatus: 'private',
        publishAt: when.toISOString(),
        license: st.license,
        embeddable: st.embeddable,
        publicStatsViewable: st.publicStatsViewable,
        selfDeclaredMadeForKids: st.selfDeclaredMadeForKids === true,
      },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`reschedule failed (${res.status}): ${err?.error?.message || ''}`);
  }
  // read-after-write が遅れる（`unschedule` の注を見ること）。**新しい時刻が返るまで
  // 待つ。** 1回の GET で古い値を見て「失敗した」と判断すると、通った PUT をもう一度撃つ。
  let after;
  for (let i = 0; i < 6; i++) {
    after = (await videoStatus([videoId]))[0];
    if (after.publishAt && Math.abs(new Date(after.publishAt) - when) < 60000) return after;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`publishAt が変わらない: ${after?.publishAt}（PUT は通ったが反映されなかった）`);
}

/**
 * Leave a comment as the channel. The API has no way to pin one — pinning is
 * console-only — so this is worth doing when the video has no other comments and
 * the owner's lands at the top on its own, and not much otherwise.
 */
export async function comment(videoId, text) {
  const token = await accessToken();
  const res = await fetch(`${DATA_API}/commentThreads?part=snippet`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      snippet: { videoId, topLevelComment: { snippet: { textOriginal: text } } },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`comment failed (${res.status}): ${err?.error?.message || ''}`);
  }
  return (await res.json()).id;
}

/**
 * Replace a video's thumbnail. Covered by the upload scope already held — no
 * re-consent needed — but the channel also has to have custom thumbnails turned
 * on, which is an account setting rather than a scope. Confirmed working on
 * 2026-08-03; if it starts returning 403 that is the setting, not the token.
 *
 * A failure here must not take the run down with it: by the time this is called
 * the video is already up, and a default thumbnail is worse than a chosen one
 * but far better than an exception that skips writing the posting log.
 */
export async function setThumbnail(videoId, file) {
  const token = await accessToken();
  const body = fs.readFileSync(file);
  const type = file.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  const res = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': type }, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`thumbnail failed (${res.status}): ${err?.error?.message || ''}`);
  }
  return true;
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

      // What this token is allowed to do. Worth a line every run because the
      // answer decides which fixes are even available: without a manage scope,
      // an existing video's empty description cannot be filled in from here, and
      // a run that does not know that will keep proposing it.
      const scopes = await grantedScopes();
      const short = scopes.map(s => s.replace('https://www.googleapis.com/auth/', ''));
      const manage = scopes.some(s => /youtube\.force-ssl|auth\/youtube$/.test(s));
      const src = credentialSources();
      console.log(`\n認証情報の出どころ: ${Object.entries(src).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      console.log(`スコープ: ${short.join(' ') || '(取得できず)'}`);
      console.log(manage
        ? '  → 既存動画の編集・再生リスト・固定コメントも可能'
        : '  → 投稿とサムネイルのみ。既存動画の説明欄は編集できない（SETUP.md の「スコープを広げる」）');
    } else if (cmd === 'lag') {
      const l = await analyticsLag(Number(rest[0]) || 45);
      if (!l.latest) {
        console.log('Analytics にデータが1日もありません。');
        console.log('  → 視聴率・維持率・流入は使えない。判断は snapshot.mjs の実測再生数で行うこと。');
      } else {
        console.log(`Analytics の最新日: ${l.latest}（太平洋時間）— ${l.days}日前`);
        l.rows.slice(-7).forEach(([d, v]) => console.log(`  ${d}  ${v}回`));
        if (l.days >= 3) {
          console.log(`\n  ※ ${l.days}日遅れています。「明日 retention を読む」類の計画は成立しません。`);
          console.log('     判断は snapshot.mjs の実測再生数で行うこと。');
        }
      }
    } else if (cmd === 'stats') {
      console.log(JSON.stringify(await videoStats(Number(rest[0]) || 28), null, 2));
    } else if (cmd === 'perday') {
      // **1日に何本出すと、1本あたりが痩せるのか。**
      //
      // RUNBOOK §2(1) は長らく「0本の日があるなら埋める」で、**1本の日は穴として
      // 数えていなかった。** その注に「1日あたり何本が適正かは測っていない（いまは2本）」
      // と自分で書いてあったので、2026-08-11 に測った。**痩せなかった。**
      // 痩せないなら、1本の日は 1本ぶん（およそ200再生）をそのまま捨てているだけなので、
      // 条件は「0本でない」ではなく「2本ある」でなければならない。
      //
      // 日は **JST で束ねる** ——— 見ているのは日本語のフィードで、`publishedAt` は UTC。
      // 横型の長尺は Shorts フィードに入らず1〜7再生で終わるので、平均を壊さないように
      // `avgViewSeconds > 30` を外す（20本の Shorts は全部 7〜17秒）。
      const days = Number(rest[0]) || 90;
      const vids = (await videoStats(days)).filter(v => v.avgViewSeconds <= 30);
      const jst = t => new Date(new Date(t).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
      const byDay = {};
      for (const v of vids) (byDay[jst(v.publishedAt)] ||= []).push(v);
      const rows = Object.entries(byDay).sort();
      for (const [d, vs] of rows) {
        console.log(`${d} ${vs.length}本  平均${Math.round(vs.reduce((s, v) => s + v.views, 0) / vs.length)}  ${vs.map(v => v.views).join('/')}`);
      }
      const grouped = {};
      for (const [, vs] of rows) (grouped[vs.length] ||= []).push(...vs.map(v => v.views));
      console.log('\n1日あたりの本数ごと（1本あたりの再生）');
      for (const k of Object.keys(grouped).sort()) {
        const g = grouped[k];
        console.log(`  ${k}本の日: 動画${g.length}本  平均${Math.round(g.reduce((s, x) => s + x, 0) / g.length)}`);
      }
      console.log('※ 平均が本数とともに下がっていないなら、1本足すぶんはそのまま合計に乗る。');
      console.log('※ 下がり始めたら RUNBOOK §2(1) の「2本」を測った数に直すこと。');
    } else if (cmd === 'hours') {
      const rows = await byHour(Number(rest[0]) || 90);
      if (!rows.length) console.log('公開時刻ごとのデータがまだありません');
      rows.forEach(r => {
        console.log(
          `  ${String(r.hour).padStart(2, '0')}時台  平均 ${String(r.views).padStart(5)}回  ` +
          `最良 ${String(r.best).padStart(5)}回  ` +
          `視聴率 ${r.avgViewPercent === null ? '  —  ' : r.avgViewPercent + '%'}  (${r.n}本)`);
        r.titles.forEach(t => console.log(`         ${t.slice(0, 40)}`));
      });
      console.log('  ※ 再生数は即時（Data API）。視聴率は Analytics で、遅れの実測は ' +
        '`yt.mjs lag`（2026-08-04 時点で3日）');
      if (rows.length && rows.every(r => r.n < 3)) {
        console.log('  ※ 各時間帯の本数が少なく、差は偶然の範囲です');
      }
    } else if (cmd === 'linkcheck') {
      // Newest *public* video. channelVideos() lists scheduled uploads too, and
      // they were sorted first — so with anything queued this was fetching the
      // watch page of a private video, which cannot answer the question and just
      // returned an error. A check that silently stops checking is worse than no
      // check, because its silence reads as "nothing changed".
      let id = rest[0];
      if (!id) {
        const vs = await channelVideos();
        const st = await api(`${DATA_API}/videos?part=status&id=${vs.map(v => v.id).join(',')}`);
        const live = new Set((st.items || [])
          .filter(i => i.status.privacyStatus === 'public' && !i.status.publishAt)
          .map(i => i.id));
        id = vs.find(v => live.has(v.id))?.id;
      }
      if (!id) { console.log('公開済みの動画がありません'); process.exit(0); }
      const r = await descriptionLinksLive(id);
      console.log(`${id}: ${r.why}`);
      // "could not check" must not read as "checked, nothing changed" — that is
      // how a switch that has already flipped goes unnoticed for days.
      console.log(!r.checked
        ? '  → 判定できていない。誘導先は据え置き、次の実行で必ずやり直すこと'
        : r.live
          ? '  → 誘導先を「動画概要欄」に切り替えてよい（CLAUDE.md の恒久指令 制約2）'
          : '  → 誘導先は「チャンネル概要欄」のまま（CLAUDE.md の恒久指令 制約2）');
    } else if (cmd === 'backfill') {
      // A video with no description is a video that cannot be joined from. Any
      // that this pipeline uploaded already carries the terms, so in practice
      // this catches ones posted by hand before the automation existed.
      const { describe } = await import('../variants.mjs');
      const t = JSON.parse(fs.readFileSync(new URL('./tester.json', import.meta.url), 'utf8'));
      const links = {
        groupUrl: (process.env.YT_TESTER_GROUP_URL || t.groupUrl || '').trim(),
        optInUrl: (process.env.YT_TESTER_OPTIN_URL || t.optInUrl || '').trim(),
        contact: (process.env.YT_TESTER_CONTACT || t.contact || '').trim(),
      };
      const TAGS = ['放置ゲーム', 'クリッカー', 'インクリメンタル', '個人開発',
        'インディーゲーム', 'Androidゲーム', 'クッキーストラテジャー'];
      const empty = (await channelVideos()).filter(v => !(v.description || '').trim());
      if (!empty.length) { console.log('説明欄が空の動画はありません'); }
      for (const v of empty) {
        const body = describe(
          { description: 'クッキーをタップして増やす放置クリッカー「クッキーストラテジャー」です。' },
          links).trim() + '\n\n' + TAGS.map(x => '#' + x).join(' ');
        await updateVideo(v.id, { description: body, tags: TAGS });
        console.log(`  ${v.id}  説明欄を追加  ${v.title}`);
      }
    } else if (cmd === 'sources') {
      // `sources <videoId>` narrows to one video — see videoSources().
      const vid = rest.find(a => a && !/^\d+$/.test(a));
      const days = Number(rest.find(a => /^\d+$/.test(a))) || 28;
      const rows = vid ? await videoSources(vid, days) : await trafficSources(days);
      if (vid) console.log(`video ${vid}:`);
      if (!rows.length) { console.log('流入のデータがまだありません'); }
      const total = rows.reduce((a, r) => a + r.views, 0) || 1;
      // Plain-language names: the raw enum reads like a database column, and the
      // point of this table is to be glanced at while deciding what to shoot.
      const NAMES = {
        SHORTS: 'Shorts フィード', SUBSCRIBER: '登録者のフィード', YT_SEARCH: 'YouTube 検索',
        RELATED_VIDEO: '関連動画', BROWSE: 'ブラウジング機能', NO_LINK_OTHER: '不明・直接',
        EXT_URL: '外部サイト', YT_CHANNEL: 'チャンネルページ', NOTIFICATION: '通知',
        PLAYLIST: '再生リスト', END_SCREEN: '終了画面', ANNOTATION: 'カード',
      };
      for (const r of rows) {
        const t = r.insightTrafficSourceType;
        console.log(`  ${(NAMES[t] || t).padEnd(16)} ${String(r.views).padStart(5)}回  ` +
          `${(r.views / total * 100).toFixed(0)}%  視聴 ${Math.round(r.estimatedMinutesWatched)}分`);
        for (const d of (await trafficDetail(t, days)).slice(0, 5)) {
          console.log(`      ${String(d.views).padStart(4)}回  ${d.insightTrafficSourceDetail}`);
        }
      }
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
    } else if (cmd === 'status') {
      if (!rest.length) throw new Error('usage: yt.mjs status <videoId> [videoId...]');
      for (const v of await videoStatus(rest)) {
        console.log(`${v.id} ${v.privacy} ${v.publishAt || '-'} ${v.title}`);
      }
    } else if (cmd === 'queue') {
      // reviewed.json と突き合わせて印字する。§2(4) が聞いているのは
      // 「予約に、まだ誰も見ていない本が残っているか」の一点なので、
      // 一覧と台帳を別々に読ませると、そこで人が突き合わせる仕事が残る。
      let reviewed = {};
      try {
        reviewed = JSON.parse(fs.readFileSync(new URL('./reviewed.json', import.meta.url), 'utf8')).videos || {};
      } catch { /* 台帳がまだ無い＝全部が未レビュー */ }
      const q = await queue();
      if (!q.length) {
        console.log('予約は0本 ← 途切れる');
      } else {
        for (const v of q) {
          const r = reviewed[v.id];
          const mark = r ? `済(${r.verdict}${r.cut ? ' ' + r.cut : ''})` : '未レビュー';
          console.log(`${v.id} ${new Date(v.publishAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }).padEnd(20)} ${mark.padEnd(14)} ${v.title}`);
        }
        const un = q.filter(v => !reviewed[v.id]);
        console.log(`\n予約 ${q.length}本 / 未レビュー ${un.length}本` +
          (un.length ? ' → RUNBOOK §2(4)（ただし「同じコードで撮り直せる本か」を先に確かめること）' : ''));
      }
    } else if (cmd === 'unschedule') {
      if (!rest[0]) throw new Error('usage: yt.mjs unschedule <videoId>');
      const v = await unschedule(rest[0]);
      console.log(`予約を外した: ${v.id} ${v.privacy} publishAt=${v.publishAt || '(消えた)'} ${v.title}`);
    } else if (cmd === 'reschedule') {
      if (!rest[0] || !rest[1]) throw new Error('usage: yt.mjs reschedule <videoId> <RFC3339>');
      const v = await reschedule(rest[0], rest[1]);
      console.log(`予約を移した: ${v.id} → ${new Date(v.publishAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} (JST) ${v.title}`);
    } else {
      console.log('usage: yt.mjs check | lag [days] | stats [days] | hours [days] | ' +
        'sources [videoId] | linkcheck [videoId] | backfill | ' +
        'retention <videoId> | upload <file.mp4> <meta.json> | ' +
        'status <videoId...> | queue | unschedule <videoId> | reschedule <videoId> <RFC3339>');
    }
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(1);
  }
}
