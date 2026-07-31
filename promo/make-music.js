"use strict";
/**
 * プロモ用の BGM と効果音を合成して WAV に書き出す。
 *
 * 既成曲を使うと配信側の権利まわりが面倒なので、全部この場で作る。
 * 120BPM(1小節=2秒)固定で、映像のカット位置がそのまま小節線に乗るようにしてある。
 *
 *   node promo/make-music.js [--out promo/build/bgm.wav] [--seconds 50]
 */

const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };

const SR = 48000;
const BPM = 120;
const BEAT = 60 / BPM;          // 0.5s
const BAR = BEAT * 4;           // 2.0s
const SECONDS = Number(arg("seconds", 50));
const OUT = path.resolve(arg("out", path.join(__dirname, "build", "bgm.wav")));

const N = Math.ceil(SECONDS * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// ── 基本ユーティリティ ────────────────────────────────────────────────
const A4 = 440;
/** 音名 → 周波数。"C4" / "A#3" / "Eb5" */
function hz(note) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) throw new Error("bad note " + note);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0;
  const midi = 12 * (Number(m[3]) + 1) + base + acc;
  return A4 * Math.pow(2, (midi - 69) / 12);
}

let rngState = 20260731;
function rnd() { rngState = (rngState * 1664525 + 1013904223) >>> 0; return rngState / 4294967296; }

function add(t, sampleL, sampleR) {
  const i = Math.round(t * SR);
  if (i < 0 || i >= N) return;
  L[i] += sampleL;
  R[i] += sampleR;
}

/** 汎用: 波形関数 wave(phase01) を、エンベロープ env(p) で鳴らす */
function voice(t0, dur, freq, wave, env, gain, pan = 0) {
  const n = Math.round(dur * SR);
  const i0 = Math.round(t0 * SR);
  let ph = 0;
  const gl = gain * Math.min(1, 1 - pan) * 0.5 + gain * 0.5 * (1 - Math.max(0, pan));
  const gr = gain * Math.min(1, 1 + pan) * 0.5 + gain * 0.5 * (1 + Math.min(0, pan));
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx < 0 || idx >= N) continue;
    const p = i / n;
    const f = typeof freq === "function" ? freq(p) : freq;
    ph += f / SR;
    const s = wave(ph - Math.floor(ph), p) * env(p);
    L[idx] += s * gl;
    R[idx] += s * gr;
  }
}

// 波形
const sine = (x) => Math.sin(x * Math.PI * 2);
const tri = (x) => 4 * Math.abs(x - 0.5) - 1;
const saw = (x) => 2 * x - 1;
const pulse = (w) => (x) => (x < w ? 1 : -1);
// やわらかい矩形(倍音を間引いて耳に痛くしない)
const softSquare = (x) => {
  let v = 0;
  for (let k = 1; k <= 7; k += 2) v += Math.sin(x * Math.PI * 2 * k) / k;
  return v * 0.85;
};

// エンベロープ
const decay = (a, d) => (p) => {
  const at = a, dt = d;
  if (p < at) return p / at;
  return Math.pow(1 - (p - at) / (1 - at), 1 / dt);
};
const pluck = (sharp = 4) => (p) => Math.pow(1 - p, sharp) * Math.min(1, p * 220);
const swell = (p) => Math.sin(Math.PI * Math.min(1, p)) ;

