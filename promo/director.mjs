// Records the YouTube Shorts promo for クッキーストラテジャー.
//   node director.mjs         -> records video/*.webm at 1080x1920 (+ trim.json)
//   node director.mjs shots   -> no video, one screenshot per beat for review
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const SHOTS = process.argv[2] === 'shots';
// Falls back to whatever playwright-core resolves on its own when this path
// (the browser bundle in the recording container) is not present.
const CHROME = process.env.PROMO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = 'http://localhost:8765/play.html';
const OUT = 'video';
const overlaySrc = fs.readFileSync('overlay.js', 'utf8');

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
  ...(SHOTS ? {} : { recordVideo: { dir: OUT, size: { width: W, height: H } } }),
});
// Recording starts the moment the page exists, so everything before the cover
// lifts is dead footage that gets trimmed off afterwards.
const recStart = Date.now();
const page = await ctx.newPage();
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));

let shotN = 0;
let coverOffAt = 0;
const shot = async (tag) => { if (SHOTS) await page.screenshot({ path: `beat_${String(++shotN).padStart(2, '0')}_${tag}.png` }); };
const mark = tag => console.log(`  ${((Date.now() - (coverOffAt || recStart)) / 1000).toFixed(1)}s  ${tag}`);
// In shots mode every wait collapses so a full pass takes seconds instead of a minute.
const wait = ms => page.waitForTimeout(SHOTS ? Math.min(ms, 200) : ms);
const ev = (fn, arg) => page.evaluate(fn, arg);

const cap = (lines, pos) => ev(([l, p]) => window.__cap(l, p), [lines, pos || null]);
const top = (html, pos) => ev(([h, p]) => window.__top(h, p), [html, pos || null]);
const flash = () => ev(() => window.__flash());

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
  try { renderAllTabs(); } catch (e) {}
});

const setFresh = () => ev(() => {
  state = freshState();
  Object.assign(state, JSON.parse(JSON.stringify(window.__extras)));
  state.cookies = D(25);
  state.runCookies = D(25);
  state.totalCookies = D(25);
  state.totalClicks = 25;
  try { renderAllTabs(); } catch (e) {}
});

const setMidGame = () => ev(() => {
  UPGRADES.slice(0, 7).forEach(u => { state.upgrades[u.id] = 45; });
  state.cookies = D('9.2e8');
  state.runCookies = D('3.1e9');
  state.totalCookies = D('3.1e9');
  state.runStart = Date.now() - 9 * 60 * 1000;
  state.quotaFailed = false;
  try { renderAllTabs(); } catch (e) {}
});

const grant = amt => ev(a => {
  state.cookies = D(a);
  state.runCookies = state.runCookies.add(D(a));
  state.totalCookies = state.totalCookies.add(D(a));
  try { renderAllTabs(); } catch (e) {}
}, amt);

// Play screen = panel at half height. Fullscreen = the tab page fills the frame.
const showTab = (id, full) => ev(([tabId, f]) => {
  switchTab(tabId);
  if (f) toggleTabPageFullscreen(tabId);
  else closeTabPageFullscreen();
}, [id, !!full]);

const toPlayScreen = () => ev(() => {
  try { closeSkillChoiceScreen(); } catch (e) {}
  try { closeTabPageFullscreen(); } catch (e) {}
  try { switchTab('shopTab'); } catch (e) {}
  // A monster kill queues a reward popup that would land on the closing shot.
  const rm = document.getElementById('rewardModal');
  if (rm) rm.style.display = 'none';
});

// =============================================================== SCENE 1 — hook
await setLateGame();
await showTab('shopTab', false);
await page.waitForTimeout(400);
await ev(() => window.__cover(false));
coverOffAt = Date.now();
await page.waitForTimeout(200);
await top('放置ゲーの数字、壊れてます');
await cap(['所持クッキー <em>100正</em>', 'ぜんぶ<em>ブラウザ</em>だけで来ました']);
await shot('hook');
await wait(2300);
mark('scene1');

// =============================================================== SCENE 2 — rewind
await flash();
await cap([]);
await top('⏪ 3分前', 'hi');
await setFresh();
await page.waitForTimeout(200);
await cap(['スタートは<em>クッキー25枚</em>']);
await shot('rewind');
await wait(1300);

