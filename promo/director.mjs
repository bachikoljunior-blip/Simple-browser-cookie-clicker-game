// Records the YouTube Shorts promo for クッキーストラテジャー.
//   node director.mjs         -> records video/frames at 900x1600 (+ trim.json)
//   node director.mjs shots   -> no video, one screenshot per beat for review
//
// Opening the browser, building the save states and driving the board all live
// in stage.mjs, which the long-form director uses too. What is left here is the
// cut itself — the order of the beats and how long each one is held.
import { openStage } from './stage.mjs';
import { VARIANTS, byId } from './variants.mjs';

// Which cut to render. Every cut shares the body of the video and differs in the
// opening screen and claim — see variants.mjs.
const VARIANT = byId(process.env.PROMO_VARIANT || 'unit') || VARIANTS[0];
const SHOTS = process.argv[2] === 'shots';
const SAFE = process.argv[3] === 'safe';   // overlay the Shorts chrome zones

// The game scales its board to the viewport width but caps it at 900px, so
// capture 9:16 at exactly 900 wide to fill the frame with no letterboxing.
// A 1.2x lanczos upscale to 1080x1920 happens at encode time.
const W = 900, H = 1600;

const stage = await openStage({
  width: W, height: H, fps: 20, quality: 95,
  overlay: 'overlay.js', mobile: true, shots: SHOTS,
});
const {
  page, ev, wait, shot, mark, flash, cap, top,
  tapAt, tapEl, tapBurst, hitMonsters,
  setLateGame, setFresh, setMidGame, grant,
  showTab, setPlayFullscreen, waitForImages, toPlayScreen, hideRewardModal,
  autoScroll, scrollToHeading, begin, finish,
} = stage;
if (SAFE) await ev(() => window.__safeZones());

// =============================================================== SCENE 1 — hook
// The number itself is the hook: the counter runs off the end of the units most
// people know, so lead with "do you know this unit?" rather than "big number".
//
// Two things matter more here than anywhere else. The play area goes full-bleed
// so the counter and the cookie own the frame instead of sharing it with a list
// of shop rows, and the text is already on screen when the cover lifts — a Short
// that opens on half a second of untitled gameplay has lost the scroll already.
await setLateGame();
await hideRewardModal();
await showTab('shopTab', false);
await setPlayFullscreen(true);

// Whatever the cut opens on is built here, while the cover is still down, so the
// first frame is already the finished picture however long it took to arrange.
const hookScreen = {
  play: async () => {},
  quota: async () => { await setMidGame(); },
  hunt: async () => {
    await ev(() => {
      try { showMonster('swarm'); showMonster('boss'); } catch (e) {}
      state.huntFocusLv = 20;
    });
  },
  craft: async () => {
    await setPlayFullscreen(false);
    await showTab('workshopTab', true);
    await waitForImages('workshopTab');
  },
  info: async () => {
    await setPlayFullscreen(false);
    await showTab('infoTab', true);
    await waitForImages('infoTab');
    await scrollToHeading('infoTab', '現在の倍率・状態');
  },
  tree: async () => {
    await setPlayFullscreen(false);
    await ev(() => { try { closeTabPageFullscreen(); openSkillTreeView(); } catch (e) {} });
    await page.waitForTimeout(700);
    await tapEl('#skillTreeOnlyBtn');
    await page.waitForTimeout(600);
    await ev(() => window.__mount('#skillChoiceScreen'));
    await ev(() => {
      setSkillMapZoom(0.45, false);
      const f = document.querySelector('.skillMapFrame');
      f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;
      f.scrollTop = (f.scrollHeight - f.clientHeight) * 0.35;
    });
    await page.waitForTimeout(400);
  },
};
await (hookScreen[VARIANT.hook.screen] || hookScreen.play)();
await page.waitForTimeout(400);
// Lift the music bed well above the game's own ceiling. Without it the take is
// mostly silence with occasional spikes: quiet enough that YouTube's loudness
// normalisation turns it up, which only makes the spikes worse.
await ev(() => {
  settings.bgmVolume = 100;
  settings.seVolume = 100;
  try { if (bgmGainNode) bgmGainNode.gain.value = 0.42; } catch (e) {}
});
// Short mode: hook → 討伐 → CTA, and nothing else.
//
// The only retention curve this channel has (UUCI_m2Xqus, 51s) loses half its
// viewers by 7.6s and 91% by 13.8s. Everything after that — the workshop, the
// research screen, the skill tree, the payoff, and the recruitment card the
// video exists to deliver — is being shown to under a tenth of the audience.
// Adding beats to a video nobody reaches is not promotion; it is decoration.
//
// So this path keeps the hook, keeps the single most kinetic beat (golden
// cookie into a swarm and a boss), and gets to the CTA while people are still
// watching. It is a test, not a verdict: the curve above comes from a video
// this pipeline did not make, so its shape may not be ours.
const SHORT = process.env.PROMO_LENGTH === 'short';
const cues = [];

