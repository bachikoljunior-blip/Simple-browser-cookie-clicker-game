// クッキーストラテジャー Service Worker
// ・ナビゲーション(index.html)はネット優先。オフライン時はキャッシュから返す
// ・images/ など同一オリジンの静的ファイルはキャッシュ優先(初回取得時に保存)
// ・広告(AdSense)・課金(Play Billing)・Firebase などクロスオリジンの通信には一切関与しない
// ゲーム本体を更新したら CACHE のバージョン番号を上げること(古いキャッシュは activate で消える)
const CACHE = "cookie-strategist-v11";
const PRECACHE = [
  "./",
  "./index.html",
  "./play.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/bg_title.webp",
  "./images/logo_title.webp",
  "./images/bg_stage1_meadow.webp",
  "./images/screen_play.webp",
  "./images/screen_shop.webp",
  "./images/screen_research.webp",
  "./images/object_cookie.webp",
  "./images/object_goldenCookie.webp",
  "./images/object_cookieMonster.webp",
  "./images/upgrade_finger.webp",
  "./images/upgrade_grandma.webp",
  "./images/upgrade_oven.webp",
  "./images/tab_shop.webp",
  "./images/tab_research.webp",
  "./images/tab_prestige.webp",
  "./images/tab_order.webp",
  "./images/tab_workshop.webp",
  "./images/tab_info.webp",
  "./images/icon_settings.webp",
  "./images/buyMode_x1.webp",
  "./images/buyMode_x10.webp",
  "./images/buyMode_x100.webp",
  "./images/buyMode_max.webp"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    // ナビゲーションはネット優先。取得できたら「そのページのURL」でキャッシュし、
    // オフライン時は同じページ→なければ play.html→index.html の順で返す。
    // (index.html は紹介ページ、play.html はゲーム本体。ページごとに別々に保存する)
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(hit =>
            hit || caches.match("./play.html").then(p => p || caches.match("./index.html"))
          )
        )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }))
  );
});
