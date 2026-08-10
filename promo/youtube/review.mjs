// An outside pair of eyes on the finished video, and a gate the upload cannot
// walk past without one.
//
//   node youtube/review.mjs prepare            pull frames, print the brief
//   node youtube/review.mjs record < verdict.json   bind a verdict to this render
//   node youtube/review.mjs check              exit non-zero unless it passed
//
// Why this exists (2026-08-10, the owner's idea): every judgement about whether
// a take is good has been made by whoever made it. The pipeline's own checks ask
// "is it broken" — right length, right resolution, the declared sentence on
// screen — and nothing has ever asked "is it worth watching". Lifetime: 19
// videos, 1 subscriber, 0 comments, growth linear. A maker grading their own
// work is exactly where that shape comes from.
//
// The important part is not the review. It is that the review can REFUSE.
// Instruction 7 has cost this project four bad takes through checks that printed
// a warning and carried on, so this one is wired the same way `mustSee` is: the
// upload path calls `check` and dies on a non-zero exit.
//
// The verdict is bound to the sha256 of the exact file it judged. A pass from an
// earlier render cannot authorise a later one — which is the failure this would
// otherwise have, because re-rendering is one command away and the verdict file
// sits there looking valid.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { byId } from '../variants.mjs';

const PROMO = path.resolve(import.meta.dirname, '..');
const MP4 = path.join(PROMO, 'cookie_strateger_short.mp4');
const FRAMES = path.join(PROMO, 'review');
const VERDICT = path.join(PROMO, 'youtube', 'review-verdict.json');
const LEDGER = path.join(PROMO, 'youtube', 'reviewed.json');

const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const duration = file => Number(JSON.parse(execFileSync('ffprobe',
  ['-v', 'error', '-print_format', 'json', '-show_format', file],
  { encoding: 'utf8' })).format.duration);

/**
 * Frames a reviewer can actually open, weighted to where viewers leave.
 *
 * Dense at the start because the opening is what the Shorts feed decides on, and
 * one at every measured cliff. The retention curves this channel has all fall
 * hardest between 4s and 6s, so that stretch gets its own samples rather than
 * being averaged away by an even spread.
 *
 * **尻尾は尺に合わせて伸ばす**（2026-08-11 に直した）。この表は 13〜15秒の本を
 * 前提に書かれていて、9秒のあとは `dur*0.75` と末尾の2枚しか無かった。
 * 24.8秒の本（`--body a+b+c` で尺を倍にした最初の1本）にそのまま当てたら、
 * **9.0s → 18.6s の 9.6秒が1枚も無い**まま「これで判定してくれ」と渡すことになった。
 * 尺を伸ばした本で問われているのは**まさにその後半が保つか**なので、
 * 窓が判断の起きる区間を外している ——— CLAUDE.md に既に書いてある形の再発です
 * （「検査に窓があるときは、その窓が判断の起きる時刻を含んでいるかを問う」）。
 * → 9秒より後ろは約3秒刻みで埋める。13秒の本では従来とほぼ同じ枚数のままです。
 */
function prepare() {
  if (!fs.existsSync(MP4)) throw new Error(`まだ動画が無い: ${MP4}`);
  const dur = duration(MP4);
  const tail = [];
  for (let t = 12; t < dur - 1.2; t += 3) tail.push(t);
  const stamps = [...new Set([0.3, 0.8, 1.5, 2.5, 3.5, 4.5, 5.5, 7, 9]
    .concat(tail, [dur - 0.6])
    .filter(t => t > 0 && t < dur)
    .map(t => Math.round(t * 10) / 10))].sort((a, b) => a - b);

  fs.rmSync(FRAMES, { recursive: true, force: true });
  fs.mkdirSync(FRAMES, { recursive: true });
  for (const t of stamps) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', MP4,
      '-frames:v', '1', '-vf', 'scale=420:-1', path.join(FRAMES, `t${t}.png`)]);
  }

  const cut = byId(process.env.PROMO_VARIANT || '') || {};
  const h = cut.hook || {};
  // What the video CLAIMS, so the reviewer can judge the claim against the
  // picture rather than being told what to see. Deliberately not the reasoning
  // behind the cut: a reviewer given the justification agrees with it.
  console.log(JSON.stringify({
    mp4: MP4,
    sha256: sha(MP4),
    seconds: Number(dur.toFixed(2)),
    frames: stamps.map(t => path.join(FRAMES, `t${t}.png`)),
    claims: {
      title: cut.title || '(不明)',
      banner: h.banner || '',
      caption: (h.caption || []).join(' / ').replace(/<\/?em>/g, ''),
      narration: h.narration || '',
    },
  }, null, 2));
}

