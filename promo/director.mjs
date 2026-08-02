// Records the YouTube Shorts promo for クッキーストラテジャー.
//   node director.mjs         -> records video/*.webm at 1080x1920 (+ trim.json)
//   node director.mjs shots   -> no video, one screenshot per beat for review
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { startCapture } from './screencap.mjs';
import { VARIANTS, byId } from './variants.mjs';

// Which cut to render. Every cut shares the body of the video and differs in the
// opening screen and claim — see variants.mjs.
const VARIANT = byId(process.env.PROMO_VARIANT || 'unit') || VARIANTS[0];

const SHOTS = process.argv[2] === 'shots';
const SAFE = process.argv[3] === 'safe';   // overlay the Shorts chrome zones
// Falls back to whatever playwright-core resolves on its own when this path
// (the browser bundle in the recording container) is not present.
const CHROME = process.env.PROMO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/play.html';
const OUT = 'video';
const overlaySrc = fs.readFileSync('overlay.js', 'utf8');
const audioTapSrc = fs.readFileSync('audiotap.js', 'utf8');

// The game scales its board to the viewport width but caps it at 900px, so
// capture 9:16 at exactly 900 wide to fill the frame with no letterboxing.
// A 1.2x lanczos upscale to 1080x1920 happens at encode time.
const W = 900, H = 1600, DSF = 1;

const browser = await chromium.launch({
  ...(fs.existsSync(CHROME) ? { executablePath: CHROME } : {}),
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: DSF,
  isMobile: true,
  hasTouch: true,
});
await ctx.addInitScript({ content: audioTapSrc + '\nwindow.__installAudioTap();' });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));

// Frames are laid onto a fixed real-time grid rather than written by Playwright,
// so the soundtrack recorded alongside them lines up exactly. See screencap.mjs.
// Chromium's headless screencast is capped near 19.5fps whatever the page or the
// resolution, so the grid runs at 20: close enough that slots rarely have to
// repeat a frame, which keeps the cadence even.
//
// The screencast also only ever hands back frames at the CSS viewport size, and
// the game caps its board at 900px wide, so 900x1600 is the ceiling and the
// deliverable is upscaled from it. That makes the JPEG quality the real limit on
// how the small text in the 研究 and 一覧 panels survives — those beats exist to
// be read — so it is set high rather than economical.
const FPS = 20;
const capture = SHOTS ? null : await startCapture(await ctx.newCDPSession(page),
  { dir: `${OUT}/frames`, fps: FPS, quality: 95, width: W, height: H });

