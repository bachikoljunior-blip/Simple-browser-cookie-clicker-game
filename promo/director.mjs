// Records the YouTube Shorts promo for クッキーストラテジャー.
//   node director.mjs         -> records video/*.webm at 1080x1920 (+ trim.json)
//   node director.mjs shots   -> no video, one screenshot per beat for review
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { startCapture } from './screencap.mjs';

const SHOTS = process.argv[2] === 'shots';
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
const FPS = 20;
const capture = SHOTS ? null : await startCapture(await ctx.newCDPSession(page),
  { dir: `${OUT}/frames`, fps: FPS, quality: 82, width: W, height: H });

let shotN = 0;
let coverOffAt = 0;
const shot = async (tag) => { if (SHOTS) await page.screenshot({ path: `beat_${String(++shotN).padStart(2, '0')}_${tag}.png` }); };
const mark = tag => console.log(`  ${((Date.now() - (coverOffAt || recStart)) / 1000).toFixed(1)}s  ${tag}`);
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

await page.goto(URL, { waitUntil: 'load' });
await page.addScriptTag({ content: overlaySrc });
await ev(() => window.__promoInstall());
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
const showTab = (id, full) => ev(([tabId, f]) => {
  switchTab(tabId);
  if (f) toggleTabPageFullscreen(tabId);
  else closeTabPageFullscreen();
}, [id, !!full]);

// The play area either shares the frame with a tab panel or takes the whole of
// it. Anything whose subject lives on the play field — the quota gauge, the
// golden cookie, the monsters — reads far better with the panel out of the way,
// so those scenes claim the frame instead of sitting in the top third of it.
const setPlayFullscreen = on => ev(want => {
  const isOn = document.body.classList.contains('playFullscreenMode');
  if (isOn !== want) { try { togglePlayFullscreen(); } catch (e) { return String(e); } }
}, on);

const toPlayScreen = () => ev(() => {
  try { closeSkillChoiceScreen(); } catch (e) {}
  try { closeTabPageFullscreen(); } catch (e) {}
  try { switchTab('shopTab'); } catch (e) {}
  // A monster kill queues a reward popup that would land on the closing shot.
  const rm = document.getElementById('rewardModal');
  if (rm) rm.style.display = 'none';
});

// A kill can queue the reward popup on top of whatever is being shown.
const hideRewardModal = () => ev(() => {
  const rm = document.getElementById('rewardModal');
  if (rm) rm.style.display = 'none';
});

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
await showTab('shopTab', false);
await setPlayFullscreen(true);
await page.waitForTimeout(400);
// Lift the music bed well above the game's own ceiling. Without it the take is
// mostly silence with occasional spikes: quiet enough that YouTube's loudness
// normalisation turns it up, which only makes the spikes worse.
await ev(() => {
  settings.bgmVolume = 100;
  settings.seVolume = 100;
  try { if (bgmGainNode) bgmGainNode.gain.value = 0.42; } catch (e) {}
});
await top('“正”って単位、知ってます?');
await cap(['所持クッキー <em>100正</em>', '= 10の<em>42</em>乗']);
await page.waitForTimeout(350);   // let the text animate in behind the cover
await ev(() => window.__cover(false));
coverOffAt = Date.now();
if (capture) capture.arm(coverOffAt);
console.log('  audio:', await ev(() => window.__startRec()));
await shot('hook');
await wait(2400);

// =============================================================== SCENE 2 — rewind
await flash();
await cap([]);
await top('⏪ 最初はこう', 'hi');
await setPlayFullscreen(false);
await setFresh();
await page.waitForTimeout(200);
await cap(['スタートは<em>クッキー25枚</em>']);
await shot('rewind');
await wait(1200);

await top(null);
await cap(['タップ1回 = <em>1クッキー</em>']);
await tapBurst('#cookie', 10, 60);
await shot('taps');
await wait(400);

