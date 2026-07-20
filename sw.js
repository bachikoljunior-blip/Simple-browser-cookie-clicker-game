// クッキーストラテジャー Service Worker
// ・ナビゲーション(index.html)はネット優先。オフライン時はキャッシュから返す
// ・images/ など同一オリジンの静的ファイルはキャッシュ優先(初回取得時に保存)
// ・広告(AdSense)・課金(Play Billing)・Firebase などクロスオリジンの通信には一切関与しない
// ゲーム本体を更新したら CACHE のバージョン番号を上げること(古いキャッシュは activate で消える)
const CACHE = "cookie-strategist-v2";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./images/bg_title.webp",
  "./images/logo_title.webp",
  "./images/object_cookie.webp"
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
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html"))
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
