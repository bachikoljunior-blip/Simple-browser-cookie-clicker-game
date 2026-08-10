// One scheduled run: look at what the channel did, pick the next cut, render it,
// and put it up.
//
//   node autopost.mjs              render and upload
//   node autopost.mjs --dry-run    render only, print what it would have posted
//   node autopost.mjs --cut boss   force a particular cut
//   node autopost.mjs --length short  hook → 本体 → CTA only (~13s)
//   node autopost.mjs --body scale   short mode: 25枚→100正 の対比を本体にする
//   node autopost.mjs --public     publish rather than upload privately
//   node autopost.mjs --at <time>  go live at an RFC3339 instant instead of at once
//
// Privacy defaults to `private`, so the automation cannot publish to the channel
// until someone deliberately passes --public (or sets YT_PRIVACY). That is the
// same kind of act as providing the credentials: a decision, not a default.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { VARIANTS, MARK, describe } from '../variants.mjs';
import { frameMotion } from '../framestats.mjs';
import { videoStats, channelVideos, channel, about, upload, credentials, retention } from './yt.mjs';

const PROMO = path.resolve(import.meta.dirname, '..');
const MP4 = path.join(PROMO, 'cookie_strateger_short.mp4');
const LOG = path.join(PROMO, 'youtube', 'posted.json');
const TESTER = path.join(PROMO, 'youtube', 'tester.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
// indexOf returns -1 when the flag is absent, and args[-1 + 1] is the first
// argument — so any other flag was being read as a cut name.
const cutAt = args.indexOf('--cut');
const forced = cutAt === -1 ? undefined : args[cutAt + 1];
const privacy = args.includes('--public') ? 'public' : (process.env.YT_PRIVACY || 'private');
// When it goes live, as distinct from when it was made. Passed straight to
// YouTube's scheduled publishing, so the render can happen whenever the machine
// is free while the moment it appears is chosen on its own evidence.
// Length is a decision about the video, not about the run, so it rides with the
// other render flags. The floor in verify() moved with it: the old 30s floor
// would have rejected every short take as broken.
const bodyAt = args.indexOf('--body');
const BODY = bodyAt === -1 ? (process.env.PROMO_BODY || 'hunt') : args[bodyAt + 1];
const lenAt = args.indexOf('--length');
const LENGTH = lenAt === -1 ? (process.env.PROMO_LENGTH || 'full') : args[lenAt + 1];
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

// --- what is on the channel, and how it did ------------------------------------
// Rebuilt from the API every run. The cut id is written into each description as
// #cut-<id>, so a live video says which cut made it; nothing has to be
// remembered between runs, and a video that was deleted stops counting the
// moment it is gone.
async function history() {
  const videos = await channelVideos();
  console.log(`チャンネルの動画 ${videos.length}本` +
    (videos.length ? `（最新: ${videos[0].title}）` : ''));

  let stats = [];
  try {
    stats = await videoStats(28);
  } catch (e) {
    console.log(`アナリティクスが読めません: ${e.message.split('\n')[0]}`);
  }
  const byId = Object.fromEntries(stats.map(s => [s.id, s]));

  const perCut = {};
  const mine = [];
  for (const v of videos) {
    const cut = VARIANTS.find(c => v.description.includes(MARK(c.id)));
    if (!cut) continue;                       // posted by hand, not by this
    mine.push({ ...v, cut: cut.id });
    const s = byId[v.id];
    const age = Math.max(1, (Date.now() - Date.parse(v.publishedAt)) / 86400_000);
    (perCut[cut.id] ||= []).push({
      ...v,
      avgViewPercent: s?.avgViewPercent ?? null,
      views: s?.views ?? v.views,
      viewsPerDay: (s?.views ?? v.views) / age,
    });
  }
  // Nothing of ours is up yet, or none of it has numbers worth ranking on.
  const rankable = Object.values(perCut).flat().some(r => r.avgViewPercent !== null);
  return { perCut: rankable ? perCut : null, mine };
}

/**
 * Retention decides how far a Short travels, and unlike raw views it does not
 * simply grow with age — so it is the score, with views per day breaking ties.
 * Anything never tried wins outright: six cuts is a small enough field to see
 * all of before optimising.
 */
function pickCut(perCut, mine) {
  if (forced) {
    const c = VARIANTS.find(v => v.id === forced);
    if (!c) throw new Error(`no cut named "${forced}"`);
    return { cut: c, why: 'コマンドラインで指定' };
  }
  if (!perCut) {
    // No numbers yet — go by what is actually up on the channel right now.
    const live = new Set(mine.map(v => v.cut));
    const fresh = VARIANTS.filter(v => !live.has(v.id));
    const cut = fresh[0] || VARIANTS[mine.length % VARIANTS.length];
    return { cut, why: fresh.length ? 'まだ出していない切り口' : '順番に回している' };
  }
  const untried = VARIANTS.filter(v => !perCut[v.id]);
  if (untried.length) return { cut: untried[0], why: 'まだ出していない切り口' };

  const scored = VARIANTS.map(v => {
    const rows = perCut[v.id].filter(r => r.avgViewPercent !== null);
    const retention = rows.reduce((a, r) => a + r.avgViewPercent, 0) / rows.length;
    const perDay = rows.reduce((a, r) => a + r.viewsPerDay, 0) / rows.length;
    return { v, retention, perDay, n: rows.length };
  }).sort((a, b) => (b.retention - a.retention) || (b.perDay - a.perDay));

  console.log('\n--- 切り口ごとの成績 (28日) ---');
  scored.forEach(s => console.log(
    `  ${s.v.id.padEnd(10)} 平均視聴率 ${s.retention.toFixed(1)}%  ` +
    `1日あたり ${s.perDay.toFixed(1)}回  (${s.n}本)`));

  // Mostly exploit, but keep testing: a cut that lost once may have lost to the
  // hour it went up rather than to the hook.
  const explore = Math.random() < 0.3;
  const least = [...scored].sort((a, b) => a.n - b.n)[0];
  return explore
    ? { cut: least.v, why: `試行（最も本数が少ない: ${least.n}本）` }
    : { cut: scored[0].v, why: `平均視聴率が最良 (${scored[0].retention.toFixed(1)}%)` };
}

/**
 * Where people stopped watching the last few posts.
 *
 * Average view percentage ranks the cuts; this says what to change. A Short
 * that holds to 5s and collapses by 9s is not a bad idea badly titled — it is a
 * specific second where the promise ran out, and the take that produced it
 * logged the time of every cut, so the second maps to a beat.
 *
 * Runs before anything is rendered. Printed after the upload it would still be
 * true, but it would be a report on a video already made — the reading has to
 * arrive while the next one can still change.
 */
async function reportRetention(mine) {
  console.log('\n--- 直近の離脱 ---');
  if (!mine.length) { console.log('  この仕組みで出した動画がまだありません'); return; }
  for (const p of mine.slice(0, 3)) {
    let r;
    try { r = await retention(p.id); } catch { continue; }
    if (!r.points.length) { console.log(`  ${p.cut}: まだ十分な視聴時間がありません`); continue; }

    // The biggest single fall, and where half the audience was gone.
    let worst = { drop: 0, at: 0 }, half = null, prev = null;
    for (const pt of r.points) {
      if (prev !== null && prev - pt.watch > worst.drop) worst = { drop: prev - pt.watch, at: pt.at };
      if (half === null && pt.watch <= 0.5) half = pt.at;
      prev = pt.watch;
    }
    console.log(`  ${p.cut.padEnd(10)} ${r.seconds}s  ` +
      `半分が離脱 ${half === null ? '最後まで残った' : half.toFixed(1) + 's'}  ` +
      `最大の落ち込み ${worst.at.toFixed(1)}s で -${(worst.drop * 100).toFixed(0)}%`);
  }
}

// --- render ---------------------------------------------------------------------
function render(cut) {
  // A cut may name the body it needs. Some hooks only pay off against one body:
  // 「無量大数の上、あります?」 followed by the monster-hunting body asks a
  // question and then changes the subject. An explicit --body still wins, so the
  // flag can still be used to try a hook against a body it was not written for.
  const body = bodyAt === -1 ? (cut.body || BODY) : BODY;
  console.log(`\nrendering cut "${cut.id}" (body: ${body}) ...`);
  // The local server has to be serving the REPOSITORY ROOT, not promo/. Started
  // from the wrong directory it answers 200 for its own index and 404s
  // play.html, and the render then dies inside the game with
  // "freshState is not defined" -- an error wearing the game's face for a
  // mistake made in the shell. Asserting it here costs one request and removes
  // the whole confusion.
  ensureServerRoot();
  ensureTools();
  run('node', ['director.mjs'], { PROMO_VARIANT: cut.id, PROMO_LENGTH: LENGTH, PROMO_BODY: body });
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
// Starting the server was a manual step in the run instructions, and manual
// steps are where this project keeps losing: it has been started from promo/
// (play.html 404s and the render dies inside the game with "freshState is not
// defined", an error wearing the game's face) and it dies with the container
// between runs. So this owns it -- checks the port, checks that what answers is
// actually play.html, and starts it at the repository root if not. The run
// instructions no longer need to mention it, which is the point: a step nobody
// has to remember cannot be forgotten.
function ensureServerRoot() {
  const ok = () => {
    try {
      const b = execFileSync('curl', ['-sf', '-m', '3', 'http://localhost:8765/play.html'],
        { maxBuffer: 1 << 28 }).toString('utf8', 0, 4000);
      return /<title>|クッキーストラテジャー/.test(b);
    } catch { return false; }
  };
  if (ok()) return;
  const repo = path.dirname(PROMO);
  execFileSync('sh', ['-c',
    `cd ${JSON.stringify(repo)} && (nohup python3 -m http.server 8765 >/dev/null 2>&1 &)`],
    { detached: true });
  for (let i = 0; i < 20; i++) {
    execFileSync('sleep', ['0.5']);
    if (ok()) { console.log(`  ローカル鯖: ${repo} で起動した`); return; }
  }
  throw new Error(`8765 で play.html を出せない。${repo} に play.html があるか確認すること。`
    + ' 別ルート（promo/ など）で誰かが 8765 を掴んでいる可能性もある。');
}

// Same shape as ensureServerRoot, for the same reason. A fresh container has no
// system ffmpeg and no open_jtalk, and encode.mjs silently degrades when it finds
// only the bundled ffmpeg: no narration mixed in, no MP4 written. The run then
// died forty seconds later on 「render finished but no mp4 was produced」 — an
// error naming the encoder for a container that had never been set up.
//
// README said 「新しいコンテナでは毎回必要」 and setup.sh existed. That is the
// exact form instruction 7 rejects: a step written down for someone to remember.
// It is not remembered — it was missed here, on a fresh container, by a run that
// had read the README in the same session. So the step moves into the code that
// needs it, and nobody has to know about it.
function ensureTools() {
  const have = t => spawnSync(t, ['-version']).status === 0
    || spawnSync('sh', ['-c', `command -v ${t}`]).status === 0;
  if (have('ffmpeg') && have('open_jtalk')) return;
  console.log('  ffmpeg/open_jtalk が無いので setup.sh を走らせる（新しいコンテナ）...');
  execFileSync('bash', [path.join(PROMO, 'youtube', 'setup.sh')], { stdio: 'inherit' });
  if (!have('ffmpeg')) {
    throw new Error('setup.sh のあとも ffmpeg が無い。ここで止める —— '
      + '同梱の ffmpeg では音声コーデックが無く、ナレーション無し・mp4 無しの take になる。');
  }
}

function verify(file) {
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', file], { encoding: 'utf8' }));
  const v = probe.streams.find(s => s.codec_type === 'video');
  const a = probe.streams.find(s => s.codec_type === 'audio');
  const dur = Number(probe.format.duration);
  const problems = [];
  if (!v) problems.push('no video stream');
  if (!a) problems.push('no audio stream');
  if (!(dur > 12 && dur < 70)) problems.push(`duration ${dur?.toFixed(1)}s outside 12–70s`);
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
  hookMoves(file);
}

/**
 * A hook that asked the screen to move, and got a still picture, is a broken
 * take — not a taste call.
 *
 * 2026-08-10. `restart` opens on the `skill` screen, whose motion in director's
 * table is `wait(400)` — nothing. 2.8 seconds of hook were one frame held still.
 * `verify` passed it: right length, right size, audio present, opening frame not
 * blank. An outside reviewer swiped at 1.5s and named the still opening.
 *
 * The threshold is measured, not felt. Two renders, same day, same scan:
 *
 *     restart  掴み静止        peak 0.09   ← 落ちてほしい側
 *     stages   研究一覧をスクロール peak 2.50   ← 通ってほしい側
 *
 * 0.5 is ~5x above one and ~5x below the other. Not a wide gap — the mid-video
 * beats reach 3–28, but a list scrolling is gentler than a golden cookie — so
 * this line is worth re-measuring as cuts are added rather than treated as
 * settled. If a cut lands between 0.3 and 1.0, that is the signal to look at the
 * take itself, not to nudge the number.
 *
 * Exempt: cuts that declare `hook.motion: 'still'`. That is an author choosing to
 * hold — `craftcap` does, because the shared scroll pushed its evidence out of
 * frame — and a declared choice is reviewable. Stillness inherited from a table
 * entry nobody chose is not, which is the case this catches.
 *
 * A first version keyed on whether the cut's *screen* was a scrolling one. It
 * would have passed `restart` — the take that prompted it. A gate that misses its
 * own motivating case is the printed warning instruction 7 forbids, wearing a
 * throw's clothes; the rule had to move to the declaration.
 *
 * Reviewing this line: if a cut ever fails here while its opening does visibly
 * move, the 32x32 greyscale scan is too coarse for that kind of motion and the
 * scale — not the threshold — is what needs raising.
 */
function hookMoves(file) {
  const trimFile = path.join(PROMO, 'trim.json');
  if (!fs.existsSync(trimFile)) return;
  const trim = JSON.parse(fs.readFileSync(trimFile, 'utf8'));
  if (!trim.hookAsksToMove) return;
  // The hook runs from the first frame to the first hard cut. Without a logged
  // flash there is no hook window to measure, so there is nothing to assert.
  const firstFlash = (trim.flashLog || [])[0];
  if (!firstFlash) return;

  const FPS = 10, FLOOR = 0.5;
  const diffs = frameMotion('ffmpeg', file, FPS, firstFlash, path.join(PROMO, 'video', '_motion'));
  if (!diffs.length) return;
  const peak = Math.max(...diffs);
  if (peak < FLOOR) {
    throw new Error(
      `掴みが静止画のまま撮れている（動きの最大 ${peak.toFixed(2)} < ${FLOOR}）。\n`
      + `この切り口は画面を動かすと宣言しているのに、録れた ${firstFlash.toFixed(1)}秒 は`
      + `1枚の絵と区別がつかない。\n`
      + `hookMotion が空振りしている（スクロール先が無い等）。`
      + `投稿しない —— Shorts は最初の1秒で決まる。`);
  }
  console.log(`掴みの動き: 最大 ${peak.toFixed(2)}（0〜${firstFlash.toFixed(1)}s、下限 ${FLOOR}）`);
}

/**
 * Where a viewer who wants to test actually lands.
 *
 * The video ends by saying the links are in the description, so this is the one
 * thing that has to be true before anything goes up. It is checked rather than
 * assumed because the channel is already in the failure state it guards against:
 * the About text says the links are in the video description, and the videos
 * that were up had no description at all, so every viewer who went looking for a
 * way in over 568 views found a loop and nothing else.
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
    throw new Error(
      `tester links not set: ${bad.join(', ')}.\n` +
      `The video says the join links are in the description, so it must not be ` +
      `published without them.\nFill them in ${path.relative(PROMO, TESTER)} ` +
      `(or set YT_TESTER_GROUP_URL).`);
  }
  return links;
}

function metadata(cut, links) {
  const tags = cut.tags.slice(0, 12);
  return {
    title: cut.title.slice(0, 100),
    description: `${describe(cut, links)}\n\n${tags.map(t => '#' + t).join(' ')}\n\n${MARK(cut.id)}`,
    tags,
    privacy,
    publishAt,
  };
}

/**
 * The About text is written by hand and cannot be edited through these scopes,
 * so it can drift out of step with what the videos say. Worth a look each run —
 * it costs one quota unit.
 *
 * What this can and cannot see matters. It reads the About *description*; the
 * channel's links live in a separate "links" section the Data API does not
 * expose, so a channel with the join link properly set still looks bare here.
 * That makes a missing link unprovable, and the check only reports what it
 * actually saw. The video does not depend on any of this — it sends people to
 * its own description, which is written on the way up.
 */
async function noteAboutText(links) {
  try {
    const text = await about();
    if (!text.includes(links.groupUrl)) {
      // Confirmed on 2026-08-04 by a human actually looking at the channel page:
      // the link IS there, in the links section. The API only ever returns the
      // About body, so this check cannot see it and will say this every run.
      // Kept because it would still catch the link being removed from the body
      // if it were ever put there — but it is not a reason to stop.
      console.log('\nnote: 概要欄の本文にテスターグループのリンクはありません（既知）。');
      console.log('      リンク欄には在ることを 2026-08-04 に目視で確認済み。API は');
      console.log('      本文しか返さないので、この行は毎回出ます。投稿を止めないこと。');
    }
  } catch (e) {
    console.log(`could not read the channel About: ${e.message.split('\n')[0]}`);
  }
}

// --- go ---------------------------------------------------------------------------
// Checked before rendering: three minutes of capture is a poor way to find out
// the video had nowhere to send anyone.
const links = testerLinks();

// Read the channel first, then decide, then spend the four minutes of capture.
const { perCut, mine } = await history();
await reportRetention(mine);

const { cut, why } = pickCut(perCut, mine);
console.log(`\n選んだ切り口: "${cut.id}" — ${why}`);

const file = render(cut);
const meta = metadata(cut, links);
console.log(`\ntitle: ${meta.title}\nprivacy: ${meta.privacy}` +
  (publishAt ? `\n公開予定: ${publishAt}` : '') + `\nfile: ` +
  `${(fs.statSync(file).size / 1e6).toFixed(1)}MB`);
console.log(`\n--- description ---\n${meta.description}\n---`);

// Before the dry-run exit, not after.
//
// 2026-08-10: `verify` sat below this block, so the render step the runbook
// actually tells you to use (`--dry-run`) ran no checks at all. A take could be
// the wrong length, silent, or — since today — a still picture, and the render
// would finish quietly; the first complaint arrived at `--public`, after an
// outside reviewer had already spent a pass on it. These checks only read the
// file, so there is no reason to hold them until upload.
//
// `review.mjs check` stays below: at dry-run time the verdict does not exist yet,
// which is the whole point of rendering first.
verify(file);

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

// verify() only asks whether the render is broken. Whether it is worth watching
// has never been asked by anyone but the process that made it — 19 videos, 1
// subscriber, 0 comments, growth flat. So an outside reviewer has to have passed
// this exact file, and this throws if it has not (review.mjs binds the verdict
// to the mp4's sha256, so a pass from an earlier take cannot authorise this one).
run('node', ['youtube/review.mjs', 'check']);
await noteAboutText(links);

const c = await channel();
const res = await upload(file, meta);
console.log(`\nuploaded to ${c.title}: ${res.url} ` +
  (res.publishAt ? `(${res.publishAt} に公開予定)` : `(${res.privacy})`));

const posted = readLog();
posted.push({ at: new Date().toISOString(), cut: cut.id, videoId: res.id,
  privacy: res.privacy, publishAt: res.publishAt, title: meta.title });
fs.writeFileSync(LOG, JSON.stringify(posted, null, 2));
console.log(`recorded in ${path.relative(PROMO, LOG)}`);