// ── 音色 ──────────────────────────────────────────────────────────────
function kick(t, g = 1) {
  voice(t, 0.34, (p) => 118 * Math.pow(0.16, p) + 42, sine, (p) => Math.pow(1 - p, 2.6), 0.95 * g);
  // アタックのクリック
  voice(t, 0.02, 1800, sine, (p) => Math.pow(1 - p, 3), 0.16 * g);
}
function snare(t, g = 1) {
  const n = Math.round(0.20 * SR);
  const i0 = Math.round(t * SR);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx < 0 || idx >= N) continue;
    const p = i / n;
    const white = rnd() * 2 - 1;
    lp = lp * 0.55 + white * 0.45;      // 少しだけ丸める
    const s = (white - lp * 0.7) * Math.pow(1 - p, 2.3) * 0.42 * g;
    L[idx] += s; R[idx] += s;
  }
  voice(t, 0.13, (p) => 210 * (1 - p * 0.35), tri, (p) => Math.pow(1 - p, 3), 0.30 * g);
}
function hat(t, g = 1, open = false) {
  const dur = open ? 0.16 : 0.045;
  const n = Math.round(dur * SR);
  const i0 = Math.round(t * SR);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i;
    if (idx < 0 || idx >= N) continue;
    const p = i / n;
    const white = rnd() * 2 - 1;
    const hp = white - prev; prev = white;   // 簡易ハイパス
    const s = hp * Math.pow(1 - p, open ? 1.6 : 3.2) * 0.16 * g;
    L[idx] += s * 0.9; R[idx] += s * 1.1;
  }
}
function bass(t, dur, note, g = 1) {
  voice(t, dur, hz(note), (x, p) => softSquare(x) * (1 - p * 0.25), decay(0.006, 0.55), 0.34 * g);
  voice(t, dur, hz(note) / 2, sine, decay(0.006, 0.5), 0.30 * g);
}
function lead(t, dur, note, g = 1, pan = 0) {
  const f = hz(note);
  voice(t, dur, f, pulse(0.33), pluck(3.2), 0.15 * g, pan);
  voice(t, dur, f * 1.005, pulse(0.5), pluck(3.6), 0.10 * g, -pan);
}
function bell(t, dur, note, g = 1, pan = 0) {
  const f = hz(note);
  voice(t, dur, f, sine, pluck(2.2), 0.22 * g, pan);
  voice(t, dur * 0.8, f * 2, sine, pluck(3.4), 0.10 * g, pan);
  voice(t, dur * 0.6, f * 3.01, sine, pluck(4.6), 0.05 * g, -pan);
}
function pad(t, dur, notes, g = 1) {
  notes.forEach((nt, i) => {
    voice(t, dur, hz(nt), (x) => (sine(x) * 0.7 + tri(x) * 0.3), swell, 0.075 * g, (i % 2 ? 0.35 : -0.35));
  });
}
function impact(t, g = 1) {
  voice(t, 1.1, (p) => 150 * Math.pow(0.08, p) + 34, sine, (p) => Math.pow(1 - p, 2.0), 0.75 * g);
  const n = Math.round(0.5 * SR), i0 = Math.round(t * SR);
  for (let i = 0; i < n; i++) {
    const idx = i0 + i; if (idx < 0 || idx >= N) continue;
    const p = i / n;
    const s = (rnd() * 2 - 1) * Math.pow(1 - p, 3.5) * 0.20 * g;
    L[idx] += s; R[idx] += s;
  }
}
function riser(t, dur, g = 1) {
  const n = Math.round(dur * SR), i0 = Math.round(t * SR);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const idx = i0 + i; if (idx < 0 || idx >= N) continue;
    const p = i / n;
    const white = rnd() * 2 - 1;
    const k = 0.02 + 0.5 * p * p;            // だんだん明るく
    lp = lp * (1 - k) + white * k;
    const s = lp * Math.pow(p, 2.0) * 0.30 * g;
    L[idx] += s * 1.05; R[idx] += s * 0.95;
  }
  voice(t, dur, (p) => 220 * Math.pow(4, p), sine, (p) => Math.pow(p, 3) * 0.5, 0.12 * g);
}

// ── 曲 ────────────────────────────────────────────────────────────────
// 進行: C - G - Am - F (1小節ずつ)。明るいまま最後まで押し切る。
const CHORDS = [
  { root: "C2", pad: ["C4", "E4", "G4"], arp: ["C5", "E5", "G5", "E5"] },
  { root: "G1", pad: ["B3", "D4", "G4"], arp: ["D5", "G5", "B5", "G5"] },
  { root: "A1", pad: ["A3", "C4", "E4"], arp: ["A4", "C5", "E5", "C5"] },
  { root: "F1", pad: ["F3", "A3", "C4"], arp: ["F4", "A4", "C5", "A4"] },
];

// 映像のカット位置(秒)。ここに合わせてアレンジを切り替える
const CUE = { drums: 6.0, res: 14.0, mon: 20.0, skill: 28.0, outro: 38.0, cta: 42.0, end: 50.0 };

