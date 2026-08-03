// One scheduled run for the landscape explainers.
//
//   node autopost-long.mjs              render and upload
//   node autopost-long.mjs --dry-run    render only, print what it would post
//   node autopost-long.mjs --topic hunt force a particular topic
//   node autopost-long.mjs --public     publish rather than upload privately
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
import { describe } from '../variants.mjs';
import { videoStats, channelVideos, channel, upload, credentials, retention } from './yt.mjs';

const PROMO = path.resolve(import.meta.dirname, '..');
const MP4 = path.join(PROMO, 'cookie_strateger_long.mp4');
const LOG = path.join(PROMO, 'youtube', 'posted-long.json');
const TESTER = path.join(PROMO, 'youtube', 'tester.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const topicAt = args.indexOf('--topic');
const forced = topicAt === -1 ? undefined : args[topicAt + 1];
const privacy = args.includes('--public') ? 'public' : (process.env.YT_PRIVACY || 'private');

const readLog = () => (fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : []);
const run = (cmd, cmdArgs, env = {}) =>
  execFileSync(cmd, cmdArgs, { cwd: PROMO, stdio: 'inherit', env: { ...process.env, ...env } });

/**
 * Where a viewer who wants to test actually lands. Shared with the Shorts run
 * and checked the same way: the video says the links are in the description, so
 * they have to be real before anything is published.
 */
function testerLinks() {
  const t = JSON.parse(fs.readFileSync(TESTER, 'utf8'));
  const links = {
    groupUrl: (process.env.YT_TESTER_GROUP_URL || t.groupUrl || '').trim(),
    optInUrl: (process.env.YT_TESTER_OPTIN_URL || t.optInUrl || '').trim(),
    contact: (process.env.YT_TESTER_CONTACT || t.contact || '').trim(),
  };
  const bad = ['groupUrl', 'optInUrl'].filter(k => !/^https?:\/\/\S+$/.test(links[k]));
  if (bad.length) {
    throw new Error(`tester links not set: ${bad.join(', ')}.\n` +
      `The video says the join links are in the description, so it must not be ` +
      `published without them.\nFill them in ${path.relative(PROMO, TESTER)}.`);
  }
  return links;
}

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
      views: s?.views ?? v.views,
      viewsPerDay: (s?.views ?? v.views) / age,
    });
  }
  console.log(`チャンネルの動画 ${videos.length}本 / うち解説 ${mine.length}本`);
  const rankable = Object.values(perTopic).flat().some(r => r.avgViewPercent !== null);
  return { perTopic: rankable ? perTopic : null, mine };
}

/**
 * Retention is the score. Unlike a Shorts cut, a topic is not interchangeable
 * with the others — a viewer who came for the skill tree did not want the
 * workshop — so a topic that does badly is evidence about the subject, not just
 * about the hook, and it is worth a second showing before being written off.
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
    return {
      x,
      keep: rows.reduce((a, r) => a + r.avgViewPercent, 0) / rows.length,
      perDay: rows.reduce((a, r) => a + r.viewsPerDay, 0) / rows.length,
      n: rows.length,
    };
  }).sort((a, b) => (b.keep - a.keep) || (b.perDay - a.perDay));

  console.log('\n--- 題材ごとの成績 (28日) ---');
  scored.forEach(s => console.log(
    `  ${s.x.id.padEnd(10)} 平均視聴率 ${s.keep.toFixed(1)}%  ` +
    `1日あたり ${s.perDay.toFixed(1)}回  (${s.n}本)`));

  const explore = Math.random() < 0.3;
  const least = [...scored].sort((a, b) => a.n - b.n)[0];
  return explore
    ? { topic: least.x, why: `試行（最も本数が少ない: ${least.n}本）` }
    : { topic: scored[0].x, why: `平均視聴率が最良 (${scored[0].keep.toFixed(1)}%)` };
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

function metadata(topic, links) {
  const tags = topic.tags.slice(0, 12);
  return {
    title: topic.title.slice(0, 100),
    // describe() holds the one copy of the recruitment terms, shared with the
    // Shorts run — six topics with their own copy would drift, and a drifted
    // copy is a viewer being told a different deal than the one waiting.
    description: `${describe(topic, links)}\n\n${tags.map(t => '#' + t).join(' ')}\n\n${MARK(topic.id)}`,
    tags,
    privacy,
  };
}

// --- go ---------------------------------------------------------------------------
const links = testerLinks();
const { perTopic, mine } = await history();
await reportRetention(mine);

const { topic, why } = pickTopic(perTopic, mine);
console.log(`\n選んだ題材: "${topic.id}" — ${why}`);

const file = render(topic);
const meta = metadata(topic, links);
console.log(`\ntitle: ${meta.title}\nprivacy: ${meta.privacy}\nfile: ` +
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
const res = await upload(file, meta);
console.log(`\nuploaded to ${c.title}: ${res.url} (${res.privacy})`);

const posted = readLog();
posted.push({ at: new Date().toISOString(), topic: topic.id, videoId: res.id,
  privacy: res.privacy, title: meta.title });
fs.writeFileSync(LOG, JSON.stringify(posted, null, 2));
console.log(`recorded in ${path.relative(PROMO, LOG)}`);
