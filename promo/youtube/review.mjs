// An outside pair of eyes on the finished video, and a gate the upload cannot
// walk past without one.
//
//   node youtube/review.mjs prepare            pull frames, print the brief
//   node youtube/review.mjs record < verdict.json   bind a verdict to this render
//   node youtube/review.mjs check              exit non-zero unless it passed
//
// Why this exists (2026-08-10, the owner's idea): every judgement about whether
// a take is good has been made by whoever made it. The pipeline's own checks ask
// "is it broken" — right length, right resolution, the declared sentence on
// screen — and nothing has ever asked "is it worth watching". Lifetime: 19
// videos, 1 subscriber, 0 comments, growth linear. A maker grading their own
// work is exactly where that shape comes from.
//
// The important part is not the review. It is that the review can REFUSE.
// Instruction 7 has cost this project four bad takes through checks that printed
// a warning and carried on, so this one is wired the same way `mustSee` is: the
// upload path calls `check` and dies on a non-zero exit.
//
// The verdict is bound to the sha256 of the exact file it judged. A pass from an
// earlier render cannot authorise a later one — which is the failure this would
// otherwise have, because re-rendering is one command away and the verdict file
// sits there looking valid.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { byId } from '../variants.mjs';

const PROMO = path.resolve(import.meta.dirname, '..');
const MP4 = path.join(PROMO, 'cookie_strateger_short.mp4');
const FRAMES = path.join(PROMO, 'review');
const VERDICT = path.join(PROMO, 'youtube', 'review-verdict.json');

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const duration = file => Number(JSON.parse(execFileSync('ffprobe',
  ['-v', 'error', '-print_format', 'json', '-show_format', file],
  { encoding: 'utf8' })).format.duration);

/**
 * Frames a reviewer can actually open, weighted to where viewers leave.
 *
 * Dense at the start because the opening is what the Shorts feed decides on, and
 * one at every measured cliff. The retention curves this channel has all fall
 * hardest between 4s and 6s, so that stretch gets its own samples rather than
 * being averaged away by an even spread.
 */
function prepare() {
  if (!fs.existsSync(MP4)) throw new Error(`まだ動画が無い: ${MP4}`);
  const dur = duration(MP4);
  const stamps = [0.3, 0.8, 1.5, 2.5, 3.5, 4.5, 5.5, 7, 9]
    .concat([dur * 0.75, dur - 0.6])
    .filter(t => t > 0 && t < dur)
    .map(t => Math.round(t * 10) / 10);

  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  for (const t of stamps) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', MP4,
      '-frames:v', '1', '-vf', 'scale=420:-1', path.join(FRAMES, `t${t}.png`)]);
  }

  const cut = byId(process.env.PROMO_VARIANT || '') || {};
  const h = cut.hook || {};
  // What the video CLAIMS, so the reviewer can judge the claim against the
  // picture rather than being told what to see. Deliberately not the reasoning
  // behind the cut: a reviewer given the justification agrees with it.
  console.log(JSON.stringify({
    mp4: MP4,
    sha256: sha(MP4),
    seconds: Number(dur.toFixed(2)),
    frames: stamps.map(t => path.join(FRAMES, `t${t}.png`)),
    claims: {
      title: cut.title || '(不明)',
      banner: h.banner || '',
      caption: (h.caption || []).join(' / ').replace(/<\/?em>/g, ''),
      narration: h.narration || '',
    },
  }, null, 2));
}

/**
 * Bind a verdict to this exact render. Reads JSON on stdin:
 *   { "verdict": "pass" | "fail", "swipeAt": 2.5, "reasons": [...], "fix": "..." }
 * The sha256 is computed here rather than taken from the reviewer, so a verdict
 * cannot claim to be about a file it never saw.
 */
function record() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  let v;
  try { v = JSON.parse(raw); } catch { throw new Error('判定が JSON になっていない: ' + raw.slice(0, 200)); }
  if (v.verdict !== 'pass' && v.verdict !== 'fail') {
    throw new Error(`verdict は "pass" か "fail"。来たのは ${JSON.stringify(v.verdict)}`);
  }
  if (!Array.isArray(v.reasons) || !v.reasons.length) {
    throw new Error('reasons が空。理由の無い合格は、見ていないのと区別がつかない');
  }
  fs.writeFileSync(VERDICT, JSON.stringify({
    ...v, sha256: sha(MP4), at: new Date().toISOString(),
  }, null, 2));
  console.log(`判定を記録: ${v.verdict}（${path.relative(PROMO, VERDICT)}）`);
}

/**
 * The gate. Throws — does not print — so `autopost.mjs` dies before uploading.
 */
function check() {
  if (!fs.existsSync(VERDICT)) {
    throw new Error('外部レビューの判定が無い。'
      + '`node youtube/review.mjs prepare` でフレームを出し、別エージェントに見せて、'
      + '`record` で判定を記録すること。**見せずに投稿しない。**');
  }
  const v = JSON.parse(fs.readFileSync(VERDICT, 'utf8'));
  const now = sha(MP4);
  if (v.sha256 !== now) {
    throw new Error('判定が別の take のものです（レンダリングし直したのに評価し直していない）。'
      + `判定=${v.sha256.slice(0, 12)} / いまの動画=${now.slice(0, 12)}`);
  }
  if (v.verdict !== 'pass') {
    throw new Error(`外部レビューが不合格と言っています: ${(v.reasons || []).join(' / ')}`
      + (v.fix ? `\n直し方の提案: ${v.fix}` : ''));
  }
  console.log(`外部レビュー: 合格（${(v.reasons || [])[0] || ''}）`);
}

const cmd = process.argv[2];
if (cmd === 'prepare') prepare();
else if (cmd === 'record') record();
else if (cmd === 'check') check();
else {
  console.log('usage: review.mjs prepare | record < verdict.json | check');
  process.exit(2);
}