await top(VARIANT.hook.banner);
await cap(VARIANT.hook.caption);
await page.waitForTimeout(350);   // let the text animate in behind the cover
await begin();
console.log(`  cut: ${VARIANT.id}`);
console.log('  audio:', await ev(() => window.__startRec()));
await shot('hook');
mark('hook');
if (SHORT) cues.push({ mark: 'hook', at: 0.30, text: VARIANT.hook.narration });
// Pre-setting the text means the opening frames would otherwise be motionless.
// Tapping the cookie gives the hook real movement — floating numbers and the
// game's own click — instead of a still frame with a caption on it.
// Give the opening seconds movement, whatever screen the cut opens on.
//
// Only `unit` had taps, so the other five cuts opened on a completely still
// picture — and `unit` is the one cut that has ever been distributed. One data
// point is not proof, but a static frame is a known-bad opening for a medium
// that decides in two seconds, and it costs nothing to fix. It matters more in
// short mode, where the hook is not an introduction to the video: it is a fifth
// of it.
//
// The motion has to suit the screen. Tapping the cookie is invisible while a
// panel is open, so the list screens scroll instead and the skill map drifts.
const hookMotion = {
  play:  () => tapBurst('#cookie', 4, 340),
  quota: () => tapBurst('#cookie', 4, 340),
  hunt:  () => tapBurst('#cookie', 3, 300),
  craft: () => autoScroll('workshopTab', 0.14, 1500),
  info:  () => autoScroll('infoTab', 0.12, 1500),
  tree:  () => ev(() => {
    const f = document.querySelector('.skillMapFrame');
    if (f) f.scrollTo({ top: f.scrollTop + f.clientHeight * 0.35, behavior: 'smooth' });
  }),
};
const moved = hookMotion[VARIANT.hook.screen] || hookMotion.play;
await moved();
await wait(VARIANT.hook.screen === 'play' || VARIANT.hook.screen === 'quota' ? 1100 : 900);

// ---- SHORT: jump straight to the kinetic beat, on the board scene 3 sets up
if (SHORT) {
  await flash();
  await cap([]);
  await setMidGame();
  await toPlayScreen();
  await setPlayFullscreen(true);
}

if (!SHORT) {
// =============================================================== SCENE 2 — rewind
// Hold the same full-bleed framing the hook used, so the two states can be read
// against each other: identical composition, identical counter position, so the
// only thing that changes is the number — 25 against 100正. Dropping to the split
// view here would make it look like a different screen rather than the same one
// earlier, which is the whole point of the rewind.
await flash();
await cap([]);
await top('⏪ 最初はこう');
// Put the board back however the hook left it, then rewind.
await ev(() => { try { closeSkillChoiceScreen(); } catch (e) {} window.__mount(); });
await showTab('shopTab', false);
await setPlayFullscreen(true);
await setFresh();
await page.waitForTimeout(200);
await cap(['スタートは<em>クッキー25枚</em>']);
await shot('rewind');
await wait(1400);

await top(null);
await setPlayFullscreen(false);
await cap(['タップ1回 = <em>1クッキー</em>']);
await tapBurst('#cookie', 10, 60);
await shot('taps');
await wait(400);

// Cause then effect. The old order put "設備を買うと毎秒が増える" on screen while
// the shop still read 所持 0 / 毎秒 0, so the claim arrived before anything backed
// it up. Buy first, then say what happened.
await grant('120000');
await cap(['貯めて<em>設備</em>を買う']);
await wait(350);
for (const nth of [0, 1, 2]) {
  await tapEl(`#shop .item >> nth=${nth}`);
  await wait(200);
}
await wait(250);
await cap(['<em>毎秒</em>が増えた', 'ここまでは<b>ふつうの放置ゲー</b>']);
mark('buyResult');   // the narration line for this beat is anchored to it
await shot('buy');
await wait(1750);   // room for the summary line, and to read 毎秒 9
mark('scene2');

// =============================================================== SCENE 3 — ノルマ
// The one mechanic no other idle clicker has. Stated as a consequence, not a rule.
await flash();
await setMidGame();
await toPlayScreen();
await setPlayFullscreen(true);
await top('ここからが本題');
// 「放置したら終わる」と書いていたが、実際に終わるのは その周回のモンスター出現
// だけで、生産は続くしオフラインでも貯まる(ゲーム内FAQと放置上限スキルが根拠)。
// 放置ゲーを探している層に「放置できない」と伝わるのは、事実と違ううえに逆効果。
await cap(['生産ペースに<em>ノルマ</em>があります', '遅れると<b>その周回はモンスターが出なくなる</b>']);
await shot('quota');
await wait(2200);
await cap(['置いておくだけでも増える', 'でも<em>放置だけだと伸びない</em>']);
await shot('quota2');
await wait(1800);
mark('scene3');
}   // end !SHORT (scenes 2-3)

