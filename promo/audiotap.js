// Audio capture for the promo recording.
//
// The game synthesises everything (BGM and SFX) through WebAudio — there are no
// sound files to mix — so the soundtrack is captured by intercepting the game's
// own AudioContext before it is created, routing its output through a makeup
// gain and compressor, and recording that with MediaRecorder as Opus.
//
// Injected as an init script so the patch is in place before the game's first
// `new AudioContext()`. Never ships with the game.
window.__installAudioTap = function () {
  const Orig = window.AudioContext || window.webkitAudioContext;
  if (!Orig) return 'no AudioContext';

  function Patched() {
    const ctx = new Orig(...arguments);
    const realDest = ctx.destination;

    const tap = ctx.createGain();
    const makeup = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    const dest = ctx.createMediaStreamDestination();

    // The game mixes for headphones; a phone speaker being scrolled past needs it
    // hotter and much more even. The gain is deliberately modest and the
    // compressor does the work as a limiter — a 4ms attack let the transition
    // hits punch straight through and clip, so it grabs almost instantly.
    makeup.gain.value = 1.9;
    comp.threshold.value = -10;
    comp.ratio.value = 14;
    comp.knee.value = 3;
    comp.attack.value = 0.001;
    comp.release.value = 0.14;

    // Nothing here can be listened to, so the bus is metered instead: peak tells
    // us whether the take clipped, RMS whether it is loud enough to survive a
    // phone speaker.
    const meter = ctx.createAnalyser();
    meter.fftSize = 2048;
    comp.connect(meter);

    tap.connect(makeup);
    makeup.connect(comp);
    comp.connect(dest);
    comp.connect(realDest);

    // Everything the game connects to `destination` lands on the tap instead.
    Object.defineProperty(ctx, 'destination', { get: () => tap, configurable: true });
    window.__tap = { ctx, tap, dest, meter };
    return ctx;
  }
  Patched.prototype = Orig.prototype;
  window.AudioContext = Patched;
  window.webkitAudioContext = Patched;
  return 'ok';
};

// A transition hit for the hard cuts, so the video sounds edited rather than
// merely captured. Synthesised into the same graph, so it rides the same bus.
window.__hit = function (kind) {
  const t = window.__tap;
  if (!t) return;
  const ctx = t.ctx;
  const now = ctx.currentTime;

  // Noise sweep: the "whoosh" across the cut.
  const dur = kind === 'stamp' ? 0.5 : 0.34;
  const n = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const p = i / n;
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - p, 1.6);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(kind === 'stamp' ? 900 : 420, now);
  bp.frequency.exponentialRampToValueAtTime(kind === 'stamp' ? 4200 : 2600, now + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(kind === 'stamp' ? 0.20 : 0.14, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(bp); bp.connect(g); g.connect(ctx.destination);
  src.start(now); src.stop(now + dur);

  // Low thump underneath it, so the cut has weight on a phone speaker.
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(kind === 'stamp' ? 150 : 110, now);
  osc.frequency.exponentialRampToValueAtTime(46, now + 0.24);
  og.gain.setValueAtTime(kind === 'stamp' ? 0.22 : 0.16, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc.connect(og); og.connect(ctx.destination);
  osc.start(now); osc.stop(now + 0.32);
};

// Sampled while the take runs; reported once at the end.
window.__meterStats = { peak: 0, sumSq: 0, n: 0, clipped: 0 };

window.__startRec = function () {
  const t = window.__tap;
  if (!t) return 'no tap';
  if (t.ctx.state !== 'running') t.ctx.resume();
  const rec = new MediaRecorder(t.dest.stream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 128000,
  });
  window.__chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) window.__chunks.push(e.data); };
  rec.start(250);
  window.__rec = rec;

  const buf = new Float32Array(t.meter.fftSize);
  window.__meterTimer = setInterval(() => {
    t.meter.getFloatTimeDomainData(buf);
    let peak = 0, sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]);
      if (v > peak) peak = v;
      sumSq += buf[i] * buf[i];
    }
    const m = window.__meterStats;
    if (peak > m.peak) m.peak = peak;
    if (peak >= 0.999) m.clipped++;
    m.sumSq += sumSq / buf.length;
    m.n++;
  }, 50);
  return 'recording';
};

window.__levels = function () {
  const m = window.__meterStats;
  if (!m.n) return null;
  const db = v => (v > 0 ? 20 * Math.log10(v) : -99);
  return { peakDb: db(m.peak), rmsDb: db(Math.sqrt(m.sumSq / m.n)), clippedFrames: m.clipped, samples: m.n };
};

window.__stopRec = function () {
  return new Promise(res => {
    const rec = window.__rec;
    if (!rec) return res(null);
    clearInterval(window.__meterTimer);
    rec.onstop = async () => {
      const buf = await new Blob(window.__chunks, { type: 'audio/webm' }).arrayBuffer();
      const b = new Uint8Array(buf);
      let s = '';
      for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
      res(btoa(s));
    };
    rec.stop();
  });
};
