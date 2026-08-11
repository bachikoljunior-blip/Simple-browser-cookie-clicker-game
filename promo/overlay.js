// Burned-in caption / FX layer for the promo capture.
// Injected into play.html at record time; never shipped with the game.
// All sizes are in vw so the same layout holds at any capture resolution.
window.__promoInstall = function () {
  const css = `
  /* YouTube draws its own chrome over the finished Short: the title, channel row
     and progress bar across the bottom, and the like/comment/share column down
     the right. Anything burned in has to stay clear of both, or it gets covered
     on the only screen that matters. These are the reserved bands. */
  #pfxRoot{position:fixed;inset:0;z-index:99999;pointer-events:none;
    --uiBottom:20%; --uiRight:13%; --uiTop:9%;
    font-family:"IPAPGothic","IPAGothic",sans-serif}
  #pfxCover{position:absolute;inset:0;background:#000;opacity:1}
  #pfxCover.off{opacity:0}
  #pfxFlash{position:absolute;inset:0;background:#fff;opacity:0}
  #pfxFlash.go{animation:pfxFlash .36s linear}
  /* Holds briefly at full strength: the capture only samples ~19.5 times a
     second, and this frame is the timing mark the soundtrack is checked against,
     so it has to survive being sampled. */
  @keyframes pfxFlash{0%{opacity:.94}28%{opacity:.9}100%{opacity:0}}

  /* --- banner: sits on the seam between play area and panel --- */
  #pfxTop{position:absolute;left:3%;right:var(--uiRight);top:37.5%;display:flex;justify-content:center;opacity:0}
  #pfxTop.on{opacity:1;animation:pfxDrop .26s cubic-bezier(.2,1.6,.4,1)}
  #pfxTop.hi{top:11%}
  /* 2026-08-11: 寄せたカードが画面の三分の二を占めると、テロップの逃げ場は
     カードの下（66%〜）と上の10%しか残らない。上は --uiTop(9%) が YouTube の
     chrome 帯なので使えない。lo はカードの直下・キャプションの直上。 */
  #pfxTop.lo{top:67%}
  #pfxTop .b{
    display:inline-block;padding:1.157vw 3.241vw;border-radius:1.852vw;
    background:linear-gradient(180deg,#ffd85e,#f2a01c);
    color:#2a1608;font-size:3.935vw;font-weight:700;white-space:nowrap;
    box-shadow:0 0.926vw 0 rgba(0,0,0,.45),0 0 5.093vw rgba(255,190,60,.5);
    transform:rotate(-1.2deg)}
  @keyframes pfxDrop{0%{transform:translateY(-5.093vw) scale(.82);opacity:0}100%{transform:none;opacity:1}}

  /* --- caption stack, anchored so it can never run off frame --- */
  #pfxCap{position:absolute;left:3%;right:var(--uiRight);bottom:calc(var(--uiBottom) + 3%);text-align:center;opacity:0}
  #pfxCap.on{opacity:1}
  /* For full-bleed play scenes: sits in the empty sky under the quota gauge,
     clear of the cookie and of whatever has spawned around it. */
  #pfxCap.high{bottom:auto;top:14%}
  #pfxCap.mid{bottom:auto;top:41%}
  #pfxCap .line{
    display:block;margin:0 auto 1.389vw;width:fit-content;max-width:100%;
    padding:1.157vw 2.778vw;border-radius:1.62vw;
    background:rgba(8,5,2,.86);border:0.347vw solid rgba(255,214,110,.5);
    color:#fff;font-size:4.861vw;line-height:1.36;font-weight:700;white-space:nowrap;
    text-shadow:0 0.463vw 0 rgba(0,0,0,.9);
    animation:pfxPop .2s cubic-bezier(.2,1.7,.4,1) both}
  #pfxCap .line:nth-child(2){animation-delay:.08s}
  #pfxCap .line:nth-child(3){animation-delay:.16s}
  #pfxCap .line em{font-style:normal;color:#ffd75e}
  #pfxCap .line b{font-weight:700;color:#7ef0c0}
  #pfxCap .line.sm{font-size:3.935vw}
  @keyframes pfxPop{0%{transform:scale(.74) translateY(1.852vw);opacity:0}100%{transform:none;opacity:1}}

  /* --- finger tap ring --- */
  .pfxRing{position:absolute;width:10.185vw;height:10.185vw;margin:-5.093vw 0 0 -5.093vw;border-radius:50%;
    border:0.579vw solid rgba(255,255,255,.95);box-shadow:0 0 2.778vw rgba(255,220,120,.9);
    animation:pfxRing .4s ease-out forwards}
  @keyframes pfxRing{0%{transform:scale(.35);opacity:1}100%{transform:scale(1.4);opacity:0}}

  /* Killing a monster opens the reward dialog, which dims the field and covers
     the beat. A stylesheet !important beats the inline display the game sets. */
  #rewardModal{display:none !important}

  /* --- end card --- */
  /* Translucent, not solid. The card is a third of a short video's runtime, and
     opaque it made that third completely motionless — the worst possible place
     for a viewer to decide they are done, and a hard cut back to the hook when
     the Short loops. The terms still have to be readable, so this is judged by
     looking at the frame, not by reasoning about the number. */
  /* Ring drawn around a live element, so a claim can point at the thing that
     backs it. The game states plenty in small type at the edge of the HUD — the
     layer counter, the multipliers — and a caption asserting a number while the
     number sits unnoticed in a corner is true but not persuasive. */
  .pfxSpot{position:absolute;border:0.65vw solid #ffd75e;border-radius:2.2vw;
    box-shadow:0 0 0 0.55vw rgba(0,0,0,.45),0 0 3.5vw rgba(255,215,94,.75);
    animation:pfxSpotIn .28s ease-out, pfxSpotPulse 1.15s ease-in-out .28s infinite;
    pointer-events:none}
  @keyframes pfxSpotIn{from{transform:scale(1.5);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes pfxSpotPulse{0%,100%{opacity:1}50%{opacity:.55}}
  #pfxEnd{position:absolute;inset:0;opacity:0;transition:opacity .35s ease;
    background:rgba(18,10,5,.82);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3.241vw;
    padding:var(--uiTop) var(--uiRight) var(--uiBottom) 6%}
  #pfxEnd.on{opacity:1}
  #pfxEnd::before{content:"";position:absolute;inset:0;
    background:radial-gradient(ellipse at 50% 34%,rgba(150,84,20,.55),rgba(10,6,3,0) 62%)}
  #pfxEnd>*{position:relative}
  #pfxEnd .t{color:#ffd75e;font-size:7.176vw;font-weight:700;text-align:center;line-height:1.22;
    text-shadow:0 0.694vw 0 rgba(0,0,0,.75),0 0 6.481vw rgba(255,180,60,.45)}
  #pfxEnd .s{color:#fff;font-size:3.935vw;font-weight:700;text-align:center;line-height:1.65}
  #pfxEnd .s u{text-decoration:none;color:#8fe9ff}
  #pfxEnd .cta{margin-top:1.389vw;padding:2.546vw 4.63vw;border-radius:2.546vw;
    background:linear-gradient(180deg,#ff7676,#d42525);color:#fff;font-size:4.398vw;font-weight:700;
    text-align:center;line-height:1.5;box-shadow:0 1.389vw 0 rgba(0,0,0,.45);
    animation:pfxPulse 1s ease-in-out infinite}
  #pfxEnd .cta em{font-style:normal;color:#ffe27a}
  @keyframes pfxPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  #pfxEnd .arrow{color:#fff;font-size:6.019vw;animation:pfxBob .8s ease-in-out infinite}
  @keyframes pfxBob{0%,100%{transform:translateY(0)}50%{transform:translateY(1.62vw)}}
  /* 「また出す」の一行。**赤枠の下に、赤枠より小さく置く。**
     指示12 のテスター募集は動画に残る制約なので、こちらが主役を奪ってはいけない。
     逆に、ここが空欄のままだった20本で登録者は生涯1。**場所は取るが順位は下**、
     が両方を満たす唯一の置き方。空文字を渡すと display:none で消える
     （旧い呼び方 __end(t,s,cta) がそのまま動くように）。
     この CSS はテンプレートリテラルの中なので、コメントにバッククォートを
     書かないこと ——— 2026-08-11 に書いて文字列がそこで終わり、
     overlay 全体が構文エラーになった（__promoInstall is not a function で出る）。 */
  #pfxEnd .sub{color:#ffe9b8;font-size:3.472vw;font-weight:700;text-align:center;
    line-height:1.5;text-shadow:0 0.463vw 0 rgba(0,0,0,.7)}
  #pfxEnd .sub:empty{display:none}
  #pfxEnd .sub em{font-style:normal;color:#ffd75e}
  `;

  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const root = document.createElement('div');
  root.id = 'pfxRoot';
  root.innerHTML = `
    <div id="pfxFlash"></div>
    <div id="pfxTop"><span class="b"></span></div>
    <div id="pfxCap"></div>
    <div id="pfxEnd">
      <div class="t"></div>
      <div class="s"></div>
      <div class="cta"></div>
      <div class="arrow">▼</div>
      <div class="sub"></div>
    </div>
    <div id="pfxCover"></div>`;
  document.body.appendChild(root);

  const $$ = id => document.getElementById(id);

  // Switched with no transition on purpose: the frame where the cover appears or
  // disappears is the timing anchor the encoder aligns the soundtrack to, so it
  // has to be a hard edge rather than a fade.
  window.__cover = on => $$('pfxCover').classList.toggle('off', !on);

  window.__flash = () => {
    const f = $$('pfxFlash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  };

  window.__top = (html, pos) => {
    const t = $$('pfxTop');
    if (!html) { t.className = ''; return; }
    t.querySelector('.b').innerHTML = html;
    t.className = '';
    void t.offsetWidth;
    t.className = 'on' + (pos ? ' ' + pos : '');
  };

  window.__cap = (lines, pos) => {
    const c = $$('pfxCap');
    if (!lines || !lines.length) { c.className = ''; c.innerHTML = ''; return; }
    c.className = 'on' + (pos ? ' ' + pos : '');
    c.innerHTML = lines.map(l => `<span class="line${l.length > 20 ? ' sm' : ''}">${l}</span>`).join('');
  };

  window.__ring = (x, y) => {
    const r = document.createElement('div');
    r.className = 'pfxRing';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    $$('pfxRoot').appendChild(r);
    setTimeout(() => r.remove(), 480);
  };

  // The skill-tree view calls requestFullscreen(), and nothing outside the
  // fullscreen element renders — so the overlay has to move inside it.
  /**
   * Ring a live element for `ms`. Returns false when the selector matches
   * nothing, so the caller can tell "highlighted" from "silently did nothing" —
   * the game's HUD is rebuilt on a lot of state changes and a stale selector
   * would otherwise fail invisibly.
   */
  window.__spot = (sel, ms) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const pad = Math.max(6, r.height * 0.35);
    const d = document.createElement('div');
    d.className = 'pfxSpot';
    d.style.left = (r.left - pad) + 'px';
    d.style.top = (r.top - pad) + 'px';
    d.style.width = (r.width + pad * 2) + 'px';
    d.style.height = (r.height + pad * 2) + 'px';
    $$('pfxRoot').appendChild(d);
    setTimeout(() => d.remove(), ms || 2400);
    return true;
  };

  /**
   * Blow one row of a list up until it is readable on a phone, and centre it.
   *
   * 2026-08-10。**6人の外部レビュアーが独立に同じ理由を挙げた**: 掴みの答えが
   * 「読めない小文字の一覧表」で、20行のどこを見ればいいのか示されていない。
   * 6本目（stages 2回目）は「段階2の行は確かにそこにあるけど、スマホの画面で
   * その文字は爪の先ほどの大きさ。**視聴者は答えを受け取っていない。**
   * 受け取っていないので、問いに意味がなくなる」と書いた。
   *
   * **これまでの手は spot（枠で囲う）だった。囲っても文字は小さいまま。**
   * 小さい文字を指し示すのと、読める大きさにするのは別の操作。
   *
   * 返り値は真偽ではなく理由つき。**呼んだ結果を捨てると検査が無いのと同じ**
   * （指示7の5つ目の形。`scrollToHeading` が false を返して誰も見ていなかった）。
   */
  /*
   * **「ok」は寄れたことを意味していなかった**（2026-08-11、実測で判明）。
   *
   * ここは 8/10 に「ok WxH @top」を返すようにして、director は
   * `startsWith('ok')` だけを見ていた。**大きさは印字していただけ。**
   * `stagebuy` を factor 2.1 で撮ったら ok が返り、撮れたフレームには
   * **研究カードが9枚並んでいた**（外部レビュアーは同じフレームを見て
   * 「読めない極小文字の一覧表」と書き、1.5秒でスワイプした）。
   * 縦 1920 に対してカードは約140px ＝ **画面の7%**。`record` の 824x114 も
   * 同じく6%で、そちらも同じ理由で落ちている。
   * **2つとも「ok」で通っていた。**
   *
   * 経路は指示7の5つ目の形の変種: 返り値は捨てていない（`startsWith('ok')` は
   * 見ている）が、**返り値のうち判断に効く部分だけを捨てていた。**
   * 数字を文字列に混ぜて返すと、混ぜた側は「報告した」つもりになり、
   * 読む側は前置きしか見ない。→ **測った値そのものに下限を当てる。**
   *
   * `minShare` はビューポート高に対する target の高さの比。既定 0.25 は
   * 実測から置いた線ではなく、**「9枚並ぶのは寄っていない」を排除する最小値**
   * （0.25 なら画面に並べて4枚が上限）。浅い寄りを意図する切り口は
   * `zoom.minShare` で自分で宣言する —— `hook.motion: 'still'` と同じ形で、
   * **宣言していない浅さは事故として扱う。**
   * **見直す条件**: 0.25 以上で撮った本の swipeAt を、2.1倍時代の 1.5 と比べる。
   * 動かなければ、読めなさは主因ではなかったことになる（掴みで6回目の空振り）。
   */
  window.__zoom = (rootSel, targetSel, factor, contains, minShare) => {
    const root = document.querySelector(rootSel);
    if (!root) return `root なし: ${rootSel}`;
    // 行を nth-child で選ばない。ゲームは並びを状態で組み替えるので、
    // 番号で選ぶと**別の行に静かにずれる**（それは mustSee が見ている文と
    // 違う行かもしれない）。文字で選べば、寄った先は必ず主張の載る行になる。
    const all = [...document.querySelectorAll(targetSel)];
    const el = contains ? all.find(n => (n.textContent || '').includes(contains)) : all[0];
    if (!el) return `target なし: ${targetSel}${contains ? ` 含[${contains}]` : ''}`;
    root.style.zoom = String(factor || 2);
    // zoom はレイアウトを変えるので、寄せるのは必ずそのあと。
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return `target に大きさが無い: ${targetSel}`;
    const vh = window.innerHeight || 1;
    const share = r.height / vh;
    const pct = n => `${Math.round(n * 100)}%`;
    const size = `${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)} 縦の${pct(share)}`;
    const floor = minShare == null ? 0.25 : minShare;
    if (share < floor) {
      return `寄りが浅い: ${size} < 下限${pct(floor)}（factor ${factor}）。`
        + '一覧のまま撮れるので、factor を上げるか zoom.minShare で宣言すること';
    }
    return `ok ${size}`;
  };

  window.__mount = sel => {
    const host = (sel && document.querySelector(sel)) || document.body;
    host.appendChild(document.getElementById('pfxRoot'));
  };

  // Debug aid: paints the areas YouTube's own Shorts chrome sits on top of, so
  // burned-in text can be checked against them instead of guessed at.
  window.__safeZones = () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;z-index:100000;pointer-events:none';
    d.innerHTML =
      '<div style="position:absolute;left:0;right:0;bottom:0;height:20%;background:rgba(255,0,0,.34);' +
      'border-top:2px solid #f00"></div>' +
      '<div style="position:absolute;right:0;top:0;bottom:0;width:13%;background:rgba(255,0,0,.34);' +
      'border-left:2px solid #f00"></div>' +
      '<div style="position:absolute;left:0;right:0;top:0;height:9%;background:rgba(255,140,0,.30);' +
      'border-bottom:2px solid #f80"></div>';
    document.getElementById('pfxRoot').appendChild(d);
  };

  // Hiding the dialog with CSS is not enough: the game gates further monster hits
  // on its inline display being "flex", so that value has to be cleared too or
  // nothing can be killed after the first drop.
  window.__suppressRewards = () => {
    setInterval(() => {
      const m = document.getElementById('rewardModal');
      if (m && m.style.display && m.style.display !== 'none') m.style.display = 'none';
    }, 30);
  };

  /* 前→後 —— 行が「現れる瞬間」をカメラの前で撮る（2026-08-10 夕に新設）。
   *
   * この台帳でいちばん重なりの強い指摘の、残っていた半分。7本目と8本目の
   * レビュアーが、互いの講評も作り手の事情も知らないまま**行の選び方まで
   * 一致させて**同じ fix を書いた:
   *   7本目「オーブンの熟練Iの行と、オーブン大量生成 段階2 の行だけを画面
   *          いっぱいに拡大して、**上の段が買われた瞬間に下の段が現れる**
   *          ところを撮れ」
   *   8本目「段階2の1件だけを大写しにして、その行が一覧に**挿入される前→後**の
   *          変化を0秒目に置け」
   * `__zoom` で「大写し」は作った。**足りなかったのは「前→後」のほう** ——
   * 寄れるのは既に在る行で、行が現れる瞬間は一度も撮っていなかった。
   *
   * **状態を書き換えて再描画する形にはしない。** それは今日いちばん高くついた
   * 間違い（`opening: 'battle'` が `monsters.length` の減少で合格して、画面には
   * 倒れる瞬間が1フレームも無かった）と同じ形になる。ここでやるのは
   * **プレイヤーがやる操作そのもの** —— 研究カードをタップして買う。
   * 買えば `buyResearch()` が購入カードを列から外し、対応スキルを持っていれば
   * `visibleResearchStageCards()` が段階2のカードを列に入れる（play.html:15206）。
   * **同じ1タップで、上の行が消えて下の行が現れる。**
   *
   * 判定は data-id で見る。カードは `data-id="<研究id>"` と
   * `data-id="<研究id>__s2"`（play.html:15455 の stageMatch）を持つので、
   * **前に無くて後に在る**が二値で言える。文字列一致にしないのは、
   * 「段階2」という語が他の研究のカードにも出るから ——
   * 語で見ると、別の行が最初から在るだけの take が通る。
   */
  /* act:'counter' —— カウンターそのものを主役にして、**単位名がその場で
   * 書き換わる**のを撮る（2026-08-11 に新設）。
   *
   * この台帳でいちばん重なりの強い未実装でした。**5人が独立に同じことを
   * 書いています**（`unit` と `beyond` を別々のレビュアーに見せた2本＋
   * 研究カードについて言っていた3本）:
   *   「上端の所持クッキー表示を画面幅いっぱいに寄せ、無量大数→火炉が
   *     その場で書き換わる瞬間を冒頭0〜1.5秒に。クッキーの絵は捨ててよい」
   *   「豆粒カウンターを画面中央の巨大表示に変え、正→無量大数→火炉と
   *     単位名がその場で書き換わるのを0秒から撮る」
   * 両方が同じ**理由**も挙げていました —— 主張の証拠（火炉・10の72乗）が
   * 自分のキャプションの中にしかなく、ゲーム画面側の該当文字は上端2%の豆粒。
   * 視聴者から見ると「ゲームが言っている」ではなく「動画の字幕が言っている」。
   *
   * **研究カードの reveal と同じ枠に入れた理由**: 出来事の形が同じだから。
   * 前に在って後に無い／前に無くて後に在る、が二値で言える。
   * `state.cookies` を動かすのは `bodyBeyond` が前からやっていることで、
   * 偽装ではありません（ゲームが 10^72 で実際に組み立てる名前を出させる）。
   *
   * **「呼んだ回数 ≠ 出来事」「状態の変化 ≠ 見える出来事」の次**: ここで
   * 変わるのは**画面いちばん大きい文字そのもの**なので、状態ではなく
   * 描画された文字列で前後を判定します（`#cookies` の textContent）。
   * 数字の部分は 1.00000 のまま動かない（10^68 も 10^72 も level 境界ちょうど）
   * ので、**書き換わるのは単位名だけ**になります。
   */
  const counterParts = () => {
    const el = document.getElementById('cookies');
    if (!el) return null;
    return { el, box: el.closest('.cookieCount') || el.parentElement };
  };

  // 巨大表示が「読める大きさ」かを、文字の大きさそのもので測る。
  // `__zoom` の minShare は行の高さを見るが、ここで効くのは1文字の大きさなので
  // **font-size を画面幅に対する比で見る**。既定 0.08 は 1080幅で 86px ＝
  // 1行に約12文字。**印字ではなく停止**（浅い巨大化は事故として扱う）。
  const counterMeasure = (spec, el) => {
    const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
    const vw = window.innerWidth || 1;
    const share = fs / vw;
    const floor = spec.minCharShare == null ? 0.08 : spec.minCharShare;
    const r = el.getBoundingClientRect();
    const size = `${Math.round(fs)}px 幅の${Math.round(share * 100)}% `
      + `箱 ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)}`;
    if (share < floor) return { why: `文字が小さい: ${size} < 下限${Math.round(floor * 100)}%` };
    // 矩形は「レイアウト上どこか」であって「画面のどこか」ではない
    // （ボスを枠外へ出したとき 232x242 @401 を返してきた）。**画面内まで見る。**
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth
        || !r.width || !r.height) {
      return { why: `カウンターが画面の外: ${size}/${innerHeight}` };
    }
    return { size };
  };

  /**
   * カウンターを画面中央の巨大表示にする（掛けるだけ。数は動かさない）。
   *
   * **`__revealPrep` から切り出した**（2026-08-11）。理由は本体側から掛け直す
   * ため ——— 3人のレビュアーが**互いを知らないまま同じことを書いた**:
   * 「見せ場で中央の巨大カウンターが消えて上端の極小文字に降格している」
   * 「巨大カウンターを一度も画面から降ろすな」「10の72乗が画面のどこにも無い」。
   * 掴みで「この文字は書き換わる」と教えておいて、**オチでその文字を捨てていた。**
   * `bodyBeyond` のコメントは 2%の位置で読めないことを**自分で予告していた**のに、
   * 直し方を「キャプションで言い直す」に取っていた。**言い直しは証拠ではない。**
   *
   * 掛け直しが要るのは、本体が `setPlayFullscreen` で描画先を作り直すため
   * （inline style ごと消える）。**冪等**なので何度呼んでもよい。
   */
  window.__counterStar = spec => {
    spec = spec || {};
    const p = counterParts();
    if (!p) return 'カウンターが無い(#cookies)';
    // 主役は1つ。隣の「合計毎秒」は同じ箱に居るので、巨大化すると
    // 単位名と同じ大きさで並んで**どちらが答えか読めなくなる。**
    const cps = document.getElementById('cookieCps');
    if (cps) cps.style.setProperty('display', 'none', 'important');
    const css = {
      position: 'fixed', left: '0', right: '0',
      top: spec.top || '24%', 'z-index': '9998',
      'font-size': (spec.px || 128) + 'px', 'line-height': '1.06',
      'text-align': 'center', 'word-break': 'break-all', margin: '0',
    };
    Object.keys(css).forEach(k => p.box.style.setProperty(k, css[k], 'important'));
    window.__counterUndo = () => {
      Object.keys(css).forEach(k => p.box.style.removeProperty(k));
      if (cps) cps.style.removeProperty('display');
    };
    try { updateTopOnly(); } catch (e) {}
    // **大きさは毎回測って返す。** 掛け直しが効かなかった回に
    // 「掛けたつもり」で進むのが、この台帳で何度も踏んでいる形なので。
    const m = counterMeasure(spec, p.el);
    if (m.why) return m.why;
    return `ok 「${(p.el.textContent || '').trim()}」 ${m.size}`;
  };

  window.__revealPrep = spec => {
    if (spec && spec.act === 'counter') {
      const got = window.__counterStar(spec);
      if (!String(got).startsWith('ok')) return got;
      if (spec.at) {
        state.cookies = D(spec.at);
        state.runCookies = D(spec.at);
        state.totalCookies = D(spec.at);
      }
      try { updateTopOnly(); } catch (e) {}
      const p = counterParts();
      return `ok カウンター「${(p.el.textContent || '').trim()}」`;
    }
    if (!spec || spec.act !== 'research') return `知らない act: ${spec && spec.act}`;
    const r = (typeof RESEARCH !== 'undefined' ? RESEARCH : []).find(x => x.id === spec.id);
    if (!r) return `研究が無い: ${spec.id}`;
    const skill = (typeof RES_STAGE2 !== 'undefined' ? RES_STAGE2 : {})[r.id];
    if (!skill) return `段階2を持たない研究: ${spec.id}`;
    // 段階2のカードは「段1購入済み + 対応スキル所持」で出る。スキルが無ければ
    // 買っても出てこない ——「出てこなかった」を後で例外にするのではなく、
    // **出ない条件のまま撮り始めない。**
    if (!hasSkill(skill)) return `段階2のスキル(${skill})を持っていない`;
    if (!researchUnlocked(r)) return `対応設備が未購入で研究欄に出ない: ${spec.id}`;
    // 買っていない状態に戻す。setLateGame は全研究を購入済みにするので、
    // そのままだと購入カードが列に無く、買う瞬間が撮れない。
    state.research[r.id] = false;
    state.researchStages = state.researchStages || {};
    delete state.researchStages[r.id];
    // **他の研究の段階カードは、列から出しておく。**
    // setLateGame は全研究を購入済みにし全スキルを与えるので、素のままだと
    // 列には13件ぶんの「〜 段階2」カードが並ぶ。その中に14件目が増えても、
    // 視聴者には**何も起きていないのと同じ**（6/7 が挙げた「読めない一覧表」
    // そのもの）。段階3まで買った状態にすると `visibleResearchStageCards()` の
    // どちらの枝にも入らない（play.html:15206 の cur<2 / cur===2）ので、
    // **画面に出る「段階2」はこれから現れる1件だけ**になる。
    // late game のセーブとして矛盾しない状態であって、絵のための偽装ではない。
    RESEARCH.forEach(x => {
      if (x.id === r.id || !state.research[x.id]) return;
      if (RES_STAGE2[x.id]) state.researchStages[x.id] = RES_STAGE3[x.id] ? 3 : 2;
    });
    if (!state.cookies.gte(researchCost(r))) return `クッキーが足りない: ${spec.id}`;
    try { renderActiveTab(); } catch (e) {}
    return `ok ${r.name}`;
  };

  // 前の状態を確かめてから返す。**「前に在る」「後に無い」の両方を撮影直前に
  // 見る** —— 前の行が無ければ買う瞬間は映らないし、後の行が最初から在れば
  // 「現れた」は嘘になる。
  window.__revealBefore = spec => {
    if (spec && spec.act === 'counter') {
      const p = counterParts();
      if (!p) return 'カウンターが無い(#cookies)';
      const txt = (p.el.textContent || '').trim();
      // 前に在って、後がまだ無いこと。**後だけ見ると、最初から在ったものを
      // 「現れた」と報告する take が通る**（monsters.length で1回外している）。
      if (!txt.includes(spec.from)) return `前の単位が出ていない: 「${txt}」に ${spec.from} が無い`;
      if (txt.includes(spec.to)) return `後の単位が最初から在る: 「${txt}」`;
      const m = counterMeasure(spec, p.el);
      if (m.why) return m.why;
      return `ok 「${txt}」 ${m.size}`;
    }
    const box = document.getElementById('research');
    if (!box) return '研究欄が無い';
    const from = box.querySelector(`[data-id="${spec.id}"]`);
    const to = box.querySelector(`[data-id="${spec.id}__s2"]`);
    if (!from) return `前の行が列に無い: ${spec.id}`;
    if (to) return `後の行が最初から在る: ${spec.id}__s2`;
    // **語のほうも見る。** data-id が無いだけで「段階2」と書かれた別のカードが
    // 並んでいたら、視聴者にとっては現れる前から段階2が在る。
    // キャプションが「段階2が出てきます」と言うので、**出てくる前に画面のどこにも
    // 無いこと**まで確かめる（`stages` は expect が語の有無しか見ず、
    // 画面に無い「段階3」をテロップが主張したまま通した）。
    // 見るのは購入カードの列だけ（`.item.artCard`）。#research の末尾には
    // 「研究解析」パネルが付いていて、そこは効果の式を書き出すので
    // 「狩り窓(段階2)」のような語が常に在る（play.html の異世界炉の式）。
    // **箱ごと見ると、その1文で毎回落ちる** —— 検査は主張と同じ粒度で書く。
    const said = [...box.querySelectorAll('.item.artCard')]
      .find(n => (n.textContent || '').includes('段階2'));
    if (said) return `前の時点で購入カードに「段階2」が在る: ${(said.textContent || '').slice(0, 20)}`;
    // **スクロールしない。測るだけ。** 前の行がどこに在るかを覚えて、
    // 後の行を**同じ高さ**へ持ってくる（`__revealAfter`）。
    //
    // 最初の版は前も後も `scrollIntoView({block:'center'})` にしていた。
    // 「どちらも中央」なら同じ場所に来るはずだったが、**前の行は列の先頭**で、
    // 先頭は scrollTop=0 より上へは行けないので中央に来ない。撮れた take は
    // 「上端の行が消える」→「列が10行ぶん飛ぶ」→「別の行が中央に出る」で、
    // **視聴者には前と後が別々の出来事**にしか見えなかった（t2.5 と t3.5）。
    // 位置を合わせれば、同じ場所で名前が「オーブン大量焼成」→
    // 「オーブン大量焼成 段階2」に変わる1つの出来事になる。
    const r = from.getBoundingClientRect();
    if (!r.width || !r.height) return `前の行に大きさが無い: ${spec.id}`;
    window.__revealAnchor = r.top;
    return `ok ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)}`;
  };

  // 後。**矩形が「画面のどこか」であることまで見る** —— 今日、ボスの位置を
  // 動かしたとき `getBoundingClientRect()` は 232x242 @401 という
  // もっともらしい値を返し、フレームには1体も映っていなかった。
  // 矩形は「レイアウト上どこか」であって「見えている」ではない。
  window.__revealAfter = spec => {
    if (spec && spec.act === 'counter') {
      const p = counterParts();
      if (!p) return 'カウンターが無い(#cookies)';
      try { updateTopOnly(); } catch (e) {}
      const txt = (p.el.textContent || '').trim();
      if (txt.includes(spec.from)) return `前の単位が消えていない: 「${txt}」`;
      if (!txt.includes(spec.to)) return `後の単位が出ていない: 「${txt}」に ${spec.to} が無い`;
      const m = counterMeasure(spec, p.el);
      if (m.why) return m.why;
      return `ok 「${txt}」 ${m.size}`;
    }
    const box = document.getElementById('research');
    if (!box) return '研究欄が無い';
    if (box.querySelector(`[data-id="${spec.id}"]`)) return `前の行が消えていない: ${spec.id}`;
    const to = box.querySelector(`[data-id="${spec.id}__s2"]`);
    if (!to) return `後の行が出ていない: ${spec.id}__s2`;
    // 後の行を、前の行が在った高さへ。段階2は段階1より高いので列の下のほうに
    // 入る（コスト順・play.html:15261）—— 放っておくと枠外なので、
    // **カメラのほうを合わせる。**
    const anchor = typeof window.__revealAnchor === 'number' ? window.__revealAnchor : null;
    if (anchor == null) return '前の行の高さを測っていない（__revealBefore を先に呼ぶこと）';
    // zoom を掛けた箱では scrollTop は拡大前の座標、getBoundingClientRect は
    // 拡大後の座標。**単位が違うので割る。** 1回で合わないので詰める。
    const z = parseFloat(getComputedStyle(box).zoom) || 1;
    for (let i = 0; i < 10; i++) {
      const d = to.getBoundingClientRect().top - anchor;
      if (Math.abs(d) < 2) break;
      const was = box.scrollTop;
      box.scrollTop += d / z;
      if (box.scrollTop === was) break;   // 端に張り付いた
    }
    const r = to.getBoundingClientRect();
    if (r.width < 60 || r.height < 24) return `後の行が小さすぎる ${Math.round(r.width)}x${Math.round(r.height)}`;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) {
      return `後の行が画面の外 @${Math.round(r.top)}/${innerHeight}`;
    }
    return `ok ${Math.round(r.width)}x${Math.round(r.height)} @${Math.round(r.top)}`;
  };

  window.__end = (t, s, cta, sub = '') => {
    const e = $$('pfxEnd');
    e.querySelector('.t').innerHTML = t;
    e.querySelector('.s').innerHTML = s;
    e.querySelector('.cta').innerHTML = cta;
    e.querySelector('.sub').innerHTML = sub;
    e.classList.add('on');
  };

  return true;
};
