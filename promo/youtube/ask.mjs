#!/usr/bin/env node
/**
 * 参加型の問いを、投稿済みの動画にチャンネル名義のコメントとして置く。
 *
 * なぜこれがあるか（2026-08-10 の探索）:
 *   コメント生涯 0件・登録者 1・伸びは線形。EXPLORE.md の外部実測で、同じ
 *   *Cookie Clicker* を扱う同一チャンネル内の対照が出た —— 参加型だけが
 *   コメントを2桁多く集め、再生も4〜5倍。台帳でいちばん根拠が厚い束が
 *   「戻ってくる理由」で、その中でいちばん安いのがこれ。
 *
 *   `yt.mjs` の `comment()` は前から在ったのに、**一度も呼ばれていなかった。**
 *   書いてあるだけの関数は、印字するだけの検査と同じで仕組みではない（指示7）。
 *   だから「毎回やる手順」ではなく、`autopost.mjs` が投稿の直後に自分で呼ぶ形にし、
 *   既に予約・公開されている本には、このコマンドでまとめて置く。
 *
 * 何を問うか（`ASK` が正本。1か所に置く —— 6か所に散ると片方が古くなる）:
 *   「次にどれを動画にするか」を視聴者に選ばせる。これは私たちが実際に決めて
 *   いることなので、**約束を守れる**（守れない問いは指示11 に触れる）。番号だけで
 *   答えられるので、コメントの敷居がいちばん低い形でもある。
 *
 * 守る側の仕組み:
 *   票が入ったのに集計されないと、視聴者に嘘をついたことになる。だから
 *   `diag.mjs` が毎回 **自分のコメントと視聴者のコメントを分けて**印字する
 *   （分けないと、自分で置いた問いを「反応があった」と読み違える）。
 *
 * 使い方:
 *   node promo/youtube/ask.mjs --pending [--limit N] [--dry-run]
 *   node promo/youtube/ask.mjs <videoId>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { comment, accessToken } from './yt.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POSTED = path.join(HERE, 'posted.json');
const ASKED = path.join(HERE, 'asked.json');

/**
 * 選択肢は「まだ動画にしていないもの」から取る。26本ぶんの切り口は全部出して
 * しまっているので、勝った番号は**新しく作る**ことになる。それでいい ——
 * 視聴者が結果に触れるというのは、そういう意味のはずなので。
 *
 * 3つとも play.html に実在することを確かめてある（金クッキー 83箇所 /
 * 深層 27箇所 / 実績研究 7097行〜）。実在しないものを選ばせたら指示11。
 */
export const ASK = [
  'この放置ゲー、次はどこを見せましょうか。',
  'まだ動画にしていないところから3つ選ぶと ①金クッキー ②深層領域 ③実績研究。',
  'コメントに番号を書いてもらえたら、いちばん多かったものを次に作ります。',
].join('');

const load = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; } };
const save = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');

/** 既に問いを置いた videoId の集合。二重投稿は視聴者から見ると連投で、荒らしと同じ。 */
export const asked = () => new Set(load(ASKED).map(r => r.videoId));

/**
 * 1本に問いを置いて記録する。**記録は投稿が成功したときだけ**書く ——
 * 先に書くと、失敗した本が「置いた」ことになって永久に置かれない。
 */
export async function ask(videoId, text = ASK) {
  const id = await comment(videoId, text);
  const log = load(ASKED);
  log.push({ videoId, commentId: id, at: new Date().toISOString(), text });
  save(ASKED, log);
  return id;
}

/** 実際に生きている動画だけを相手にする。posted.json は古くなる（RUNBOOK §2）。 */
async function alive(ids) {
  const tok = await accessToken();
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status&id=${ids.slice(i, i + 50).join(',')}`,
      { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) continue;
    for (const v of ((await r.json()).items || [])) out.set(v.id, v.status);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const dry = argv.includes('--dry-run');
  const limit = Number((argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 0) || Infinity;
  const given = argv.filter(a => !a.startsWith('--'));

  const done = asked();
  let targets;
  if (given.length) targets = given;
  else {
    const seen = new Set();
    targets = load(POSTED).map(p => p.videoId).filter(id => id && !seen.has(id) && seen.add(id) && !done.has(id));
  }

  const status = await alive(targets);
  let ok = 0, skip = 0, fail = 0;
  for (const id of targets) {
    if (ok >= limit) break;
    const st = status.get(id);
    if (!st) { skip++; console.log(`skip ${id} —— YouTube 側に無い`); continue; }
    // 2026-08-10 実測: 予約済み（private + publishAt）に commentThreads.insert すると
    // 403 insufficient permissions。**所有者でも公開前には置けない。**
    // だから「投稿の直後に autopost が置く」形にはできない —— 公開されたあとに
    // 誰かが置きに来る必要がある。それを人（や次の回の判断）に任せると忘れるので、
    // `preflight.sh` が毎回 --pending を撃つ形にした（指示7: 覚えなくていい手順は忘れない）。
    // ここで private を飛ばすのは、毎時7本ぶんの 403 を無駄に撃たないため。
    if (st.privacyStatus !== 'public') { skip++; if (given.length) console.log(`skip ${id} —— まだ ${st.privacyStatus}（公開前は 403）`); continue; }
    if (dry) { console.log(`dry  ${id} (${st.privacyStatus}${st.publishAt ? ' 予約 ' + st.publishAt : ''})`); ok++; continue; }
    try {
      const cid = await ask(id);
      ok++;
      console.log(`ok   ${id} (${st.privacyStatus}) -> ${cid}`);
    } catch (e) {
      fail++;
      console.log(`FAIL ${id} (${st.privacyStatus}) —— ${String(e.message || e).slice(0, 120)}`);
    }
  }
  console.log(`\n置いた ${ok} / 飛ばした ${skip} / 失敗 ${fail}`);
}
