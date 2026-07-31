"use strict";
/**
 * プロモ収録用のゲーム操作ヘルパー。
 *
 * 収録では「実際に動いているゲーム」をそのまま撮る。ただし 0 から始めると数字が
 * 小さすぎて画が持たないので、撮影前だけ state を中盤相当まで進めておく。
 * 進めたあとの操作(タップ・購入・討伐・スキル取得)はすべて通常の入力で行う。
 */

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const VIEWPORT = { width: 540, height: 960 };

async function launchGame(chromium, { url, mute = true } = {}) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      // CDP のスクリーンキャストは CSS ピクセルのまま返してくるので、
      // これを付けて描画面そのものを 2 倍にする(= 1080x1920 の等倍素材が撮れる)
      "--force-device-scale-factor=2",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      "--hide-scrollbars",
      mute ? "--mute-audio" : "",
    ].filter(Boolean),
  });

  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  });

  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [page error]", String(e).slice(0, 200)));

  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(2200);
  // 音声解禁ゲート → タイトル
  await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.waitForTimeout(1200);

  return { browser, ctx, page };
}

/** タイトル画面から実際にゲームを開始する */
async function startRun(page) {
  await page.click("#titleStartBtn");
  await page.waitForTimeout(1800);
  // 周回方針の選択が出る構成なら 1 つ選んでおく
  await page.evaluate(() => {
    const row = document.querySelector("#policyChoiceRow");
    if (row && row.offsetParent !== null) {
      const first = row.querySelector("button, .policyChoiceCard");
      if (first) first.click();
    }
  });
  await page.waitForTimeout(600);
}

/**
 * 撮影用に周回を中盤〜終盤相当まで進める。
 * 直接 state を書いたあと、ゲーム側の再描画を呼んで表示を揃える。
 */
async function seedProgress(page, opts = {}) {
  return page.evaluate((o) => {
    debugMode = true;

    const upgradeCounts = o.upgrades || {};
    Object.keys(upgradeCounts).forEach((id) => {
      if (state.upgrades[id] === undefined) return;
      state.upgrades[id] = upgradeCounts[id];
      state.everUpgrades[id] = true;
    });

    (o.research || []).forEach((id) => {
      if (state.research[id] === undefined) return;
      state.research[id] = true;
      state.everResearch[id] = true;
    });

    (o.skills || []).forEach((id) => {
      if (state.skills[id] === undefined) return;
      state.skills[id] = true;
    });

    if (o.prestige != null) {
      state.prestige = o.prestige;
      state.prestigeTotal = o.prestige * 3;
      state.prestigeBaseTotal = o.prestige * 3;
    }
    if (o.prestigeRuns != null) state.prestigeRuns = o.prestigeRuns;
    if (o.monstersDefeated != null) state.monstersDefeated = o.monstersDefeated;
    if (o.stageUnlocked != null) state.stageUnlocked = o.stageUnlocked;
    if (o.workshopUnlocked) state.workshopUnlocked = true;
    state.prestigeUnlockedEver = true;
    state.quotaActive = true;
    state.quotaFailed = false;

    if (o.cookies) {
      state.cookies = D(o.cookies);
      state.totalCookies = D(o.cookies).mul(12);
      state.runCookies = D(o.cookies).mul(8);
      state.earnEma = D(o.cookies).div(60);
      state.lastSecondEarn = D(o.cookies).div(90);
    }

    debugMode = false;

    try { renderAllTabs(); } catch (_) {}
    try { updateTopOnly(); } catch (_) {}
    try { renderQuota(); } catch (_) {}
    try { applyVisualAssets(); } catch (_) {}

    return {
      cps: (typeof currentCps === "function" && typeof fmt === "function") ? fmt(currentCps()) : "?",
      cookies: typeof fmt === "function" ? fmt(state.cookies) : "?",
    };
  }, opts);
}

/**
 * 「今どこを触っているか」を画面に出すための指マーク。
 * 収録映像だけを見た人にも操作が追えるように、タップのたびに波紋を出す。
 * ゲーム本体には触らず、収録用のオーバーレイを足すだけ。
 */
async function installTouchFx(page) {
  await page.evaluate(() => {
    if (window.__promoTouch) return;
    const style = document.createElement("style");
    // 明るい背景でも暗い背景でも読めるよう、白い芯 + 濃い縁取り + 金色の輪で作る
    style.textContent = `
      #promoTouchLayer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; }
      .promoTouchDot {
        position: absolute; width: 46px; height: 46px; margin: -23px 0 0 -23px;
        border-radius: 50%; background: #fff; border: 5px solid rgba(60,26,0,.9);
        box-shadow: 0 0 0 4px rgba(255,214,110,.95), 0 0 30px 10px rgba(255,170,40,.7);
        animation: promoTouchDot .40s ease-out forwards;
      }
      .promoTouchRing {
        position: absolute; width: 56px; height: 56px; margin: -28px 0 0 -28px;
        border-radius: 50%; border: 7px solid rgba(255,222,140,.98);
        outline: 3px solid rgba(60,26,0,.75); outline-offset: -10px;
        box-shadow: 0 0 26px rgba(255,180,50,.95), inset 0 0 18px rgba(255,190,70,.6);
        animation: promoTouchRing .60s cubic-bezier(.16,.72,.3,1) forwards;
      }
      @keyframes promoTouchDot { 0% { transform: scale(.35); opacity: 1 } 45% { transform: scale(1) } 100% { transform: scale(1.1); opacity: 0 } }
      @keyframes promoTouchRing { from { transform: scale(.4); opacity: 1 } to { transform: scale(2.9); opacity: 0 } }
    `;
    document.head.appendChild(style);

    const layer = document.createElement("div");
    layer.id = "promoTouchLayer";
    document.body.appendChild(layer);

    window.__promoTouch = (x, y) => {
      ["promoTouchDot", "promoTouchRing"].forEach((cls) => {
        const n = document.createElement("div");
        n.className = cls;
        n.style.left = x + "px";
        n.style.top = y + "px";
        layer.appendChild(n);
        setTimeout(() => n.remove(), 700);
      });
    };
  });
}

/** 素の cookies をゲーム内関数で足す(演出中に息切れしないように) */
async function topUp(page, amount) {
  await page.evaluate((a) => { try { earn(D(a)); } catch (_) {} }, amount);
}

async function switchTab(page, tabId) {
  await page.click(`.tab[data-tab="${tabId}"]`);
  await page.waitForTimeout(500);
}

module.exports = { launchGame, startRun, seedProgress, installTouchFx, topUp, switchTab, VIEWPORT, CHROME };
