"use strict";
/**
 * コンポジタ(compositor.html)を 1 フレームずつ進めて撮り、動画に焼く。
 *
 * 見た目は timeline.js が時刻 t の関数として決めているので、ここは
 * 「t を渡す → 1 枚撮る」を繰り返すだけ。実時間に依存しないので何度回しても同じ絵になる。
 *
 *   node promo/render-video.js [--url http://127.0.0.1:8123/promo/compositor.html]
 *                              [--out promo/build] [--range 0:6]
 */

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const { chromium } = require(path.join(__dirname, "..", "node_modules", "playwright-core"));

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes("--" + n);

const URL = arg("url", "http://127.0.0.1:8123/promo/compositor.html");
const OUT = path.resolve(arg("out", path.join(__dirname, "build")));
const COMP = path.join(OUT, "comp");
const RANGE = arg("range", null); // "秒:秒" 部分レンダ(確認用)
const FFMPEG = arg("ffmpeg", "ffmpeg");

async function main() {
  fs.rmSync(COMP, { recursive: true, force: true });
  fs.mkdirSync(COMP, { recursive: true });

  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--font-render-hinting=none", "--disable-lcd-text", "--hide-scrollbars", "--force-device-scale-factor=1"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1080, height: 1920 },
    deviceScaleFactor: 1,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  [page error]", String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.log("  [console]", m.text().slice(0, 200)); });

  await page.goto(URL, { waitUntil: "load" });
  await page.evaluate(() => window.__promo.init());
  const meta = await page.evaluate(() => ({ d: window.__promo.DURATION, fps: window.__promo.FPS }));
  console.log(`timeline: ${meta.d}s @ ${meta.fps}fps`);

  let from = 0;
  let to = meta.d;
  if (RANGE) { const [a, b] = RANGE.split(":").map(Number); from = a; to = b; }

  const first = Math.round(from * meta.fps);
  const last = Math.round(to * meta.fps);
  const total = last - first;
  const t0 = Date.now();

  for (let i = first; i < last; i++) {
    const t = i / meta.fps;
    await page.evaluate((tt) => window.__promo.seek(tt), t);
    await page.screenshot({
      path: path.join(COMP, String(i - first + 1).padStart(5, "0") + ".jpg"),
      type: "jpeg",
      quality: 94,
    });
    if ((i - first) % 60 === 0 || i === last - 1) {
      const done = i - first + 1;
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`  frame ${done}/${total}  ${(done / el).toFixed(1)}fps  eta ${(((total - done) / (done / el)) | 0)}s\n`);
    }
  }
  await browser.close();

  const mp4 = path.join(OUT, RANGE ? "preview.mp4" : "promo_shorts_1080x1920.mp4");
  console.log("encoding ->", mp4);
  execFileSync(FFMPEG, [
    "-y", "-loglevel", "error",
    "-framerate", String(meta.fps),
    "-i", path.join(COMP, "%05d.jpg"),
    "-c:v", "libx264", "-preset", "slow", "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-level", "4.2",
    "-movflags", "+faststart",
    "-r", String(meta.fps),
    mp4,
  ], { stdio: "inherit" });
  console.log("done:", mp4, (fs.statSync(mp4).size / 1e6).toFixed(1) + "MB");
}

main().catch((e) => { console.error(e); process.exit(1); });
