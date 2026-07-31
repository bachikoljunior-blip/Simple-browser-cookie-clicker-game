"use strict";
/**
 * プロモ用のゲームプレイ素材を収録する。
 *
 * 出す絵はすべて実際に動いているゲームそのもの。撮影前に周回を中盤相当まで進めて
 * おき、そのあとの操作(タップ・購入・討伐・スキル取得)は通常の入力で行う。
 * 収録結果は scene ごとの JPEG 連番として <out>/frames/<scene>/ に落ちる。
 *
 *   node promo/capture-gameplay.js [--url http://127.0.0.1:8123/play.html] [--out promo/build]
 */

const path = require("path");
const fs = require("fs");
const { chromium } = require(path.join(__dirname, "..", "node_modules", "playwright-core"));
const { Recorder } = require("./lib/recorder.js");
const G = require("./lib/game.js");
const SEED = require("./lib/seed.js");

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : def;
};

const URL = arg("url", "http://127.0.0.1:8123/play.html");
const OUT = path.resolve(arg("out", path.join(__dirname, "build")));
const FRAMES = path.join(OUT, "frames");
const FPS = 30;
const W = 1080;
const H = 1920;

const sleep = (page, ms) => page.waitForTimeout(ms);

async function tap(page, x, y, wait = 90) {
  await page.mouse.click(x, y);
  if (wait) await sleep(page, wait);
}

async function centerOf(page, selector) {
  return page.evaluate((sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    if (!b.width || b.bottom < 0 || b.top > innerHeight) return null;
    return [b.x + b.width / 2, b.y + b.height / 2];
  }, selector);
}

/** クッキー連打。位置を散らして「指で叩いている」感を出す */
async function tapCookie(page, times, interval = 95) {
  const box = await page.evaluate(() => {
    const b = document.getElementById("cookie").getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: b.width / 2 };
  });
  for (let i = 0; i < times; i++) {
    const a = (i * 2.399963) % (Math.PI * 2);
    const rr = box.r * 0.42 * ((i % 3) / 3 + 0.25);
    await tap(page, box.x + Math.cos(a) * rr, box.y + Math.sin(a) * rr, interval);
  }
}

/** 全画面タブに入っていたら戻す(全画面中はモンスターも金クッキーも出ない) */
async function exitPageFullscreen(page) {
  await page.evaluate(() => { try { closeTabPageFullscreen(); } catch (_) {} });
  await sleep(page, 400);
}

