// Frame capture for the promo recording.
//
// Playwright's own video recorder writes a webm whose timestamps run a few
// percent off wall clock and jitter by ~200ms, because Chromium's headless
// screencast is capped near 19.5fps and the writer pads to reach its nominal
// rate. That is fine for a silent clip and fatal for one with a soundtrack: the
// audio is recorded in real time, so any wobble in the picture's clock shows up
// as sound landing off the cut.
//
// So frames are taken straight from the screencast, which stamps each one with a
// wall-clock time, and laid onto a fixed grid: grid slot n gets whichever frame
// was on screen at t0 + n/fps. The result is constant-rate video whose every
// frame sits at a known real instant, which makes audio sync exact rather than
// fitted. Slots where the browser produced nothing simply repeat the frame that
// was still showing — which is what the viewer saw.
import fs from 'node:fs';

export async function startCapture(cdpSession, { dir, fps = 25, quality = 82, width, height }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  let held = null;        // most recent frame from the browser
  let heldTs = null;      // when that frame was on screen, in seconds
  let gridT = null;       // wall-clock time of the next grid slot, in seconds
  let armAt = null;       // when the grid was armed, in seconds
  let index = 0;
  let stopAt = Infinity;
  let dropped = 0;
  // Slots filled from a frame that predates the arm — see the backfill below.
  let stale = [];

  cdpSession.on('Page.screencastFrame', async ({ data, sessionId, metadata }) => {
    const buf = Buffer.from(data, 'base64');
    const ts = metadata.timestamp;

    if (gridT !== null) {
      // Emit every grid slot this frame's arrival has passed, using the frame
      // that was actually on screen during each of them.
      const heldIsStale = heldTs !== null && armAt !== null && heldTs < armAt;
      while (gridT <= ts && gridT <= stopAt) {
        if (held) {
          const file = `${dir}/f${String(++index).padStart(6, '0')}.jpg`;
          fs.writeFileSync(file, held);
          if (heldIsStale) stale.push(file);
        } else {
          dropped++;
        }
        gridT += 1 / fps;
      }
    }

    // The take opens on whatever the browser last painted, and at the top of a
    // take that is the black cover: begin() waits for the reveal to paint before
    // arming, but the grid is anchored to the moment the cover lifted, so the
    // slots inside that wait are served by the cover frame. Three black frames
    // at the head is what the upload check calls a blank opening — correctly.
    // Rewriting them with the first frame from after the arm keeps every slot at
    // its own real instant (so audio sync is untouched) and opens the video on
    // the finished screen the cover was hiding.
    if (armAt !== null && ts >= armAt && stale.length) {
      for (const file of stale) fs.writeFileSync(file, buf);
      stale = [];
    }

    held = buf;
    heldTs = ts;

    // Acking late throttles the browser, so never block on it.
    cdpSession.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });

  await cdpSession.send('Page.startScreencast', {
    format: 'jpeg', quality, everyNthFrame: 1, maxWidth: width, maxHeight: height,
  });

  return {
    /** Begin laying frames onto the grid, anchored to a wall-clock ms timestamp. */
    arm(startMs) { gridT = armAt = startMs / 1000; },
    /** Stop after the grid slot covering this wall-clock ms timestamp. */
    end(stopMs) { stopAt = stopMs / 1000; },
    async finish() {
      await cdpSession.send('Page.stopScreencast').catch(() => {});
      return { dir, fps, frames: index, dropped };
    },
  };
}
