/* 숙제 대소동 v2.2 — 서비스 워커
   · HTML·JS·CSS는 '네트워크 우선' — 새 버전이 늦게 뜨는 일이 없습니다.
   · 아이콘·글꼴 같은 정적 파일만 캐시에서 바로 꺼내 씁니다(빠른 실행 + 설치 조건).
   · 새 버전을 올리면 CACHE 이름이 바뀌고, 예전 캐시는 activate에서 지웁니다.
*/
const CACHE = 'ema-v2.2-1';
const PRECACHE = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon-180.png',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isStatic = /\.(png|jpg|jpeg|svg|webp|ico|woff2?|ttf|otf|webmanifest)$/i.test(url.pathname);
  if (isStatic) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit || Response.error()))
    );
    return;
  }

  /* 그 밖(HTML·JS·CSS)은 항상 네트워크 우선, 실패하면 캐시 → 그래도 없으면 그대로 실패 */
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || Response.error()))
  );
});
