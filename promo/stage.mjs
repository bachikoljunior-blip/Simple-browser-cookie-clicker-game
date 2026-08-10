// Everything both formats need to drive the game and record it.
//
// The Shorts director and the long-form director disagree about almost
// everything above this line — frame shape, pacing, how many things one video is
// allowed to say — and about nothing below it. Opening the browser, clearing the
// title screen under a black cover, building a plausible save, tapping, waiting
// for lazily-loaded panel art, and laying frames onto a real-time grid are the
// same work either way, and the parts of it that are subtle (see the comments on
// flash() and hitMonsters()) are subtle in both.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { startCapture } from './screencap.mjs';

const CHROME = process.env.PROMO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.PROMO_URL || 'http://localhost:8765/play.html';

/**
 * Boots the game, hides it behind a cover, and hands back the tools to shoot it.
 *
 * `overlay` is the caption layer to inject — the two formats put text in
 * different places, so each brings its own. It must define the same hooks
 * (__cap, __top, __flash, __cover, __end, __ring, __promoInstall).
 *
 * The take does not start here. Call `begin()` when the first screen is built,
 * so frame zero is a finished picture rather than whatever was half-drawn.
 */
export async function openStage({ width, height, fps = 20, quality = 95,
                                  overlay, mobile = true, shots = false, out = 'video' }) {
  const overlaySrc = fs.readFileSync(overlay, 'utf8');
  const audioTapSrc = fs.readFileSync('audiotap.js', 'utf8');

  // 注入するスクリプトの構文を、注入する前に見る。
  //
  // なぜ（2026-08-11 に踏んだ）: overlay.js の CSS はテンプレートリテラルの中に
  // あり、コメントにバッククォートを1つ書いたら**そこで文字列が終わって**
  // ファイル全体が壊れた。`addScriptTag` は壊れたスクリプトを黙って飲み、
  // 苦情は次の行の **`window.__promoInstall is not a function`** として出る。
  // 原因（構文）と症状（関数が無い）が離れているので、`__promoInstall` の定義や
  // 注入の順番を疑うことになる。**実際そこで1往復した。**
  //
  // `new Function` は本文をパースするだけで実行しない。壊れていれば
  // SyntaxError が行番号つきで出て、**撮影の前に止まる**（印字ではなく停止）。
  for (const [name, src] of [[overlay, overlaySrc], ['audiotap.js', audioTapSrc]]) {
    try { new Function(src); }
    catch (e) { throw new Error(`${name} の構文が壊れています: ${e.message}`); }
  }

  const browser = await chromium.launch({
    ...(fs.existsSync(CHROME) ? { executablePath: CHROME } : {}),
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: true,
  });
  await ctx.addInitScript({ content: audioTapSrc + '\nwindow.__installAudioTap();' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));

  // Frames are laid onto a fixed real-time grid rather than written by
  // Playwright, so the soundtrack recorded alongside them lines up exactly.
  // Chromium's headless screencast is capped near 19.5fps whatever the page or
  // the resolution, so the grid runs at 20: close enough that slots rarely have
  // to repeat a frame, which keeps the cadence even. The screencast also only
  // ever hands back frames at the CSS viewport size, so that size is the ceiling
  // on detail and the JPEG quality is what decides whether small text survives.
  const capture = shots ? null : await startCapture(await ctx.newCDPSession(page),
    { dir: `${out}/frames`, fps, quality, width, height });

  const ev = (fn, arg) => page.evaluate(fn, arg);
  let coverOffAt = 0;
  let shotN = 0;

  // In stills mode every hold collapses so a full pass takes seconds instead of
  // minutes — but not below the length of the cut flash (.36s) plus the caption
  // animation, or every screenshot catches a half-faded white frame with the
  // text still at zero opacity.
  const wait = ms => page.waitForTimeout(shots ? Math.min(ms, 620) : ms);
  const shot = async tag => {
    if (shots) await page.screenshot({ path: `beat_${String(++shotN).padStart(2, '0')}_${tag}.png` });
  };

  // Beat boundaries are needed later to place the narration, so they are
  // recorded as well as printed. Each mark is the moment its beat finished.
  const markLog = {};
  const mark = tag => {
    const t = (Date.now() - coverOffAt) / 1000;
    markLog[tag.split(' ')[0]] = t;
    console.log(`  ${t.toFixed(1)}s  ${tag}`);
  };

  const cap = (lines, pos) => ev(([l, p]) => window.__cap(l, p), [lines, pos || null]);
  const top = (html, pos) => ev(([h, p]) => window.__top(h, p), [html, pos || null]);

  // Every flash is also a sync mark: the white frame and the transition sound
  // are fired together, so their wall times let the encoder line the two tracks
  // up.
  //
  // The sound starts the instant it is asked for, but the white frame only
  // appears at the next paint — and the scene changes that follow a cut rebuild
  // enough DOM to block painting for a few hundred milliseconds. Waiting for the
  // flash to actually reach the screen before returning keeps the two together,
  // and means the rebuild happens behind the white instead of in front of it.
  const flashLog = [];
  const flash = async kind => {
    await ev(k => {
      // A flash always starts a new beat, so the outgoing line goes with it.
      // Some beats take over a second to build their screen, and a caption left
      // up through that describes whatever happens to be underneath it.
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
    for (let i = 0; i < times; i++) { await tapAt(x, y); await wait(gap); }
    return true;
  }

  // Hits whatever monster is currently on the field, moving on to the next as
  // they die. This goes through the game's own hit handler rather than a tap at
  // the sprite's coordinates: the golden-cookie buff swells the centre cookie
  // until it covers the monsters, so coordinate taps land on the cookie and the
  // monsters never take damage. The finger ring is still drawn where it is.
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
  await page.waitForTimeout(1200);

  // Audio gate + title are cleared under the black cover so the video opens on
  // gameplay rather than on a button nobody in the audience can press.
  await page.mouse.click(width / 2, height / 2);
  await page.waitForTimeout(400);
  await ev(() => { try { startGameFromTitle(); } catch (e) { return String(e); } });
  await page.waitForTimeout(1200);

  // freshState() predates a few fields (eq2Seen, eq2Owned, msResearch, ...) that
  // the real load path back-fills. Snapshot them at boot so a rewind can restore
  // them.
  await ev(() => {
    const base = freshState();
    const extras = {};
    Object.keys(state).forEach(k => { if (!(k in base)) extras[k] = state[k]; });
    window.__extras = JSON.parse(JSON.stringify(extras));
  });

  // ------------------------------------------------------------ save states
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

  // ------------------------------------------------------------ screens
  // Changing the screen clears the caption: setting up the next one takes long
  // enough that the previous line would otherwise sit over it for the best part
  // of a second, describing something no longer there.
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
  // golden cookie, the monsters — reads better with the panel out of the way.
  const setPlayFullscreen = on => ev(want => {
    const isOn = document.body.classList.contains('playFullscreenMode');
    if (isOn !== want) { try { togglePlayFullscreen(); } catch (e) { return String(e); } }
  }, on);

  // Panel art is lazy-loaded, so switching to a tab and captioning it
  // immediately puts the line over a half-drawn list — and on the cooking beat
  // the art is the whole point of the shot.
  const waitForImages = tabId => ev(async id => {
    const el = document.getElementById(id);
    if (!el) return 0;
    const imgs = [...el.querySelectorAll('img')];
    imgs.forEach(im => { im.loading = 'eager'; });
    await Promise.race([
      Promise.all(imgs.map(im => (im.complete ? null : im.decode().catch(() => {})))),
      new Promise(r => setTimeout(r, 1600)),
    ]);
    return imgs.length;
  }, tabId);

  // Cooking has no tab of its own — it is a panel inside the workshop, reached
  // by a button that scrolls out of view, so the list is sent back to the top
  // before reaching for it.
  const showCooking = async () => {
    await setSkills();
    await showTab('workshopTab', true);
    await ev(() => {
      const el = document.getElementById('workshopTab');
      if (el) [...el.querySelectorAll('*')].forEach(n => {
        if (n.scrollHeight > n.clientHeight + 40) n.scrollTop = 0;
      });
    });
    await wait(250);
    // Selected by its data attribute, not by its label. The panel renders both
    // section switches as plain .item buttons and also prints 料理 as a heading
    // in the locked-state box, so matching on text picks up whichever came
    // first. Clicked through the DOM because the switch is wired to click and a
    // synthetic touch at its coordinates does nothing.
    const ok = await ev(() => {
      const b = document.querySelector('[data-wssub="dish"]');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      window.__ring(r.x + r.width / 2, r.y + r.height / 2);
      b.click();
      return true;
    });
    if (!ok) console.log('no 料理 button');
    await waitForImages('workshopTab');
  };

  // Cooking is gated behind a skill, so on a mid-game save the 料理 switch is
  // present, clickable, and does nothing — which looked like a broken selector
  // for three takes. Unlocking the tree without touching the counters keeps the
  // save reading as mid-game while the panel is actually reachable.
  const setSkills = () => ev(() => {
    SKILLS.forEach(x => { state.skills[x.id] = true; });
    try { renderActiveTab(); } catch (e) {}
  });

  // The workshop is a wall of greyed-out buttons without materials, and every
  // beat that shows crafting is about what can be made rather than what cannot.
  // Kept separate from setLateGame so a mid-game save can show a stocked
  // workshop without its cookie counter jumping thirty orders of magnitude.
  const setMaterials = (n = 999) => ev(k => {
    MATERIALS.forEach(m => { state.materials[m.id] = k; state.materialsSeen[m.id] = true; });
    try { renderActiveTab(); } catch (e) {}
  }, n);

  const toPlayScreen = () => ev(() => {
    try { closeSkillChoiceScreen(); } catch (e) {}
    try { closeTabPageFullscreen(); } catch (e) {}
    try { switchTab('shopTab'); } catch (e) {}
  });

  // Killing a monster pops the reward dialog, which dims the whole screen and
  // sits over the very thing the beat is about — and its backdrop swallows the
  // taps aimed at the next monster. It is kept out of the take from frame one.
  const hideRewardModal = () => ev(() => {
    const rm = document.getElementById('rewardModal');
    if (rm) rm.style.setProperty('display', 'none', 'important');
  });

  // Eases a tab page's list downward while a beat plays, so a run of panel
  // screens is not a long stretch of stillness, and so it is visible that there
  // is more below the fold than fits. `to` is a fraction of the scrollable
  // range; pass {by} instead to drift a fraction of one screenful from wherever
  // the page already is — an absolute target sails straight past a block of
  // numbers a caption is pointing at.
  const autoScroll = (tabId, to, ms) => ev(([id, target, dur]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const boxes = [...el.querySelectorAll('*')].filter(n => n.scrollHeight > n.clientHeight + 40);
    const box = boxes.sort((a, b) =>
      (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
    if (!box) return;
    const from = box.scrollTop;
    const dest = target && target.by !== undefined
      ? Math.min(box.scrollHeight - box.clientHeight, from + box.clientHeight * target.by)
      : (box.scrollHeight - box.clientHeight) * target;
    const t0 = performance.now();
    return new Promise(res => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        box.scrollTop = from + (dest - from) * (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }, [tabId, to, ms]);

  // Scrolls a tab page so the section with the given heading is at the top. The
  // part of 一覧 worth showing (the wall of live multipliers) sits well below
  // the fold, and its offset moves with how much content is unlocked.
  const scrollToHeading = (tabId, text) => ev(([id, t]) => {
    const el = document.getElementById(id);
    if (!el) return 'no page';
    const box = [...el.querySelectorAll('*')].find(n => n.scrollHeight > n.clientHeight + 40);
    const head = [...el.querySelectorAll('h1,h2,h3,h4,b,strong,div,span')]
      .find(n => n.textContent.trim() === t);
    if (!box || !head) return `box=${!!box} head=${!!head}`;
    box.scrollTop += head.getBoundingClientRect().top - box.getBoundingClientRect().top;
    return 'ok';
  }, [tabId, text]);

  // ------------------------------------------------------------ skill tree
  // The tree is its own fullscreen view, drawn with requestFullscreen(), so
  // nothing outside it renders and the caption layer has to move inside. Zoom is
  // set explicitly because the default fits one branch and the point of showing
  // the tree at all is how many there are.
  const openTree = async (zoom = 0.45) => {
    await ev(() => { try { closeTabPageFullscreen(); openSkillTreeView(); } catch (e) { return String(e); } });
    await wait(700);
    await tapEl('#skillTreeOnlyBtn');
    await wait(600);
    await ev(() => window.__mount('#skillChoiceScreen'));
    await ev(z => {
      setSkillMapZoom(z, false);
      const f = document.querySelector('.skillMapFrame');
      if (!f) return;
      f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;
      f.scrollTop = (f.scrollHeight - f.clientHeight) * 0.35;
    }, zoom);
    await wait(400);
  };

  // Eases the map to a vertical position given as a fraction of its range. The
  // tree is 2120x3320, so panning is the only way a frame ever contains enough
  // of it to read as "a lot".
  const panTree = (to, ms = 2600) => ev(([target, dur]) => {
    const f = document.querySelector('.skillMapFrame');
    if (!f) return;
    const from = f.scrollTop;
    const dest = (f.scrollHeight - f.clientHeight) * target;
    const t0 = performance.now();
    return new Promise(res => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / dur);
        f.scrollTop = from + (dest - from) * (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2);
        if (k < 1) requestAnimationFrame(step); else res();
      };
      requestAnimationFrame(step);
    });
  }, [to, ms]);

  const closeTree = async () => {
    await ev(() => { try { closeSkillChoiceScreen(); } catch (e) {} window.__mount(); });
    await wait(400);
  };

  /**
   * Lifts the cover and starts the clock. Everything before this happened in the
   * dark, which is the point: the first frame is a finished screen.
   *
   * The take starts when the browser is seen to be delivering the uncovered
   * screen, not when the cover is switched off. Those are different instants —
   * the screencast kept sending the cover for 90ms after the DOM change in the
   * one case that was measured, and longer on a page that had just been rebuilt
   * — and anchoring on the DOM change opened the video on black.
   *
   * Waiting here rather than subtracting a fixed offset keeps every other
   * timeline honest: beat marks, the take length and the soundtrack are all
   * measured from coverOffAt, so moving it to the truth moves them with it.
   */
  async function begin() {
    await ev(() => window.__cover(false));
    await ev(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (capture) await capture.waitForChange();
    coverOffAt = Date.now();
    if (capture) capture.arm(coverOffAt);
    return coverOffAt;
  }

  /**
   * Closes on the same hard-edged cover that opened the take. Both edges are
   * exact frames in the capture and exact instants on the wall clock, which is
   * how the encoder maps one timeline onto the other.
   */
  async function finish(extra = {}) {
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
    if (shots) { console.log('shots:', shotN); return null; }

    const audioFile = `${out}/audio.webm`;
    if (audioB64) fs.writeFileSync(audioFile, Buffer.from(audioB64, 'base64'));
    const trim = {
      frames: rec.dir, fps: rec.fps, frameCount: rec.frames,
      audio: audioB64 ? audioFile : null, takeSec, flashLog, markLog,
      width, height, ...extra,
    };
    fs.writeFileSync('trim.json', JSON.stringify(trim, null, 2));
    console.log(`frames ${rec.frames} @${rec.fps}fps (${(rec.frames / rec.fps).toFixed(2)}s)`,
      `| take ${takeSec.toFixed(2)}s`,
      `| audio ${audioB64 ? (fs.statSync(audioFile).size / 1e6).toFixed(2) + 'MB' : 'MISSING'}`,
      rec.dropped ? `| ${rec.dropped} empty slots` : '');
    if (levels) {
      console.log(`audio level: peak ${levels.peakDb.toFixed(1)}dBFS, rms ${levels.rmsDb.toFixed(1)}dBFS` +
        (levels.clippedFrames ? `, CLIPPED in ${levels.clippedFrames}/${levels.samples} windows`
          : ', no clipping'));
    }
    return trim;
  }

  return {
    page, ev, wait, shot, mark, markLog, flash, flashLog, cap, top,
    tapAt, tapEl, tapBurst, hitMonsters,
    setLateGame, setFresh, setMidGame, grant,
    showTab, setPlayFullscreen, waitForImages, toPlayScreen, hideRewardModal, showCooking, setMaterials, setSkills,
    autoScroll, scrollToHeading, openTree, panTree, closeTree,
    begin, finish,
    get startedAt() { return coverOffAt; },
  };
}
