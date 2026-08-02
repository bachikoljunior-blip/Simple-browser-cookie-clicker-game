// Burned-in caption / FX layer for the promo capture.
// Injected into play.html at record time; never shipped with the game.
// All sizes are in vw so the same layout holds at any capture resolution.
window.__promoInstall = function () {
  const css = `
  #pfxRoot{position:fixed;inset:0;z-index:99999;pointer-events:none;
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
  #pfxTop{position:absolute;left:2.5%;right:2.5%;top:37.5%;display:flex;justify-content:center;opacity:0}
  #pfxTop.on{opacity:1;animation:pfxDrop .26s cubic-bezier(.2,1.6,.4,1)}
  #pfxTop.hi{top:5.5%}
  #pfxTop .b{
    display:inline-block;padding:1.157vw 3.241vw;border-radius:1.852vw;
    background:linear-gradient(180deg,#ffd85e,#f2a01c);
    color:#2a1608;font-size:3.935vw;font-weight:700;white-space:nowrap;
    box-shadow:0 0.926vw 0 rgba(0,0,0,.45),0 0 5.093vw rgba(255,190,60,.5);
    transform:rotate(-1.2deg)}
  @keyframes pfxDrop{0%{transform:translateY(-5.093vw) scale(.82);opacity:0}100%{transform:none;opacity:1}}

  /* --- caption stack, anchored so it can never run off frame --- */
  #pfxCap{position:absolute;left:2.5%;right:2.5%;bottom:11%;text-align:center;opacity:0}
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

  /* --- end card --- */
  #pfxEnd{position:absolute;inset:0;opacity:0;transition:opacity .35s ease;
    background:#120a05;
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3.241vw;padding:0 6%}
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
  window.__mount = sel => {
    const host = (sel && document.querySelector(sel)) || document.body;
    host.appendChild(document.getElementById('pfxRoot'));
  };

  window.__end = (t, s, cta) => {
    const e = $$('pfxEnd');
    e.querySelector('.t').innerHTML = t;
    e.querySelector('.s').innerHTML = s;
    e.querySelector('.cta').innerHTML = cta;
    e.classList.add('on');
  };

  return true;
};
