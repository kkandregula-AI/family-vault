// ─── Family Vault Service Worker ────────────────────────────
// Strategy: Network-first for HTML (always fresh), cache-first for assets
// Updates activate immediately via skipWaiting + clients.claim

const CACHE = 'fvault-v4';
const ASSETS = ['./index.html', './manifest.json', './icon-192.svg', './icon-512.svg'];

// ── Install: cache all assets ───────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting(); // activate immediately, don't wait
});

// ── Activate: delete old caches, claim all open tabs ────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()) // take over immediately
  );
});

// ── Fetch: network-first for HTML so updates are instant ────
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('googleapis.com') || url.includes('accounts.google.com')) return;

  // HTML pages — always network first for freshness
  if (e.request.mode === 'navigate' || url.endsWith('index.html') || url.endsWith('/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Other assets — cache first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached => cached ||
      fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      })
    )
  );
});

// ── Message: allow app to force-activate waiting SW ─────────
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