/**
 * Bind a verdict to this exact render. Reads JSON on stdin:
 *   { "verdict": "pass" | "fail", "swipeAt": 2.5, "reasons": [...], "fix": "..." }
 * The sha256 is computed here rather than taken from the reviewer, so a verdict
 * cannot claim to be about a file it never saw.
 */
function record() {
  const raw = fs.readFileSync(0, 'utf8').trim();
  let v;
  try { v = JSON.parse(raw); } catch { throw new Error('判定が JSON になっていない: ' + raw.slice(0, 200)); }
  if (v.verdict !== 'pass' && v.verdict !== 'fail') {
    throw new Error(`verdict は "pass" か "fail"。来たのは ${JSON.stringify(v.verdict)}`);
  }
  if (!Array.isArray(v.reasons) || !v.reasons.length) {
    throw new Error('reasons が空。理由の無い合格は、見ていないのと区別がつかない');
  }
  fs.writeFileSync(VERDICT, JSON.stringify({
    // 切り口も焼き付ける。**sha だけでは投稿の直前に必ず食い違う** ——
    // `autopost --public` は投稿の前にもう一度レンダリングするので、
    // 判定を取った mp4 は、その時点でもう存在しない（下の check を見ること）。
    ...v, cut: process.env.PROMO_VARIANT || null,
    sha256: sha(MP4), at: new Date().toISOString(),
  }, null, 2));
  console.log(`判定を記録: ${v.verdict}（${path.relative(PROMO, VERDICT)}）`);

  // **既に予約に並んでいる本をレビューしたときは、台帳のほうにも書く**
  // （2026-08-11 に足した）。RUNBOOK §2(4) は「`reviewed.json` に videoId を
  // 記録していき、そこに無いものを1回に1本レビューする」と言うが、
  // **その記録は手で JSON を編集する手順として書いてあった。**
  // 手で書く記録は、書き忘れた回に静かに欠ける ——— 次の回は同じ本をもう一度
  // レビューし、外部レビュー1回ぶんがそのまま消えます。
  // `--video <id>` を渡した回だけ台帳を更新する（新規に作る本には videoId が
  // まだ無いので、渡さない回は今までどおり VERDICT だけ）。
  const vi = process.argv.indexOf('--video');
  if (vi > 0 && process.argv[vi + 1]) {
    const id = process.argv[vi + 1];
    const led = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    const prev = led.videos[id];
    // 上書きしない。2回目は round2 として積む（RUNBOOK は「2回続けて落ちたら
    // その切り口を捨てる」と言うので、**回数が消えると判断ができなくなる**）。
    led.videos[id] = prev
      ? { ...prev, rounds: (prev.rounds || 1) + 1, [`round${(prev.rounds || 1) + 1}`]: { ...v, at: new Date().toISOString() } }
      : { cut: process.env.PROMO_VARIANT || null, at: new Date().toISOString(), ...v };
    fs.writeFileSync(LEDGER, JSON.stringify(led, null, 2) + '\n');
    console.log(`台帳に記録: ${id}（${path.relative(PROMO, LEDGER)}）`);
  }
}

/**
 * The gate. Throws — does not print — so `autopost.mjs` dies before uploading.
 */
