// Weekly search-led long-form run. Shorts bring discovery; these explainers
// target valid public watch time and answer durable game-design searches.
// One scheduled run for the landscape explainers.
//
//   node autopost-long.mjs              render and upload
//   node autopost-long.mjs --dry-run    render only, print what it would post
//   node autopost-long.mjs --topic hunt force a particular topic
//   node autopost-long.mjs --public     publish rather than upload privately
//   node autopost-long.mjs --at <time>  go live at an RFC3339 instant instead of at once
//
// Same shape as autopost.mjs and for the same reasons — read the channel, read
// where people stopped watching, pick, render, check, post — but it picks from
// topics rather than cuts, and its idea of "already tried" is a different tag.
// The two are kept apart rather than parameterised into one because the thing
// they disagree about is what a good next video is, and that is the whole job.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { TOPICS, MARK } from '../topics.mjs';
import { buildThumbnail } from '../thumbnail.mjs';
import { videoStats, channelVideos, channel, upload, credentials, retention, setThumbnail } from './yt.mjs';

const PROMO = path.resolve(import.meta.dirname, '..');
const MP4 = path.join(PROMO, 'cookie_strateger_long.mp4');
const LOG = path.join(PROMO, 'youtube', 'posted-long.json');
const PLAY_URL = 'https://cookiestrateger.com/play.html';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const topicAt = args.indexOf('--topic');
const forced = topicAt === -1 ? undefined : args[topicAt + 1];
const privacy = args.includes('--public') ? 'public' : (process.env.YT_PRIVACY || 'private');
// When it goes live, as distinct from when it was made. Passed straight to
// YouTube's scheduled publishing, so the render can happen whenever the machine
// is free while the moment it appears is chosen on its own evidence.
const atIdx = args.indexOf('--at');
const publishAt = atIdx === -1 ? null : args[atIdx + 1];
if (publishAt && Number.isNaN(Date.parse(publishAt))) {
  throw new Error(`--at "${publishAt}" is not a date. Use RFC3339, e.g. 2026-08-04T12:10:00+09:00`);
}
if (publishAt && Date.parse(publishAt) <= Date.now()) {
  throw new Error(`--at "${publishAt}" is in the past; YouTube rejects that.`);
}

const readLog = () => (fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : []);
const run = (cmd, cmdArgs, env = {}) =>
  execFileSync(cmd, cmdArgs, { cwd: PROMO, stdio: 'inherit', env: { ...process.env, ...env } });

// --- what is on the channel, rebuilt every run --------------------------------
async function history() {
  const videos = await channelVideos();
  let stats = [];
  try {
    stats = await videoStats(28);
  } catch (e) {
    console.log(`アナリティクスが読めません: ${e.message.split('\n')[0]}`);
  }
  const byId = Object.fromEntries(stats.map(s => [s.id, s]));

  const perTopic = {};
  const mine = [];
  for (const v of videos) {
    const t = TOPICS.find(x => v.description.includes(MARK(x.id)));
    if (!t) continue;
    mine.push({ ...v, topic: t.id });
    const s = byId[v.id];
    const age = Math.max(1, (Date.now() - Date.parse(v.publishedAt)) / 86400_000);
    (perTopic[t.id] ||= []).push({
      ...v,
      avgViewPercent: s?.avgViewPercent ?? null,
      estimatedMinutesWatched: s?.estimatedMinutesWatched ?? 0,
      views: s?.views ?? v.views,
      viewsPerDay: (s?.views ?? v.views) / age,
      watchMinutesPerDay: (s?.estimatedMinutesWatched ?? 0) / age,
    });
  }
  console.log(`チャンネルの動画 ${videos.length}本 / うち解説 ${mine.length}本`);
  const rankable = Object.values(perTopic).flat().some(r => r.avgViewPercent !== null);
  return { perTopic: rankable ? perTopic : null, mine };
}

/**
 * Total watched minutes per day is the primary score. The YPP long-form gate is
 * valid public watch hours, so percentage retention by itself is misleading: a
 * short video can win on percentage while contributing fewer minutes. This is a
 * close Analytics proxy, not YouTube Studio's final "valid public watch hours".
 */
