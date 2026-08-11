// Records the YouTube Shorts promo for クッキーストラテジャー.
//   node director.mjs         -> records video/frames at 900x1600 (+ trim.json)
//   node director.mjs shots   -> no video, one screenshot per beat for review
//
// Opening the browser, building the save states and driving the board all live
// in stage.mjs, which the long-form director uses too. What is left here is the
// cut itself — the order of the beats and how long each one is held.
import { openStage } from './stage.mjs';
import { VARIANTS, byId } from './variants.mjs';

// Which cut to render. Every cut shares the body of the video and differs in the
// opening screen and claim — see variants.mjs.
const VARIANT = byId(process.env.PROMO_VARIANT || 'unit') || VARIANTS[0];
const SHOTS = process.argv[2] === 'shots';
const SAFE = process.argv[3] === 'safe';   // overlay the Shorts chrome zones

// The game scales its board to the viewport width but caps it at 900px, so
// capture 9:16 at exactly 900 wide to fill the frame with no letterboxing.
// A 1.2x lanczos upscale to 1080x1920 happens at encode time.
const W = 900, H = 1600;

const stage = await openStage({
  width: W, height: H, fps: 20, quality: 95,
  overlay: 'overlay.js', mobile: true, shots: SHOTS,
});
const {
  page, ev, wait, shot, mark, flash, cap, top,
  tapAt, tapEl, tapBurst, hitMonsters,
  setLateGame, setFresh, setMidGame, grant,
  showTab, setPlayFullscreen, waitForImages, toPlayScreen, hideRewardModal,
  autoScroll, scrollToHeading, showCooking, begin, finish,
} = stage;
if (SAFE) await ev(() => window.__safeZones());

// =============================================================== SCENE 1 — hook
// The number itself is the hook: the counter runs off the end of the units most
// people know, so lead with "do you know this unit?" rather than "big number".
//
// Two things matter more here than anywhere else. The play area goes full-bleed
// so the counter and the cookie own the frame instead of sharing it with a list
// of shop rows, and the text is already on screen when the cover lifts — a Short
// that opens on half a second of untitled gameplay has lost the scroll already.
await setLateGame();
await hideRewardModal();
await showTab('shopTab', false);
await setPlayFullscreen(true);

// Whatever the cut opens on is built here, while the cover is still down, so the
// first frame is already the finished picture however long it took to arrange.

// A check that only prints is not a mechanism -- it is a note asking someone to
// be careful, and instruction 7 says care is not the fix. Three hook screens had
// readbacks that printed 「投稿しないこと」 and then carried on rendering, which
// leaves the refusal to whoever reads the log. This throws instead: autopost runs
// director through execFileSync, so a non-zero exit kills the run before the
// upload rather than after it.
//
// It asks whether the text is IN THE FRAME, not whether it is in the document.
// The DOM version passed on a take whose panel was entirely off-screen, because
// every node label lives in that textContent.
const mustSee = async (label, pattern, root = 'body') => {
  const r = await ev(([sel, src]) => {
    const re = new RegExp(src);
    // Both the roots and their descendants. Querying only `sel + ' *'` misses
    // the case where the text lives on the root element itself, which is how
    // .quotaStageBadge (a leaf carrying 「第52層」) came back as "not on screen"
    // on a frame that was showing it.
    // What is wanted is the SMALLEST element that carries the text, so the
    // rectangle measured below is the evidence and not a panel wrapping it.
    //
    // That used to be spelled "a leaf, or a leaf with <br>s in it" — the drop
    // table in the 一覧 panel is one <div> of <br>-separated lines, and a strict
    // children.length===0 test had reported 「オーバーキル」 as absent from a
    // screen that was showing it. The tag whitelist was the wrong repair: the
    // 記録 rows are `<div class="infoRow"><img><b>名前</b> 累計… / 次の記録 …</div>`,
    // where the sentence sits in a text node beside an <img> and a <b>, and the
    // check again called it absent from a screen that had it on it.
    //
    // Asked directly instead: keep the matches none of whose children match. No
    // tag list to keep extending, and it says what "smallest" actually means.
    const all = [...document.querySelectorAll(sel), ...document.querySelectorAll(sel + ' *')]
      .filter(n => re.test(n.textContent || ''));
    const hit = all.filter(n => ![...n.children].some(c => re.test(c.textContent || ''))).pop();
    if (!hit) return { ok: false, why: 'その文が画面のどこにも無い' };
    hit.scrollIntoView({ block: 'center' });
    const b = hit.getBoundingClientRect();
    const onScreen = b.top >= 0 && b.bottom <= window.innerHeight && b.width > 0 && b.height > 0;
    if (!onScreen) return { ok: false, why: `画面外 y=${Math.round(b.top)}` };
    // Being in the viewport is not the same as being visible. Twice in one run
    // the evidence was inside the frame and covered by my own overlay — first
    // the banner sitting on 「この周回あと 5/5 個」, then the caption doing it
    // again after the banner moved. Both passed a viewport-only check.
    //
    // Rect intersection against the overlay's own boxes, not elementFromPoint:
    // the caption layer sets pointer-events:none, so hit-testing passes straight
    // through it and reported "visible" on a frame where the caption was sitting
    // on the evidence.
    //
    // #pfxTop is the banner and #pfxCap the caption lines (overlay.js). Measure
    // the leaf spans inside them — the containers are full-width and would
    // report a collision with anything on their row.
    const boxes = [...document.querySelectorAll('#pfxTop *, #pfxCap *')]
      .filter(n => n.getClientRects().length && n.textContent.trim())
      .map(n => n.getBoundingClientRect());
    const overlapX = boxes.map(o => Math.max(0, Math.min(b.right, o.right) - Math.max(b.left, o.left))
      * (o.top < b.bottom && o.bottom > b.top ? 1 : 0));
    const worst = Math.max(0, ...overlapX) / (b.width || 1);
    if (worst > 0.25) {
      return { ok: false, why: `テロップが根拠の${Math.round(worst * 100)}%を覆っている` };
    }
    return { ok: true, why: `y=${Math.round(b.top)}` };
  }, [root, pattern.source ?? String(pattern)]);
  console.log(`  ${label}: ${r.ok ? '見えている' : '✗ ' + r.why} (${pattern})`);
  if (!r.ok) {
    throw new Error(`掴みの根拠が画面に映っていない: ${label} — ${r.why}. `
      + 'テロップが画面と食い違う take なので、投稿せずにここで止める。');
  }
};