await top(null);
await cap(['タップ = 1クッキー。それだけ']);
await tapBurst('#cookie', 10, 60);
await shot('taps');
await wait(400);

// buy the first buildings for real, so the shop rows show owned counts going up
await grant('120000');
await cap(['貯めて<em>設備</em>を買う', '→ <em>毎秒</em>が勝手に増える']);
await wait(400);
for (const nth of [0, 1, 2]) {
  await tapEl(`#shop .item >> nth=${nth}`);
  await wait(200);
}
await shot('buy');
await wait(600);
mark('scene2');

// =============================================================== SCENE 3 — ノルマ
await flash();
await setMidGame();
await toPlayScreen();
await top('本体はここから');
await cap(['<em>「モンスター生成ノルマ」</em>がある', 'ペースを落とすと<b>強化が止まる</b>']);
await shot('quota');
await wait(1900);
await cap(['つまり<em>放置しっぱなしは負け</em>']);
await shot('quota2');
await wait(1700);
mark('scene3');

// =============================================================== SCENE 4 — 金 / モンスター
await flash();
await top(null);
await cap(['<em>金のクッキー</em>で生産が跳ねる']);
await ev(() => { try { showGoldenCookie(); } catch (e) { return String(e); } });
await wait(1300);
await tapEl('#goldenCookie');
await shot('golden');
await wait(1100);

await cap(['<em>クッキーモンスター</em>を倒すと', '素材がドロップ']);
// Forced spawn: the unforced path is gated on quota state and can silently no-op.
await ev(() => { try { showMonster('normal'); } catch (e) { return String(e); } });
await wait(700);
await tapBurst('.monsterInstance', 12, 55);
await shot('monster');
await wait(800);
mark('scene4');

// =============================================================== SCENE 5 — 研究 / 工房
await flash();
await setLateGame();
await showTab('researchTab', true);
await wait(500);
await top('伸ばす手段が多すぎる', 'hi');
await cap(['<em>研究</em>で<b>計算式そのもの</b>を書き換える']);
await shot('research');
await wait(2000);

await showTab('workshopTab', true);
await wait(500);
await cap(['<em>工房</em>で装備を作り、料理を仕込む']);
await shot('workshop');
await wait(1900);
mark('scene5');

// =============================================================== SCENE 6 — 転生スキルツリー
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
await cap(['そして<em>転生</em>。', '<em>70以上</em>のノードのスキルツリー']);
const pan = ev(async () => {
  const f = document.querySelector('.skillMapFrame');
  const max = f.scrollHeight - f.clientHeight;
  const t0 = performance.now(), dur = 4200;
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
await wait(2100);
await cap(['取る順番で<b>次の周回が別ゲー</b>に', '何度でも組み直せます']);
await shot('tree2');
await wait(2100);
await pan;
mark('scene6');

// =============================================================== SCENE 7 — payoff
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
await flash();
await top('で、さっきの数字に戻ります');
await shot('payoff');
await wait(2600);
mark('scene7');

// =============================================================== SCENE 8 — CTA
await top(null);
await cap([]);
await ev(() => window.__end(
  'クッキーストラテジャー',
  'ブラウザで即プレイ・<u>無料</u>・登録不要<br>cookiestrateger.com',
  'Android版の<em>テスター募集中</em><br>応募方法はチャンネル概要欄に'));
await shot('cta');
await wait(3800);
mark('scene8 / total');

await page.waitForTimeout(200);
const trimSec = (coverOffAt - recStart) / 1000;
await ctx.close();
await browser.close();

if (!SHOTS) {
  const f = fs.readdirSync(OUT).filter(n => n.endsWith('.webm'))[0];
  fs.writeFileSync('trim.json', JSON.stringify({ file: `${OUT}/${f}`, trimSec }, null, 2));
  console.log('raw:', `${OUT}/${f}`, (fs.statSync(`${OUT}/${f}`).size / 1e6).toFixed(1) + 'MB', 'head-trim', trimSec.toFixed(2) + 's');
} else {
  console.log('shots:', shotN);
}