function pickTopic(perTopic, mine) {
  if (forced) {
    const t = TOPICS.find(x => x.id === forced);
    if (!t) throw new Error(`no topic named "${forced}"`);
    return { topic: t, why: 'コマンドラインで指定' };
  }
  if (!perTopic) {
    const live = new Set(mine.map(v => v.topic));
    const fresh = TOPICS.filter(x => !live.has(x.id));
    const topic = fresh[0] || TOPICS[mine.length % TOPICS.length];
    return { topic, why: fresh.length ? 'まだ出していない題材' : '順番に回している' };
  }
  const untried = TOPICS.filter(x => !perTopic[x.id]);
  if (untried.length) return { topic: untried[0], why: 'まだ出していない題材' };

  const scored = TOPICS.map(x => {
    const rows = perTopic[x.id].filter(r => r.avgViewPercent !== null);
    const n = rows.length;
    return {
      x,
      keep: n ? rows.reduce((a, r) => a + r.avgViewPercent, 0) / n : 0,
      perDay: n ? rows.reduce((a, r) => a + r.viewsPerDay, 0) / n : 0,
      watchMinutesPerDay: n
        ? rows.reduce((a, r) => a + r.watchMinutesPerDay, 0) / n : 0,
      n,
    };
  }).sort((a, b) =>
    (b.watchMinutesPerDay - a.watchMinutesPerDay) ||
    (b.perDay - a.perDay) ||
    (b.keep - a.keep));

  console.log('\n--- YPP長尺視聴時間を優先した題材成績 (28日) ---');
  scored.forEach(s => console.log(
    `  ${s.x.id.padEnd(10)} 視聴 ${s.watchMinutesPerDay.toFixed(1)}分/日  ` +
    `再生 ${s.perDay.toFixed(1)}回/日  維持 ${s.keep.toFixed(1)}%  (${s.n}本)`));

  // Most weeks use the strongest watch-time topic; one in five explores the
  // least-tested subject so search demand can surface instead of being assumed.
  const explore = Math.random() < 0.2;
  const least = [...scored].sort((a, b) => (a.n - b.n) ||
    (a.watchMinutesPerDay - b.watchMinutesPerDay))[0];
  return explore
    ? { topic: least.x, why: `試行（最も本数が少ない: ${least.n}本）` }
    : { topic: scored[0].x, why:
      `YPP長尺視聴時間proxyが最良 (${scored[0].watchMinutesPerDay.toFixed(1)}分/日)` };
}

/**
 * Where people stopped watching the last few explainers. Read before anything is
 * rendered — three minutes is long enough that a drop is about a specific beat,
 * and the take that produced it logged the time of every beat by name.
 */
async function reportRetention(mine) {
  console.log('\n--- 直近の離脱 ---');
  if (!mine.length) { console.log('  解説動画がまだありません'); return; }
  for (const p of mine.slice(0, 3)) {
    let r;
    try { r = await retention(p.id); } catch { continue; }
    if (!r.points.length) { console.log(`  ${p.topic}: まだ十分な視聴時間がありません`); continue; }
    let worst = { drop: 0, at: 0 }, half = null, prev = null;
    for (const pt of r.points) {
      if (prev !== null && prev - pt.watch > worst.drop) worst = { drop: prev - pt.watch, at: pt.at };
      if (half === null && pt.watch <= 0.5) half = pt.at;
      prev = pt.watch;
    }
    console.log(`  ${p.topic.padEnd(10)} ${r.seconds}s  ` +
      `半分が離脱 ${half === null ? '最後まで残った' : half.toFixed(1) + 's'}  ` +
      `最大の落ち込み ${worst.at.toFixed(1)}s で -${(worst.drop * 100).toFixed(0)}%`);
  }
}

function render(topic) {
  console.log(`\nrendering topic "${topic.id}" ...`);
  run('node', ['director-wide.mjs'], { PROMO_TOPIC: topic.id });
  run('node', ['narrate.mjs']);
  run('node', ['encode.mjs']);
  if (!fs.existsSync(MP4)) throw new Error('render finished but no mp4 was produced');
  return MP4;
}

/**
 * Refuse to publish a broken render. Same checks as the Shorts run with the
 * frame shape and the duration window swapped: an explainer that came out at
 * forty seconds lost beats somewhere.
 */
