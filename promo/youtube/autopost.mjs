// One scheduled run: look at what the channel did, pick the next cut, render it,
// and put it up.
//
//   node autopost.mjs              render and upload
//   node autopost.mjs --dry-run    render only, print what it would have posted
//   node autopost.mjs --cut boss   force a particular cut
//
// Privacy comes from YT_PRIVACY and defaults to `private`, so the automation
// cannot publish to the channel until that is deliberately set to `public`.
// Setting it is the same act as providing the credentials: a decision, not a
// default.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { VARIANTS, MARK } from '../variants.mjs';
import { videoStats, channel, upload, credentials } from './yt.mjs';

const PROMO = path.resolve(import.meta.dirname, '..');
const MP4 = path.join(PROMO, 'cookie_strateger_short.mp4');
const LOG = path.join(PROMO, 'youtube', 'posted.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forced = args[args.indexOf('--cut') + 1];
const privacy = process.env.YT_PRIVACY || 'private';

const run = (cmd, cmdArgs, env = {}) =>
  execFileSync(cmd, cmdArgs, { cwd: PROMO, stdio: 'inherit', env: { ...process.env, ...env } });

// --- what has been posted, and how it did --------------------------------------
// The cut id is written into each description as #cut-<id>, so a published video
// can be traced back to the cut that made it without keeping state anywhere.
async function history() {
  let stats = [];
  try {
    stats = await videoStats(28);
  } catch (e) {
    console.log(`analytics unavailable: ${e.message.split('\n')[0]}`);
    return null;
  }
  const perCut = {};
  for (const v of stats) {
    const cut = VARIANTS.find(c => v.description.includes(MARK(c.id)));
    if (!cut) continue;
    const age = v.publishedAt
      ? Math.max(1, (Date.now() - Date.parse(v.publishedAt)) / 86400_000) : 1;
    (perCut[cut.id] ||= []).push({ ...v, viewsPerDay: v.views / age });
  }
  return perCut;
}

/**
 * Retention decides how far a Short travels, and unlike raw views it does not
 * simply grow with age — so it is the score, with views per day breaking ties.
 * Anything never tried wins outright: six cuts is a small enough field to see
 * all of before optimising.
 */
function pickCut(perCut) {
  if (forced) {
    const c = VARIANTS.find(v => v.id === forced);
    if (!c) throw new Error(`no cut named "${forced}"`);
    return { cut: c, why: 'forced on the command line' };
  }
  if (!perCut) {
    const posted = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
    const tried = new Set(posted.map(p => p.cut));
    const fresh = VARIANTS.filter(v => !tried.has(v.id));
    const cut = fresh[0] || VARIANTS[posted.length % VARIANTS.length];
    return { cut, why: fresh.length ? 'not posted yet (no analytics)' : 'rotating (no analytics)' };
  }
  const untried = VARIANTS.filter(v => !perCut[v.id]);
  if (untried.length) return { cut: untried[0], why: 'not tried yet' };

  const scored = VARIANTS.map(v => {
    const rows = perCut[v.id];
    const retention = rows.reduce((a, r) => a + r.avgViewPercent, 0) / rows.length;
    const perDay = rows.reduce((a, r) => a + r.viewsPerDay, 0) / rows.length;
    return { v, retention, perDay, n: rows.length };
  }).sort((a, b) => (b.retention - a.retention) || (b.perDay - a.perDay));

  console.log('cut performance (28d):');
  scored.forEach(s => console.log(
    `  ${s.v.id.padEnd(10)} retention ${s.retention.toFixed(1)}%  ` +
    `${s.perDay.toFixed(1)} views/day  (${s.n} video${s.n > 1 ? 's' : ''})`));

  // Mostly exploit, but keep testing: a cut that lost once may have lost to the
  // hour it went up rather than to the hook.
  const explore = Math.random() < 0.3;
  const least = [...scored].sort((a, b) => a.n - b.n)[0];
  return explore
    ? { cut: least.v, why: `exploring (fewest posts: ${least.n})` }
    : { cut: scored[0].v, why: `best retention (${scored[0].retention.toFixed(1)}%)` };
}

// --- render ---------------------------------------------------------------------
function render(cut) {
  console.log(`\nrendering cut "${cut.id}" ...`);
  run('node', ['director.mjs'], { PROMO_VARIANT: cut.id });
  run('node', ['narrate.mjs']);
  run('node', ['encode.mjs']);
  if (!fs.existsSync(MP4)) throw new Error('render finished but no mp4 was produced');
  return MP4;
}

/**
 * Refuse to publish a broken render. This runs unattended against a live
 * channel, so the cheap checks are worth it: a take that failed halfway still
 * produces a file, and a Short that opens on black or plays silent is worse than
 * one that never went up.
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
  if (!(dur > 30 && dur < 70)) problems.push(`duration ${dur?.toFixed(1)}s outside 30–70s`);
  if (v && (v.width !== 1080 || v.height !== 1920)) problems.push(`${v.width}x${v.height}, expected 1080x1920`);

  // A black opening frame compresses to almost nothing as a PNG.
  const probeFrame = path.join(PROMO, 'video', '_first.png');
  fs.mkdirSync(path.dirname(probeFrame), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', '0.05', '-i', file,
    '-frames:v', '1', '-vf', 'scale=160:284', probeFrame]);
  const bytes = fs.statSync(probeFrame).size;
  fs.rmSync(probeFrame, { force: true });
  if (bytes < 3000) problems.push(`opening frame looks blank (${bytes} bytes)`);

  if (problems.length) throw new Error('render failed checks: ' + problems.join('; '));
  console.log(`checks passed: ${dur.toFixed(1)}s, ${v.width}x${v.height}, ${a.codec_name} audio`);
}

function metadata(cut) {
  const tags = cut.tags.slice(0, 12);
  return {
    title: cut.title.slice(0, 100),
    description: `${cut.description.trim()}\n\n${tags.map(t => '#' + t).join(' ')}\n\n${MARK(cut.id)}`,
    tags,
    privacy,
  };
}

// --- go ---------------------------------------------------------------------------
const perCut = await history();
const { cut, why } = pickCut(perCut);
console.log(`\nchose "${cut.id}" — ${why}`);

const file = render(cut);
const meta = metadata(cut);
console.log(`\ntitle: ${meta.title}\nprivacy: ${meta.privacy}\nfile: ` +
  `${(fs.statSync(file).size / 1e6).toFixed(1)}MB`);

if (dryRun) {
  console.log('\n--dry-run: not uploading');
  process.exit(0);
}

// Without credentials the video is still made — it is just left on disk for a
// human to post. Better than failing the whole run over a missing setup step.
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

const posted = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, 'utf8')) : [];
posted.push({ at: new Date().toISOString(), cut: cut.id, videoId: res.id, privacy: res.privacy, title: meta.title });
fs.writeFileSync(LOG, JSON.stringify(posted, null, 2));
console.log(`recorded in ${path.relative(PROMO, LOG)}`);