await grant('120000');
await cap(['設備を買うと<em>毎秒</em>が増える', 'ここまでは<b>ふつうの放置ゲー</b>']);
await wait(300);
for (const nth of [0, 1, 2]) {
  await tapEl(`#shop .item >> nth=${nth}`);
  await wait(200);
}
await shot('buy');
await wait(400);
mark('scene2');

// =============================================================== SCENE 3 — ノルマ
// The one mechanic no other idle clicker has. Stated as a consequence, not a rule.
await flash();
await setMidGame();
await toPlayScreen();
await setPlayFullscreen(true);
await top('ここからが本題');
await cap(['<em>「モンスター生成ノルマ」</em>があります', '生産が遅れると<b>モンスターが来なくなる</b>']);
await shot('quota');
await wait(2200);
await cap(['<em>放置ゲーなのに、放置したら終わる</em>']);
await shot('quota2');
await wait(1600);
mark('scene3');

// =============================================================== SCENE 4 — 討伐
// Golden cookie first (the field cookie visibly swells), then a swarm and a boss
// on screen together — the busiest, most alive frame in the game.
await flash();
await top(null);
await cap(['<em>金のクッキー</em>で生産が跳ねて'], 'high');
await ev(() => { try { showGoldenCookie(); } catch (e) { return String(e); } });
await wait(1300);
await tapEl('#goldenCookie');
await shot('golden');
await wait(1000);

await cap(['<em>モンスター</em>を殴ると素材が出る', '群れも<b>ボス</b>も来ます'], 'high');
await ev(() => {
  try { showMonster('swarm'); showMonster('boss'); } catch (e) { return String(e); }
});
await wait(1100);
await shot('monster');
await tapBurst('.monsterInstance', 6, 90);
await wait(700);
await hideRewardModal();
mark('scene4');

// =============================================================== SCENE 5 — 工房
// 486 recipes is a genuinely surprising number for a clicker, and the cooking
// list pays off the ノルマ beat: one dish slows the quota clock down.
await flash();
await setPlayFullscreen(false);
await setLateGame();
await showTab('workshopTab', true);
await wait(600);
await top('素材の使い道', 'hi');
await cap(['集めた素材で<em>装備</em>を作る', 'レシピは<em>486種類</em>']);
await shot('craft');
await wait(1900);

await tapEl('#workshopPanel >> text=料理');
await wait(700);
await top(null);
await cap(['<em>料理</em>は<b>ノルマの進行を遅くする</b>', '金のクッキーを出やすくする一皿も']);
await shot('cook');
await wait(2200);
mark('scene5');

// =============================================================== SCENE 6 — 研究 / 一覧
await flash();
await showTab('researchTab', true);
await wait(600);
await cap(['<em>研究</em>で<b>生産の計算式</b>を書き換えて']);
await shot('research');
await wait(1600);

await showTab('infoTab', true);
await wait(500);
console.log('  info scroll:', await scrollToHeading('infoTab', '現在の倍率・状態'));
await wait(400);
await cap(['効いている倍率は<em>全部この画面で見られる</em>']);
await shot('info');
await wait(2100);
mark('scene6');

// =============================================================== SCENE 7 — 転生スキルツリー
await flash();
await top(null);
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
await wait(300);
await cap(['転生すると<em>スキルツリー</em>', 'ノードは<em>71個</em>']);
const pan = ev(async () => {
  const f = document.querySelector('.skillMapFrame');
  const max = f.scrollHeight - f.clientHeight;
  const t0 = performance.now(), dur = 3900;
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
await wait(1900);
await cap(['取る順番で<b>次の周回が別ゲー</b>に', '何度でも組み直せます']);
await shot('tree2');
await wait(1900);
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
await wait(2200);
mark('scene8');

// =============================================================== SCENE 9 — CTA
await top(null);
await cap([]);
await ev(() => window.__end(
  'クッキーストラテジャー',
  'Google Play <u>クローズドテスト中</u><br>基本プレイ無料・広告なし',
  '<em>テスターを募集しています</em><br>応募方法はチャンネル概要欄に'));
await shot('cta');
await wait(3600);
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
    audio: audioB64 ? audioFile : null, takeSec, flashLog,
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