function verify(file) {
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', file], { encoding: 'utf8' }));
  const v = probe.streams.find(s => s.codec_type === 'video');
  const a = probe.streams.find(s => s.codec_type === 'audio');
  const dur = Number(probe.format.duration);
  const problems = [];
  if (!v) problems.push('no video stream');
  if (!a) problems.push('no audio stream');
  if (!(dur > 45 && dur < 420)) problems.push(`duration ${dur?.toFixed(1)}s outside 45–420s`);
  if (v && (v.width !== 1920 || v.height !== 1080)) problems.push(`${v.width}x${v.height}, expected 1920x1080`);

  // A black opening frame compresses to almost nothing as a PNG.
  const probeFrame = path.join(PROMO, 'video', '_first.png');
  fs.mkdirSync(path.dirname(probeFrame), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '0.05', '-i', file,
    '-frames:v', '1', '-vf', 'scale=284:160', probeFrame]);
  const bytes = fs.statSync(probeFrame).size;
  fs.rmSync(probeFrame, { force: true });
  if (bytes < 3000) problems.push(`opening frame looks blank (${bytes} bytes)`);

  if (problems.length) throw new Error('render failed checks: ' + problems.join('; '));
  console.log(`checks passed: ${dur.toFixed(1)}s, ${v.width}x${v.height}, ${a.codec_name} audio`);
}

function metadata(topic) {
  const tags = topic.tags.slice(0, 12);
  return {
    title: topic.title.slice(0, 100),
    description:
      `${topic.description}\n\n` +
      'このチャンネルでは、放置ゲームの設計を実際の画面と数字で解説しています。\n' +
      '次に見たい仕組みをコメントしてください。続きはチャンネル登録で。\n\n' +
      `無料ブラウザ版（iPhone・Android対応／インストール不要）\n${PLAY_URL}\n\n` +
      `${tags.slice(0, 3).map(t => '#' + t.replace(/\\s+/g, '')).join(' ')}\n\n` +
      MARK(topic.id),
    tags,
    privacy,
    publishAt,
  };
}

// --- go ---------------------------------------------------------------------------
const { perTopic, mine } = await history();
await reportRetention(mine);

const { topic, why } = pickTopic(perTopic, mine);
console.log(`\n選んだ題材: "${topic.id}" — ${why}`);

const file = render(topic);
const meta = metadata(topic);
console.log(`\ntitle: ${meta.title}\nprivacy: ${meta.privacy}` +
  (publishAt ? `\n公開予定: ${publishAt}` : '') + `\nfile: ` +
  `${(fs.statSync(file).size / 1e6).toFixed(1)}MB`);
console.log(`\n--- description ---\n${meta.description}\n---`);

if (dryRun) {
  console.log('\n--dry-run: not uploading');
  process.exit(0);
}

try {
  credentials();
} catch (e) {
  console.log(`\nnot uploading: ${e.message.split('\n')[0]}`);
  console.log(`the video is ready at ${path.relative(process.cwd(), file)} — see youtube/SETUP.md`);
  process.exit(0);
}

verify(file);

const c = await channel();
if (c.title !== 'クッキーストラテジャー') {
  throw new Error(`誤投稿防止: 接続先は「${c.title}」`);
}
const res = await upload(file, meta);
console.log(`\nuploaded to ${c.title}: ${res.url} ` +
  (res.publishAt ? `(${res.publishAt} に公開予定)` : `(${res.privacy})`));

// The thumbnail is chosen rather than left to YouTube, which picks a frame on
// its own and has no idea which one carries the point. It is built from the file
// that was just uploaded, so it cannot promise a screen the video does not have.
// Anything going wrong here is reported and stepped over: the video is already
// published, and the posting log below still has to be written.
try {
  const trim = JSON.parse(fs.readFileSync(path.join(PROMO, 'trim.json'), 'utf8'));
  const thumb = buildThumbnail(topic, {
    mp4: file, trim, out: path.join(PROMO, 'video', 'thumbnail.png'),
  });
  if (thumb) {
    await setThumbnail(res.id, thumb);
    console.log(`サムネイルを設定: ${topic.thumb.lines.join(' / ')}`);
  }
} catch (e) {
  console.log(`サムネイルは設定できませんでした（動画はそのまま公開されます）: ${e.message}`);
}

const posted = readLog();
posted.push({ at: new Date().toISOString(), topic: topic.id, videoId: res.id,
  privacy: res.privacy, publishAt: res.publishAt, title: meta.title });
fs.writeFileSync(LOG, JSON.stringify(posted, null, 2));
console.log(`recorded in ${path.relative(PROMO, LOG)}`);