const bars = Math.ceil(SECONDS / BAR);
for (let b = 0; b < bars; b++) {
  const t = b * BAR;
  if (t >= SECONDS) break;
  const ch = CHORDS[b % 4];

  const inIntro = t < CUE.drums;
  const inOutro = t >= CUE.outro && t < CUE.cta;
  const inCta = t >= CUE.cta;
  const hot = t >= CUE.mon && t < CUE.skill;     // 討伐パートは一番あつく
  const airy = t >= CUE.skill && t < CUE.outro;  // スキルツリーは広がりを出す

  // パッド(全編)。ためを作る区間でも音が消えないように少し厚くする
  pad(t, BAR * 0.98, ch.pad, inIntro ? 0.75 : airy ? 1.25 : inOutro ? 1.35 : 1.0);

  // ベース
  if (inOutro) {
    bass(t, BEAT * 1.8, ch.root, 0.6);       // ためでも土台は残す
    bass(t + BEAT * 2, BEAT * 1.8, ch.root, 0.5);
  } else {
    const g = inIntro ? 0.5 : 1;
    bass(t, BEAT * 0.9, ch.root, g);
    bass(t + BEAT * 1.5, BEAT * 0.45, ch.root, g * 0.8);
    bass(t + BEAT * 2, BEAT * 0.9, ch.root, g);
    bass(t + BEAT * 3, BEAT * 0.45, ch.root, g * 0.8);
    if (hot) bass(t + BEAT * 3.5, BEAT * 0.4, ch.root, g * 0.7);
  }

  // ドラム
  if (t >= CUE.drums && !inOutro) {
    kick(t);
    kick(t + BEAT * 2);
    if (hot || inCta) kick(t + BEAT * 2.75, 0.7);
    snare(t + BEAT, 0.85);
    snare(t + BEAT * 3, 0.85);
    const hats = hot ? 8 : 4;
    for (let i = 0; i < hats; i++) {
      hat(t + (BAR / hats) * i, i % 2 ? 0.6 : 1.0, hats === 4 && i === 3);
    }
  } else if (inIntro) {
    kick(t, 0.55);
    hat(t + BEAT * 2, 0.5);
  }

  // アルペジオ / メロディ
  const arpGain = inIntro ? 0.9 : inOutro ? 0.75 : 1.0;
  for (let i = 0; i < 8; i++) {
    const nt = ch.arp[i % 4];
    const tt = t + (BAR / 8) * i;
    if (tt >= SECONDS) break;
    if (inOutro && i % 2) continue;
    if (airy) bell(tt, BEAT * 0.9, nt, 0.9, i % 2 ? 0.3 : -0.3);
    else lead(tt, BEAT * 0.55, nt, arpGain, i % 2 ? 0.22 : -0.22);
  }
  if (inCta) {
    // しめは上に一本、伸びる音を足す
    bell(t, BAR * 0.9, ch.arp[0], 0.8, 0);
  }
}

// カット頭のアクセントと、しめ前の盛り上げ
[CUE.drums, CUE.res, CUE.mon, CUE.skill].forEach((t) => impact(t, 0.8));
impact(CUE.cta, 1.0);
riser(CUE.cta - 2.0, 2.0, 1.0);
riser(CUE.mon - 1.0, 1.0, 0.5);
// 最後は余韻を残して終わる
pad(CUE.end - 2.2, 2.2, ["C4", "E4", "G4", "C5"], 1.3);
bell(CUE.end - 2.2, 2.2, "C6", 0.7);

// ── 仕上げ(軽いディレイ・ソフトクリップ・フェード) ────────────────────
const delaySamples = Math.round(BEAT * 0.75 * SR);
for (let i = delaySamples; i < N; i++) {
  L[i] += R[i - delaySamples] * 0.16;
  R[i] += L[i - delaySamples] * 0.16;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const norm = peak > 0 ? 0.82 / peak : 1;
const fadeIn = Math.round(0.25 * SR);
const fadeOut = Math.round(1.6 * SR);
const buf = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  let a = L[i] * norm;
  let b = R[i] * norm;
  a = Math.tanh(a * 1.25) * 0.86;
  b = Math.tanh(b * 1.25) * 0.86;
  if (i < fadeIn) { const g = i / fadeIn; a *= g; b *= g; }
  if (i > N - fadeOut) { const g = (N - i) / fadeOut; a *= g; b *= g; }
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(a * 32767))), i * 4);
  buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(b * 32767))), i * 4 + 2);
}

// WAV ヘッダ
const head = Buffer.alloc(44);
head.write("RIFF", 0);
head.writeUInt32LE(36 + buf.length, 4);
head.write("WAVE", 8);
head.write("fmt ", 12);
head.writeUInt32LE(16, 16);
head.writeUInt16LE(1, 20);
head.writeUInt16LE(2, 22);
head.writeUInt32LE(SR, 24);
head.writeUInt32LE(SR * 4, 28);
head.writeUInt16LE(4, 32);
head.writeUInt16LE(16, 34);
head.write("data", 36);
head.writeUInt32LE(buf.length, 40);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([head, buf]));
console.log("wrote", OUT, (fs.statSync(OUT).size / 1e6).toFixed(2) + "MB", SECONDS + "s");