let shotN = 0;
let coverOffAt = 0;
const shot = async (tag) => { if (SHOTS) await page.screenshot({ path: `beat_${String(++shotN).padStart(2, '0')}_${tag}.png` }); };
// Scene boundaries are needed later to place the narration, so they are recorded
// as well as printed. Each mark is the moment its scene finished.
const markLog = {};
const mark = tag => {
  const t = (Date.now() - coverOffAt) / 1000;
  markLog[tag.split(' ')[0]] = t;
  console.log(`  ${t.toFixed(1)}s  ${tag}`);
};
// In shots mode every wait collapses so a full pass takes seconds instead of a minute.
const wait = ms => page.waitForTimeout(SHOTS ? Math.min(ms, 200) : ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

const cap = (lines, pos) => ev(([l, p]) => window.__cap(l, p), [lines, pos || null]);
const top = (html, pos) => ev(([h, p]) => window.__top(h, p), [html, pos || null]);
// Every flash is also a sync mark: the white frame and the transition sound are
// fired together, so their wall times let the encoder line the two tracks up.
//
// The sound starts the instant it is asked for, but the white frame only appears
// at the next paint — and the scene changes that follow a cut rebuild enough DOM
// to block painting for a few hundred milliseconds. Waiting for the flash to
// actually reach the screen before returning keeps the two together, and means
// the rebuild happens behind the white instead of in front of it.
const flashLog = [];
const flash = async (kind) => {
  await ev(k => {
    // A flash always starts a new beat, so the outgoing line goes with it. Some
    // scenes take over a second to build their screen, and a caption left up
    // through that describes whatever happens to be underneath it.
    window.__cap([]);
    window.__flash();
    window.__hit(k);
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, kind || 'cut');
  flashLog.push((Date.now() - coverOffAt) / 1000);
};

async function tapAt(x, y) {
  await ev(([px, py]) => window.__ring(px, py), [x, y]);
  await page.touchscreen.tap(x, y);
}
async function tapEl(sel) {
  const box = await page.locator(sel).first().boundingBox().catch(() => null);
  if (!box) { console.log('no box:', sel); return false; }
  await tapAt(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
// Repeated taps on one target: resolve the box once, then just fire.
async function tapBurst(sel, times, gap) {
  const box = await page.locator(sel).first().boundingBox().catch(() => null);
  if (!box) { console.log('no box:', sel); return false; }
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  for (let i = 0; i < times; i++) {
    await tapAt(x, y);
    await wait(gap);
  }
  return true;
}

// Hits whatever monster is currently on the field, moving on to the next as they
// die. This goes through the game's own hit handler rather than a tap at the
// sprite's coordinates: the golden-cookie buff swells the centre cookie until it
// covers the monsters, so coordinate taps land on the cookie and the monsters
// never take damage. The finger ring is still drawn where the monster is.
async function hitMonsters(times, gap) {
  for (let i = 0; i < times; i++) {
    const ok = await ev(() => {
      const mon = typeof monsters !== 'undefined' && monsters[0];
      if (!mon || !mon.el) return false;
      const r = mon.el.getBoundingClientRect();
      window.__ring(r.x + r.width / 2, r.y + r.height / 2);
      hitMonster(mon.id);
      return true;
    });
    if (!ok) return;
    await wait(gap);
  }
}

await page.goto(URL, { waitUntil: 'load' });
await page.addScriptTag({ content: overlaySrc });
await ev(() => window.__promoInstall());
if (SAFE) await ev(() => window.__safeZones());
await page.waitForTimeout(1200);

// Audio gate + title are cleared under the black cover so the video opens on gameplay.
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(400);
await ev(() => { try { startGameFromTitle(); } catch (e) { return String(e); } });
await page.waitForTimeout(1200);

// freshState() predates a few fields (eq2Seen, eq2Owned, msResearch, ...) that the
// real load path back-fills. Snapshot them at boot so the rewind can restore them.
await ev(() => {
  const base = freshState();
  const extras = {};
  Object.keys(state).forEach(k => { if (!(k in base)) extras[k] = state[k]; });
  window.__extras = JSON.parse(JSON.stringify(extras));
});

// ---------------------------------------------------------------- state helpers
const setLateGame = () => ev(() => {
  UPGRADES.forEach(u => { state.upgrades[u.id] = 180; });
  RESEARCH.forEach(r => { state.research[r.id] = true; });
  SKILLS.forEach(s => { state.skills[s.id] = true; });
  // Without materials the workshop is a wall of greyed-out buttons.
  MATERIALS.forEach(m => { state.materials[m.id] = 999; state.materialsSeen[m.id] = true; });
  state.prestigeRuns = 14;
  state.prestigeTotal = 9200;
  state.prestigePoints = 640;
  state.prestigeUnlockedEver = true;
  state.cookies = D('1e42');
  state.runCookies = D('1e42');
  state.totalCookies = D('4.4e43');
  state.totalClicks = 38400;
  state.runStart = Date.now() - 26 * 60 * 1000;
  state.quotaFailed = false;
  try { renderActiveTab(); } catch (e) {}
});

const setFresh = () => ev(() => {
  state = freshState();
  Object.assign(state, JSON.parse(JSON.stringify(window.__extras)));
  state.cookies = D(25);
  state.runCookies = D(25);
  state.totalCookies = D(25);
  state.totalClicks = 25;
  try { renderActiveTab(); } catch (e) {}
});

const setMidGame = () => ev(() => {
  UPGRADES.slice(0, 7).forEach(u => { state.upgrades[u.id] = 45; });
  state.cookies = D('9.2e8');
  state.runCookies = D('3.1e9');
  state.totalCookies = D('3.1e9');
  state.runStart = Date.now() - 9 * 60 * 1000;
  state.quotaFailed = false;
  try { renderActiveTab(); } catch (e) {}
});

const grant = amt => ev(a => {
  state.cookies = D(a);
  state.runCookies = state.runCookies.add(D(a));
  state.totalCookies = state.totalCookies.add(D(a));
  try { renderActiveTab(); } catch (e) {}
}, amt);

// Play screen = panel at half height. Fullscreen = the tab page fills the frame.
// Clearing the caption is part of changing the screen: setting up the next one
// takes long enough that the previous line would otherwise sit over it for the
// best part of a second, describing something no longer on screen.
const showTab = async (id, full) => {
  await cap([]);
  await ev(([tabId, f]) => {
    switchTab(tabId);
    if (f) toggleTabPageFullscreen(tabId);
    else closeTabPageFullscreen();
  }, [id, !!full]);
};

// The play area either shares the frame with a tab panel or takes the whole of
// it. Anything whose subject lives on the play field — the quota gauge, the
// golden cookie, the monsters — reads far better with the panel out of the way,
// so those scenes claim the frame instead of sitting in the top third of it.
const setPlayFullscreen = on => ev(want => {
  const isOn = document.body.classList.contains('playFullscreenMode');
  if (isOn !== want) { try { togglePlayFullscreen(); } catch (e) { return String(e); } }
}, on);

// Panel art is lazy-loaded, so switching to a tab and captioning it immediately
// put the line over a half-drawn list — and on the cooking beat the art is the
// whole point of the shot.
const waitForImages = tabId => ev(async id => {
  const page = document.getElementById(id);
  if (!page) return 0;
  const imgs = [...page.querySelectorAll('img')];
  imgs.forEach(im => { im.loading = 'eager'; });
  await Promise.race([
    Promise.all(imgs.map(im => (im.complete ? null : im.decode().catch(() => {})))),
    new Promise(r => setTimeout(r, 1600)),
  ]);
  return imgs.length;
}, tabId);

const toPlayScreen = () => ev(() => {
  try { closeSkillChoiceScreen(); } catch (e) {}
  try { closeTabPageFullscreen(); } catch (e) {}
  try { switchTab('shopTab'); } catch (e) {}
});

// Killing a monster pops the reward dialog, which dims the whole screen and sits
// over the very thing the beat is about — and its backdrop swallows the taps
// aimed at the next monster. It is kept out of the take from the first frame.
const hideRewardModal = () => ev(() => {
  const rm = document.getElementById('rewardModal');
  if (rm) rm.style.setProperty('display', 'none', 'important');
});

// Eases the tab page's list downward while a beat plays. Four panel screens back
// to back is a long stretch of stillness in the middle of a Short; keeping the
// content moving also shows there is more below the fold than fits the frame.
// `to` is a fraction of the scrollable range; pass {by} instead to drift a
// fraction of one screenful from wherever the page already is, which is what the
// 一覧 beat needs — an absolute target sails straight past the block of numbers
// the caption is pointing at.
const autoScroll = (tabId, to, ms) => ev(([id, target, dur]) => {
  const page = document.getElementById(id);
  if (!page) return;
  const boxes = [...page.querySelectorAll('*')].filter(el => el.scrollHeight > el.clientHeight + 40);
  const box = boxes.sort((a, b) =>
    (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
  if (!box) return;
  const from = box.scrollTop;
  const to = target && target.by !== undefined
    ? Math.min(box.scrollHeight - box.clientHeight, from + box.clientHeight * target.by)
    : (box.scrollHeight - box.clientHeight) * target;
  const t0 = performance.now();
  return new Promise(res => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      box.scrollTop = from + (to - from) * (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2);
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}, [tabId, to, ms]);

// Scrolls a tab page so the section with the given heading is at the top. The
// part of 一覧 worth showing (the wall of live multipliers) sits well below the
// fold, and its offset moves with how much content is unlocked.
const scrollToHeading = (tabId, text) => ev(([id, t]) => {
  const page = document.getElementById(id);
  if (!page) return 'no page';
  const box = [...page.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 40);
  const head = [...page.querySelectorAll('h1,h2,h3,h4,b,strong,div,span')]
    .find(el => el.textContent.trim() === t);
  if (!box || !head) return `box=${!!box} head=${!!head}`;
  box.scrollTop += head.getBoundingClientRect().top - box.getBoundingClientRect().top;
  return 'ok';
}, [tabId, text]);

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
await top(VARIANT.hook.banner);
await cap(VARIANT.hook.caption);
await page.waitForTimeout(350);   // let the text animate in behind the cover
await ev(() => window.__cover(false));
// The grid holds whatever frame was last captured, and the screencast only
// samples about every 50ms — arming the instant the cover lifts can leave slot
// zero holding the cover itself, opening the Short on a black frame. Wait for
// the uncovered screen to paint and then to be sampled before starting.
await ev(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.waitForTimeout(90);
coverOffAt = Date.now();
if (capture) capture.arm(coverOffAt);
console.log(`  cut: ${VARIANT.id}`);
console.log('  audio:', await ev(() => window.__startRec()));
await shot('hook');
// Pre-setting the text means the opening frames would otherwise be motionless.
// Tapping the cookie gives the hook real movement — floating numbers and the
// game's own click — instead of a still frame with a caption on it.
if (VARIANT.hook.taps) await tapBurst('#cookie', 4, 340);
await wait(VARIANT.hook.taps ? 1100 : 2300);

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

// =============================================================== SCENE 4 — 討伐
// Golden cookie first (the field cookie visibly swells), then a swarm and a boss
// on screen together — the busiest, most alive frame in the game.
await flash();
await top(null);
await cap(['<em>金のクッキー</em>で生産が跳ねて'], 'high');
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

await ev(() => { state.huntFocusLv = 0; });

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

// =============================================================== SCENE 9 — CTA
await top(null);
await cap([]);
// 「クローズドテスト中」は"未完成でまだ遊べない"、「テスター募集」は"報告作業が
// ある"と読まれやすい。募集の理由(公開に必要)と、実際にやること(入れたままに
// するだけ)と、対象(Android)を先に出して、行動だけを赤枠に残す。
await ev(() => window.__end(
  'クッキーストラテジャー',
  // 「14日間」と「基本プレイ無料」が隣り合っていると、14日間だけ無料と読める。
  '基本プレイ無料・<u>Android</u>版<br>公開に必要なテスターを募集しています<br>やることは 14日間 入れたままにするだけ',
  '応募方法は<em>チャンネル概要欄</em>に'));
await shot('cta');
await wait(3900);   // a beat after the last word, so the loop does not cut it off
mark('scene9 / total');

// Close on the same hard-edged cover that opened the take. Both edges are exact
// frames in the capture and exact instants on the wall clock, which is how the
// encoder maps one timeline onto the other.
await ev(() => window.__cover(true));
const coverOnAt = Date.now();
if (capture) capture.end(coverOnAt);
await page.waitForTimeout(1400);
const levels = await ev(() => window.__levels());
const audioB64 = await ev(() => window.__stopRec());
const rec = capture ? await capture.finish() : null;
const takeSec = (coverOnAt - coverOffAt) / 1000;
await ctx.close();
await browser.close();

if (!SHOTS) {
  const audioFile = `${OUT}/audio.webm`;
  if (audioB64) fs.writeFileSync(audioFile, Buffer.from(audioB64, 'base64'));
  fs.writeFileSync('trim.json', JSON.stringify({
    frames: rec.dir, fps: rec.fps, frameCount: rec.frames,
    audio: audioB64 ? audioFile : null, takeSec, flashLog, markLog, variant: VARIANT.id,
  }, null, 2));
  console.log(`frames ${rec.frames} @${rec.fps}fps (${(rec.frames / rec.fps).toFixed(2)}s)`,
    `| take ${takeSec.toFixed(2)}s`,
    `| audio ${audioB64 ? (fs.statSync(audioFile).size / 1e6).toFixed(2) + 'MB' : 'MISSING'}`,
    rec.dropped ? `| ${rec.dropped} empty slots` : '');
  if (levels) {
    console.log(`audio level: peak ${levels.peakDb.toFixed(1)}dBFS, rms ${levels.rmsDb.toFixed(1)}dBFS` +
      (levels.clippedFrames ? `, CLIPPED in ${levels.clippedFrames}/${levels.samples} windows` : ', no clipping'));
  }
} else {
  console.log('shots:', shotN);
}
