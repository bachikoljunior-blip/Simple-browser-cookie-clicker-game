// Per-frame mean brightness of a video, used to locate the black setup cover and
// the white flash on each hard cut. Those flashes are fired from the same code
// that fires the transition sounds, so finding them in the picture is how the
// soundtrack gets lined up with the picture.
//
// The bundled ffmpeg has no rawvideo muxer, so frames come out as tiny greyscale
// PNGs and are decoded here (zlib is all a greyscale PNG needs).
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import fs from 'node:fs';

// 8-bit greyscale, non-interlaced — the only shape ffmpeg is asked to produce.
function pngGrayMean(buf) {
  let pos = 8, w = 0, h = 0;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w;
  const out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = raw.subarray(p, p + stride);
    p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= 1 ? cur[x - 1] : 0;
      const b = prev ? prev[x] : 0;
      const c = (prev && x >= 1) ? prev[x - 1] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 0xff;
    }
  }
  let sum = 0;
  for (let i = 0; i < out.length; i++) sum += out[i];
  return sum / out.length;
}

export function frameMeans(ff, file, fps, tmp = 'framescan') {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp);
  execFileSync(ff, ['-y', '-hide_banner', '-loglevel', 'error', '-i', file,
    '-r', String(fps), '-vf', 'scale=32:32', '-pix_fmt', 'gray', `${tmp}/f%06d.png`]);
  const means = fs.readdirSync(tmp).sort()
    .map(n => pngGrayMean(fs.readFileSync(`${tmp}/${n}`)));
  fs.rmSync(tmp, { recursive: true, force: true });
  return means;
}

// Onset frame of each white flash. The flash animation fades from 90% white over
// ~0.3s, so a run of bright frames is one cut; only its first frame is the mark.
export function findFlashes(means, fps, threshold = 170) {
  const marks = [];
  let inFlash = false;
  means.forEach((m, i) => {
    if (m >= threshold) {
      if (!inFlash) marks.push(i / fps);
      inFlash = true;
    } else if (m < threshold - 25) {
      inFlash = false;
    }
  });
  return marks;
}

// Last frame of the opaque setup cover, searched only inside a bounded window so
// genuinely dark scenes later in the take can't be mistaken for it.
export function findCoverEnd(means, fps, limitSec, threshold = 26) {
  const limit = Math.min(means.length, Math.ceil(limitSec * fps));
  let last = -1;
  for (let i = 0; i < limit; i++) if (means[i] < threshold) last = i;
  return (last + 1) / fps;
}

// First frame of the cover that closes the take. Scans back from the end, so a
// dark scene earlier in the video can't be mistaken for it.
export function findTailCoverStart(means, fps, threshold = 26) {
  let i = means.length - 1;
  while (i >= 0 && means[i] < threshold) i--;
  return (i + 1) / fps;
}

// Pairs each logged sync mark with the nearest detected flash, seeded by a rough
// guess and refined twice. The game plays its own screen-transition effects, so
// the detector always finds more bright events than the director fired; matching
// by nearest neighbour ignores the extras instead of giving up on them.
export function matchFlashes(detected, logged, seedA, seedB, tolerance = 0.5) {
  let a = seedA, b = seedB;
  let pairs = [];
  for (let pass = 0; pass < 3; pass++) {
    pairs = [];
    for (const wall of logged) {
      let best = null, bestErr = Infinity;
      for (const t of detected) {
        const err = Math.abs((a * t + b) - wall);
        if (err < bestErr) { bestErr = err; best = t; }
      }
      if (best !== null && bestErr <= tolerance) pairs.push([best, wall]);
    }
    if (pairs.length < 3) return null;
    const fit = fitTimeline(pairs.map(p => p[0]), pairs.map(p => p[1]));
    a = fit.a; b = fit.b;
    if (pass === 2) return { ...fit, pairs };
  }
  return null;
}

// Least-squares fit of wall time against capture time: wall = a * t + b.
export function fitTimeline(captureTimes, wallTimes) {
  const n = captureTimes.length;
  const mx = captureTimes.reduce((s, v) => s + v, 0) / n;
  const my = wallTimes.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (captureTimes[i] - mx) * (wallTimes[i] - my);
    den += (captureTimes[i] - mx) ** 2;
  }
  const a = num / den;
  const b = my - a * mx;
  const residuals = captureTimes.map((t, i) => wallTimes[i] - (a * t + b));
  return { a, b, residuals, maxAbs: Math.max(...residuals.map(Math.abs)) };
}
