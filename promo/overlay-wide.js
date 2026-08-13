// Burned-in caption / FX layer for the landscape (long-form) capture.
// Injected into play.html at record time; never shipped with the game.
//
// The portrait overlay has to put text *over* the game, because a 9:16 frame is
// entirely game. Landscape is the opposite problem: the game's wide layout is a
// fixed 750x356 box scaled to fit, so on a 16:9 frame it leaves a band above and
// below. That band is where the text goes. Nothing is ever drawn over play, and
// nothing has to be positioned by guesswork — the bands are measured from the
// game element itself and published as CSS variables.
//
// Sizes are in vh rather than vw. Height is what the layout is short of here,
// and a caption sized against the width would grow as the frame got wider while
// the space it has to fit in did not.
window.__promoInstall = function () {
  const css = `
  #pfxRoot{position:fixed;inset:0;z-index:99999;pointer-events:none;
    --gx:0px; --gy:0px; --gw:100vw; --gh:100vh;
    font-family:"IPAPGothic","IPAGothic",sans-serif}

  /* The frame around the game. Left black it reads as a recording mistake; as a
     deliberate surround it reads as a frame, and it is where the words live.
     It is four strips rather than one full-frame panel because the caption layer
     sits above the game in the stacking order — a panel spanning the frame would
     paint over the very thing being explained. Each strip carries the same
     gradient sized to the whole frame and shifted into place, so the four of
     them read as one continuous surface with a hole in it. */
  #pfxMat>i{position:absolute;display:block;
    background-image:radial-gradient(ellipse at 50% 42%,#1e1109 0%,#0b0603 70%,#050302 100%);
    background-size:100vw 100vh;background-repeat:no-repeat}
  #pfxMat .t{left:0;right:0;top:0;height:var(--gy);background-position:0 0}
  #pfxMat .b{left:0;right:0;top:calc(var(--gy) + var(--gh));bottom:0;
    background-position:0 calc(-1 * (var(--gy) + var(--gh)))}
  #pfxMat .l{left:0;width:var(--gx);top:var(--gy);height:var(--gh);
    background-position:0 calc(-1 * var(--gy))}
  #pfxMat .r{left:calc(var(--gx) + var(--gw));right:0;top:var(--gy);height:var(--gh);
    background-position:calc(-1 * (var(--gx) + var(--gw))) calc(-1 * var(--gy))}
  /* Transparent inside, so it rims the picture without covering it. */
  #pfxMat .ring{left:var(--gx);top:var(--gy);width:var(--gw);height:var(--gh);
    background:none;box-shadow:0 0 0 0.19vh rgba(255,200,110,.22)}

  #pfxCover{position:absolute;inset:0;background:#000;opacity:1}
  #pfxCover.off{opacity:0}
  #pfxFlash{position:absolute;inset:0;background:#fff;opacity:0}
  #pfxFlash.go{animation:pfxFlash .36s linear}
  /* Holds briefly at full strength: the capture only samples ~19.5 times a
     second, and this frame is the timing mark the soundtrack is checked
     against, so it has to survive being sampled. */
  @keyframes pfxFlash{0%{opacity:.94}28%{opacity:.9}100%{opacity:0}}

  /* --- the running title, in the band above the game --- */
  #pfxTop{position:absolute;left:4%;right:4%;
    top:0;height:var(--gy);display:flex;align-items:center;justify-content:center;opacity:0}
  #pfxTop.on{opacity:1;animation:pfxDrop .26s cubic-bezier(.2,1.6,.4,1)}
  #pfxTop .b{display:inline-block;padding:1.1vh 3vh;border-radius:1.6vh;
    background:linear-gradient(180deg,#ffd85e,#f2a01c);
    color:#2a1608;font-size:3.4vh;font-weight:700;white-space:nowrap;
    box-shadow:0 .8vh 0 rgba(0,0,0,.45),0 0 4.6vh rgba(255,190,60,.5)}
  @keyframes pfxDrop{0%{transform:translateY(-3vh) scale(.86);opacity:0}100%{transform:none;opacity:1}}

  /* --- caption stack, in the band below the game ---
     YouTube lays its progress bar and controls over the bottom of a landscape
     player, so the stack is bottom-anchored a little above the edge rather than
     centred in the band. */
  #pfxCap{position:absolute;left:4%;right:4%;
    top:calc(var(--gy) + var(--gh));bottom:0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding-bottom:2.4vh;text-align:center;opacity:0}
  #pfxCap.on{opacity:1}
  #pfxCap .line{display:block;margin:0 auto .9vh;width:fit-content;max-width:100%;
    padding:.9vh 2.4vh;border-radius:1.4vh;
    background:rgba(8,5,2,.86);border:.28vh solid rgba(255,214,110,.5);
    color:#fff;font-size:3.6vh;line-height:1.34;font-weight:700;white-space:nowrap;
    text-shadow:0 .37vh 0 rgba(0,0,0,.9);
    animation:pfxPop .2s cubic-bezier(.2,1.7,.4,1) both}
  #pfxCap .line:nth-child(2){animation-delay:.08s}
  #pfxCap .line:nth-child(3){animation-delay:.16s}
  #pfxCap .line em{font-style:normal;color:#ffd75e}
  #pfxCap .line b{font-weight:700;color:#7ef0c0}
  #pfxCap .line.sm{font-size:2.9vh}
  @keyframes pfxPop{0%{transform:scale(.8) translateY(1.2vh);opacity:0}100%{transform:none;opacity:1}}

  /* --- chapter card: covers the frame between topics --- */
  #pfxChap{position:absolute;inset:0;opacity:0;transition:opacity .3s ease;
    background:radial-gradient(ellipse at 50% 45%,#2a1608,#080402 72%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2vh}
  #pfxChap.on{opacity:1}
  #pfxChap .n{color:#f2a01c;font-size:2.8vh;font-weight:700;letter-spacing:.4vh}
  #pfxChap .h{color:#ffd75e;font-size:7vh;font-weight:700;text-align:center;line-height:1.24;
    text-shadow:0 .6vh 0 rgba(0,0,0,.75),0 0 5.6vh rgba(255,180,60,.45)}
  #pfxChap .d{color:#e8dccb;font-size:3.2vh;font-weight:700;text-align:center}

  /* --- finger tap ring --- */
  .pfxRing{position:absolute;width:7.4vh;height:7.4vh;margin:-3.7vh 0 0 -3.7vh;border-radius:50%;
    border:.42vh solid rgba(255,255,255,.95);box-shadow:0 0 2vh rgba(255,220,120,.9);
    animation:pfxRing .4s ease-out forwards}
  @keyframes pfxRing{0%{transform:scale(.35);opacity:1}100%{transform:scale(1.4);opacity:0}}

  /* Killing a monster opens the reward dialog, which dims the field and covers
     the beat. A stylesheet !important beats the inline display the game sets. */
  #rewardModal{display:none !important}

  /* --- end card --- */
  #pfxEnd{position:absolute;inset:0;opacity:0;transition:opacity .35s ease;
    background:#120a05;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.4vh;
    padding:6vh 8vh 10vh}
  #pfxEnd.on{opacity:1}
  #pfxEnd::before{content:"";position:absolute;inset:0;
    background:radial-gradient(ellipse at 50% 36%,rgba(150,84,20,.55),rgba(10,6,3,0) 62%)}
  #pfxEnd>*{position:relative}
  #pfxEnd .t{color:#ffd75e;font-size:7.4vh;font-weight:700;text-align:center;line-height:1.2;
    text-shadow:0 .6vh 0 rgba(0,0,0,.75),0 0 5.6vh rgba(255,180,60,.45)}
  #pfxEnd .s{color:#fff;font-size:3.4vh;font-weight:700;text-align:center;line-height:1.6}
  #pfxEnd .s u{text-decoration:none;color:#8fe9ff}
  #pfxEnd .cta{margin-top:1vh;padding:2vh 4vh;border-radius:2vh;
    background:linear-gradient(180deg,#ff7676,#d42525);color:#fff;font-size:3.8vh;font-weight:700;
    text-align:center;line-height:1.5;box-shadow:0 1.1vh 0 rgba(0,0,0,.45);
    animation:pfxPulse 1s ease-in-out infinite}
  #pfxEnd .cta em{font-style:normal;color:#ffe27a}
  @keyframes pfxPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  `;

  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  const root = document.createElement('div');
  root.id = 'pfxRoot';
  root.innerHTML = `
    <div id="pfxMat"><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="ring"></i></div>
    <div id="pfxFlash"></div>
    <div id="pfxTop"><span class="b"></span></div>
    <div id="pfxCap"></div>
    <div id="pfxChap"><div class="n"></div><div class="h"></div><div class="d"></div></div>
    <div id="pfxEnd">
      <div class="t"></div>
      <div class="s"></div>
      <div class="cta"></div>
    </div>
    <div id="pfxCover"></div>`;
  document.body.appendChild(root);

  const $$ = id => document.getElementById(id);

  // The mat and both text bands are positioned off wherever the game actually
  // is. The game recomputes its own scale on resize and on entering fullscreen
  // views, so this is remeasured continuously rather than read once — a band
  // pinned to a stale rect would drift onto the play area exactly when a beat
  // changed the layout.
  const measure = () => {
    const g = document.querySelector('.game');
    const r = g ? g.getBoundingClientRect() : null;
    const s = $$('pfxRoot').style;
    if (!r || r.width < 40 || r.height < 40) {
      // Fullscreen views (the skill tree) have no .game box to sit around; the
      // bands collapse to the frame edges and captions go back over the picture.
      s.setProperty('--gx', '0px'); s.setProperty('--gy', '0px');
      s.setProperty('--gw', '100vw'); s.setProperty('--gh', '84vh');
      return;
    }
    s.setProperty('--gx', Math.round(r.left) + 'px');
    s.setProperty('--gy', Math.round(r.top) + 'px');
    s.setProperty('--gw', Math.round(r.width) + 'px');
    s.setProperty('--gh', Math.round(r.height) + 'px');
  };
  measure();
  setInterval(measure, 120);
  window.__measure = measure;
  window.__gameRect = () => {
    const g = document.querySelector('.game');
    const r = g && g.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  };

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

  window.__top = (html) => {
    const t = $$('pfxTop');
    if (!html) { t.className = ''; return; }
    t.querySelector('.b').innerHTML = html;
    t.className = '';
    void t.offsetWidth;
    t.className = 'on';
  };

  window.__cap = (lines) => {
    const c = $$('pfxCap');
    if (!lines || !lines.length) { c.className = ''; c.innerHTML = ''; return; }
    c.className = 'on';
    c.innerHTML = lines.map(l => `<span class="line${l.length > 26 ? ' sm' : ''}">${l}</span>`).join('');
  };

  // Between topics rather than over them: a long-form video needs somewhere for
  // the viewer to catch up, and a full-frame card is also the cleanest place to
  // hide the state rebuild the next section needs.
  window.__chapter = (n, head, sub) => {
    const c = $$('pfxChap');
    if (!head) { c.classList.remove('on'); return; }
    c.querySelector('.n').textContent = n || '';
    c.querySelector('.h').innerHTML = head;
    c.querySelector('.d').innerHTML = sub || '';
    c.classList.add('on');
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
  window.__mount = sel => {
    const host = (sel && document.querySelector(sel)) || document.body;
    host.appendChild(document.getElementById('pfxRoot'));
  };

  // Hiding the dialog with CSS is not enough: the game gates further monster
  // hits on its inline display being "flex", so that value has to be cleared too
  // or nothing can be killed after the first drop.
  window.__suppressRewards = () => {
    setInterval(() => {
      const m = document.getElementById('rewardModal');
      if (m && m.style.display && m.style.display !== 'none') m.style.display = 'none';
    }, 30);
  };

  window.__end = (t, s, cta) => {
    const e = $$('pfxEnd');
    e.querySelector('.t').innerHTML = t;
    e.querySelector('.s').innerHTML = s;
    e.querySelector('.cta').innerHTML = cta;
    e.classList.add('on');
  };

  // Debug aid: paints the strip YouTube's own player chrome sits on top of.
  window.__safeZones = () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;inset:0;z-index:100000;pointer-events:none';
    d.innerHTML =
      '<div style="position:absolute;left:0;right:0;bottom:0;height:12%;background:rgba(255,0,0,.34);' +
      'border-top:2px solid #f00"></div>';
    document.getElementById('pfxRoot').appendChild(d);
  };

  return true;
};
