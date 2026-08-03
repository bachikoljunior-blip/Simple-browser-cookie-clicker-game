// Builds the thumbnail for a long-form explainer.
//
// The frame is pulled out of the finished mp4 rather than taken with a separate
// screenshot pass. Two reasons: a second pass would have to rebuild the same
// screen and could drift from the one that actually shipped, and the thumbnail
// is the one promise a viewer checks against the video immediately. Taking it
// from the encoded file makes "this frame is in this video" true by
// construction.
//
// Which frame is named per topic, as a mark id — `trim.json` logs the instant
// every caption went up, so `fail_0` is a time, not a guess. The offset lands
// after the caption's animation rather than during it.
//
// The game draws itself into a fixed box in the middle of the 16:9 frame, with
// black above and below. At thumbnail size that box is too small to read, so it
// is cropped out and blown up to full width, and the headline goes in the space
// underneath. Beats that take over the whole screen (the skill tree opens
// fullscreen) say so with `crop: null` and are used uncropped.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FONT = '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf';

// The game's box inside a 1920x1080 take, measured off a still.
const GAME_BOX = { w: 1548, h: 642, x: 186, y: 174 };

const W = 1280, H = 720;

/** ffmpeg's drawtext reads a handful of characters as syntax. */
const esc = s => String(s).replace(/[\\':%]/g, c => '\\' + c);

/**
 * Compose `out` from the frame of `mp4` at the topic's chosen mark.
 * Returns the path, or null when the topic has no thumbnail spec.
 */
export function buildThumbnail(topic, { mp4, trim, out }) {
  const spec = topic.thumb;
  if (!spec) return null;
  if (!fs.existsSync(FONT)) throw new Error(`no Japanese font at ${FONT}`);

  const marks = trim.markLog || {};
  const at = marks[spec.at];
  if (at === undefined) {
    throw new Error(`thumbnail wants mark "${spec.at}", which this take did not log ` +
      `(has: ${Object.keys(marks).join(', ')})`);
  }

  const crop = spec.crop === undefined ? GAME_BOX : spec.crop;
  const lines = spec.lines.slice(0, 2);
  // Two lines sit under the picture; one line gets the picture taller.
  const bandH = lines.length > 1 ? 189 : 110;
  const picH = H - bandH;

  const steps = [];
  if (crop) steps.push(`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y}`);
  // Fit inside the picture area without distorting, then pad out to 1280x720.
  steps.push(`scale=${W}:${picH}:force_original_aspect_ratio=decrease`);
  steps.push(`pad=${W}:${H}:(ow-iw)/2:0:black`);

  const size = lines.length > 1 ? 82 : 88;
  lines.forEach((text, i) => {
    // The second line is the one that carries the claim, so it gets the colour.
    const colour = i === lines.length - 1 && lines.length > 1 ? '#FFD24A' : 'white';
    const y = picH + 17 + i * (size + 4);
    steps.push(`drawtext=fontfile=${FONT}:text='${esc(text)}':fontcolor=${colour}` +
      `:fontsize=${size}:x=(w-text_w)/2:y=${y}`);
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(at + (spec.offset ?? 1.2)),
    '-i', mp4, '-frames:v', '1', '-vf', steps.join(','), out]);

  // YouTube rejects anything over 2MB.
  const bytes = fs.statSync(out).size;
  if (bytes > 2_000_000) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', out, '-q:v', '3',
      out.replace(/\.png$/, '.jpg')]);
    return out.replace(/\.png$/, '.jpg');
  }
  return out;
}
