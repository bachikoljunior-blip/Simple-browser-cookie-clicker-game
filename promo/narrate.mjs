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

const DIC = '/var/lib/mecab/dic/open-jtalk/naist-jdic';
const VOICE = '/usr/share/hts-voice/nitech-jp-atr503-m001/nitech_jp_atr503_m001.htsvoice';
const TMP = 'video/tts';
const OUT = 'video/narration.wav';
const RATE_BASE = 1.2;      // brisker than the default; Shorts narration is quick
const RATE_MAX = 1.55;      // beyond this it stops sounding like speech
const SR = 48000;

// `scene` names the beat the line belongs to, or `mark` names a moment the
// director logged; `at` is seconds after that. Anchoring to a logged moment
// beats guessing an offset — the beats that build something on screen take a
// variable amount of time, and a guessed offset put lines over screens that had
// not caught up yet. Readings the analyser gets wrong are written in kana.
const CUES = [
  { scene: 1, at: 0.30, text: 'しょうって単位、知ってます?' },
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
  { scene: 9, at: 0.35, text: 'テスター募集中。詳しくは概要欄へ。' },
];

function synth(text, rate, wav, trace) {
  const args = ['-x', DIC, '-m', VOICE, '-r', String(rate), '-ow', wav];
  if (trace) args.push('-ot', trace);
  const r = spawnSync('open_jtalk', args, { input: text + '\n' });
  if (r.error) throw r.error;
  return wav;
}

function wavInfo(path) {
  const b = fs.readFileSync(path);
  // canonical PCM WAV from open_jtalk: 44-byte header
  const rate = b.readUInt32LE(24);
  const bits = b.readUInt16LE(34);
  const dataLen = b.readUInt32LE(40);
  return { rate, bits, samples: dataLen / (bits / 8), pcm: b.subarray(44, 44 + dataLen) };
}

function reading(trace) {
  return fs.readFileSync(trace, 'utf8').split('\n')
    .map(l => l.split(','))
    .filter(p => p.length > 9 && p[0] && p[0] !== '。' && p[0] !== '、')
    .map(p => p[9]).join(' ');
}

// ---------------------------------------------------------------- check mode
if (process.argv[2] === 'check') {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  CUES.forEach((c, i) => {
    const wav = `${TMP}/c${i}.wav`, tr = `${TMP}/c${i}.txt`;
    synth(c.text, RATE_BASE, wav, tr);
    const { samples, rate } = wavInfo(wav);
    console.log(`s${c.scene}+${c.at}  ${(samples / rate).toFixed(2)}s  ${c.text}`);
    console.log(`            ${reading(tr)}`);
  });
  process.exit(0);
}

// ---------------------------------------------------------------- build mode
const { fps, frameCount, flashLog, markLog } = JSON.parse(fs.readFileSync('trim.json', 'utf8'));
const total = frameCount / fps;
// Scenes 2..8 each open on a cut, so the flash log is their start times; scene 1
// starts at zero and scene 9 (the end card) starts where scene 8 was marked done.
const starts = { 1: 0 };
flashLog.forEach((t, i) => { starts[i + 2] = t; });
starts[9] = (markLog && markLog.scene8) ?? (flashLog[6] + 2.4);

fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });

const anchor = c => (c.mark ? markLog[c.mark] : starts[c.scene]);
const placed = CUES
  .map(c => ({ ...c, start: anchor(c) + c.at }))
  .filter(c => Number.isFinite(c.start))
  .sort((a, b) => a.start - b.start);

const clips = [];
placed.forEach((c, i) => {
  const next = i + 1 < placed.length ? placed[i + 1].start : total;
  const window = Math.max(0.6, next - c.start - 0.12);
  const wav = `${TMP}/n${i}.wav`;
  synth(c.text, RATE_BASE, wav);
  let info = wavInfo(wav);
  let rate = RATE_BASE;
  const dur = () => info.samples / info.rate;
  if (dur() > window) {
    rate = Math.min(RATE_MAX, RATE_BASE * dur() / window);
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