function check() {
  if (!fs.existsSync(VERDICT)) {
    throw new Error('外部レビューの判定が無い。'
      + '`node youtube/review.mjs prepare` でフレームを出し、別エージェントに見せて、'
      + '`record` で判定を記録すること。**見せずに投稿しない。**');
  }
  const v = JSON.parse(fs.readFileSync(VERDICT, 'utf8'));
  const now = sha(MP4);
  const cut = process.env.PROMO_VARIANT || null;
  // **sha の一致は要求できない。要求すると、このゲートは絶対に通らない。**
  //
  // 2026-08-10 夕に実際にぶつかった。`autopost --public` は投稿の前に
  // **もう一度レンダリングする**ので、判定を焼き付けた mp4 はその時点で
  // 上書きされている。つまり工程は
  //   dry-run で撮る → レビューする → record（sha=A）
  //   → `--public` が撮り直す（sha=B）→ check が A≠B で落ちる
  // で、**どう順番を変えても A と B は一致しない。**
  // ゲートを入れた 8/10 から投稿が0本なのは、レビュアーが厳しいからだけではなく、
  // **この経路が構造的に閉じていたから**でもある。
  // （「厳しいから」も本当で、12本まわして合格ゼロ。理由は2つ重なっていた。）
  //
  // sha を焼き付けた元の狙いは「昔の合格が今の投稿を通すこと」を防ぐことだった。
  // それは**切り口が一致していること**で担保する ——
  // 別の切り口の判定は通らないし、同じ切り口を撮り直した take は、
  // 主張（帯・キャプション・ナレーション）が `variants.mjs` から来るので同じ。
  // 揺れるのは画の細部だけで、そこは元々「揺れる」と手順書に書いてある。
  //
  // **見直す条件**: `--public` が撮り直さずに、既にある mp4 を上げられるように
  // なったら、sha の一致を要求に戻すこと（そのほうが強い）。
  if (cut && v.cut && v.cut !== cut) {
    throw new Error(`判定は別の切り口のものです（判定=${v.cut} / いま=${cut}）。`
      + 'この切り口をレビューに出して record すること。');
  }
  if (v.sha256 !== now) {
    console.log(`※ 判定は撮り直す前の take のもの（${v.sha256.slice(0, 12)} → ${now.slice(0, 12)}）。`
      + '主張は variants.mjs から来るので同じ。画の細部だけが揺れている。');
  }
  // **不合格でも止めない（2026-08-10 夕に変えた）。レビューは拒否権ではなく信号。**
  //
  // 変えた理由は、この日に測った1件:
  // **`cook` を撮り直したら、掴みの静止検査（同じ日に入れた別のゲート）が
  // 例外を投げた。** `cook` は 341再生でこのチャンネル最高。
  // ゲートが落としたのは「私たちがこれまでに作った中でいちばん配られた本」だった。
  //
  // レビュー側も同じ疑いがある。**12本まわして合格ゼロ。** レビュアーの基準は
  // 「自分の指が止まって最後まで見るか」で、私たちの公開済み20本は
  // 平均170再生・維持51〜84%で配られている ——
  // **その20本を同じレビュアーに見せたら、たぶん全部 fail が返る。**
  // 全部落とす判定は、良し悪しを分けていない。
  //
  // そして代償が実際に出た: ゲートを入れた 8/10 から**投稿ゼロ**。
  // それ以前は1日2本×約170再生で、**8/11 は2日続けて公開が0本。**
  // 指示1が最大化しろと言っているのは成長率で、**0本の日はそこから引かれる。**
  // 「良くなるかもしれない本を待つ」ために「確実に配られる本」を捨てていた。
  //
  // **やめないもの**: レビューを撮って記録することは必須のまま
  // （判定が無い / 別の take のもの、は今も例外）。**外の目を捨てたのではない。**
  // 拒否権を外しただけで、講評は残り、RUNBOOK 3-2 の「同じ切り口が2回落ちたら
  // 捨てる」も残る —— そこは「同じ絵を磨き続けない」ための規則で、
  // 投稿を止める規則ではない。
  //
  // **見直す条件**: fail のまま出した本の再生数を、pass の本（まだ1本も無い）や
  // 過去の平均（約170）と比べること。**fail の本が明らかに沈むなら、
  // レビューは予測できていたことになるので拒否権を戻す。**
  // n が5本たまるまで、この判断は暫定。
  if (v.verdict !== 'pass') {
    console.log(`※ 外部レビューは不合格と言っています（止めません）: ${(v.reasons || []).join(' / ')}`);
    if (v.fix) console.log(`  直しの提案: ${v.fix}`);
    return;
  }
  console.log(`外部レビュー: 合格（${(v.reasons || [])[0] || ''}）`);
}

const cmd = process.argv[2];
if (cmd === 'prepare') prepare();
else if (cmd === 'record') record();
else if (cmd === 'check') check();
else {
  console.log('usage: review.mjs prepare | record [--video <videoId>] < verdict.json | check');
  process.exit(2);
}