const hookScreen = {
  play: async () => {},
  quota: async () => { await setMidGame(); },
  hunt: async () => {
    await ev(() => {
      try { showMonster('swarm'); showMonster('boss'); } catch (e) {}
      state.huntFocusLv = 20;
    });
  },
  craft: async () => {
    // Panel shares the frame with the play field rather than taking it over.
    // Full-page, the game's own workshop layout puts the crafting list down the
    // left and decorative art down the right — in portrait that is half a frame
    // of scenery, which is a weak two and a half seconds to open on. Sharing
    // keeps the board (and its motion) in shot above the list.
    await setPlayFullscreen(false);
    await showTab('workshopTab', false);
    await waitForImages('workshopTab');
  },
  info: async () => {
    await setPlayFullscreen(false);
    await showTab('infoTab', true);
    await waitForImages('infoTab');
    await scrollToHeading('infoTab', '現在の倍率・状態');
  },
  // The same 一覧 panel as `info`, parked on a different heading. 素材の入手
  // prints the whole drop table — which kill gives which material — and that is
  // a rule a viewer cannot guess, written out by the game itself.
  drops: async () => {
    await setPlayFullscreen(false);
    await showTab('infoTab', true);
    await waitForImages('infoTab');
    await scrollToHeading('infoTab', '素材の入手');
  },
  tree: async () => {
    await setPlayFullscreen(false);
    await ev(() => { try { closeTabPageFullscreen(); openSkillTreeView(); } catch (e) {} });
    await page.waitForTimeout(700);
    await tapEl('#skillTreeOnlyBtn');
    await page.waitForTimeout(600);
    await ev(() => window.__mount('#skillChoiceScreen'));
    await ev(() => {
      setSkillMapZoom(0.45, false);
      const f = document.querySelector('.skillMapFrame');
      f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;
      f.scrollTop = (f.scrollHeight - f.clientHeight) * 0.35;
    });
    await page.waitForTimeout(400);
  },
  // The order board is the one screen in the game that runs a clock. It prints
  // its own terms — 「依頼が1件ずつ届く。制限時間内に達成で報酬。時間切れは次へ、
  // 選び直し不可。」 — above a card with a draining 残り時間 bar, which is what
  // makes a cut about deadlines something the frame can show rather than
  // something the narration has to assert.
  //
  // The order is placed deliberately rather than left to whatever the sim rolls:
  // createOrderSnapshot() picks at random from whatever is currently available,
  // so an unseeded take would open on a different card every render and the
  // caption could not name what is on screen. 討伐依頼 is chosen because its
  // progress reads as a count of monsters, which the body then goes and shows.
  order: async () => {
    await setPlayFullscreen(false);
    await ev(() => {
      try {
        state.activeOrder = createOrderSnapshot('monsterOrder');
        // Mid-progress, not zero: a bar at 0% and a bar that does not exist look
        // the same at Shorts size, and the point of the shot is that something
        // is being counted against a clock.
        state.activeOrder.progress = Math.max(1, Math.floor(state.activeOrder.need * 0.45));
        state.completedOrders = 37;
        renderOrder();
      } catch (e) {}
    });
    await showTab('orderTab', true);
    await waitForImages('orderTab');
    // Left at native size on purpose. The card sits in the top quarter and the
    // rest of the frame is background art, which is tempting to fix with a CSS
    // scale — and that was tried: transform:scale(1.45) on #orderPanel overflows
    // the viewport, so the box borders leave the frame and both ends of every
    // line get clipped ("…制限時間内に達成で報酬" with its opening cut off, and the
    // 7/17体 counter gone entirely). Bigger and cropped is worse than smaller and
    // whole, because the lines are the evidence. The ring on .orderTimeBar is
    // what carries the eye instead.
  },
  // The play field sharing the frame with the shop list, which is the only
  // arrangement where the quota bar — and the 第52層 badge at its right end —
  // is actually drawn. On the fullscreen play screen .quotaStageBadge exists in
  // the DOM at zero size, which is why `layers` was refused twice before this
  // screen existed. Do not move that cut back to `play`.
  board: async () => {
    await setPlayFullscreen(false);
    await showTab('shopTab', false);
    await waitForImages('shopTab');
  },
  // (`bake` の画面はここに在ったが、焼き加減がプレイヤーに解放されない死んだ
  //  機能だと分かったので消した。経緯は variants.mjs の「棄却: `bake`」。)
  // The reward modal, which no cut had opened. Every entry in REWARD_POOL has its
  // own illustration (images/37..54_reward_*.png), so this is one of the two
  // screens in the game that is mostly picture — the other is the cooking panel,
  // and that cut is the highest-reaching statement hook on the channel.
  //
  // The three risk-category perks are placed directly rather than fought for:
  // buildMonsterRewardChoices() draws from the whole unlocked pool weighted by
  // category, so the odds of all three landing in one roll are poor, and a take
  // that comes back with three ordinary perks under a caption about drawbacks is
  // a constraint-11 violation. The shape copied from the same function
  // (play.html:18078) so the panel renders them as it would its own.
  risk: async () => {
    // Full-bleed behind the modal. Sharing the frame with the shop list put a
    // wall of upgrade rows behind a translucent panel, and the first frame read
    // as two screens on top of each other rather than one.
    await setPlayFullscreen(true);
    const why = await ev(() => {
      try {
        // `body.skillChoiceMode #rewardModal { display: none !important }`
        // (play.html:138). setLateGame grants every skill, which can leave the
        // save paused on the skill-choice screen — and there the modal is in the
        // DOM at zero size, so the second refusal read 「画面外 y=0」 rather than
        // 「その文が画面のどこにも無い」. Same distinction the `layers` cut hit.
        document.body.classList.remove('skillChoiceMode', 'titleScreenMode');
        // stage.mjs's hideRewardModal() pins this modal to `display: none`
        // with !important, because on every other cut it is an obstruction —
        // it dims the screen and its backdrop eats the taps aimed at the next
        // monster. This is the one cut where the modal is the subject, so the
        // pin comes off. showRewardChoices() only sets the inline display, so
        // without this the modal stayed hidden with all three cards built:
        // cards=3, modal=none, every card 0x0.
        document.getElementById('rewardModal').style.removeProperty('display');
        // Two cards, not three. Three fitted only by running the panel from 25%
        // to 80% of the frame, and Shorts reserves the bottom 20% for its own
        // chrome — so the caption's own slot landed on the third card and the
        // occlusion check refused the take at 73%. Both of these print 「反動」,
        // so the claim is still carried twice.
        pendingRewardChoices = ['deepPursuit', 'chainPrep']
          .map(id => REWARD_POOL.find(x => x.id === id))
          .filter(Boolean)
          .map(r => ({
            kind: 'perk', id: r.id, key: 'perk:' + r.id,
            name: r.name, category: r.category, count: 1, desc: r.desc,
          }));
        showRewardChoices(20, []);
        // showRewardChoices() opens the modal in its rewardLocked state, where
        // the game hides #rewardChoices behind the 「報酬を手に入れた！」 notice
        // (play.html:2887) — the first take was refused with the cards present
        // in the DOM and nothing on screen. This is the step the player's own
        // OK tap performs.
        revealRewardChoices();
        // Re-asserted after the fact, not just cleared before it. Clearing the
        // pin ahead of showRewardChoices() was not enough — the probe still
        // read modal=none with all three cards built — so the last word on this
        // property belongs to the cut that needs the modal visible.
        document.getElementById('rewardModal').style.setProperty('display', 'flex', 'important');
        // .rewardPanel is width: min(420px, 100%) — sized for a phone, where 420
        // CSS px is the whole screen. The capture viewport is wider than that,
        // so the panel came out occupying about a third of the frame with the
        // card text too small to read at Shorts size.
        //
        // zoom, not transform: scale(). Scaling #orderPanel by 1.45 clipped every
        // line in it, because a transform leaves the layout box the old size and
        // paints outside it. zoom re-lays-out at the new size, so the text stays
        // whole — which is the property this frame is judged on.
        //
        // 1.75 rather than the 2.2 the first readable take used: at 2.2 the
        // panel ran 13%–88% of the frame and left nowhere for the overlay, so
        // the banner landed in the gap between two cards and the caption sat on
        // the first card's name. 1.75 keeps the card text legible at Shorts size
        // and clears a band top and bottom for the banner and the caption.
        document.getElementById('rewardModal').style.setProperty('zoom', '1.6');
        // The modal centres its panel, so shrinking it moved both edges inward
        // and the cards stayed in the middle of the frame — where the caption's
        // own slot is. Shorts reserves the bottom 20% for its chrome, which puts
        // the caption's top edge near 63% of the frame, so the evidence has to
        // live above that. Anchoring the panel to the top and pushing it clear of
        // the banner leaves the cards in the 16%–55% band, between the two
        // overlays rather than under one of them.
        const rm = document.getElementById('rewardModal');
        rm.style.setProperty('align-items', 'flex-start', 'important');
        // 21%, not 9%: at 9% the panel's first card sat directly under the
        // banner's slot and the banner covered 深追いの契約's name. The occlusion
        // check passed — it guards the 反動 line, not the card's title — so this
        // one came from opening the frame. 15% still clipped the title; the
        // banner occupies roughly 11%–17% of the frame, so the panel has to
        // start below that.
        rm.style.setProperty('padding-top', '21%', 'important');
        const b = document.querySelector('#rewardChoices .rewardBtn');
        const r = b && b.getBoundingClientRect();
        const cs = el => el ? getComputedStyle(el).display : 'なし';
        return `body="${document.body.className}" cards=${document.querySelectorAll('#rewardChoices .rewardBtn').length}`
          + ` modal=${cs(document.getElementById('rewardModal'))}`
          + ` panel=${cs(document.querySelector('.rewardPanel'))}`
          + ` choices=${cs(document.getElementById('rewardChoices'))}`
          + ` locked=${document.getElementById('rewardModal').classList.contains('rewardLocked')}`
          + ` 1枚目=${r ? Math.round(r.width) + 'x' + Math.round(r.height) + ' @y' + Math.round(r.top) : 'なし'}`;
      } catch (e) { return String(e); }
    });
    // Reported rather than assumed: a modal that is present but zero-sized looks
    // identical to a healthy one from the setup code's side.
    console.log('  報酬モーダル:', why);
    await page.waitForTimeout(600);
  },
  // The shop list, which no cut had opened on -- `play` hides it by going
  // full-bleed. The claim is the escalation at the bottom of it, so the list is
  // scrolled to the end and the last row is checked against the viewport before
  // the take is allowed to stand.
  shop: async () => {
    await setPlayFullscreen(false);
    await showTab('shopTab', false);
    await waitForImages('shopTab');
    await mustSee('shop 最終行', /反物質オーブン/, '#shopTab, #shop');
  },
  // Same skill screen as `tree`, but zoomed into one node instead of showing the
  // whole map. The claim -- that the idle cap can be removed outright -- exists
  // as text in exactly one place, the 終わらぬ焼窯 node's own description, so the
  // detail panel has to be on that node or the frame does not back the caption.
  //
  // selectedSkillId is what the panel reads (play.html:13709), and it is set
  // directly rather than by clicking the node: the same lesson as the workshop
  // dish switch, where a synthetic click did nothing three takes running.
  skill: async () => {
    await setPlayFullscreen(false);
    await ev(() => { try { closeTabPageFullscreen(); openSkillTreeView(); } catch (e) {} });
    await page.waitForTimeout(900);
    await ev(() => window.__mount('#skillChoiceScreen'));
    // No #skillTreeOnlyBtn here, unlike `tree`. That button switches to the
    // map-only view, which is what `tree` wants and is exactly wrong for this
    // cut: it hides the detail panel, and the panel is the only place in the
    // game where 「放置生産の時間上限を撤廃。」 is written down.
    // Which node, from the cut. The screen is the same one `offline` uses; only
    // the selected node differs, so a new skill-based cut needs no code here.
    await ev(id => { try { selectedSkillId = id; renderSkillChoiceScreen(); } catch (e) {} },
      VARIANT.hook.skillId || 'endless_oven');
    await page.waitForTimeout(500);
  },
  // The workshop's cooking half, which nothing had used -- `recipes` and the two
  // craft cuts all open on the equipment list. showCooking() already exists in
  // stage.mjs (it grants skills, opens the workshop, then clicks the dish switch
  // by data attribute rather than by label, because the panel prints 料理 as a
  // heading in the locked box too).
  //
  // showCooking() alone is not enough here: the take came back with the 作成/料理
  // switch still on 作成 and the 装備の作成 heading in shot, under a caption saying
  // 料理. So the switch is clicked again after the panel has finished rendering,
  // and the heading is read back and printed -- a silent failure here is a
  // constraint-11 violation that verify() cannot see.
  cook: async () => {
    await showCooking();
    // The 作成/料理 switch is wired with the game's addTap, not a click listener,
    // so b.click() does nothing -- two takes came back with 装備の作成 in shot
    // under a caption saying 料理. renderWorkshop() reads state.wsSubTab
    // (play.html:10336), so set that and re-render instead.
    await ev(() => { try { state.wsSubTab = 'dish'; renderWorkshop(); } catch (e) {} });
    await waitForImages('workshopTab');
    await mustSee('cook 見出し', /料理\(時限バフ/, '#workshopPanel');
  },
  // Same board as `order`, opposite half of it. renderOrder() draws the quest box
  // under the timed request, and with no active order the timed half collapses to
  // one waiting line — which leaves the quest sitting near the top of the frame
  // where its number can be read. Deliberately not a second shot of the order
  // card: two cuts back to back on the same picture is a re-upload with different
  // words on it.
  quest: async () => {
    await setPlayFullscreen(false);
    await ev(() => {
      try {
        // Clearing activeOrder alone does not hold: the sim spawns a
        // replacement on the next tick (the first take came back with a fresh
        // 0/17体 card, near-identical to the `order` cut's frame). nextOrderAt
        // is what actually gates the spawn, so push it out — which puts the
        // board in its genuine 「次の注文まで」 waiting state rather than hiding
        // anything, and leaves the quest as the only thing being counted.
        state.activeOrder = null;
        // Inside the interval the screen itself states, not past it. A 20-minute
        // push put 「次の注文まで 19:59」 directly above the game's own
        // 「現在の間隔 3:05」 — a contradiction the viewer can read, in a frame
        // whose whole job is to be checkable. 175s at 14 runs is consistent
        // (1800 × 0.85^14 = 185s) and the take is 13 seconds long.
        state.nextOrderAt = Date.now() + 175 * 1000;
        state.stageUnlocked = 1;
        state.questKills = { 1: 0 };
        renderOrder();
      } catch (e) {}
    });
    await showTab('orderTab', true);
    await waitForImages('orderTab');
  },
  // The research list is 21 cards deep and the count is the claim, so this opens
  // at the top and lets hookMotion scroll — a still frame of three cards cannot
  // carry "21種類" on its own.
  research: async () => {
    await setPlayFullscreen(false);
    await showTab('researchTab', true);
    await waitForImages('researchTab');
  },
  // The prestige screen states its own cost and says, in the game's words, that
  // it rises every run. Opening on run 0 is deliberate: the number that makes
  // the hook work is the first one, and setLateGame leaves the save at run 14.
  prestige: async () => {
    await setPlayFullscreen(false);
    await ev(() => {
      state.prestigeRuns = 0;
      state.prestigeUnlockedEver = true;
      try { renderActiveTab(); } catch (e) {}
    });
    await showTab('prestigeTab', true);
    await waitForImages('prestigeTab');
    await scrollToHeading('prestigeTab', '転生');
  },
  // 周回方針の選択画面。`cook` が言い切りの帯(126〜193)を341で破ったとき、
  // 効いたのが文の形なのか画の強さなのかを分けられなかった —— cook だけが
  // 「絵が大きく並ぶ画面」で、他は全部 UI かテキストだった。ここはその軸の
  // 2本目で、しかも料理と違って画面が自分で規則を書いている
  // (「この周回の方針を1つ選択(途中変更不可)」)ので、問いの形とも両立する。
  //
  // play.html:4856 が #policyChoiceRow 限定で画像を大きくしているので、
  // 5枚が上3・下2で並ぶ。ここを選ばず prestigeTab を使うと、方針は
  // 「周回方針：標準」という1行のテキストにしかならない。
  policy: async () => {
    await setPlayFullscreen(true);
    await ev(() => {
      try {
        // risk と同じ理由。setLateGame が全スキルを与えるので、セーブが
        // スキル選択画面で止まっていることがあり、そのとき body の
        // skillChoiceMode が別のオーバーレイを出したままになる。
        document.body.classList.remove('skillChoiceMode', 'titleScreenMode');
        // 素材との相性文は workshopTabUnlocked() でしか出ない(play.html:13598)。
        // setLateGame は工房を解放済みにするので5枚とも bias 行つきで並ぶ。
        openPolicyChoiceScreen();
      } catch (e) {}
    });
    await page.waitForTimeout(400);
    // 素で撮ると縦の上半分が空いた背景のままで、5枚は画面の中〜下段に小さく
    // 収まる —— この切り口は「絵が大きく並ぶ画面」の軸を試すために在るのに、
    // 絵が小さいままでは軸そのものが試せていない。
    //
    // transform:scale ではなく zoom。scale はレイアウトを動かさずに描画だけ
    // 拡げるので、`order` で枠外へ溢れて両端が切れた。zoom はレイアウトごと
    // 組み直すので、中身は枠の中に収まったまま大きくなる。
    await ev(() => {
      const inner = document.querySelector('#policyChoiceScreen .policyChoiceInner');
      if (inner) inner.style.zoom = '1.32';
    });
    await page.waitForTimeout(400);
    await mustSee('方針 途中変更不可', /途中変更不可/, '#policyChoiceScreen');
  },
  // 討伐マイルストーン。「同じ種類を倒し続けると恒久ボーナスが付く」という、
  // 放置ゲーの見た目からは出てこない規則。25体で1段、以降4倍ごと
  // (play.html killRecordTier)。
  //
  // 置き場所を最初 一覧タブだと読み違えた。recordRows は renderWorkshop の中に
  // あり(play.html:10355)、工房タブの「料理」サブタブ側にしか描かれない
  // —— つまり `cook` と同じ画面の下端。infoTab を開いて撮ろうとした take は
  // 掴みの検査に「その文が画面のどこにも無い」で落とされた。仕組みのほうが
  // 私の記憶より正しかった。
  //
  // setLateGame は killRecords を触らないので、素で撮ると全17行が
  // 「累計0体 / 次の記録25体 / 記録0段：ボーナスなし」になる —— 規則は
  // 書いてあるのに効いている例が1つも無い画面で、テロップだけが倍率を
  // 語ることになる。これは指示11に触れるので、記録のほうを実際に積む。
  record: async () => {
    await setPlayFullscreen(false);
    await ev(() => {
      try {
        // 段がばらける値を入れる。全部同じ数だと「種類ごとに別々に数えている」
        // という主張のほうが画面から読めない。25/100/400/1600 が段の境目。
        const n = [1740, 430, 118, 96, 27, 512, 63, 210, 31, 88, 1210, 44, 150, 26, 340, 72, 19];
        state.killRecords = state.killRecords && typeof state.killRecords === 'object'
          ? state.killRecords : {};
        Object.keys(MONSTER_TYPES).forEach((id, i) => {
          state.killRecords[id] = n[i % n.length];
        });
        renderActiveTab();
      } catch (e) {}
    });
    // cook と同じ経路で料理サブタブへ。b.click() は効かない（工房のサブタブは
    // addTap で配線されている）ので、state を書いて描き直す。
    await showCooking();
    await ev(() => { try { state.wsSubTab = 'dish'; renderWorkshop(); } catch (e) {} });
    await waitForImages('workshopTab');
    // 料理の棚は cook が使った絵なので、そこは通過して記録欄で止める。
    //
    // ただし記録欄はパネルの最下部にあるので、素の scrollToHeading では
    // スクロール上限に当たって画面の下半分にしか来ない —— 最初の take は
    // 帯もテロップも料理の写真の上に乗り、記録の行はその下に切れて並んだ。
    // 検査は通る（根拠は映っている）が、掴みとしては焦点が2つある絵になる。
    // パネルの末尾に空きを足して、記録欄を上まで送れるようにする。映るものは
    // ゲームが描いたそのままで、足したのは何も書いていない余白だけ。
    await ev(() => {
      const box = document.getElementById('workshopPanel') || document.getElementById('workshopTab');
      if (!box || box.querySelector('#pfxSpacer')) return;
      const sp = document.createElement('div');
      sp.id = 'pfxSpacer';
      sp.style.height = '900px';
      box.appendChild(sp);
      // policy でやった zoom はここでは効かない。試したら見出しごと枠の上へ
      // 流れて行数も減った —— あちらは中身が枠に収まっている画面、こちらは
      // スクロールする一覧で、zoom がスクロール量のほうを変えてしまう。
      // 下半分が工房の背景になるのは受け入れる（この切り口は「絵の強さ」では
      // なく「当てられない問い」の側で出している）。
    });
    // 見出しの文字は完全一致で探される（stage.mjs の scrollToHeading）。
    // '記録' だけ渡した take は head=false を返して黙って何もせず、料理の棚の
    // まま撮れていた —— 戻り値を誰も見ていなかったので、失敗が静かに通った。
    // 見出しの全文を渡し、'ok' でなければここで落とす。
    const sc = await scrollToHeading('workshopTab', '記録(討伐マイルストーン)');
    if (sc !== 'ok') throw new Error(`記録欄までスクロールできなかった: ${sc}`);
  },
  // 周回開始前のステージ選択。`endless` が「ステージを6つにして最後だけ
  // 終わらなくした」を言い切りで扱ったが、選べること自体は扱っていない
  // —— 解放済みなら第1に戻れる。renderStageChoiceScreen は
  // maxUnlockedStageNo() までしか描かないので、解放数を入れないと1枚しか出ず、
  // 「選ぶ」という主張の根拠が画面に無くなる。
  stagepick: async () => {
    await setPlayFullscreen(true);
    await ev(() => {
      try {
        document.body.classList.remove('skillChoiceMode', 'titleScreenMode');
        state.stageUnlocked = 5;
        openStageChoiceScreen();
      } catch (e) {}
    });
    await page.waitForTimeout(700);
    await mustSee('ステージ 第5', /星屑の銀河/, '#stageChoiceScreen');
  },
};
// 掴みの最初の1秒を、証拠の画面ではなくクッキーそのものに使う。
//
// 2026-08-10。外部レビュー3本（`restart` / `stages` / `formula`）が、切り口も
// 画面も題材も違うのに、**上位の理由をそろえて同じにした**:
// 「冒頭が茶色い極小テキストの一覧で、何のゲームか分からない」
// 「いちばん強い絵（巨大クッキー）が4.5秒まで出てこない」。
// 3人とも互いの講評も作り手の事情も知らない。**切り口ではなく型の問題。**
//
// 型がそうなっていた理由は構造にある: hookScreen の設定は録画が始まる**前**に
// 走っていたので、**フレーム0がいきなりパネルの中身**だった。クッキーは一度も
// 映らないまま、掴みの2.8秒が終わっていた。
//
// なので、クッキー画面（hookScreen.play は何もしない = 素の状態）のまま録り始め、
// タップを撃ってから、**カメラの前で**証拠の画面を開く。副産物として、
// レビュー3本が2番目に挙げた「買う瞬間・開く瞬間が映っていない/変化が見えない」も
// 埋まる —— 開く動きそのものが画になる。
//
// **見直す条件**: これ以降に作った本と、それ以前の本の再生数を比べる。差が出ない
// なら「冒頭が何の絵か」は配信量に効いていないので、この1秒は掴みの尺として
// 返してよい（capAt の実験と同じで、変えたのは1点だけにしてある）。
// 個別の切り口は `hook.preroll: false` で降りられる —— 状態を書き換える設定
// （setMidGame 等）を持つ画面は、数字がカメラの前で飛ぶので降ろすこと。
const COOKIE_SCREENS = new Set(['play', 'quota', 'hunt', 'board']);
const setupHookScreen = hookScreen[VARIANT.hook.screen] || hookScreen.play;
const PREROLL = VARIANT.hook.preroll ?? !COOKIE_SCREENS.has(VARIANT.hook.screen);
// 前→後の下ごしらえは**録画の前**にやる（`hook.reveal`。中身は overlay.js）。
// カメラの前でやりたいのは「買う瞬間」だけで、そのために状態を戻す操作まで
// 映すと、行が2回ちらついて、どちらが出来事なのか読めなくなる。
const REVEAL = VARIANT.hook.reveal || null;
if (REVEAL) {
  const got = await ev(a => window.__revealPrep(a), REVEAL);
  console.log(`  前→後の下ごしらえ: ${got}`);
  if (typeof got !== 'string' || !got.startsWith('ok')) {
    throw new Error(`前→後の下ごしらえが成立していない（${got}）。`
      + '行が現れる瞬間を撮れない状態で撮り始めるので止める。');
  }
}
if (!PREROLL) await setupHookScreen();

await page.waitForTimeout(400);
// Lift the music bed well above the game's own ceiling. Without it the take is
// mostly silence with occasional spikes: quiet enough that YouTube's loudness
// normalisation turns it up, which only makes the spikes worse.
await ev(() => {
  settings.bgmVolume = 100;
  settings.seVolume = 100;
  try { if (bgmGainNode) bgmGainNode.gain.value = 0.42; } catch (e) {}
});
// Short mode: hook → 討伐 → CTA, and nothing else.
//
// The only retention curve this channel has (UUCI_m2Xqus, 51s) loses half its
// viewers by 7.6s and 91% by 13.8s. Everything after that — the workshop, the
// research screen, the skill tree, the payoff, and the recruitment card the
// video exists to deliver — is being shown to under a tenth of the audience.
// Adding beats to a video nobody reaches is not promotion; it is decoration.
//
// So this path keeps the hook, keeps the single most kinetic beat (golden
// cookie into a swarm and a boss), and gets to the CTA while people are still
// watching. It is a test, not a verdict: the curve above comes from a video
// this pipeline did not make, so its shape may not be ours.
const SHORT = process.env.PROMO_LENGTH === 'short';
const cues = [];

await top(VARIANT.hook.banner, VARIANT.hook.bannerPos);
// The question goes up alone. The answer comes later — see `capAt` below.
//
// 2026-08-10. Two outside reviewers, on two unrelated cuts (`restart`, `stages`),
// independently gave the same top reason for swiping: the hook asks a question
// and the caption underneath it answers the question in the same frame. "問いを
// 出した0.1秒後に答えを見せたら、続きを見る理由がゼロになる." Neither reviewer was
// told anything about how the cut was built, and neither was told what the other
// said. That is two blind hits on one mechanism.
//
// It was already written down as the untested experiment in CLAUDE.md 第2部 —
// `cook`'s 341 could be explained either by its picture being the strongest of
// the 26 hooks, or by it being the only cut that does NOT answer itself up
// front. The two hypotheses were tangled because no cut had ever separated them.
// Delaying only the caption separates them: the picture does not change, the
// wording does not change, the only thing that moves is when the answer arrives.
await cap([], VARIANT.hook.capPos);
await page.waitForTimeout(350);   // let the text animate in behind the cover
await begin();
const recStart = Date.now();
console.log(`  cut: ${VARIANT.id}`);
console.log('  audio:', await ev(() => window.__startRec()));
mark('hook');
if (SHORT) cues.push({ mark: 'hook', at: 0.30, text: VARIANT.hook.narration });
// クッキーを先に見せてから、証拠の画面をカメラの前で開く（上の PREROLL の理由）。
//
// **タップは録画開始の直後に始める。** 最初の版は `shot('hook')` を先に置いて
// いて、そのスクリーンショットにかかる時間ぶん **最初の1秒がまるごと静止画**に
// なっていた（実測: 0〜1.0s のフレーム間差分は 0.02〜0.17 で、最初の打点は
// 1.1秒）。レビュアーは 0.3 / 0.8 / 1.5 秒のフレームを「区別がつかない、
// 1枚の画像が貼られている」と書いて 1.5秒でスワイプした。
// **掴みの動きを測る窓が「最初のフラッシュまでの最大」だったので、
// 3秒地点でパネルが開く動き（70.95）が最初の1秒の静止（0.17）を隠していた。**
// 窓のほうは autopost の hookMoves() で直した。
//
// 6発200ms でおよそ1.2秒。証拠が出そろうのは 1.8〜2.8秒あたりで、
// capAt の既定はそのぶん後ろへずらしてある。
//
// **2026-08-10: そのタップ連打では足りなかった。** PREROLL を入れた後の take
// （`restart` 2本目）でも外部レビュアーは 1.5秒でスワイプし、理由を
// 「クッキーが脈打つだけで**出来事が起きず**、1.5秒で見る理由が尽きる」と書いた。
// 掴みの動きの検査（フレーム間差分 0.5）はその take を 2.88 で通している ——
// **検査はピクセルの差分を測り、視聴者は出来事を見ている。** 脈動と浮き数字は
// 差分を作るが、出来事ではない。しきい値を上げても測っているものは変わらない。
//
// なので開幕に置くものを、動きではなく**出来事**に替える。モンスターが湧いて、
// HPが減って、死んで、素材が落ちる —— これは差分ではなく事象で、
// **何のゲームかも同時に答えている。**
// 素材は外から来た: 落ちた5本のレビューのうち2本が、頼んでもいないのに
// 「モンスターの群れの絵(t9)で始めろ」「冒頭を金のクッキーの画面と入れ替えろ」と
// 書いた。5本全部に共通していた*理由*のほうは「最初の1.5秒に出来事がゼロ」で、
// ここで直しているのはその理由。**絵の選択は、たまたま重なった彼らの案を借りた。**
//
// **見直す条件**: これ以降の本が外部レビューを通るか、通っても再生数が
// 変わらないか。**通らなければ「開幕の出来事」も主因ではない**ので、
// 掴みそのものより後ろ（本編・尺・題材）を疑うこと。
// 個別の切り口は `hook.opening: 'taps'` で元のタップ連打に戻せる。
// **群れは一度試して外した（2026-08-10、同じ回で）。** `showMonster('swarm')` を
// 開幕に置いた take のフレームを開いたら、t0.8 と t1.5 が**ほぼ同一**だった:
// モンスターは枠の右端に小さく2体、HP は 41.977万 のまま両フレームで変わらない。
// **打撃は数えられていたのに、画面では何も起きていなかった。**
// （`hitMonster()` を6回呼んで hits=6 で通っている ——「呼んだ回数」は
// 「起きた出来事」ではない。指示7の5つ目の形を、検査を足したその場で踏んだ。）
//
// なので開幕を**金のクッキー**にした。理由は3つとも検証可能な側にある:
// (1) 現れる／消えるという**二値の事象**なので、起きたかどうかを状態で判定できる
//     （下の before/after。差分でも呼び出し回数でもない）
// (2) 画が大きい —— 群れは枠の端の小さな2体だったが、金は中央付近に置ける
// (3) 取ると中央のクッキーが目に見えて膨らむ。scene 4 が既にこの順で撮っている
//
// **2026-08-10 夕、`battle` を足した。** `golden` は swipeAt を 1.5 → 2.5 に
// 動かしたが pass ではない。**5本の外部レビューのうち3人が、頼まれてもいないのに
// 独立に同じ絵を名指しした**: `stages`「モンスターの群れがクッキーに群がる絵(t9)で
// 始めろ」/ `restart`「冒頭を金のクッキーの画面と入れ替えろ」/ `record`
// 「9秒の戦闘画面（群れ＋ボス＋HPバー）を0秒に持ってこい」。
// **重なった理由を信じる**（RUNBOOK 3-2）——— 単独の fix は n=1 だが、
// 互いの講評も作り手の事情も知らない3人が同じ絵を指したのは、絵の側の情報。
//
// **RUNBOOK は「この一手は打てない」と書いていた。それは誤りだった。**
// 曰く「障害は `hook.expect` ——『証拠は掴みの中に無ければならない』を強制して
// いるので、掴みを戦闘にすると全部の切り口が例外で落ちる。証拠を掴みの後ろに
// 置けるようにする設計変更が要る」。**その設計変更は PREROLL として既に在る。**
// PREROLL の回は「開幕は別の絵 → そのあと証拠の画面を開く → expect を見る」の
// 順で、`expect` が見るのは開幕ではなく**開いたあと**の画面。
// つまり必要だったのは設計変更ではなく、`openingEvent()` に戦闘を足すことだけ。
// **手順書に「打てない」と書いてあったせいで、1日ぶん打たれなかった。**
// → 手順書に障害を書くときは、その障害を**実際にコードで確かめてから**書くこと。
//
// **群れは 2026-08-10 午前に一度外している。今回それを外した理由と直した点**:
// 前回の take は t0.8 と t1.5 がほぼ同一で、モンスターは枠の右端に小さく2体、
// HP は 41.977万 のまま動かなかった。**原因は「殴っていたが倒せていなかった」**
// —— `hitMonster()` を6回呼んで hits=6 で通っていたが、素のダメージでは
// HP が目に見えて減らない。scene 4 は同じ絵を撮るのに `state.huntFocusLv = 20`
// を先に入れていて、**そちらは倒せている。** 開幕にも同じ下ごしらえを入れる。
// 判定も「呼んだ回数」ではなく**討伐数の増加**（状態の差）にした ——
// 倒れたかどうかは画面の出来事そのもので、差分でも呼び出し回数でもない。
//
// **見直す条件**: これで swipeAt が 2.5 から動かなければ、**掴みの絵は主因では
// ない。** 5回外したことになるので、次は掴みより後ろ（尺・本編・題材）を疑うこと。
const OPENING = VARIANT.hook.opening ?? 'golden';
async function openingEvent() {
  if (OPENING === 'taps') { await tapBurst('#cookie', 6, 200); return 'taps'; }
  if (OPENING === 'battle') {
    // **1体だけにする。HPが8発かけて減って、最後に落ちる。**
    //
    // 2026-08-10 夕、最初の版は `showMonster('swarm')` + `showMonster('boss')` を
    // 湧かせて9発殴り、**`monsters.length` が減ったことを確かめて合格していた。**
    // 外部レビュアーは同じ take を見て「タップも、**何かが倒れる瞬間**も無い、
    // 0.3/0.8/1.5秒はほぼ同じ絵」と書いて 2.5秒でスワイプした。
    // **状態は変わっていたのに、画面では誰も倒れて見えなかった。**
    //
    // 理由は2つ、どちらもコードで裏が取れる:
    // (1) `hitMonster()` は先頭に `if (rewardPending || rewardModalOpen()) return;`
    //     を持つ（play.html:17898）。**1体倒した時点で報酬待ちになり、残り8発は
    //     何もしていない。** 数は 4→3 に減るので、私の検査は通る。
    // (2) 群れは `目安1撃` で消えるので、HPバーは満タンのまま**忽然と消える**。
    //     減っていく過程が1フレームも無い ——「倒れる瞬間」は無い。
    //
    // **一般化（指示7に足す形）**: 「呼んだ回数 ≠ 出来事」は午前に学んだ。
    // **「状態の変化 ≠ 見える出来事」はその次の段**で、今回そこで踏んだ。
    // 状態で判定する検査は、事象が**起きたこと**は証明できるが、
    // **画面で読めること**は証明しない。読めるかは人が見るしかない（それが外部レビュー）。
    //
    // なので 8発で落ちる強さに**実測から合わせる**。定数で書くと、周回の状態や
    // ステージでHPが変わったときに黙って1撃に戻る（そして検査は通る）。
    // **位置は動かさない。** 一度動かして失敗した（同じ回で）:
    // `mon.el.style.left/top` を `.top` の寸法で書いたら、モンスターの
    // offsetParent は `.top` ではないので**枠の外に出た。** そのとき
    // `getBoundingClientRect()` は 232x242 @401 という**もっともらしい値**を
    // 返して私の可視判定を通し、**フレームには1体も映っていなかった。**
    // 矩形は「レイアウト上どこか」であって「見えている」ではない。
    // 素の位置で湧かせた take は実際に映っている（同じ回の1本目で確認済み）。
    const setup = await ev(() => {
      try { showMonster('swarm'); showMonster('boss'); } catch (e) { return String(e); }
      const list = (typeof monsters !== 'undefined' && monsters) || [];
      if (!list.length) return 'モンスターが出ない';
      // **いちばん弱い個体に合わせる。** 最初は `list[0]`（ボス）で合わせて
      // いて、ボスが3発で落ちる強さは群れを**1撃**で消した ——— t0.8 に4体、
      // t1.5 に0体、間の「減っていく」フレームが1枚も無い絵になった。
      // 弱いほうに合わせると、群れが3発ずつ・ボスはさらに何発もかかるので、
      // **開幕の2秒がずっと戦闘のまま**になり、HP バーが減り続ける。
      const weakest = list.reduce((a, b) => (b.maxHp < a.maxHp ? b : a), list[0]);
      const base = Math.max(1, Math.ceil(monsterBaseDamage() * monsterDamageMultiplier(weakest)));
      // **3発で落ちる強さ。** 1撃だと HP バーは満タンのまま忽然と消えるので、
      // 「減っていく過程」が1フレームも残らない ——— レビュアーが
      // 「何かが倒れる瞬間が無い」と書いたのはこれ。
      state.huntFocusLv = Math.max(1, Math.ceil(weakest.maxHp / (base * 3)) - 1);
      return { n: list.length, hp: weakest.maxHp, lv: state.huntFocusLv };
    });
    if (typeof setup === 'string') throw new Error(`開幕の戦闘を出せない（${setup}）`);
    await wait(400);            // 群れとボスと HP バーが画面に載る間
    // **報酬待ちを毎回どける。** `hitMonster()` の1行目は
    // `if (rewardPending || rewardModalOpen()) return;`（play.html:17898）で、
    // **1体倒した瞬間に残りの打撃が全部無効になる。** 最初の take はそれで
    // 9発中1発しか効いておらず、`monsters.length` が 4→3 に減ったのを見て
    // 私の検査は合格を出していた。**殴るたびに報酬をどけて、次を殴れる状態に戻す。**
    for (let i = 0; i < 10; i++) {
      await ev(() => {
        const mon = (typeof monsters !== 'undefined' && monsters[0]) || null;
        if (!mon || !mon.el) return false;
        const r = mon.el.getBoundingClientRect();
        window.__ring(r.x + r.width / 2, r.y + r.height / 2);
        hitMonster(mon.id);
        return true;
      });
      // 260ms。**打撃の間隔が開幕の尺を決めている。** 120ms だと10発が1.2秒で
      // 終わり、t1.5 のフレームは**もう誰もいない野原**になっていた（実測）。
      // 1体あたり何発かかるかは倍率次第で読み切れないので、**倒れる速さではなく
      // 打つ速さのほうで尺を作る。** 10発×260ms ≒ 2.6秒 —— レビュアーが指を
      // 動かす 1.2〜2.5秒のあいだ、画面はずっと戦闘のまま。
      await wait(260);
      await hideRewardModal();
    }
    await wait(350);            // 落ちた反応と素材
    const left = await ev(() => (typeof monsters !== 'undefined' && monsters.length) || 0);
    await hideRewardModal();    // 次の画面を覆わせない
    // **半分以上倒れていること。** 「1体減った」で合格にすると、
    // 報酬待ちで止まった take が今日と同じように通る。
    if (!(left <= setup.n / 2)) {
      throw new Error(`開幕の戦闘で倒れた数が足りない（湧き${setup.n}→残り${left}・HP${setup.hp}・Lv${setup.lv}）。`
        + '報酬待ちで殴れていないか、3発の見積りが外れている。');
    }
    return `討伐=湧き${setup.n}→残り${left}（1体あたり3発の想定）`;
  }
  // 置き場所は scene 4 と同じ理由 —— ゲームは金を画面のどこにでも落とすので、
  // 「どこにでも」には下端（小さく、YouTube のUIの下、誰も見ないうち消える）が入る。
  const born = await ev(() => {
    try { showGoldenCookie(); } catch (e) { return String(e); }
    const btn = document.getElementById('goldenCookie');
    const host = document.querySelector('.top');
    if (!btn || getComputedStyle(btn).display === 'none') return 'なし';
    if (host) {
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
      btn.style.left = Math.round(host.clientWidth * 0.55) + 'px';
      btn.style.top = Math.round(host.clientHeight * 0.20) + 'px';
    }
    return 'あり';
  });
  await wait(650);          // 現れたことが読める間。ここが「前」の状態
  await tapEl('#goldenCookie');
  await wait(450);          // 取った反応（中央のクッキーが膨らむ）が出るまで
  // 存在ではなく**表示**で見る。#goldenCookie は常設のボタンで、ゲームは
  // style.display を切り替えるだけ ——「要素があるか」で見た最初の版は、
  // 取っても消えない（あり→あり）と報告して自分で自分を止めた。
  const gone = await ev(() => {
    const b = document.getElementById('goldenCookie');
    return (b && getComputedStyle(b).display !== 'none') ? 'あり' : 'なし';
  });
  return `金=${born}→${gone}`;
}
if (PREROLL) {
  const what = await openingEvent();
  console.log(`  開幕の出来事: ${OPENING} ${what}`);
  // 印字ではなく停止（指示7）。**「あり→なし」以外は事象が起きていない。**
  // 現れなかった（なし→なし）なら開幕は素のクッキー画面のままで、それは直前に
  // 5本続けて落ちた型そのもの。消えなかった（あり→あり）ならタップが外れていて、
  // 画には金が置いてあるだけ ——「置いた」は出来事ではない。
  // `battle` は自分の中で状態差を見て throw するので、ここは golden の判定だけ。
  if (OPENING === 'golden' && what !== '金=あり→なし') {
    throw new Error(`掴みの開幕に出来事が起きていない（${what}）。`
      + '期待は「金=あり→なし」（現れて、取られて、消える）。');
  }
  await setupHookScreen();
}
await shot('hook');
// Pre-setting the text means the opening frames would otherwise be motionless.
// Tapping the cookie gives the hook real movement — floating numbers and the
// game's own click — instead of a still frame with a caption on it.
// Give the opening seconds movement, whatever screen the cut opens on.
//
// Only `unit` had taps, so the other five cuts opened on a completely still
// picture — and `unit` is the one cut that has ever been distributed. One data
// point is not proof, but a static frame is a known-bad opening for a medium
// that decides in two seconds, and it costs nothing to fix. It matters more in
// short mode, where the hook is not an introduction to the video: it is a fifth
// of it.
//
// The motion has to suit the screen. Tapping the cookie is invisible while a
// panel is open, so the list screens scroll instead and the skill map drifts.
const hookMotion = {
  play:  () => tapBurst('#cookie', 4, 340),
  quota: () => tapBurst('#cookie', 4, 340),
  hunt:  () => tapBurst('#cookie', 3, 300),
  craft: () => autoScroll('workshopTab', 0.14, 1500),
  info:  () => autoScroll('infoTab', 0.12, 1500),
  drops: () => wait(400),
  tree:  () => ev(() => {
    const f = document.querySelector('.skillMapFrame');
    if (f) f.scrollTo({ top: f.scrollTop + f.clientHeight * 0.35, behavior: 'smooth' });
  }),
  prestige: () => autoScroll('prestigeTab', 0.12, 1500),
  // The order card is the whole shot and it already animates its own countdown,
  // so scrolling would only push the evidence out of frame. Hold still and let
  // the 残り時間 bar do the moving.
  order: () => wait(400),
  quest: () => wait(400),
  // No scroll here, unlike the other list screens. showCooking() positions the
  // panel on the dish section and a scroll walks straight off it into the
  // equipment rows below — the first take opened on a wall of unnamed flasks
  // with 作成 buttons, under a caption that said 料理.
  cook:  () => wait(400),
  skill: () => wait(400),
  shop:  () => wait(400),
  board: () => tapBurst('#cookie', 4, 340),
  research: () => autoScroll('researchTab', 0.12, 1500),
  // The modal covers the play field, so a tap burst would be both invisible and
  // aimed at an element the overlay is blocking. The panel's own entry animation
  // is the movement here.
  risk:  () => wait(400),
  // どちらも選択肢が画面いっぱいに並ぶ専用画面で、スクロールする先が無い。
  policy: () => wait(400),
  stagepick: () => wait(400),
  // 記録は見出しに合わせてあるので、共通の info スクロールを流すと
  // `craftcap` と同じで根拠が枠外へ出る。
  record: () => wait(400),
};
// Ring first, then move. Called after the motion it only appeared 1.6s in — past
// the window the whole hook exists to win. The point of pointing at the evidence
// is that the evidence is seen while the viewer is still deciding.
//
// Reports rather than assumes: a selector that stops matching would otherwise
// remove the evidence from the shot without anything saying so.
if (VARIANT.hook.spot) {
  // Compare against true, not truthiness. A page-side exception comes back as a
  // string, and a string is truthy — so "did it work?" answered yes for every
  // possible failure. That is how a check reports success on a take where
  // nothing was highlighted at all.
  const hit = await ev(sel => window.__spot(sel, 2600), VARIANT.hook.spot);
  console.log(`  spot ${VARIANT.hook.spot}: ${hit === true ? 'ok' : `失敗 (${hit})`}`);
}
// A cut can hold still. The screen-level motions scroll their lists, which is
// right when the claim is "there is a lot of this" and wrong when the claim is
// one line near the top — `craftcap` had its evidence scrolled out of frame by
// the shared craft motion.
//
// `'reveal'` は3つ目の宣言（2026-08-10 夕）。共通のスクロールは流さないが、
// **動きの検査は降りない。** 前→後を撮る切り口は、行が現れることそのものが
// 動きなので、共通スクロールに証拠を動かされては困る一方で、
// 「動かなかった take」は事故のまま止めたい。`'still'` にしてしまうと
// 検査ごと降りてしまい、reveal が空振りした take が黙って通る。
const moved = VARIANT.hook.motion === 'reveal'
  ? (() => wait(120))       // 出来事はこの後に来る。ここで待つぶんだけ後ろへ寄る
  : VARIANT.hook.motion === 'still'
  ? (() => wait(300))
  : (hookMotion[VARIANT.hook.screen] || hookMotion.play);
// Implicit stillness is a defect; declared stillness is a choice.
//
// 2026-08-10. `restart` opens on `skill`, whose entry above is `wait(400)` — no
// motion at all. The recorded hook scored 0.01–0.09 per frame for its whole 2.8s
// (the beats that genuinely move score 3–28), and an outside reviewer swiped at
// 1.5s naming the still opening as the reason. Nothing in the pipeline objected:
// `verify` asks whether a render is broken, and a held frame is not broken.
//
// Nine of the entries above are `wait(...)`. None of those cuts decided to hold
// still — they inherited it from a table, which is how a comment fifteen lines
// up can say a static opening is known-bad while most screens are static.
//
// So the gate keys on the declaration, not the screen: `hook.motion: 'still'` is
// an author saying "hold, I know" — `craftcap` says it because the shared scroll
// pushed its evidence out of frame — and that is respected. Everything else is
// expected to move, and autopost throws on a take that did not.
const hookAsksToMove = VARIANT.hook.motion !== 'still';
await moved();
// 答えを読める大きさにする（`hook.zoom`）。**囲うのではなく、寄る。**
//
// 2026-08-10 夕。外部レビュー6本のうち6本が「掴みの答え／冒頭が読めない小文字の
// 一覧表」を理由に挙げた。**これは掴みの絵の話でも、答えの時刻の話でもない。**
// 今日ここで打った手は3つとも「何を映すか」「いつ映すか」を動かすもので
// （PREROLL / capAt / battle）、swipeAt は 1.5 → 2.5 → 2.5 と止まった。
// **6本が名指ししていたのは「映しているものが読めない」ほう**で、そこは
// 一度も触っていない。**重なった理由を信じる**（RUNBOOK 3-2）。
//
// 寄せるのは `moved()` のあと。スクロールの共通モーションが先に走るので、
// 先に寄せると craftcap と同じ事故（根拠が枠外へ押し出される）になる。
// **返り値を捨てないこと** —— `__zoom` は理由つきの文字列を返し、
// ok 以外は例外にする。値を返すだけの検査は検査ではない（指示7）。
if (VARIANT.hook.zoom) {
  const z = VARIANT.hook.zoom;
  // `minShare` は「寄れたか」の本体。**2026-08-11 に足した** ——
  // それまで `ok WxH` の数字は印字するだけで、`stagebuy` は factor 2.1 で
  // カード9枚が並んだフレームに対して ok を返していた（外部レビュアーは
  // 「読めない極小文字の一覧表」と書いて1.5秒でスワイプ）。理由は overlay.js。
  const got = await ev(a => window.__zoom(a[0], a[1], a[2], a[3], a[4]),
    [z.root, z.target, z.factor ?? 2, z.contains || null, z.minShare ?? null]);
  console.log(`  掴みのズーム: ${got}`);
  if (typeof got !== 'string' || !got.startsWith('ok')) {
    throw new Error(`掴みのズームが効いていない（${got}）。`
      + '根拠が読めない大きさのまま撮れるので止める。');
  }
  await wait(250);   // 寄ったことが1フレーム以上残るように
}
// **行が現れる瞬間を、カメラの前で起こす**（`hook.reveal`）。
//
// 2026-08-10 夕。この台帳でいちばん重なりの強い指摘で、**半分だけ実装して
// 残していた半分。** 7本目と8本目のレビュアーが、互いの講評も作り手の事情も
// 知らないまま**行の選び方まで一致させて**「上の段が買われた瞬間に下の段が
// 現れるところを撮れ」「その行が挿入される前→後を0秒目に置け」と書いた。
// 寄る（`__zoom`）は在ったが、寄れるのは**既に在る行**で、
// 現れる瞬間は一度も撮っていなかった。
//
// **順番が要点**: 寄る → 前を確かめる → タップ → 後を確かめる。
// 寄ってからタップするので、視聴者は**読める大きさの行が入れ替わるのを見る**。
// 逆にすると、入れ替わった後の一覧に寄ることになり、それは今までと同じ
// 「読めない小文字の一覧表」に戻る（6/7 が挙げた理由）。
//
// **検査は前と後の両方を見る。** 後だけ見ると、最初から在った行を「現れた」と
// 報告する take が通る —— 今日それと同じ形で1回外している
// （`monsters.length` の減少で合格して、倒れる瞬間が1フレームも無かった）。
// **段の境目を、桁を回しながら跨ぐ**（`hook.reveal.ramp`、2026-08-11 夜）。
// 中身と根拠は overlay.js の `__revealRamp`。ここでは「跨ぎ終わるまで待つ」だけ
// やる —— 待たずに `__revealAfter` を呼ぶと、まだ前の単位が出ているので落ちます。
// **返り値を捨てないこと**（指示7の5つ目の形）: 跨ぐ前から後の単位が在った回は
// `__revealRamp` が理由を返すので、それを見ずに進むと
// 「何も起きていない take」が「跨いだ」として通ります。
// **跨いでいる間、クッキーを叩き続ける**（`hook.reveal.tap`、既定 true）。
//
// 2026-08-11 夜、桁送りの1本目を外部レビューに出したら 1.5秒で落ちた。理由の1位が
// 「t0.3 / t0.8 / t1.5 の**背景がピクセル単位で完全に同一**。動くのは中央の数字
// テキストだけで、動画ではなく数字を差し替えたスライドショーに見える」。
// 2位が「**クッキーが一度も叩かれず、クリッカーだと最後まで分からない**」——
// これは3人が独立に挙げた4点のうちの (d) で、**4人目**にあたります。
// `fix` も「掴みの全区間でクッキーを連打させろ」でした。
//
// 桁送りは page 側の setInterval なので、待つ代わりに叩けば**同じ尺のまま**
// 画面が動きます。叩くのは実際にクッキーが増える操作なので（`play.html` の
// タップ処理）、**画面に映っていないことを主張してはいません**（指示11）。
// ただし**増える速さは主張しない** —— 帯もキャプションもナレーションも
// 速度に触れていないことを、切り口を足すたびに確かめること。
//
// **見直す条件**: 叩きを入れた本の swipeAt が 2.5 を超えなければ、
// (d) は主因ではなかったことになる。
async function rampOrJump(spec) {
  if (spec.ramp === false) { await grant(spec.next); return; }
  const got = await ev(a => window.__revealRamp(a), spec);
  console.log(`  桁送り: ${got}`);
  if (typeof got !== 'string' || !got.startsWith('ok')) {
    throw new Error(`桁送りが成立していない（${got}）。`);
  }
  const ms = (spec.rampMs == null ? 2600 : spec.rampMs) + 120;
  if (spec.tap === false) { await wait(ms); return; }
  // **回数ではなく締切で数える。** 最初は `tapBurst(..., ms/260, 200)` と
  // 回数で書いて、**掴みが 4.9秒から 8.7秒に伸びました** —— 1タップの実費は
  // 200ms の間隔ではなく 500ms 前後で、回数から尺を見積もると外れます。
  // 桁送りは page 側の setInterval なので、**叩きが長引いたぶんだけ
  // 「跨ぎ終わった後に叩き続ける区間」が伸びる**（＝答えの後の静止の変種）。
  // → 締切まで叩いて、締切で止める。実費が変わっても尺は変わりません。
  // **返り値を捨てない**（指示7の5つ目の形）——`tapBurst` は箱が取れないと
  // `no box:` と印字して false を返すだけなので、見なければ
  // 「1回も叩いていない take」が黙って通ります。
  const deadline = Date.now() + ms;
  let taps = 0;
  while (Date.now() < deadline) {
    const ok = await tapBurst('#cookie', 1, 40);
    if (!ok) throw new Error('桁送りの間、クッキーを叩けなかった（#cookie が取れない）。');
    taps++;
  }
  console.log(`  桁送りの間のタップ: ${taps}回 / ${ms}ms`);
}
if (REVEAL) {
  const before = await ev(a => window.__revealBefore(a), REVEAL);
  console.log(`  前→後（前）: ${before}`);
  if (typeof before !== 'string' || !before.startsWith('ok')) {
    throw new Error(`前→後の「前」が成立していない（${before}）。`);
  }
  // **前は短く。** 1本目の take は前を 500ms 取っていて、タップが 1.5〜2.0秒、
  // 行が入れ替わるのが 2.7秒だった —— レビュアーが指を動かすのは 1.2〜2.5秒なので、
  // **出来事がその窓の後ろ端に落ちていた。** 前の行は1フレーム読めれば足りる。
  // 桁送りの回はここを短く。**跨ぐ前の 0.9倍から始まって最初の 1.8秒は
  // ずっと前の単位のまま**なので、「前」を見せる時間は ramp 自身が持っています。
  // ここで 280 待つと、そのぶん**最初の1秒の動きが減る** ——
  // 実際、レンダリングが重い回に `最初の1s 0.15`（下限 0.5 未満）が出ました。
  await wait(REVEAL.act === 'counter' && REVEAL.ramp !== false ? 100 : 280);
  if (REVEAL.act === 'counter') {
    // 単位が書き換わるのは、所持数がその桁に届いたとき。押す物は無いので
    // 出来事は grant のほうで起こす（`bodyBeyond` が前からやっている操作で、
    // ゲームが 10^72 に対して実際に組み立てる名前を出させるだけ）。
    // **画面で読めることは `__revealAfter` が文字列で見る** ——
    // 状態の変化は見える出来事ではない、を1回踏んでいるので。
    if (!REVEAL.next) throw new Error('counter の reveal に next（後の所持数）が無い。');
    await rampOrJump(REVEAL);
  } else {
    // **返り値を捨てない**（指示7の5つ目の形）。`tapEl` は箱が取れないと
    // `no box:` と印字して false を返すだけで、呼ぶ側が見なければ
    // 「何も押していない take」がそのまま進む。
    const tapped = await tapEl(`#research [data-id="${REVEAL.id}"]`);
    if (!tapped) throw new Error(`前の行をタップできなかった（${REVEAL.id}）。`);
  }
  // 列が組み替わり、後の行が読める間。**桁送りの回は 650 待たない** ——
  // ramp は最後の値まで動かしきって終わるので、ここでの待ちは
  // そのまま「答えの後の静止」（3人が独立に挙げた (b)）になります。
  // 組み替わりを待つ必要があるのは研究カードのほうだけ。
  await wait(REVEAL.act === 'counter' && REVEAL.ramp !== false ? 180 : 650);
  const after = await ev(a => window.__revealAfter(a), REVEAL);
  console.log(`  前→後（後）: ${after}`);
  if (typeof after !== 'string' || !after.startsWith('ok')) {
    throw new Error(`前→後の「後」が成立していない（${after}）。`
      + '行が現れる瞬間が撮れていないので止める。');
  }
  await wait(250);
  // **答えが出たあとの静止を、同じ出来事でもう一度埋める**（`hook.reveal.then`、
  // 2026-08-11 に足した）。
  //
  // なぜ: `unitmake` は counter の reveal で swipeAt 3.5 を出し、掴みの帯
  // （1.2〜2.5）を初めて破った。**そのとき残った宿題が2つ**あって、どちらも
  // 「書き換わった後」の話だった ——（1）レビュアーの掴みへの指摘は
  // 「0.8秒と1.5秒が完全に同一（答えの後が静止）」だけ、（2）実際に指が動いたのは
  // **3.5秒＝本体に切り替わった瞬間**。つまり **1つ目の書き換えは効いたが、
  // その後ろが空いている。** capAt で作った空白を4本ぶん指摘されたのと同じ形です。
  //
  // 対処は「待たせ方を変える」ではなく **同じ二値の出来事をもう一段置く**こと。
  // 単位名は段ごとに変わるので、grant を1回足すだけで「読める大きさの文字が
  // その場で書き換わる」がもう一度起きる（絵も画面も変えない）。
  //
  // **これは同時に、3.5秒の壁が「時刻」なのか「本体への切り替え」なのかを分ける
  // 実験でもあります。** 掴みが伸びて、なお 3.5 で指が動くなら壁は時刻の側。
  // 本体の開始まで持つなら、壁は切り替えの側（＝次の予算は本体へ）。
  //
  // 検査は1段目とまったく同じものを使い回す —— `from` は前段の `to`。
  // **「前に在って後に無い」を毎段見る**ので、grant が空振りした段は止まります。
  let prevTo = REVEAL.to;
  for (const step of REVEAL.then || []) {
    if (REVEAL.act !== 'counter') throw new Error('reveal.then は counter だけに対応しています。');
    if (!step.next || !step.to) throw new Error('reveal.then の段に next / to が無い。');
    // 1段目の後の 250ms と合わせて、書き換わった文字が読める間を置く。
    // **短いほうに倒す** —— 前の段の take で「答えの後が静止」と書かれたのは
    // 止まっている時間が長いからで、ここを伸ばすと同じ穴を自分で掘り直します。
    await wait(step.hold ?? 420);
    // 続きの段も同じ形で跨ぐ。**1段目だけ桁が回って2段目が飛ぶと、
    // 同じ画面で2つの別々の見え方をすることになる**（レビュアーはそれを
    // 「1回目は増えたのに2回目は瞬間移動した」と読む）。
    //
    // **ただし段と段の継ぎ目は、まだ飛びます**（2026-08-11、承知のうえで残した）。
    // 1段目は `next×1.06` で終わり、2段目は `next×0.94`（＝1段上の 9400）から
    // 始まるので、**単位は同じまま数字だけが 1.06 → 9400 に飛ぶ**フレームが
    // 継ぎ目に1つ入ります。段は10の4乗ごとなので、そこを線形で繋ぐと
    // 継ぎ目の直後が一瞬でぼやけて読めなくなり、直すなら対数補間で
    // 鎖全体を1本の桁送りにする必要がある。**`then` を使う切り口はいま
    // `unitnayu` 1本だけで、それは既に予約に入っている**ので、
    // この回では継ぎ目を直さずに残します。
    // **見直す条件**: `then` を使う本をもう1本作るなら、そのとき対数補間にすること。
    const stepSpec = {
      ...step, act: 'counter', from: prevTo, to: step.to,
      ramp: step.ramp ?? REVEAL.ramp, rampMs: step.rampMs ?? REVEAL.rampMs,
      rampLo: step.rampLo ?? REVEAL.rampLo, rampHi: step.rampHi ?? REVEAL.rampHi,
    };
    await rampOrJump(stepSpec);
    await wait(650);
    const spec = { act: 'counter', from: prevTo, to: step.to, minCharShare: REVEAL.minCharShare };
    const got = await ev(a => window.__revealAfter(a), spec);
    console.log(`  前→後（続き ${prevTo}→${step.to}）: ${got}`);
    if (typeof got !== 'string' || !got.startsWith('ok')) {
      throw new Error(`reveal.then の段が成立していない（${got}）。`
        + '書き換わる瞬間が撮れていないので止める。');
    }
    prevTo = step.to;
    await wait(250);
  }
}
// The answer lands here, measured from the moment recording started rather than
// from this line — `moved()` runs 400ms on the still screens and 1500ms on the
// scrolling ones, so timing it from here would put the answer at a different
// second on every cut and the experiment would measure the wrong thing.
//
// A cut can set `hook.capAt: 0` to keep the old simultaneous form (some hooks
// are a statement, not a question, and have no answer to withhold), or raise it.
// Default 1500ms: `restart`'s reviewer swiped at 1.5s and `stages`'s at 1.2s, so
// the answer now arrives after the frame where both of them had already left —
// it has to buy the stop, not reward it.
// PREROLL の回は、証拠の画面が出そろうのが 1.5〜2.5秒。1500 のままだと答えが
// クッキー画面や切り替えの途中に乗って、答えでも証拠でもないフレームになる。
// `battle` の開幕は golden より長い（湧き→9発→素材で約1.8秒）ので、既定の 2800 の
// ままだと証拠の画面が開ききる前に答えが乗る。**答えは証拠の上に置くもの**なので、
// 開幕の実尺に合わせて後ろへずらす。**上げるほど掴みが伸びる**（hold は capAt から
// 引かれるので下限 500 に張り付き、掴み全体は capAt+500 になる）ことは承知のうえ:
// 13〜15秒の本で 4.3秒は3割で、**その3割で止まらなければ残りは配られない。**
// **見直す条件**: battle の take が「戦闘は良いが長い」と言われたら、
// 殴る回数（9発）のほうを削ること。capAt はそれに追随する数字でしかない。
const capAt = VARIANT.hook.capAt ?? (OPENING === 'battle' ? 3800 : PREROLL ? 2800 : 1500);
const late = Math.max(0, capAt - (Date.now() - recStart));
if (late) await wait(late);
// Captions can be moved off the evidence, same as the banner. #pfxCap defaults
// to the lower area, which on the panel screens lands on the panel's own
// headings — the line `craftcap` exists to show.
await cap(VARIANT.hook.caption, VARIANT.hook.capPos);
// The hold has to leave room for the hook line to finish, not just for the
// motion to play. Cutting it to 900ms made the tree hook overrun by 0.73s: the
// movement was added by taking away the time the sentence needed.
//
// Whatever the delay above spent comes out of this hold, so the hook keeps its
// total length and the beats after it do not shift. The floor is 500ms: the
// answer still has to be readable before the flash cuts away from it.
const hold = VARIANT.hook.screen === 'play' || VARIANT.hook.screen === 'quota' ? 1100 : 1800;
await wait(Math.max(500, hold - late));

// Checked here, not during setup. The first version ran before hookMotion and
// therefore certified a frame that the motion then scrolled away from —
// `craftcap` passed with 「この周回あと 5/5 個」 centred and filmed with it off
// screen. The check has to measure the state that is actually recorded.
//
// Any cut may declare its own evidence, so a new one does not need to edit this
// file to be checkable. Same abort as the screen-level checks: a throw here
// exits non-zero and autopost dies before the upload.
if (VARIANT.hook.expect) {
  const e = VARIANT.hook.expect;
  await mustSee('掴みの根拠', new RegExp(e.text || e), e.root || 'body');
}

// ---- SHORT: jump straight to the kinetic beat, on the board scene 3 sets up
if (SHORT) {
  await flash();
  await cap([]);
  // Put the caption layer back on the main host first.
  //
  // The tree hook opens the skill view fullscreen and moves the overlay inside
  // it (nothing outside a fullscreen element renders). Leaving that view without
  // re-mounting leaves every later caption drawing into a host that is no longer
  // shown — the body played for eight seconds with no text on it at all, and
  // nothing in the numbers said so: duration, resolution, audio and the opening
  // frame were all fine. Scene 2 of the full sequence does this for the same
  // reason; the short path had not copied it.
  await ev(() => { try { closeSkillChoiceScreen(); } catch (e) {} window.__mount(); });
  // The `risk` hook opens the reward modal and leaves it open — and the modal
  // pauses the game and covers the play field, so the 討伐 beat played behind a
  // dimmed panel with no monsters in it, under a caption saying 群れもボスも来ます.
  // verify() saw nothing wrong: right length, right resolution, right audio.
  // Undo everything that hook set, not just the display, or the zoom and the
  // top-anchoring survive into the rest of the video.
  await ev(() => {
    // 方針選択・ステージ選択も、開いたままだと risk のモーダルと同じことになる
    // —— 画面いっぱいの .policyChoiceScreen.active が討伐ビートを覆い、
    // 「群れもボスも来ます」の下に選択画面が映る。verify() は長さも解像度も
    // 音声も正常と言うので、ここで確実に閉じる。
    try { closePolicyChoiceScreen(); } catch (e) {}
    try { closeStageChoiceScreen(); } catch (e) {}
    // 掴みが巨大化したカウンターも戻す。戻さないと本体のあいだじゅう
    // 画面中央に 128px の所持数が居座り、本体のキャプションと重なる
    // ——— risk のモーダルを閉じ忘れたのと同じ形の事故。
    try { if (window.__counterUndo) window.__counterUndo(); } catch (e) {}
    const rm = document.getElementById('rewardModal');
    if (!rm) return;
    ['zoom', 'align-items', 'padding-top'].forEach(k => rm.style.removeProperty(k));
    rm.style.setProperty('display', 'none', 'important');
    try { pendingRewardChoices = []; } catch (e) {}
    // finishQuotaPause, not endQuotaPause — the latter does not exist, and a
    // wrong name inside this try would have been swallowed silently.
    try { finishQuotaPause(); } catch (e) {}
  });
  await setMidGame();
  await toPlayScreen();
  await setPlayFullscreen(true);
}

if (!SHORT) {
// =============================================================== SCENE 2 — rewind
// Hold the same full-bleed framing the hook used, so the two states can be read
// against each other: identical composition, identical counter position, so the
// only thing that changes is the number — 25 against 100正. Dropping to the split
// view here would make it look like a different screen rather than the same one
// earlier, which is the whole point of the rewind.
await flash();
await cap([]);
await top('⏪ 最初はこう');
// Put the board back however the hook left it, then rewind.
await ev(() => { try { closeSkillChoiceScreen(); } catch (e) {} window.__mount(); });
await showTab('shopTab', false);
await setPlayFullscreen(true);
await setFresh();
await page.waitForTimeout(200);
await cap(['スタートは<em>クッキー25枚</em>']);
await shot('rewind');
await wait(1400);

await top(null);
await setPlayFullscreen(false);
await cap(['タップ1回 = <em>1クッキー</em>']);
await tapBurst('#cookie', 10, 60);
await shot('taps');
await wait(400);

// Cause then effect. The old order put "設備を買うと毎秒が増える" on screen while
// the shop still read 所持 0 / 毎秒 0, so the claim arrived before anything backed
// it up. Buy first, then say what happened.
await grant('120000');
await cap(['貯めて<em>設備</em>を買う']);
await wait(350);
for (const nth of [0, 1, 2]) {
  await tapEl(`#shop .item >> nth=${nth}`);
  await wait(200);
}
await wait(250);
await cap(['<em>毎秒</em>が増えた', 'ここまでは<b>ふつうの放置ゲー</b>']);
mark('buyResult');   // the narration line for this beat is anchored to it
await shot('buy');
await wait(1750);   // room for the summary line, and to read 毎秒 9
mark('scene2');

// =============================================================== SCENE 3 — ノルマ
// The one mechanic no other idle clicker has. Stated as a consequence, not a rule.
await flash();
await setMidGame();
await toPlayScreen();
await setPlayFullscreen(true);
await top('ここからが本題');
// 「放置したら終わる」と書いていたが、実際に終わるのは その周回のモンスター出現
// だけで、生産は続くしオフラインでも貯まる(ゲーム内FAQと放置上限スキルが根拠)。
// 放置ゲーを探している層に「放置できない」と伝わるのは、事実と違ううえに逆効果。
await cap(['生産ペースに<em>ノルマ</em>があります', '遅れると<b>その周回はモンスターが出なくなる</b>']);
await shot('quota');
await wait(2200);
await cap(['置いておくだけでも増える', 'でも<em>放置だけだと伸びない</em>']);
await shot('quota2');
await wait(1800);
mark('scene3');
}   // end !SHORT (scenes 2-3)

// Which beat the short version is built around. Posting more than one video a
// day only helps if the videos differ; in short mode the body is most of the
// video, so a second body is what makes a second daily post something other than
// a near-duplicate. Full mode always plays every beat, so this only selects.
const BODY = process.env.PROMO_BODY || 'hunt';
// `--body a+b+c` で本体を並べられる（2026-08-10 夕に足した）。
//
// なぜ: 私たちの20本は**全部 11〜15秒**で、外の上位75本の尺の中央値は 28s。
// 11〜15秒の帯は母集団で 8/75 しかいない（`rivals.mjs` の実測）。**尺は n=0 の軸**で、
// 掴みの絵のほうは4通り試して swipeAt 2.5 で頭打ちになっている。
// 尺を伸ばす最も安い形は「本体をもう1つ足す」——— 新しい絵を作らずに済むので、
// **変わるのが尺だけ**になり、切り口と掴みは既存のまま比較できる。
//
// **順番は宣言した順。コードに書いてある順ではない。** 以前は本体が
// `if (SHORT && BODY === 'x')` の羅列で、実行順はファイルの並び（hunt→scale→
// beyond→prestige）に固定されていた。それだと「単位の話」の掴みのあとに
// いきなり討伐が来る組み合わせしか作れない —— コードの並びが構成を決めていた。
const BODIES = SHORT ? BODY.split('+').map(s => s.trim()).filter(Boolean) : [];

async function bodyHunt() {
// =============================================================== SCENE 4 — 討伐
// Golden cookie first (the field cookie visibly swells), then a swarm and a boss
// on screen together — the busiest, most alive frame in the game.
await flash();
await top(null);
// 本体を並べられるようにしたので、討伐は「盤面の上から始まる」を仮定できない。
// 前の本体が転生タブや研究タブを開いたままなら、金のクッキーは湧いても映らない
// （`getBoundingClientRect()` は「見えている」ではない、と同じ穴）。
if (SHORT) { await toPlayScreen(); await setPlayFullscreen(true); }
await cap(['<em>金のクッキー</em>で生産が跳ねて'], 'high');
mark('golden');
await ev(() => {
  try { showGoldenCookie(); } catch (e) { return String(e); }
  // The game drops it anywhere on the field, and "anywhere" included the bottom
  // edge — small, half under YouTube's chrome, and gone before anyone saw it.
  // Put it in clear space below the caption and away from the centre cookie.
  const btn = document.getElementById('goldenCookie');
  const host = document.querySelector('.top');
  if (btn && host) {
    btn.style.right = 'auto';
    btn.style.bottom = 'auto';
    btn.style.left = Math.round(host.clientWidth * 0.58) + 'px';
    btn.style.top = Math.round(host.clientHeight * 0.22) + 'px';
  }
});
await wait(1250);
await tapEl('#goldenCookie');
await shot('golden');
await wait(1000);   // let the buff visibly take hold before cutting away

await cap(['<em>モンスター</em>を殴ると素材が出る', '群れも<b>ボス</b>も来ます'], 'high');
mark('swarm');
await ev(() => {
  try { showMonster('swarm'); showMonster('boss'); } catch (e) { return String(e); }
  // At this point in the run a tap does 4 damage against 173hp minions, so the
  // burst never killed anything and the drop the caption promises never
  // appeared. 狩猟集中 is the game's own damage skill; enough of it to land the
  // kills inside the beat.
  state.huntFocusLv = 20;
});
await wait(1000);
await shot('monster');
await hitMonsters(10, 105);
await wait(600);
await hideRewardModal();
mark('scene4');
if (SHORT) {
  cues.push({ mark: 'golden', at: 0.20, text: '金のクッキーで生産が跳ねます。' });
  cues.push({ mark: 'swarm', at: 0.20, text: '殴ると素材が出ます。ボスも来ます。' });
}

await ev(() => { state.huntFocusLv = 0; });
}   // end body: hunt
if (!SHORT) await bodyHunt();

// ---- SHORT body: scale — the same screen, thirty orders of magnitude apart.
// The one cut that has ever been distributed was built on this contrast, so it
// is worth a body of its own rather than only a hook.
async function bodyScale() {
  await flash();
  // Clear the hook's banner. The hunt body does this; leaving it up put
  // 「転生で消えないもの」 above 「スタートはクッキー25枚」 — two unrelated claims
  // stacked on one frame, which only showed up when the frames were actually
  // looked at rather than measured.
  await top(null);
  await toPlayScreen();
  await setPlayFullscreen(true);
  await setFresh();
  await cap(['スタートは<em>クッキー25枚</em>']);
  mark('small');
  cues.push({ mark: 'small', at: 0.20, text: '最初はクッキー25枚。' });
  await tapBurst('#cookie', 4, 300);
  await wait(900);
  await shot('small');

  await flash('stamp');
  await setLateGame();
  await setPlayFullscreen(true);
  await cap(['<em>100正</em> ＝ 10の<em>42</em>乗']);
  mark('big');
  // 「正」は解析器に ヒャク・セー と読まれる。かなで書くのは engine を問わない
  // 唯一の直し方 —— 読みの検算は open_jtalk でしかできないのに、実際に喋るのは
  // Cloud TTS なので、どちらにも同じ音を出させるにはこう書くしかない。
  cues.push({ mark: 'big', at: 0.25, text: 'いまは、ひゃくしょう。10の42乗です。' });
  await wait(2600);
  await shot('big');
}

// ---- SHORT body: beyond — what the counter says once Japanese runs out.
//
// The only cut that has ever been distributed was 「“正”って単位、知ってますか」,
// and what it had was a real unit almost nobody can place. This is that same
// vein one step further along, and the step is the surprising part: 無量大数 is
// where the standard units stop, and this game needs more of them, so it makes
// them up. 「火炉」 is not a word — it is what the game printed when it needed a
// name for 10^72.
//
// Every number here was checked by running the game's own generateHugeUnit()
// out of play.html rather than by reading the table:
//   JAPANESE_NUMBER_UNITS holds 17 named units, 万 through 無量大数
//   無量大数 = 10^68   (level 17, and each level is four digits)
//   level 18 = 10^72 -> 火炉
// The captions say only those three things. What the game does past 10^72 is a
// larger claim and is left to the description.
// **掴みがカウンターを主役にしたなら、本体でも降ろさない**（2026-08-11）。
// 3人のレビュアーが互いを知らないまま同じ場所を指した ——— 掴みで
// 「画面中央の巨大な文字がその場で書き換わる」と教えておいて、
// **見せ場（無量大数→火炉）でその文字を上端2%の極小表示に降格させていた。**
// 「一番強い主張が、一番小さい文字で裏づけられている」（2本目）。
// 掛け直しは冪等なので、掴みが counter でない回には何も起きません。
const starCounter = async () => {
  if (!REVEAL || REVEAL.act !== 'counter') return;
  const got = await ev(a => window.__counterStar(a), REVEAL);
  console.log(`  本体でもカウンターを主役に: ${got}`);
  // **返り値を捨てない**（指示7の5つ目の形）。掛け直しが効かないまま進むと、
  // 直したつもりで元の「読めない極小文字」を撮ります。
  if (typeof got !== 'string' || !got.startsWith('ok')) {
    throw new Error(`本体でカウンターを主役にできなかった（${got}）。`);
  }
};

async function bodyBeyond() {
  // **フラッシュより前にも置く**（2026-08-11 夜。安全側の重ね掛け）。
  // 桁送りの1本目の外部レビュアーが「t5.5 の**白フラッシュ越しに
  // 4181.99穣（10の28乗）が読める**。恒河沙→阿僧祇の直後に28桁戻っていて、
  // 話が後退して見える」と書いた。下の grant は画面を作り直した**後**に
  // 効くので、**作り直している最中の1〜2フレーム**は覆えていません。
  // フラッシュは半透明なので、そこが読めてしまう。
  // **これは推測に基づく重ね掛けです** —— 穣がどこから来るのかは特定して
  // いません（`toPlayScreen` / `setPlayFullscreen` のどちらかが挟む中間状態）。
  // **見直す条件**: 次の take の t5.5 を開いて、まだ穣が読めるなら
  // 原因は grant の位置ではないので、そのときに特定すること。
  await grant('1e68');
  await flash();
  await top(null);
  await toPlayScreen();
  await setPlayFullscreen(true);
  // **ここだけ grant が先。** 逆にすると、画面を作り直した直後の値
  // （実測 6736.45穣 ＝ 10の31乗）が巨大表示で1拍映り、
  // **直前に見せた恒河沙(10^52)より小さい数**が画面に出ます。
  // 2本目のレビュアーが上端の極小文字でそれを見つけて
  // 「数字が後退したように見えて話が壊れる」と書いた ———
  // **大きくすると、その傷も大きくなる。** 火炉のほうは逆で、
  // 書き換わる瞬間そのものが見せ場なので star が先です。
  await grant('1e68');
  await starCounter();
  await cap(['<em>無量大数</em> ＝ 10の<em>68</em>乗', '日本語の単位はここで終わり']);
  mark('top');
  cues.push({ mark: 'top', at: 0.20, text: 'むりょうたいすう。日本語の単位はここで終わりです。' });
  await tapBurst('#cookie', 4, 280);
  await wait(1000);
  await shot('top');

  await flash('stamp');
  await setPlayFullscreen(true);
  // **grant より先に掛け直す。** 逆にすると、書き換わる瞬間が
  // 極小文字のほうで起きて、巨大表示は「もう火炉になっている」状態で現れます
  // ——— 出来事をカメラの前で起こす、の逆。
  await starCounter();
  await grant('1e72');
  // The caption quotes 火炉 rather than pointing at it. The counter is the proof
  // and it renders at 2% from the top — inside the band YouTube draws its own
  // chrome over — so a viewer may never see it, and the payoff of the whole cut
  // would be the one thing on screen that got covered. Saying the name in the
  // caption costs a line and makes the claim survive the crop.
  // 3行目「＝ 火炉」は、**カウンターが主役になっている回だけ落とす。**
  // 上のコメントは「読めないからキャプションで言い直す」と決めていたが、
  // **言い直しは証拠ではない** ——— レビュアーは「中央にすでに書いてあるのに
  // 同じ単語を二度言われただけ」と書き、そこで問いが閉じたと言っています。
  // 巨大表示が出ていない回（掴みが counter でない回）は、今までどおり言い直す。
  await cap(REVEAL && REVEAL.act === 'counter'
    ? ['10の<em>72</em>乗の単位は', 'ゲームが<em>作ります</em>']
    : ['10の<em>72</em>乗の単位は', 'ゲームが<em>作ります</em>', '＝ <em>火炉</em>']);
  mark('made');
  cues.push({ mark: 'made', at: 0.25, text: '10の72乗の単位は、ゲームが作ります。かろ、でした。' });
  // No ring on #cookies. The invented name is small and easy to miss, which is
  // the case the ring was built for — but #cookies spans the full width, and a
  // box that wide reads as a frame rather than a pointer. That was the finding
  // from idle-trap, and it does not stop applying because this cut would like it
  // to. If the name turns out to be unreadable in the frames, the fix is a
  // caption that quotes it, not a ring around the whole counter.
  await wait(2600);
  await shot('made');
}


// ---- SHORT body: prestige — the same screen, a hundred runs apart.
//
// Verified against play.html rather than described from memory: PRESTIGE_COST_TABLE
// holds 116 entries, [0] is 5,000,000 and [115] is 1e131, and past the table the
// cost keeps extending three digits a run. So the claim is not "there are 116
// runs" — there is no cap, and saying there was one would be false. The claim is
// that the price of the first is 500万 and the price of the 116th is 10^131, and
// both of those are printed on the screen the shot is pointing at.
async function bodyPrestige() {
  await flash();
  await top(null);
  // **画面を先に開く。キャプションはそのあと**（指示11。2026-08-11 に踏んだ）。
  //
  // ここは長らく `cap('1回目は500万クッキー')` から始まっていた。転生が**唯一の本体**
  // だったころは、直前に居るのが `screen: 'prestige'` の掴みだったので、たまたま
  // 転生タブが開いたままで、根拠が画面に在った。**`--body a+b+c` で本体を繋げるように
  // した瞬間、その仮定が黙って崩れた** ——— `--body hunt+prestige` で撮った take は、
  // 金のクッキーとモンスターとボスが映っている戦闘画面の上に
  // 「1回目は500万クッキー」だけが乗っていた（外部レビュアーが見つけた）。
  // hunt / scale / beyond は3つとも画面を先に開いていて、**転生だけが違った。**
  //
  // 一般化: **前の場面が残した画面に寄りかかっている本体は、繋いだ瞬間に嘘になる。**
  // 本体は「自分が主張することの画面を、自分で開く」こと。
  //
  // 周回数も自分で戻す。前の本体が `setLateGame()` を通っていると転生済みの状態で、
  // そのとき画面が出す数は「1回目」のものではない。
  await ev(() => {
    state.prestigeRuns = 0;
    try { renderActiveTab(); } catch (e) {}
  });
  await showTab('prestigeTab', true);
  await scrollToHeading('prestigeTab', '転生');
  await cap(['1回目は<em>500万</em>クッキー']);
  mark('first');
  cues.push({ mark: 'first', at: 0.20, text: '1回目は、500万クッキー。' });
  await wait(2200);
  await shot('first');

  await flash('stamp');
  await ev(() => {
    state.prestigeRuns = 115;
    try { renderActiveTab(); } catch (e) {}
  });
  await showTab('prestigeTab', true);
  await scrollToHeading('prestigeTab', '転生');
  // Quote the screen, then give the value — not the other way round. The game
  // prints 1e131 as 「1000劫火極」, using a unit name it composed itself, so a
  // caption that only said 「10の131乗」 asserted a number the viewer cannot find
  // anywhere in the shot. Both lines are true and now both are checkable: the
  // first is what the screen says, the second is what it means.
  await cap(['<em>116回目</em>は', '<em>1000劫火極</em>', '＝ 10の<em>131</em>乗']);
  mark('last');
  cues.push({ mark: 'last', at: 0.25, text: '116回目は、10の131乗。単位の名前も変わります。' });
  await wait(2800);
  await shot('last');
}

// 宣言した順に本体を流す。**知らない名前は例外で止める** ——— `--body beyond+hunt` の
// 打ち間違いが「本体1つの短い動画」として黙って通ると、尺を試したつもりで
// 何も試していない回になる（印字するだけの検査は仕組みではない・指示7）。
if (SHORT) {
  const TABLE = { hunt: bodyHunt, scale: bodyScale, beyond: bodyBeyond, prestige: bodyPrestige };
  for (const name of BODIES) {
    const fn = TABLE[name];
    if (!fn) throw new Error(`本体 "${name}" は無い（使えるのは ${Object.keys(TABLE).join('/')}）`);
    console.log(`  body: ${name}`);
    await fn();
  }
}

if (!SHORT) {
// =============================================================== SCENE 5 — 工房
// 486 recipes is a genuinely surprising number for a clicker, and the cooking
// list pays off the ノルマ beat: one dish slows the quota clock down.
await flash();
await setPlayFullscreen(false);
await setLateGame();
// The caption goes up before the art is waited on. Waiting first left the panel
// on screen with nothing on it for over a second, three times in the video.
await showTab('workshopTab', true);
await top('素材の使い道', 'hi');
await cap(['集めた素材で<em>装備</em>を作る', 'レシピは<em>486種類</em>']);
await waitForImages('workshopTab');
await wait(400);
const craftPan = autoScroll('workshopTab', 0.30, 1900);
await shot('craft');
await wait(1800);
await craftPan;

// Scrolling moved the 作成 / 料理 buttons out of the frame, so put the page back
// to the top before reaching for one of them.
await cap([]);
await ev(() => {
  const page = document.getElementById('workshopTab');
  if (page) [...page.querySelectorAll('*')].forEach(el => {
    if (el.scrollHeight > el.clientHeight + 40) el.scrollTop = 0;
  });
});
await wait(250);
await tapEl('#workshopPanel >> text=料理');
await top(null);
await cap(['<em>料理</em>で<b>ノルマをゆるめられる</b>', '金のクッキーを出やすくする一皿も']);
await waitForImages('workshopTab');
await wait(500);
const cookPan = autoScroll('workshopTab', 0.22, 2200);
await shot('cook');
await wait(1900);
await cookPan;
mark('scene5');

// =============================================================== SCENE 6 — 研究 / 一覧
await flash();
await showTab('researchTab', true);
await cap(['<em>研究</em>を買うと<b>生産の計算式</b>が変わる']);
await waitForImages('researchTab');
await wait(400);
const researchPan = autoScroll('researchTab', 0.32, 1600);
await shot('research');
await wait(1350);
await researchPan;

await showTab('infoTab', true);
await cap(['効いている倍率は<em>全部この画面で見られる</em>']);
await waitForImages('infoTab');
console.log('  info scroll:', await scrollToHeading('infoTab', '現在の倍率・状態'));
await wait(500);
const infoPan = autoScroll('infoTab', { by: 0.34 }, 2100);
await shot('info');
await wait(1800);
await infoPan;
mark('scene6');

// =============================================================== SCENE 7 — 転生スキルツリー
await flash();
await top(null);
// The tree screen takes about 1.8s to open, zoom and settle, and the game plays
// its own fade on the way in. The caption goes up first so that stretch is not a
// blank screen, and the narration is anchored to the moment the tree is actually
// there — announcing "71 nodes" over a black frame wasted the best shot in the
// video.
await cap(['転生すると<em>スキルツリー</em>', 'ノードは<em>71個</em>']);
await ev(() => { try { closeTabPageFullscreen(); openSkillTreeView(); } catch (e) { return String(e); } });
await wait(700);
await tapEl('#skillTreeOnlyBtn');
await wait(500);
await ev(() => window.__mount('#skillChoiceScreen'));
// The map is 2120x3320, far taller than the frame — pan down it instead of
// zooming out to an unreadable speck.
await ev(() => {
  setSkillMapZoom(0.45, false);
  const f = document.querySelector('.skillMapFrame');
  f.scrollLeft = (f.scrollWidth - f.clientWidth) / 2;
  f.scrollTop = 0;
});
// The game runs its own 0.72s fade when the tree goes fullscreen; wait it out so
// the mark lands on the settled map rather than mid-wash.
await wait(800);
mark('treeReady');
const pan = ev(async () => {
  const f = document.querySelector('.skillMapFrame');
  const max = f.scrollHeight - f.clientHeight;
  const t0 = performance.now(), dur = 3200;
  await new Promise(res => {
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      f.scrollTop = max * k;
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
});
await shot('tree');
await wait(1700);
// 「転生」はジャンル外の人には"進行が消える"と読まれる。得られるもの(次の周回が
// 速くなる)を先に言わないと、リセットの罰にしか見えない。
await cap(['次の周回は<b>確実に速くなる</b>', '取り方は何度でも組み直せます']);
await shot('tree2');
await wait(1700);
await pan;
mark('scene7');

// =============================================================== SCENE 8 — payoff
// Tear the tree screen down and restore the play screen in one step, so no
// half-dressed frame (stale caption, leftover panel) ever reaches the video.
await cap([]);
await ev(() => {
  try { closeSkillChoiceScreen(); } catch (e) {}
  window.__mount();
});
await wait(250);
await toPlayScreen();
await setLateGame();
await setPlayFullscreen(true);
await flash('stamp');
await top('で、さっきの数字に戻ります');
await cap(['<em>100正</em> ＝ 10の<em>42</em>乗']);
await shot('payoff');
await wait(1950);
mark('scene8');
}   // end !SHORT (scenes 5-8)

// =============================================================== SCENE 9 — CTA
await top(null);
await cap([]);
// 「クローズドテスト中」は"未完成でまだ遊べない"、「テスター募集」は"報告作業が
// ある"と読まれやすい。募集の理由(公開に必要)と、実際にやること、対象(Android)を
// 先に出して、行動だけを赤枠に残す。
//
// 条件は募集主がチャンネルで告知しているものと一字一句そろえること。以前ここは
// 「入れたままにするだけ」と書いていたが、実際の募集条件は「ときどき起動して遊ぶ」
// も含む。動画の方を軽く言うと、来た人が聞いていた話と違うことになる。
//
// 行き先はチャンネル概要欄。一度は説明欄に変えたが、あれは間違いだった ——
// 説明欄なら中身を保証できる(投稿時に自分で書くので)という理屈は合っていても、
// YouTube は詳細機能が解放されるまで説明欄の外部リンクをただの文字として出す。
// 押せないリンクを保証しても意味がない。概要欄の「リンク」欄はボタンとして
// 描画されるので、開設まもないチャンネルではそこだけが実際に踏める導線になる。
// 説明欄にも同じURLは載せている(コピーはできるので)が、案内はしない。
await ev(() => window.__end(
  'クッキーストラテジャー',
  // 「14日間」と「基本プレイ無料」が隣り合っていると、14日間だけ無料と読める。
  '基本プレイ無料・<u>Android専用</u>（iPhone不可）<br>Google Play 公開に必要なテスターを募集中<br>14日間 入れたまま ＋ ときどき起動',
  '参加リンクは<em>チャンネル概要欄</em>に',
  // 2026-08-11 に足した4つ目の欄。**20本のあいだ、ここは空欄だった。**
  //
  // 何を確かめたか: `grep -rn 'チャンネル登録' promo/` が0件。説明欄の `cta()` にも、
  // この終了カードにも、ナレーションにも無い。**私たちは一度も「また来て」と
  // 言っていない。** そのあいだの登録者は**生涯1**で、伸びは線形のまま
  // （前の本が次の本を助けていないので、毎回ゼロから配られる）。
  //
  // 台帳（EXPLORE.md「戻ってくる理由」）には「続きもの」と「固定コメント」が
  // 並んでいて、**いちばん安い形＝ただ頼む、が抜けていた。** 実装済みだが一度も
  // 呼ばれていなかった `comment()` と同じ穴で、**在るものの一覧を作ると、
  // 無いものは項目にならない。**
  //
  // 尺は1秒も増えない —— このカードは既に 4.7秒（13秒の本の3分の1）出ている。
  // 増えるのは字だけで、赤枠（指示12のテスター募集）の下・小さい字なので順位も奪わない。
  //
  // 文面は「作っています」まで。**頻度を約束しない** —— 自動実行が止まった日に
  // 嘘になる主張を、消せない動画の中に焼き付けないこと（指示11）。
  // **改行は自分で決める。** 1行で書いたら「チャンネル登／録」で折れた
  // （フレームを開いて見つけた。`verify()` も動き検査も通っている）。
  // 折れたのは**この一行でいちばん大事な語**で、`zoom` factor 6 が
  // 「読めなさを1つ消して、壊れて見えるを1つ作った」のと同じ形。
  'この放置ゲーを1本ずつ出しています<br>→ <em>チャンネル登録</em>'));
// Mark where the card *appears*. Marking the end of the beat put the cue past
// the last frame — the card was on screen for 3.9s with nothing spoken over it.
mark('cta');
if (SHORT) cues.push({ mark: 'cta', at: 0.10, text: 'アンドロイドのテスター募集中。リンクはチャンネル概要欄に。' });
await shot('cta');
// The card is the payload, so it gets room: long enough for the line to finish
// with margin and for the terms to be read. In short mode that is a third of the
// runtime, which is the right proportion when the other two thirds exist to earn
// it. At 3900ms the closing line overran the last frame by 0.13s.
await wait(SHORT ? 4700 : 3900);
mark('scene9 / total');

await finish({
  variant: VARIANT.id,
  // Recorded so the motion gate in autopost can ask "did this take do what it
  // asked for", instead of guessing from the cut id.
  hookAsksToMove,
  ...(SHORT ? { narration: cues } : {}),
});