// =============================================================== SCENE 4 — 討伐
// Golden cookie first (the field cookie visibly swells), then a swarm and a boss
// on screen together — the busiest, most alive frame in the game.
await flash();
await top(null);
await cap(['<em>金のクッキー</em>で生産が跳ねて'], 'high');
mark('golden');
await ev(() => {
  try { showGoldenCookie(); } catch (e) { return String(e); }
  // The game drops it anywhere on the field, and "anywhere" included the bottom
  // edge — small, half under YouTube's chrome, and gone before anyone saw it.
  // Put it in clear space below the caption and away from the centre cookie.
  const btn = document.getElementById('goldenCookie');
  const host = document.querySelector('.top');
  if (btn && host) {
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
    btn.style.left = Math.round(host.clientWidth * 0.58) + 'px';
    btn.style.top = Math.round(host.clientHeight * 0.22) + 'px';
  }
});
await wait(1250);
await tapEl('#goldenCookie');
await shot('golden');
await wait(1000);   // let the buff visibly take hold before cutting away

await cap(['<em>モンスター</em>を殴ると素材が出る', '群れも<b>ボス</b>も来ます'], 'high');
mark('swarm');
await ev(() => {
  try { showMonster('swarm'); showMonster('boss'); } catch (e) { return String(e); }
  // At this point in the run a tap does 4 damage against 173hp minions, so the
  // burst never killed anything and the drop the caption promises never
  // appeared. 狩猟集中 is the game's own damage skill; enough of it to land the
  // kills inside the beat.
  state.huntFocusLv = 20;
});
await wait(1000);
await shot('monster');
await hitMonsters(10, 105);
await wait(600);
await hideRewardModal();
mark('scene4');
if (SHORT) {
  cues.push({ mark: 'golden', at: 0.20, text: '金のクッキーで生産が跳ねます。' });
  cues.push({ mark: 'swarm', at: 0.20, text: '殴ると素材が出ます。ボスも来ます。' });
}

await ev(() => { state.huntFocusLv = 0; });

