// RETIRED 2026-08-04 — do not use this to publish.
//
// It writes 1920x1080, and YouTube only admits square or vertical video to the
// Shorts feed. Both videos it produced redirect /shorts/<id> to /watch: they
// were never in the feed at all, and they have one view between them, against
// 208 and 768 for vertical uploads from the same channel in the same days. The
// duration was never the problem — 1m44s is inside the three-minute limit — so
// nothing about the writing or the pacing would have rescued them.
//
// Kept because the staging logic here is sound and a vertical topic renderer
// would start from it. Publishing from it is the mistake; reading it is not.
//
// Records one long-form explainer for クッキーストラテジャー.
//   PROMO_TOPIC=quota node director-wide.mjs         -> video/frames at 1920x1080
//   PROMO_TOPIC=quota node director-wide.mjs shots   -> stills, no capture
//
// Unlike the Shorts director this is not a hand-written sequence of scenes: the
// sequence comes from topics.mjs, and this file is the machine that plays one.
// That is the difference the format forces. A Short is one idea and its order is
// the whole design, so it is worth writing out; a three-minute explainer is the
// same shape every time — cut, build a screen, say two or three things about it
// — and what changes between videos is which system is being explained.
//
// The game has a landscape layout of its own (a fixed 750x356 box scaled to
// fit), so this captures 16:9 directly and the game sits in the middle of it at
// native size. The band above and below is not waste: it is where every caption
// goes, which means nothing is ever drawn on top of play.
import { openStage } from './stage.mjs';
import { TOPICS, byId } from './topics.mjs';

const TOPIC = byId(process.env.PROMO_TOPIC || 'quota') || TOPICS[0];
const SHOTS = process.argv[2] === 'shots';
const SAFE = process.argv[3] === 'safe';

// 1920x1080 is the delivery size and also what the screencast hands back, so
// unlike the portrait pipeline nothing is upscaled afterwards. Quality is still
// high: the panels this format lingers on are made of small text.
const W = 1920, H = 1080;

const stage = await openStage({
  width: W, height: H, fps: 20, quality: 92,
  overlay: 'overlay-wide.js', mobile: false, shots: SHOTS,
});
const { ev, wait, shot, mark, flash, cap, top, begin, finish } = stage;
if (SAFE) await ev(() => window.__safeZones());

// A beat may be written as one caption or as a run of them over the same screen.
// Long-form wants the second: cutting every six seconds to keep a video moving
// is a Shorts habit, and applied here it produces three minutes of flinching.
// Holding a screen and changing the line over it is how an explanation reads.
const linesOf = b => b.lines || [{ caption: b.caption, narration: b.narration, hold: b.hold }];

// The narration is written next to the caption it belongs with, so the cue list
// is built here rather than kept in a table that has to be re-aligned by hand
// every time a beat moves. Each line is anchored to the mark logged the instant
// its caption went up.
const narration = [];

console.log(`  topic: ${TOPIC.id}`);
await stage.hideRewardModal();
await ev(() => window.__suppressRewards());

// Beat one is built while the cover is still down, so the video opens on a
// finished screen rather than on the half-second it takes to arrange one.
const beats = TOPIC.beats;
await beats[0].run(stage);
await wait(400);

// Lift the music bed well above the game's own ceiling. Without it the take is
// mostly silence with occasional spikes: quiet enough that YouTube's loudness
// normalisation turns it up, which only makes the spikes worse.
await ev(() => {
  settings.bgmVolume = 100;
  settings.seVolume = 100;
  try { if (bgmGainNode) bgmGainNode.gain.value = 0.42; } catch (e) {}
});

await top(TOPIC.chapter.head);
await wait(250);
await begin();
console.log('  audio:', await ev(() => window.__startRec()));

for (let i = 0; i < beats.length; i++) {
  const b = beats[i];
  if (i > 0) {
    await flash();
    await b.run(stage);
    // The banner is re-asserted after every cut: entering and leaving the
    // fullscreen views moves the overlay between hosts, and a re-mounted layer
    // comes back empty.
    await top(TOPIC.chapter.head);
  }
  for (let j = 0; j < linesOf(b).length; j++) {
    const ln = linesOf(b)[j];
    await cap(ln.caption);
    const id = `${b.id}_${j}`;
    mark(id);
    if (ln.narration) narration.push({ mark: id, at: 0.25, text: ln.narration });
    // The still is taken after the hold starts, not before: captions animate in,
    // and a screenshot on the same tick catches them at zero opacity — which
    // made the review stills look like the captions were missing entirely.
    await wait(ln.hold);
    await shot(id);
  }
}

// ------------------------------------------------------------------- end card
await flash('stamp');
await cap([]);
await top(null);
// Same wording as the Shorts end card, and for the same reasons: the terms have
// to match what the channel asks of testers, "Android専用" is not the same
// sentence as "iPhone不可", and the links are only tappable on the channel page
// until the channel earns advanced features.
await ev(() => window.__end(
  'クッキーストラテジャー',
  '基本プレイ無料・<u>Android専用</u>（iPhone不可）<br>Google Play 公開に必要なテスターを募集中<br>14日間 入れたまま ＋ ときどき起動',
  '参加リンクは<em>チャンネル概要欄</em>に'));
mark('cta');
narration.push({ mark: 'cta', at: 0.4, text: 'アンドロイドのテスター募集中。リンクはチャンネル概要欄に。' });
await shot('cta');
await wait(6000);
mark('total');

await finish({ topic: TOPIC.id, narration });