/** ページ内 rAF で滑らかに動かす(evaluate 往復だとカクつくため) */
function inPageTween(page, ms, bodySource) {
  return page.evaluate(
    ({ ms, src }) =>
      new Promise((resolve) => {
        const apply = new Function("e", src);
        const t0 = performance.now();
        const step = () => {
          const p = Math.min(1, (performance.now() - t0) / ms);
          const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
          apply(e);
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { ms, src: bodySource }
  );
}

async function main() {
  fs.mkdirSync(FRAMES, { recursive: true });

  console.log("launching game ...");
  const { browser, page } = await G.launchGame(chromium, { url: URL });
  await G.startRun(page);
  const seeded = await G.seedProgress(page, SEED);
  console.log("  seeded:", JSON.stringify(seeded));

  await page.evaluate(() => {
    try { closeTabPageFullscreen(); } catch (_) {}
    // 尺を管理したいので、出現は自動任せにせず手動で起こす
    try { clearGoldenSpawnTimer(); } catch (_) {}
    try { clearMonsterSpawnTimer(); } catch (_) {}
  });
  await sleep(page, 1200);

  const rec = new Recorder(page, { width: W, height: H, quality: 90 });
  await rec.start();

  const clips = [];
  /** pre は収録前の下ごしらえ(画面遷移など)。前のシーンの残りが頭に映らないようにする */
  const scene = async (name, seconds, body, pre) => {
    console.log(`scene ${name} ...`);
    if (pre) await pre();
    rec.begin();
    await body();
    rec.end();
    clips.push(rec.writeClip(FRAMES, name, FPS, seconds));
  };

  // ── 1. つかみ: クッキー連打 → 金のクッキー ──────────────────────────
  await scene("tap", 6.0, async () => {
    await tapCookie(page, 16, 100);
    await page.evaluate(() => { try { forceGoldenCookie(); } catch (_) {} });
    await sleep(page, 450);
    const gb = await centerOf(page, "#goldenCookie");
    await tapCookie(page, 5, 95);
    if (gb) await tap(page, gb[0], gb[1], 250);
    await tapCookie(page, 16, 95);
  });

  // ── 2. 設備: まとめ買いで毎秒が跳ねる ────────────────────────────────
  await scene("shop", 8.5, async () => {
    await page.click('.tab[data-tab="shopTab"]');
    await sleep(page, 450);
    await exitPageFullscreen(page);
    // 購入数を x10 に(タブ見出し帯は全画面トグルも兼ねるので押したあと戻す)
    const b10 = await centerOf(page, '.buyModeBtn[data-buymode="10"]');
    if (b10) await tap(page, b10[0], b10[1], 250);
    await exitPageFullscreen(page);
    // 上の「毎秒」が跳ねるのを見せたいので、分割表示のまま買う
    for (const id of ["finger", "grandma", "oven"]) {
      const c = await centerOf(page, `#shop [data-id="${id}"]`);
      if (c) await tap(page, c[0], c[1], 620);
    }
    // 設備は 16 種類ある。全画面にしてカードの厚みを見せる
    await page.evaluate(() => { try { toggleTabPageFullscreen("shopTab"); } catch (_) {} });
    await sleep(page, 500);
    await inPageTween(page, 2600, `
      const s = document.getElementById("shop");
      if (s) s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.62 * e;
    `);
    await sleep(page, 400);
    const cmax = await centerOf(page, '#shop .item.canBuy');
    if (cmax) await tap(page, cmax[0], cmax[1], 700);
    await sleep(page, 300);
  });

  // ── 3. 研究: 仕組みそのものを書き換える ─────────────────────────────
  // 「毎秒」が跳ねるところが主役なので、上のカウンタが見える分割表示のまま買う。
  await scene(
    "research",
    7.5,
    async () => {
      // 未購入で残しておいた本命の研究(反物質・量子)を実際に解放する
      for (const id of ["annihilationCore", "quantumProofing", "antimatterRecipe"]) {
        const c = await page.evaluate((rid) => {
          const e = document.querySelector(`#research .item[data-id="${rid}"]`);
          if (!e) return null;
          e.scrollIntoView({ block: "center" });
          const b = e.getBoundingClientRect();
          if (b.bottom < 0 || b.top > innerHeight) return null;
          return [b.x + b.width / 2, b.y + b.height / 2];
        }, id);
        if (c) await tap(page, c[0], c[1], 1000);
      }
      // そのあと全画面で「研究はこれだけある」を一望させる
      await page.evaluate(() => { try { toggleTabPageFullscreen("researchTab"); } catch (_) {} });
      await sleep(page, 500);
      await inPageTween(page, 2600, `
        const r = document.getElementById("research");
        if (r) r.scrollTop = (r.scrollHeight - r.clientHeight) * 0.5 * e;
      `);
      await sleep(page, 500);
    },
    async () => {
      await page.evaluate(() => { const s = document.getElementById("shop"); if (s) s.scrollTop = 0; });
      await exitPageFullscreen(page);
      await page.click('.tab[data-tab="researchTab"]');
      await sleep(page, 500);
      await exitPageFullscreen(page);
      await page.evaluate(() => { const r = document.getElementById("research"); if (r) r.scrollTop = 0; });
      await sleep(page, 400);
    }
  );

  // ── 4. 討伐: モンスターを叩いて報酬を選ぶ ───────────────────────────
  await scene(
    "monster",
    11.0,
    async () => {
      await sleep(page, 700);
      const mb = await page.evaluate(() => {
        const e = document.querySelector(".monsterInstance");
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      });
      if (mb) {
        for (let i = 0; i < 18; i++) {
          await tap(page, mb.x + ((i % 3) - 1) * 14, mb.y + ((i % 2) - 0.5) * 16, 185);
          if (!(await page.evaluate(() => monsters.length))) break;
        }
      }
      await sleep(page, 900);
      // 報酬モーダル → 開封 → 1 つ選ぶ(どのボタンも pointerdown/up 実装なので実クリックで押す)
      const ok = await centerOf(page, "#rewardConfirmBtn");
      if (ok) await tap(page, ok[0], ok[1], 1500);
      const rc = await centerOf(page, "#rewardChoices .rewardChoice, #rewardChoices button, #rewardChoices .item");
      if (rc) await tap(page, rc[0], rc[1], 1600);
      await sleep(page, 600);
    },
    async () => {
      await exitPageFullscreen(page);
      await page.click('.tab[data-tab="shopTab"]');
      await sleep(page, 400);
      await exitPageFullscreen(page);
      await page.evaluate(() => { const s = document.getElementById("shop"); if (s) s.scrollTop = 0; });
      // 一撃で溶けると絵にならないので、HP をタップ 11 発ぶんに合わせる
      const mres = await page.evaluate(() => {
        showMonster("boss");
        const m = monsters[monsters.length - 1];
        if (!m) return null;
        const dmg = Math.max(1, Math.ceil(monsterBaseDamage() * monsterDamageMultiplier(m)));
        m.maxHp = dmg * 11;
        m.hp = m.maxHp;
        renderMonsterHp(m.id);
        return { hp: m.maxHp, dmg, type: m.typeId };
      });
      console.log("   monster:", JSON.stringify(mres));
      await sleep(page, 500);
    }
  );

  // ── 5. スキルツリー: 引きで 71 ノードを見せる ────────────────────────
  await scene(
    "skilltree",
    10.0,
    async () => {
      await sleep(page, 600);
      // コア付近から一気に引いて、枝が全部見えるところまで下げる
      await inPageTween(page, 3600, `
        const f = document.querySelector(".skillMapFrame");
        const zmin = skillMinZoom();
        const z = 1.15 + (zmin - 1.15) * e;
        setSkillMapZoom(z, false);
        const padX = f.clientWidth / 2, padY = f.clientHeight / 2;
        const cx = 1010 * e + 380 * (1 - e);
        const cy = 1690 * e + 300 * (1 - e);
        f.scrollLeft = Math.max(0, padX + cx * z - f.clientWidth / 2);
        f.scrollTop  = Math.max(0, padY + cy * z - f.clientHeight / 2);
      `);
      await sleep(page, 1400);
      // 引いた画から 1 ノードへ寄って、実際に取得する
      await page.evaluate(() => { try { toggleSkillTreeOnly(); } catch (_) {} });
      await sleep(page, 800);
      await page.evaluate(() => {
        skillViewMode = false; // 閲覧モードのままだと「取得は転生時のみ」で押せない
        const n = document.querySelector(".skillNode.canBuy");
        if (n) { n.scrollIntoView({ block: "center", inline: "center" }); n.click(); }
      });
      await sleep(page, 1000);
      const tb = await centerOf(page, "#takeSelectedSkillBtn");
      if (tb) await tap(page, tb[0], tb[1], 1600);
      await sleep(page, 800);
    },
    async () => {
      await page.evaluate(() => {
        const m = document.getElementById("rewardModal");
        if (m) m.style.display = "none";
        openSkillTreeView();
      });
      await sleep(page, 1000);
      await page.evaluate(() => { try { toggleSkillTreeOnly(); } catch (_) {} });
      await sleep(page, 600);
      await page.evaluate(() => { setSkillMapZoom(1.15, false); centerSkillMapOnCore(); });
      await sleep(page, 600);
    }
  );

  // ── 6. しめ: タイトル画面 ───────────────────────────────────────────
  await scene(
    "title",
    5.0,
    async () => { await sleep(page, 4900); },
    async () => {
      await page.evaluate(() => {
        try { closeSkillChoiceScreen(); } catch (_) {}
        try { returnToTitleScreen(); } catch (_) {}
      });
      await sleep(page, 1200);
    }
  );

  await rec.stop();
  await browser.close();

  fs.writeFileSync(path.join(OUT, "clips.json"), JSON.stringify(clips, null, 2));
  console.log("done ->", FRAMES);
}

main().catch((e) => { console.error(e); process.exit(1); });