if (!SHORT) {
// =============================================================== SCENE 5 — 工房
// 486 recipes is a genuinely surprising number for a clicker, and the cooking
// list pays off the ノルマ beat: one dish slows the quota clock down.
await flash();
await setPlayFullscreen(false);
await setLateGame();
// The caption goes up before the art is waited on. Waiting first left the panel
// on screen with nothing on it for over a second, three times in the video.
await showTab('workshopTab', true);
await top('素材の使い道', 'hi');
await cap(['集めた素材で<em>装備</em>を作る', 'レシピは<em>486種類</em>']);
await waitForImages('workshopTab');
await wait(400);
const craftPan = autoScroll('workshopTab', 0.30, 1900);
await shot('craft');
await wait(1800);
await craftPan;

// Scrolling moved the 作成 / 料理 buttons out of the frame, so put the page back
// to the top before reaching for one of them.
await cap([]);
await ev(() => {
  const page = document.getElementById('workshopTab');
  if (page) [...page.querySelectorAll('*')].forEach(el => {
    if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = 0;
  });
});
await wait(250);
await tapEl('#workshopPanel >> text=料理');
await top(null);
await cap(['<em>料理</em>で<b>ノルマをゆるめられる</b>', '金のクッキーを出やすくする一皿も']);
await waitForImages('workshopTab');
await wait(500);
const cookPan = autoScroll('workshopTab', 0.22, 2200);
await shot('cook');
await wait(1900);
await cookPan;
mark('scene5');

// =============================================================== SCENE 6 — 研究 / 一覧
await flash();
await showTab('researchTab', true);
await cap(['<em>研究</em>を買うと<b>生産の計算式</b>が変わる']);
await waitForImages('researchTab');
await wait(400);
const researchPan = autoScroll('researchTab', 0.32, 1600);
await shot('research');
await wait(1350);
await researchPan;

await showTab('infoTab', true);
await cap(['効いている倍率は<em>全部この画面で見られる</em>']);
await waitForImages('infoTab');
console.log('  info scroll:', await scrollToHeading('infoTab', '現在の倍率・状態'));
await wait(500);
const infoPan = autoScroll('infoTab', { by: 0.34 }, 2100);
await shot('info');
await wait(1800);
await infoPan;
mark('scene6');

// =============================================================== SCENE 7 — 転生スキルツリー
await flash();
await top(null);
// The tree screen takes about 1.8s to open, zoom and settle, and the game plays
// its own fade on the way in. The caption goes up first so that stretch is not a
// blank screen, and the narration is anchored to the moment the tree is actually
// there — announcing "71 nodes" over a black frame wasted the best shot in the
// video.
await cap(['転生すると<em>スキルツリー</em>', 'ノードは<em>71個</em>']);
await ev(() => { try { closeTabPageFullscreen(); openSkillTreeView(); } catch (e) { return String(e); } });
await wait(700);
await tapEl('#skillTreeOnlyBtn');
await wait(500);
await ev(() => window.__mount('#skillChoiceScreen'));
// The map is 2120x3320, far taller than the frame — pan down it instead of
// zooming out to an unreadable speck.
await ev(() => {
  setSkillMapZoom(0.45, false);
  const f = document.querySelector('.skillMapFrame');
  f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;
  f.scrollTop = 0;
});
// The game runs its own 0.72s fade when the tree goes fullscreen; wait it out so
// the mark lands on the settled map rather than mid-wash.
await wait(800);
mark('treeReady');
const pan = ev(async () => {
  const f = document.querySelector('.skillMapFrame');
  const max = f.scrollHeight - f.clientHeight;
  const t0 = performance.now(), dur = 3200;
  await new Promise(res => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      f.scrollTop = max * k;
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
});
await shot('tree');
await wait(1700);
// 「転生」はジャンル外の人には"進行が消える"と読まれる。得られるもの(次の周回が
// 速くなる)を先に言わないと、リセットの罰にしか見えない。
await cap(['次の周回は<b>確実に速くなる</b>', '取り方は何度でも組み直せます']);
await shot('tree2');
await wait(1700);
await pan;
mark('scene7');

// =============================================================== SCENE 8 — payoff
// Tear the tree screen down and restore the play screen in one step, so no
// half-dressed frame (stale caption, leftover panel) ever reaches the video.
await cap([]);
await ev(() => {
  try { closeSkillChoiceScreen(); } catch (e) {}
  window.__mount();
});
await wait(250);
await toPlayScreen();
await setLateGame();
await setPlayFullscreen(true);
await flash('stamp');
await top('で、さっきの数字に戻ります');
await cap(['<em>100正</em> ＝ 10の<em>42</em>乗']);
await shot('payoff');
await wait(1950);
mark('scene8');
}   // end !SHORT (scenes 5-8)

// =============================================================== SCENE 9 — CTA
await top(null);
await cap([]);
// 「クローズドテスト中」は"未完成でまだ遊べない"、「テスター募集」は"報告作業が
// ある"と読まれやすい。募集の理由(公開に必要)と、実際にやること、対象(Android)を
// 先に出して、行動だけを赤枠に残す。
//
// 条件は募集主がチャンネルで告知しているものと一字一句そろえること。以前ここは
// 「入れたままにするだけ」と書いていたが、実際の募集条件は「ときどき起動して遊ぶ」
// も含む。動画の方を軽く言うと、来た人が聞いていた話と違うことになる。
//
// 行き先はチャンネル概要欄。一度は説明欄に変えたが、あれは間違いだった ——
// 説明欄なら中身を保証できる(投稿時に自分で書くので)という理屈は合っていても、
// YouTube は詳細機能が解放されるまで説明欄の外部リンクをただの文字として出す。
// 押せないリンクを保証しても意味がない。概要欄の「リンク」欄はボタンとして
// 描画されるので、開設まもないチャンネルではそこだけが実際に踏める導線になる。
// 説明欄にも同じURLは載せている(コピーはできるので)が、案内はしない。
await ev(() => window.__end(
  'クッキーストラテジャー',
  // 「14日間」と「基本プレイ無料」が隣り合っていると、14日間だけ無料と読める。
  '基本プレイ無料・<u>Android専用</u>（iPhone不可）<br>Google Play 公開に必要なテスターを募集中<br>14日間 入れたまま ＋ ときどき起動',
  '参加リンクは<em>チャンネル概要欄</em>に'));
// Mark where the card *appears*. Marking the end of the beat put the cue past
// the last frame — the card was on screen for 3.9s with nothing spoken over it.
mark('cta');
if (SHORT) cues.push({ mark: 'cta', at: 0.10, text: 'アンドロイドのテスター募集中。リンクはチャンネル概要欄に。' });
await shot('cta');
// The card is the payload, so it gets room: long enough for the line to finish
// with margin and for the terms to be read. In short mode that is a third of the
// runtime, which is the right proportion when the other two thirds exist to earn
// it. At 3900ms the closing line overran the last frame by 0.13s.
await wait(SHORT ? 4700 : 3900);
mark('scene9 / total');

await finish({ variant: VARIANT.id, ...(SHORT ? { narration: cues } : {}) });