// Builds the narration track for the promo.
//
// open_jtalk synthesises Japanese offline, so the voice-over does not depend on
// any network service. Two things need care:
//
//   * Pronunciation cannot be checked by ear here, so every line is run through
//     the analyser and its katakana reading printed. `node narrate.mjs check`
//     shows them — that is how "100正" was caught being read ヒャク・セー rather
//     than ヒャクショー, which is why some words are written in kana below.
//   * Each line has to fit the gap before the next one. Lines are synthesised,
//     measured, and re-synthesised faster if they overrun, within a limit that
//     keeps them listenable.
//
// Output is one 48kHz mono WAV the length of the whole take, with each line at
// its own offset — encode.mjs ducks the game audio under it.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { byId, VARIANTS } from './variants.mjs';

const DIC = '/var/lib/mecab/dic/open-jtalk/naist-jdic';
const VOICE = '/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice';
const TMP = 'video/tts';
const OUT = 'video/narration.wav';
// Briskness, per engine. Both call 1.0 "normal" but they are not the same
// number: open_jtalk at 1.2 lands where Cloud TTS lands nearer 1.1.
const RATE_BASE_LOCAL = 1.2;
const RATE_BASE_CLOUD = 1.15;
// How far above base a line may be pushed to fit its gap. open_jtalk is an HMM
// voice and falls apart early; the neural voices hold together further, and they
// speak slower at the same nominal rate, so they need the extra room to fit the
// same lines. Measured on one take: at the old shared ceiling the cloud voice
// overran four lines where open_jtalk overran one.
const RATE_MAX_MUL_LOCAL = 1.3;
const RATE_MAX_MUL_CLOUD = 1.45;
const SR = 48000;

// `scene` names the beat the line belongs to, or `mark` names a moment the
// director logged; `at` is seconds after that. Anchoring to a logged moment
// beats guessing an offset — the beats that build something on screen take a
// variable amount of time, and a guessed offset put lines over screens that had
// not caught up yet. Readings the analyser gets wrong are written in kana.
const CUES = [
  // scene 1's line comes from the cut being rendered; the rest are shared.
  { scene: 1, at: 0.30, text: null },
  { scene: 2, at: 0.25, text: '最初はクッキー25枚。' },
  { mark: 'buyResult', at: 0.15, text: 'ここまでは普通です。' },
  { scene: 3, at: 0.30, text: '生産ペースにノルマがあって、放置だけだと伸びません。' },
  { scene: 4, at: 0.30, text: '金のクッキーで生産が跳ねる。' },
  { scene: 4, at: 2.70, text: '殴ると素材が出ます。ボスも来ます。' },
  { scene: 5, at: 0.30, text: '装備のレシピは486種類。' },
  { scene: 5, at: 3.30, text: '料理でノルマをゆるめられます。' },
  { scene: 6, at: 0.30, text: '研究で計算式が変わる。' },
  { scene: 6, at: 2.70, text: '倍率は全部この画面で見られます。' },
  { mark: 'treeReady', at: 0.10, text: '転生。ノードは71個。' },
  { mark: 'treeReady', at: 2.50, text: '周回ごとに速くなる。' },
  { scene: 8, at: 0.35, text: 'さっきの数字に戻ります。' },
  { scene: 9, at: 0.35, text: 'アンドロイドのテスター募集中。リンクはチャンネル概要欄に。' },
];

function localSynth(text, rate, wav, trace) {
  const args = ['-x', DIC, '-m', VOICE, '-r', String(rate), '-ow', wav];
  if (trace) args.push('-ot', trace);
  const r = spawnSync('open_jtalk', args, { input: text + '\n' });
  if (r.error) throw r.error;
  return wav;
}

/**
 * The Google key, from `youtube/.env` first and the environment second.
 *
 * Same order as the YouTube credentials and for the same reason: environment
 * variables reach a session only when it starts, and the posting schedule fires
 * into one long-lived session, so a value added later can never arrive that way.
 */
