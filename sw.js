/* Offline režim pre hru „V albume je lego“.
   Keď je internet: vždy najprv skúsi novú verziu z GitHubu.
   Keď nie je: použije kópiu uloženú v telefóne. */
const PREFIX = 'album-';
const CACHE = PREFIX + 'v1';
const CORE = ['./', './index.html', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // maže iba staré kópie TEJTO hry, iné hry na jn5x.github.io nechá tak
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function key(url) {
  const u = new URL(url);
  u.search = ''; u.hash = '';
  if (u.pathname.endsWith('/')) u.pathname += 'index.html';
  return u.href;
}

function withTimeout(p, ms) {
  return new Promise((ok, no) => {
    const t = setTimeout(() => no(new Error('timeout')), ms);
    p.then(r => { clearTimeout(t); ok(r); }, err => { clearTimeout(t); no(err); });
  });
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (u.origin === self.location.origin) {
    const scope = new URL(self.registration.scope).pathname;
    if (!u.pathname.startsWith(scope)) return;
    const k = key(r.url);
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await withTimeout(fetch(k, { cache: 'no-cache' }), 5000);
        if (res && res.ok) cache.put(k, res.clone());
        return res;
      } catch (err) {
        const hit = await cache.match(k) || (r.mode === 'navigate' ? await cache.match(key(self.registration.scope)) : null);
        return hit || Response.error();
      }
    })());
    return;
  }

  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(r);
      if (hit) return hit;
      try {
        const res = await fetch(r);
        cache.put(r, res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
  }
});
