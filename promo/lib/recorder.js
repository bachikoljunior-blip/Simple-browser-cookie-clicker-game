"use strict";
/**
 * CDP スクリーンキャストで「実際に動いているゲーム画面」を JPEG の連番フレームとして
 * 取り込むための小さなレコーダ。
 *
 * Chromium は画面が変化したときだけフレームを push してくるので、届いたフレームには
 * 実時刻(metadata.timestamp)を持たせておき、最後に固定 fps へリサンプルする。
 * こうすると「収録は可変フレーム / 出力は等間隔」になり、ffmpeg 側で素直に扱える。
 */

const fs = require("fs");
const path = require("path");

class Recorder {
  constructor(page, { width, height, quality = 92 } = {}) {
    this.page = page;
    this.width = width;
    this.height = height;
    this.quality = quality;
    this.frames = [];   // { t: 秒(単調), buf: Buffer }
    this.client = null;
    this.recording = false;
  }

  async start() {
    this.client = await this.page.context().newCDPSession(this.page);
    this.client.on("Page.screencastFrame", async (ev) => {
      // ack を返さないと次のフレームが来ないので、まず ack。
      try { await this.client.send("Page.screencastFrameAck", { sessionId: ev.sessionId }); } catch (_) {}
      if (!this.recording) return;
      this.frames.push({
        t: ev.metadata.timestamp,
        buf: Buffer.from(ev.data, "base64"),
      });
    });
    await this.client.send("Page.startScreencast", {
      format: "jpeg",
      quality: this.quality,
      maxWidth: this.width,
      maxHeight: this.height,
      everyNthFrame: 1,
    });
    // 最初の 1 フレームが届くまで少し待つ
    await this.page.waitForTimeout(300);
  }

  /** 収録開始。戻り値はこのクリップの基準時刻を得るためのマーカー */
  begin() {
    this.frames = [];
    this.recording = true;
    return Date.now();
  }

  end() {
    this.recording = false;
  }

  async stop() {
    try { await this.client.send("Page.stopScreencast"); } catch (_) {}
  }

  /**
   * 収録済みフレームを fps 等間隔にリサンプルして書き出す。
   * 変化がなくて実フレームが来ていない区間は、直前のフレームを使い回す(=静止)。
   */
  writeClip(dir, name, fps, durationSec) {
    if (!this.frames.length) throw new Error(`no frames captured for ${name}`);
    const outDir = path.join(dir, name);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });

    const t0 = this.frames[0].t;
    const span = durationSec != null
      ? durationSec
      : this.frames[this.frames.length - 1].t - t0;
    const total = Math.max(1, Math.round(span * fps));

    let cursor = 0;
    for (let i = 0; i < total; i++) {
      const want = t0 + i / fps;
      while (cursor + 1 < this.frames.length && this.frames[cursor + 1].t <= want) cursor++;
      const f = this.frames[cursor];
      fs.writeFileSync(path.join(outDir, String(i + 1).padStart(5, "0") + ".jpg"), f.buf);
    }
    const info = { name, fps, frames: total, seconds: total / fps, captured: this.frames.length };
    fs.writeFileSync(path.join(outDir, "clip.json"), JSON.stringify(info, null, 2));
    console.log(`  clip ${name}: ${total}f (${(total / fps).toFixed(2)}s) from ${this.frames.length} raw frames`);
    return info;
  }
}

module.exports = { Recorder };
