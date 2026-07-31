/* eslint-disable */
"use strict";
/**
 * プロモ映像のタイムライン。
 *
 * 見た目はすべて時刻 t(秒)の純粋な関数として決める。CSS アニメーションを使わないのは、
 * レンダラが「t を渡して 1 枚撮る」を繰り返すだけで決定的に書き出せるようにするため。
 *
 * カット位置は 120BPM(1小節=2秒)の小節線に乗せてあり、make-music.js の
 * アレンジ切り替えと一致している。
 */

const FPS = 30;
const CLIP_DIR = "build/frames";

// ── 尺(秒) ────────────────────────────────────────────────────────────
// [開始, 終了, 使う素材, 素材内の開始位置]
const SECTIONS = [
  { id: "hook",   t0:  0.0, t1:  3.0, clip: "tap",       at: 0.0 },
  { id: "intro",  t0:  3.0, t1:  6.0, clip: "tap",       at: 3.0 },
  { id: "shop",   t0:  6.0, t1: 14.0, clip: "shop",      at: 0.4 },
  { id: "res",    t0: 14.0, t1: 20.0, clip: "research",  at: 0.4 },
  // 討伐は殴っている所を少しだけスローにして、倒したあとで巻き取る
  { id: "mon",    t0: 20.0, t1: 28.0, clip: "monster",
    at: (u) => (u < 3.0 ? 0.2 + u * 0.80 : 2.6 + (u - 3.0) * 1.14) },
  // スキルツリーは頭の静止を削り、引きの動きから入る
  // スキルツリー: 引きの途中から入り、全体が見えた所でひと呼吸置いて、取得へ
  { id: "skill",  t0: 28.0, t1: 38.0, clip: "skilltree",
    at: (u) => (u < 3.5 ? 3.3 + u * 0.486 : u < 6.0 ? 5.0 + (u - 3.5) * 0.52 : 6.3 + (u - 6.0) * 0.925) },
  { id: "outro",  t0: 38.0, t1: 42.0, clip: "title",     at: 0.6 },
  { id: "cta",    t0: 42.0, t1: 50.0, clip: "title",     at: 4.6 },
];
const DURATION = SECTIONS[SECTIONS.length - 1].t1;
const CUTS = [6.0, 14.0, 20.0, 28.0, 38.0];

// テロップの縦位置。
// ①〜④の解説パートでは、ゲーム画面を上から押し下げて空けた「帯」の中だけに置く。
// こうするとテロップがゲーム画面に一切かからず、どこを触っているかが最後まで見える。
const BAND_H = 344;                       // 帯の高さ
const GAME_TOP = BAND_H;                  // 画面の上端
const GAME_SCALE = (1920 - BAND_H) / 1920; // 縦に収まる倍率(=横も同じだけ縮む)
const Y_HOOK = 1250;                      // つかみは全画面なので従来どおり下寄せ
const Y_CHAP = 118;
const Y_CAP = 112;
/** 解説パート(画面を丸ごと見せる区間) */
const FRAMED = new Set(["shop", "res", "mon", "skill"]);

