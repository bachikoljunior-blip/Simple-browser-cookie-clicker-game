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

// The ffmpeg playwright-core bundles can only do VP8 — no audio codecs at all,
// and no H.264. A system ffmpeg, if one is installed, is used instead so the
// narration can be mixed in and an MP4 written alongside the WebM.
const BUNDLED = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const FF = process.env.PROMO_FFMPEG
  || (spawnSync('ffmpeg', ['-version']).status === 0 ? 'ffmpeg' : BUNDLED);
const FULL = FF !== BUNDLED;
const { frames: DIR, fps: FPS, audio: AUDIO, takeSec, flashLog } =
  JSON.parse(fs.readFileSync('trim.json', 'utf8'));
const OUT = process.argv[2] || 'cookie_strateger_short.webm';
const MID = 'video/_video_only.webm';
const NARRATION = 'video/narration.wav';
const MP4 = OUT.replace(/\.webm$/, '.mp4');

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

// --- mix and mux the soundtrack ----------------------------------------------
// The game audio and the narration are separate stems, so the music can be
// pushed out of the way under each spoken line rather than turned down for the
// whole video. loudnorm lands the result on the -14 LUFS that YouTube normalises
// to, which is also why the levels are set here and not at capture time.
const hasVoice = FULL && fs.existsSync(NARRATION);
if (AUDIO && fs.existsSync(AUDIO)) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', MID, '-i', AUDIO];
  if (hasVoice) args.push('-i', NARRATION);
  if (hasVoice) {
    args.push('-filter_complex',
      // asplit because the voice is used twice: once to key the ducking, once in
      // the mix itself. A filter label can only be consumed once.
      '[2:a]aformat=sample_rates=48000:channel_layouts=stereo,' +
      'highpass=f=100,acompressor=threshold=0.06:ratio=4:attack=5:release=200,volume=3.2,asplit=2[voc1][voc2];' +
      '[1:a][voc1]sidechaincompress=threshold=0.02:ratio=9:attack=25:release=380[duck];' +
      '[duck][voc2]amix=inputs=2:duration=first:normalize=0[mix];' +
      '[mix]alimiter=limit=0.97,loudnorm=I=-14:TP=-1.5:LRA=11[aout]',
      '-map', '0:v:0', '-map', '[aout]');
  } else {
    args.push('-map', '0:v:0', '-map', '1:a:0');
  }
  args.push('-c:v', 'copy', '-c:a', FULL ? 'libopus' : 'copy');
  if (FULL) args.push('-b:a', '128k');
  args.push('-shortest', OUT);
  execFileSync(FF, args, { stdio: 'inherit' });
  console.log(hasVoice ? 'mixed: game audio ducked under narration' : 'game audio only');
} else {
  console.log('!! no audio track captured — writing silent video');
  fs.copyFileSync(MID, OUT);
}
fs.rmSync(MID, { force: true });

// An H.264/AAC copy as well: phone editing apps and some uploaders will not take
// WebM, and the bundled ffmpeg could not produce one.
if (FULL) {
  execFileSync(FF, ['-y', '-hide_banner', '-loglevel', 'error', '-i', OUT,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '160k', MP4], { stdio: 'inherit' });
  console.log(MP4, (fs.statSync(MP4).size / 1e6).toFixed(1) + 'MB');
}

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
