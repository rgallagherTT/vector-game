/* Somo service worker: after the first visit Somo opens and runs with no signal.
   - The page, manifest and icons: served from the cache at once, refreshed in the background (the next launch
     gets any update).
   - Voice packs (audio/<lang>/*.bin): file names carry a content hash, so once cached they are kept for good.
     audio/<lang>/index.json is refreshed in the background like the page.
   - Kidi's chat (the relay) and Claude: network only; the app has rules-based coaching when they cannot be reached.
   The grown-ups panel can delete voice packs to free space; deleted packs come back when needed. */
const VERSION = 'b810915009';
const SHELL = 'somo-shell-' + VERSION, AUDIO = 'somo-audio';
const SHELL_FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-180.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('somo-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

async function fresh(req, cacheName) {
  const cache = await caches.open(cacheName); const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || new Response('', { status: 504 });
}
async function kept(req) {
  const cache = await caches.open(AUDIO); const hit = await cache.match(req);
  if (hit) return hit;
  const r = await fetch(req); if (r && r.ok) cache.put(req, r.clone()); return r;
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url); if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/\/audio\/[^/]+\/.+\.bin$/.test(u.pathname)) return e.respondWith(kept(e.request));
  if (/\/audio\/[^/]+\/index\.json$/.test(u.pathname)) return e.respondWith(fresh(e.request, AUDIO));
  /* opening Somo (its folder or index.html) gets the app; other pages here (progress.html) are fetched as themselves */
  if (e.request.mode === 'navigate' && /\/(index\.html)?$/.test(u.pathname)) return e.respondWith(fresh(new Request(new URL('index.html', self.registration.scope)), SHELL));
  e.respondWith(fresh(e.request, SHELL));
});
