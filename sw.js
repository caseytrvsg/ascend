// ASCEND service worker — app code (page + our small JS files) is network-first
// so edits show up on a plain reload; big static bundles are cache-first for
// speed. Everything is cached either way, so the app still opens fully offline.
// Bump VERSION whenever anatomy.js / exercise-images.js / vendor files / icons change.
const VERSION = 'ascend-v7';
const CORE = ['./', 'index.html', 'anatomy.js', 'exercise-images.js', 'vendor/supabase-js.js', 'vendor/zxing.js', 'config.js', 'sync-core.js', 'scanner.js', 'backend.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const FRESH = ['config.js', 'sync-core.js', 'scanner.js', 'backend.js'];   // network-first app code

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;                          // let POSTs (exercise requests) pass through
  const path = new URL(e.request.url).pathname.split('/').pop();
  if (e.request.mode === 'navigate' || FRESH.includes(path)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => Response.error()))
  );
});