// ── イージング ────────────────────────────────────────────────────────
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (p) => 1 - Math.pow(1 - clamp01(p), 3);
const easeIn = (p) => Math.pow(clamp01(p), 3);
const easeInOut = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const lerp = (a, b, p) => a + (b - a) * clamp01(p);
/** t が [a,b] のどこにいるか(0→1) */
const span = (t, a, b) => clamp01((t - a) / (b - a));
/** 出入りのフェード付き窓。戻り値 0..1 */
function window_(t, a, b, fadeIn = 0.28, fadeOut = 0.28) {
  if (t < a || t > b) return 0;
  return Math.min(easeOut(span(t, a, a + fadeIn)), 1 - easeIn(span(t, b - fadeOut, b)));
}
/** 決定的な擬似乱数(手ブレやきらめき用) */
function noise(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

// ── DOM ───────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const el = {};
["gameA", "gameBg", "band", "flash", "hitFx", "scrim", "hook1", "hook2", "chap", "chapNum", "chapTtl", "chapBar",
 "cap", "spot", "cta", "ctaBg", "ctaLogo", "ctaBadge", "ctaHead", "ctaSub", "ctaPanel",
 "ctaArrow", "ctaFoot"].forEach((k) => (el[k] = $(k)));

let CLIPS = {};       // クリップ名 → フレーム数
let sparkNodes = [];

async function init() {
  const res = await fetch("build/clips.json", { cache: "no-store" });
  (await res.json()).forEach((c) => (CLIPS[c.name] = c.frames));

  el.ctaBg.style.backgroundImage = 'url("../images/bg_title.webp")';

  for (let i = 0; i < 26; i++) {
    const s = document.createElement("div");
    s.className = "spark";
    s.style.left = (540 + noise(i * 3.1) * 500).toFixed(1) + "px";
    s.style.top = (960 + noise(i * 7.7) * 830).toFixed(1) + "px";
    el.cta.appendChild(s);
    sparkNodes.push(s);
  }

  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// ── 素材フレームの差し替え ────────────────────────────────────────────
let lastSrc = "";
function frameSrc(clip, at) {
  const n = CLIPS[clip] || 1;
  const idx = Math.min(n, Math.max(1, Math.round(at * FPS) + 1));
  return `${CLIP_DIR}/${clip}/${String(idx).padStart(5, "0")}.jpg`;
}
/** 素材内の時刻。数値なら等速、関数ならスロー/早回しに使う */
function clipTimeAt(sec, local) {
  return typeof sec.at === "function" ? sec.at(local) : sec.at + local;
}
function setGame(src) {
  if (src === lastSrc) return Promise.resolve();
  lastSrc = src;
  el.gameBg.src = src;   // 余白に敷くぼかし背景も同じ絵で
  return new Promise((resolve) => {
    el.gameA.onload = () => resolve();
    el.gameA.onerror = () => resolve();
    el.gameA.src = src;
  });
}

// ── カメラ ────────────────────────────────────────────────────────────
// 素材(1080×1920)の点 (cx,cy) を画面中央に置いて scale 倍する。
// transform-origin は要素中央なので、平行移動量は (540-cx)*scale。
const camAt = (scale, cx, cy, dx = 0, dy = 0) => ({ scale, cx, cy, dx, dy });
/** 素材の上端を画面上端に合わせたまま寄る(総数と毎秒を切らさないため) */
const camTop = (scale, dx = 0, dy = 0) => camAt(scale, 540, 960 / scale, dx, dy);
/** 上端合わせのまま、横の見る位置だけずらす */
const camTopAt = (scale, cx, dx = 0, dy = 0) => camAt(scale, cx, 960 / scale, dx, dy);
/** 上端合わせ → 中央合わせの補間 */
const camTopToCenter = (scale, p, cx = 540) =>
  camAt(scale, lerp(cx, 540, clamp01(p)), lerp(960 / scale, 960, clamp01(p)));
/** 画面を丸ごと、帯の下にぴたりと収める(どこも切り落とさない) */
const camFramed = (dx = 0, dy = 0) =>
  camAt(GAME_SCALE, 540, (960 - GAME_TOP) / GAME_SCALE, dx, dy);

function camTransform(c) {
  const tx = (540 - c.cx) * c.scale + c.dx;
  const ty = (960 - c.cy) * c.scale + c.dy;
  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${c.scale.toFixed(4)})`;
}
/** 素材座標 → 画面座標(ハイライトを絵の特定の場所に貼るため) */
function toScreen(c, x, y) {
  return {
    x: 540 + c.scale * (x - c.cx) + c.dx,
    y: 960 + c.scale * (y - c.cy) + c.dy,
  };
}

function cameraFor(sec, t) {
  const p = span(t, sec.t0, sec.t1);
  switch (sec.id) {
    // つかみ: クッキーに寄り切った状態から、少しずつ引く
    case "hook":  return camTop(lerp(1.96, 1.72, easeOut(p)));
    case "intro": return camTop(lerp(1.72, 1.26, easeInOut(p)));
    // ①〜④の解説パートは、どこも切らずに画面を丸ごと見せる。
    // 寄って一部を隠すより、何をタップしているかが分かることを優先する。
    case "shop":
    case "res":
    case "skill":
      return camFramed();
    // 討伐だけは、殴っている間ほんの少し揺らして手応えを出す(拡大はしない)
    case "mon": {
      const hit = t < sec.t0 + 3.4 ? Math.max(0, 1 - ((t * 1000) % 300) / 95) : 0;
      return camFramed(hit * noise(Math.floor(t * 3.3)) * 9, hit * noise(Math.floor(t * 3.3) + 99) * 7);
    }
    // しめ: タイトル画面をゆっくり押していく
    case "outro":
    case "cta": return camAt(lerp(1.04, 1.18, easeInOut(span(t, 38.0, 50.0))), 540, 900);
  }
  return camAt(1, 540, 960);
}

// ── テロップ ──────────────────────────────────────────────────────────
// どの style* も「窓の外なら何も触らない」。毎フレーム hideTelops() で一旦消してから
// 全部の窓を順に評価するので、触らない = 消えたまま、になる。
function styleLine(node, text, t, a, b, y, size) {
  const w = window_(t, a, b, 0.26, 0.26);
  if (w <= 0.001) return;
  node.style.opacity = w.toFixed(3);
  node.style.visibility = "visible";
  if (node.dataset.txt !== text) { node.innerHTML = text; node.dataset.txt = text; }
  const inP = easeOut(span(t, a, a + 0.42));
  const outP = easeIn(span(t, b - 0.30, b));
  node.style.top = y + "px";
  node.style.fontSize = size + "px";
  node.style.transform =
    `translateY(${((1 - inP) * 46 - outP * 34).toFixed(1)}px) scale(${(lerp(0.92, 1, inP) * (1 - outP * 0.05)).toFixed(4)})`;
  scrimNeed = Math.max(scrimNeed, w);
}

function styleChapter(t, a, b, num, title) {
  const w = window_(t, a, b, 0.30, 0.26);
  if (w <= 0.001) return;
  el.chap.style.opacity = w.toFixed(3);
  el.chap.style.visibility = "visible";
  if (el.chapNum.textContent !== num) el.chapNum.textContent = num;
  if (el.chapTtl.textContent !== title) el.chapTtl.textContent = title;
  const inP = easeOut(span(t, a, a + 0.5));
  const outP = easeIn(span(t, b - 0.3, b));
  el.chap.style.top = Y_CHAP + "px";
  el.chap.style.transform = `translateX(${((1 - inP) * -190 - outP * 100).toFixed(1)}px)`;
  el.chapBar.style.width = (easeOut(span(t, a + 0.18, a + 0.9)) * 480).toFixed(1) + "px";
}

function styleCaption(t, a, b, html) {
  const w = window_(t, a, b, 0.26, 0.24);
  if (w <= 0.001) return;
  el.cap.style.opacity = w.toFixed(3);
  el.cap.style.visibility = "visible";
  if (el.cap.dataset.txt !== html) { el.cap.innerHTML = html; el.cap.dataset.txt = html; }
  const inP = easeOut(span(t, a, a + 0.4));
  el.cap.style.top = Y_CAP + "px";
  el.cap.style.transform = `translateY(${((1 - inP) * 38).toFixed(1)}px) scale(${lerp(0.96, 1, inP).toFixed(4)})`;
}

/** 素材の (x,y) を中心に、幅 w 高さ h(素材基準)のリングを重ねる */
function styleSpot(t, a, b, camera, x, y, w, h) {
  const o = window_(t, a, b, 0.22, 0.22);
  if (o <= 0.001) return;
  const c = toScreen(camera, x, y);
  const sw = w * camera.scale;
  const sh = h * camera.scale;
  el.spot.style.opacity = (o * 0.9).toFixed(3);
  el.spot.style.visibility = "visible";
  el.spot.style.left = (c.x - sw / 2).toFixed(1) + "px";
  el.spot.style.top = (c.y - sh / 2).toFixed(1) + "px";
  el.spot.style.width = sw.toFixed(1) + "px";
  el.spot.style.height = sh.toFixed(1) + "px";
  el.spot.style.transform = `scale(${(1 + Math.sin((t - a) * 7.2) * 0.035).toFixed(4)})`;
}

let scrimNeed = 0;
function hideTelops() {
  scrimNeed = 0;
  [el.hook1, el.hook2, el.chap, el.cap, el.spot].forEach((n) => {
    n.style.opacity = "0";
    n.style.visibility = "hidden";
  });
}

// ── しめ(CTA)の段階表示 ──────────────────────────────────────────────
function renderCta(t) {
  const s = SECTIONS[SECTIONS.length - 1];
  const appear = easeInOut(span(t, s.t0 - 0.8, s.t0 + 0.6));
  el.cta.style.opacity = appear.toFixed(3);
  if (appear <= 0.001) return;

  const rel = t - s.t0;
  const stage = (a, b) => easeOut(span(rel, a, b));
  const pop = (a) => {
    const p = easeOut(span(rel, a, a + 0.46));
    return { o: p.toFixed(3), tr: `translateY(${((1 - p) * 40).toFixed(1)}px) scale(${lerp(0.9, 1, p).toFixed(4)})` };
  };

  el.ctaBg.style.transform = `scale(${(1.0 + 0.08 * span(rel, -0.8, 8.0)).toFixed(4)})`;

  const lg = pop(0.10); el.ctaLogo.style.opacity = lg.o; el.ctaLogo.style.transform = lg.tr;
  const bd = pop(0.50); el.ctaBadge.style.opacity = bd.o; el.ctaBadge.style.transform = bd.tr;

  const hd = pop(0.80);
  // 「募集中」の着地でひと跳ねさせる
  const kickP = span(rel, 1.10, 1.80);
  const kick = 1 + Math.max(0, 1 - kickP) * 0.055 * Math.sin(kickP * Math.PI * 3);
  el.ctaHead.style.opacity = hd.o;
  el.ctaHead.style.transform = `${hd.tr} scale(${kick.toFixed(4)})`;

  const sb = pop(1.30); el.ctaSub.style.opacity = sb.o; el.ctaSub.style.transform = sb.tr;
  const pn = pop(1.90); el.ctaPanel.style.opacity = pn.o; el.ctaPanel.style.transform = pn.tr;

  el.ctaArrow.style.opacity = stage(2.45, 2.85).toFixed(3);
  el.ctaArrow.style.transform = `translateY(${(Math.sin(rel * 4.4) * 12).toFixed(1)}px)`;
  el.ctaFoot.style.opacity = stage(3.05, 3.55).toFixed(3);

  sparkNodes.forEach((n, i) => {
    const ph = (rel * 0.55 + i * 0.37) % 1;
    n.style.opacity = (Math.sin(ph * Math.PI) * 0.7 * stage(0.6, 1.6)).toFixed(3);
    n.style.transform = `translateY(${(-ph * 70).toFixed(1)}px) scale(${(0.5 + ph).toFixed(2)})`;
  });
}

// ── 1 フレーム分の状態を作る ──────────────────────────────────────────
async function seek(t) {
  const sec = SECTIONS.find((s) => t >= s.t0 && t < s.t1) || SECTIONS[SECTIONS.length - 1];
  const camera = cameraFor(sec, t);
  await setGame(frameSrc(sec.clip, clipTimeAt(sec, t - sec.t0)));
  el.gameA.style.transform = camTransform(camera);
  // スキルツリーの画面はもともと暗い。スマホで見たときにノードが沈まないよう少し持ち上げる
  el.gameA.style.filter = sec.id === "skill" ? "brightness(1.24) saturate(1.14) contrast(1.04)" : "none";

  // 解説パートだけ「帯 + 画面まるごと」のレイアウトにする
  const framed = FRAMED.has(sec.id);
  el.gameA.classList.toggle("framed", framed);
  el.gameBg.style.opacity = framed ? "1" : "0";
  el.band.style.opacity = framed ? "1" : "0";
  el.band.style.height = (BAND_H + 90) + "px";

  // カット頭のフラッシュ
  let fl = 0;
  CUTS.forEach((c) => { if (t >= c && t < c + 0.15) fl = Math.max(fl, 1 - (t - c) / 0.15); });
  el.flash.style.opacity = (fl * fl * 0.30).toFixed(3);

  // 殴っている間だけ、タップに合わせて画面のふちを熱くする
  const hitPulse = sec.id === "mon" && t < sec.t0 + 3.4
    ? Math.max(0, 1 - ((t * 1000) % 300) / 95) : 0;
  el.hitFx.style.opacity = (hitPulse * 0.60).toFixed(3);

  hideTelops();

  // ── つかみ
  styleLine(el.hook1, 'タップして、<em>焼く</em>。', t, 0.30, 2.60, Y_HOOK, 100);
  styleLine(el.hook2, '…のはずが、<br><em>数字が止まらない</em>。', t, 2.75, 5.80, Y_HOOK - 60, 84);

  // ── ① 設備(章タグ → ひとこと の順に、帯の中で入れ替える)
  styleChapter(t, 6.20, 9.30, "1", "設備でクッキーを増やす");
  styleCaption(t, 9.50, 13.70, 'まとめ買いで <b>毎秒の生産</b> がケタごと跳ねる');
  styleSpot(t, 6.60, 9.20, camera, 540, 122, 330, 92);

  // ── ② 研究
  styleChapter(t, 14.20, 17.00, "2", "研究で設備を強化");
  styleCaption(t, 17.20, 19.70, '<b>生産の式そのもの</b>を書き換える研究が並ぶ');

  // ── ③ 討伐
  styleChapter(t, 20.20, 22.60, "3", "モンスター撃破で報酬");
  styleCaption(t, 22.80, 25.10, '連打で削る。<b>ボスほど報酬が重い</b>');
  styleCaption(t, 25.40, 27.70, '報酬は毎回 <b>自分で選ぶ</b>');

  // ── ④ スキルツリー
  styleChapter(t, 28.20, 31.00, "4", "転生スキルツリー");
  styleCaption(t, 31.20, 37.70, '<b>71ノード</b>。取る順番で次の周回の速さが変わる');

  // 大きな一行テロップの下だけ静かに沈めて、文字を確実に読ませる
  el.scrim.style.opacity = (scrimNeed * 0.92).toFixed(3);
  el.scrim.style.top = (Y_HOOK - 250) + "px";
  el.scrim.style.height = "600px";

  renderCta(t);

  await new Promise((r) => requestAnimationFrame(r));
}

window.__promo = { init, seek, DURATION, FPS, SECTIONS };
