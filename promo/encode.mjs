// Trims the setup lead-in off the raw capture and encodes the deliverable.
//
// The capture opens on the game's own boot screen (bright), then the promo cover
// blacks the frame out during setup, then the take begins. The cut point is the
// frame right after the LAST covered frame — found by sampling the video at 5fps
// as 64x64 PNGs: a flat black frame compresses to a few hundred bytes, a frame of
// gameplay to several KB. That beats trusting wall-clock timing, since Playwright's
// webm timestamps run a few percent slow.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';

// playwright-core bundles an ffmpeg; override with PROMO_FFMPEG to use your own.
const FF = process.env.PROMO_FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const { file: RAW, trimSec } = JSON.parse(fs.readFileSync('trim.json', 'utf8'));
const OUT = process.argv[2] || 'cookie_strateger_short.webm';
const FPS = 25;
const SAMPLE_FPS = 5;
const DARK_BYTES = 900;   // 64x64 PNG of a near-flat dark frame
const TMP = 'scan';

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP);
// This ffmpeg build ships without the fps filter, so resample via -r instead.
execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', RAW,
  '-r', String(SAMPLE_FPS), '-vf', 'scale=64:64', `${TMP}/f%05d.png`]);

const samples = fs.readdirSync(TMP).sort()
  .map(n => fs.statSync(`${TMP}/${n}`).size);
// Only look inside the setup window. Later scenes (the skill tree) are dark enough
// to trip the size test too, and the wall-clock estimate is a reliable upper bound
// once padded for the timestamp stretch.
const limit = Math.min(samples.length, Math.ceil((trimSec * 1.2 + 2) * SAMPLE_FPS));
let lastDark = -1;
for (let i = 0; i < limit; i++) if (samples[i] < DARK_BYTES) lastDark = i;
// Samples are 1-indexed frames at SAMPLE_FPS; cut just after the last dark one.
const ss = ((lastDark + 1) / SAMPLE_FPS).toFixed(3);
console.log(`samples: ${samples.length}, last covered: ${lastDark}, cut at ${ss}s`);
fs.rmSync(TMP, { recursive: true, force: true });

execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error',
  '-ss', ss, '-i', RAW,
  '-vf', 'scale=1080:1920:flags=lanczos',
  '-c:v', 'libvpx', '-b:v', '5M', '-crf', '28',
  '-deadline', 'good', '-cpu-used', '3', '-auto-alt-ref', '0', '-an',
  '-r', String(FPS), OUT], { stdio: 'inherit' });

const info = spawnSync(FF, ['-hide_banner', '-i', OUT], { encoding: 'utf8' }).stderr;
console.log(OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + 'MB',
  (info.match(/Duration: ([\d:.]+)/) || [])[1] || '');
