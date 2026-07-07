// ASCEND service worker — app code (page + our small JS files) is network-first
// so edits show up on a plain reload; big static bundles are cache-first for
// speed. Everything is cached either way, so the app still opens fully offline.
// Bump VERSION whenever anatomy.js / exercise-images.js / vendor files / icons change.
const VERSION = 'ascend-v31';
const DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const APP_JS = ['js/exercises.js','js/ranks.js','js/icons.js','js/state.js','js/scoring.js','js/progress.js','js/nav.js','js/train.js','js/store.js','js/workout.js','js/rank.js','js/profile.js','js/helpers.js','js/social.js','js/onboarding.js','js/nutrition.js','js/boot.js'];
const CORE = ['./', 'index.html', 'styles.css', ...APP_JS, 'anatomy.js', 'exercise-images.js', 'vendor/supabase-js.js', 'vendor/zxing.js', 'config.js', 'sync-core.js', 'scanner.js', 'backend.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
// network-first app code (by basename) so edits show on a plain reload
const FRESH = ['config.js', 'sync-core.js', 'scanner.js', 'backend.js', 'styles.css', ...APP_JS.map(p => p.split('/').pop())];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Web Push: show nudges in the OS notification centre; tapping opens the app.
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || 'ASCEND', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'ascend', data: d,
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
    for (const w of ws) { if ('focus' in w) return w.focus(); }
    return clients.openWindow('./');
  }));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;                          // let POSTs (exercise requests) pass through
  if (DEV) return;                                                 // dev (localhost): never cache, always hit the live server
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
