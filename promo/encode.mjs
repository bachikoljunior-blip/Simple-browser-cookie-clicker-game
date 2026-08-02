// Assembles the deliverable from the captured frame grid and the captured audio.
//
// director.mjs already laid every frame on a fixed real-time grid starting at the
// instant the take began — the same instant the audio recording started — so there
// is no drift to correct and no lead-in to trim. This just encodes the frames,
// muxes the soundtrack, and then measures the result to prove the sync held.
//
// Two quirks of the bundled ffmpeg shape the pipeline: there is no image2 demuxer
// (frames go in through image2pipe on stdin) and no audio codec at all (the Opus
// track can only be stream-copied, so the mux is a separate copy-only pass).
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import { frameMeans, findFlashes, matchFlashes } from './framestats.mjs';

// playwright-core bundles an ffmpeg; override with PROMO_FFMPEG to use your own.
const FF = process.env.PROMO_FFMPEG || '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const { frames: DIR, fps: FPS, audio: AUDIO, takeSec, flashLog } =
  JSON.parse(fs.readFileSync('trim.json', 'utf8'));
const OUT = process.argv[2] || 'cookie_strateger_short.webm';
const MID = 'video/_video_only.webm';

// --- encode the frame grid ----------------------------------------------------
const files = fs.readdirSync(DIR).filter(n => n.endsWith('.jpg')).sort();
console.log(`${files.length} frames @${FPS}fps = ${(files.length / FPS).toFixed(2)}s (take was ${takeSec.toFixed(2)}s)`);

await new Promise((resolve, reject) => {
  const ff = spawn(FF, ['-y', '-hide_banner', '-loglevel', 'error',
    // This build has no image2 demuxer and cannot probe a JPEG stream, so the
    // frames arrive on stdin with the codec named explicitly.
    '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0',
    '-vf', 'scale=1080:1920:flags=lanczos',
    '-c:v', 'libvpx', '-b:v', '5M', '-crf', '28',
    '-deadline', 'good', '-cpu-used', '3', '-auto-alt-ref', '0', '-an',
    '-r', String(FPS), MID], { stdio: ['pipe', 'inherit', 'inherit'] });
  ff.on('error', reject);
  ff.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg exit ' + code)));
  (async () => {
    for (const n of files) {
      if (!ff.stdin.write(fs.readFileSync(`${DIR}/${n}`))) {
        await new Promise(r => ff.stdin.once('drain', r));
      }
    }
    ff.stdin.end();
  })().catch(reject);
});

// --- mux the soundtrack -------------------------------------------------------
if (AUDIO && fs.existsSync(AUDIO)) {
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error',
    '-i', MID, '-i', AUDIO,
    '-map', '0:v:0', '-map', '1:a:0',
    '-c', 'copy', '-shortest', OUT], { stdio: 'inherit' });
} else {
  console.log('!! no audio track captured — writing silent video');
  fs.copyFileSync(MID, OUT);
}
fs.rmSync(MID, { force: true });

// --- prove the sync -----------------------------------------------------------
// Each hard cut wrote a white frame and a transition sound at the same instant.
// Finding those white frames in the finished video says where the picture thinks
// each cut happened; the log says when the sound did. They should agree to within
// about a frame.
if (flashLog && flashLog.length >= 3) {
  const means = frameMeans(FF, OUT, FPS);
  const flashes = findFlashes(means, FPS, 200);
  const check = matchFlashes(flashes, flashLog, 1, 0, 0.4);
  if (check) {
    console.log(`sync: ${check.pairs.length}/${flashLog.length} cuts matched, ` +
      `max ${(check.maxAbs * 1000).toFixed(0)}ms ` +
      `(${check.residuals.map(r => (r * 1000).toFixed(0)).join('/')}ms), ` +
      `scale ${check.a.toFixed(4)}`);
  } else {
    console.log(`sync: could not match cuts (${flashes.length} bright events found)`);
  }
}

const info = spawnSync(FF, ['-hide_banner', '-i', OUT], { encoding: 'utf8' }).stderr;
console.log(OUT, (fs.statSync(OUT).size / 1e6).toFixed(1) + 'MB',
  (info.match(/Duration: ([\d:.]+)/) || [])[1] || '',
  info.includes('Audio:') ? '| audio ok' : '| NO AUDIO');