function ttsKey() {
  try {
    const txt = fs.readFileSync(new URL('./youtube/.env', import.meta.url).pathname, 'utf8');
    for (const line of txt.split('\n')) {
      const m = /^\s*GOOGLE_TTS_API_KEY\s*=\s*(.*)$/.exec(line);
      if (m) return m[1].trim().replace(/^(['"])(.*)\1$/, '$2');
    }
  } catch { /* no file is not an error */ }
  return (process.env.GOOGLE_TTS_API_KEY || '').trim();
}

const KEY = ttsKey();
const CLOUD_VOICE = process.env.PROMO_TTS_VOICE || 'ja-JP-Chirp3-HD-Charon';
const CLOUD = Boolean(KEY) && process.env.PROMO_TTS !== 'local';

/**
 * Cloud Text-to-Speech. Returns false rather than throwing when it cannot
 * deliver, so the caller falls back to open_jtalk.
 *
 * The voice is the one thing a viewer judges in the first second, and the first
 * second is the whole of a Short's distribution decision — 98% of this channel's
 * views arrive from the Shorts feed. That is why this is worth a network
 * dependency at all. It is also why the dependency must never be load-bearing:
 * a failed synthesis has to degrade to the offline voice, not cancel the day's
 * video.
 */
function cloudSynth(text, rate, wav) {
  const body = JSON.stringify({
    input: { text },
    voice: { languageCode: 'ja-JP', name: CLOUD_VOICE },
    audioConfig: {
      audioEncoding: 'LINEAR16', sampleRateHertz: SR,
      speakingRate: Math.max(0.25, Math.min(4, rate)),
    },
  });
  const r = spawnSync('curl', ['-sS', '--max-time', '30', '-X', 'POST',
    '-H', 'content-type: application/json', '--data-binary', '@-',
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${KEY}`],
    { input: body, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return false;
  let audio;
  try { audio = JSON.parse(r.stdout.toString()).audioContent; } catch { return false; }
  if (!audio) return false;
  fs.writeFileSync(wav, Buffer.from(audio, 'base64'));
  return true;
}

let cloudFailed = false;

/**
 * `rate` is on the engine's own scale: open_jtalk's -r and Cloud TTS's
 * speakingRate are both "1 is normal, higher is faster" but are not the same
 * number, so the base and ceiling below are per engine.
 */
function synth(text, rate, wav, trace) {
  if (CLOUD && !cloudFailed && !trace) {
    if (cloudSynth(text, rate, wav)) return wav;
    cloudFailed = true;
    console.log(`  !! Cloud TTS が応答しないので open_jtalk に切り替えます`);
  }
  return localSynth(text, rate * (RATE_BASE_LOCAL / RATE_BASE_CLOUD), wav, trace);
}

/**
 * Read a PCM WAV by walking its chunks.
 *
 * open_jtalk writes the textbook 44-byte header, and the old version of this
 * just indexed into it. Cloud TTS does not promise that layout — an extra
 * LIST/INFO chunk ahead of the data would shift every offset and the file would
 * be read as noise — so the chunks get found rather than assumed.
 */
function wavInfo(path) {
  const b = fs.readFileSync(path);
  if (b.subarray(0, 4).toString() !== 'RIFF' || b.subarray(8, 12).toString() !== 'WAVE') {
    throw new Error(`${path} is not a RIFF/WAVE file`);
  }
  let pos = 12, fmt = null, data = null;
  while (pos + 8 <= b.length) {
    const id = b.subarray(pos, pos + 4).toString();
    const size = b.readUInt32LE(pos + 4);
    const body = b.subarray(pos + 8, pos + 8 + size);
    if (id === 'fmt ') fmt = body;
    else if (id === 'data') data = body;
    pos += 8 + size + (size % 2);            // chunks are word-aligned
  }
  if (!fmt || !data) throw new Error(`${path} has no fmt/data chunk`);
  const rate = fmt.readUInt32LE(4);
  const bits = fmt.readUInt16LE(14);
  return { rate, bits, samples: data.length / (bits / 8), pcm: data };
}

function reading(trace) {
  return fs.readFileSync(trace, 'utf8').split('\n')
    .map(l => l.split(','))
    .filter(p => p.length > 9 && p[0] && p[0] !== '。' && p[0] !== '、')
    .map(p => p[9]).join(' ');
}

// ---------------------------------------------------------------- check mode
if (process.argv[2] === 'check') {
  const cut = byId(process.env.PROMO_VARIANT || 'unit') || VARIANTS[0];
  CUES.filter(c => c.text === null).forEach(c => { c.text = cut.hook.narration; });
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  CUES.forEach((c, i) => {
    const wav = `${TMP}/c${i}.wav`, tr = `${TMP}/c${i}.txt`;
    localSynth(c.text, RATE_BASE_LOCAL, wav, tr);
    const { samples, rate } = wavInfo(wav);
    console.log(`s${c.scene}+${c.at}  ${(samples / rate).toFixed(2)}s  ${c.text}`);
    console.log(`            ${reading(tr)}`);
  });
  process.exit(0);
}

// ---------------------------------------------------------------- build mode
const { fps, frameCount, flashLog, markLog, variant, narration } =
  JSON.parse(fs.readFileSync('trim.json', 'utf8'));

// The long-form director writes its cue list into trim.json, because there the
// line and the caption it belongs with are written together in topics.mjs. The
// Shorts cut is a fixed sequence of scenes, so its cues stay in the table above.
// Either way what comes out of this block is a list of {anchor, at, text}.
const SCRIPTED = Array.isArray(narration) && narration.length > 0;
if (!SCRIPTED) {
  const CUT = byId(variant || process.env.PROMO_VARIANT || 'unit') || VARIANTS[0];
  CUES.filter(c => c.text === null).forEach(c => { c.text = CUT.hook.narration; });
}
const CUE_LIST = SCRIPTED ? narration : CUES;
const total = frameCount / fps;
// Scenes 2..8 each open on a cut, so the flash log is their start times; scene 1
// starts at zero and scene 9 (the end card) starts where scene 8 was marked done.
const starts = { 1: 0 };
flashLog.forEach((t, i) => { starts[i + 2] = t; });
starts[9] = (markLog && markLog.scene8) ?? (flashLog[6] + 2.4);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const anchor = c => (c.mark ? markLog[c.mark] : starts[c.scene]);
const placed = CUE_LIST
  .map(c => ({ ...c, start: anchor(c) + c.at }))
  .filter(c => Number.isFinite(c.start))
  .sort((a, b) => a.start - b.start);

const clips = [];
placed.forEach((c, i) => {
  const next = i + 1 < placed.length ? placed[i + 1].start : total;
  const window = Math.max(0.6, next - c.start - 0.12);
  const wav = `${TMP}/n${i}.wav`;
  const base = CLOUD && !cloudFailed ? RATE_BASE_CLOUD : RATE_BASE_LOCAL;
  synth(c.text, base, wav);
  let info = wavInfo(wav);
  let rate = base;
  const dur = () => info.samples / info.rate;
  // Fit by measuring again, not by predicting once.
  //
  // Cloud TTS is not deterministic: the same sentence at the same speakingRate
  // came back 2.28s in one render and 3.07s in the next — a third longer. A
  // single corrective pass computed from the first measurement therefore passes
  // one day and overruns the next, and the line most likely to be clipped is the
  // last one, which is the recruitment card the video exists to deliver.
  //
  // So: adjust, re-measure, repeat, with a little margin so a rounding-sized
  // wobble does not push it back over. Bounded, because the ceiling exists to
  // keep the result listenable and there is no rate that rescues a line that is
  // simply too long — that one gets the warning below and a shorter script.
  const ceiling = base * (CLOUD && !cloudFailed ? RATE_MAX_MUL_CLOUD : RATE_MAX_MUL_LOCAL);
  for (let attempt = 0; attempt < 3 && dur() > window && rate < ceiling; attempt++) {
    rate = Math.min(ceiling, rate * (dur() / window) * 1.04);
    synth(c.text, rate, wav);
    info = wavInfo(wav);
  }
  const over = dur() - window;
  console.log(`${c.start.toFixed(2)}s  win ${window.toFixed(2)}s  ` +
    `spoke ${dur().toFixed(2)}s  rate ${rate.toFixed(2)}` +
    (over > 0.05 ? `  !! overruns by ${over.toFixed(2)}s — shorten the line` : ''));
  clips.push({ at: c.start, info });
});

// lay the clips onto one silent bed
const totalSamples = Math.ceil(total * SR);
const out = Buffer.alloc(totalSamples * 2);
for (const { at, info } of clips) {
  if (info.rate !== SR) throw new Error('unexpected sample rate ' + info.rate);
  const off = Math.round(at * SR) * 2;
  const len = Math.min(info.pcm.length, out.length - off);
  if (len > 0) info.pcm.copy(out, off, 0, len);
}

const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + out.length, 4);
header.write('WAVE', 8);
header.write('fmt ', 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(out.length, 40);
fs.writeFileSync(OUT, Buffer.concat([header, out]));
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`${OUT}  ${clips.length} lines over ${total.toFixed(2)}s`);
