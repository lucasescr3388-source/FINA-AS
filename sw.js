/* =============================================
   FINARA — Service Worker  (sw.js)
   Cache-first + Network fallback + Offline page
   ============================================= */

const APP_VERSION   = 'v1.0.0';
const CACHE_STATIC  = `finara-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `finara-dynamic-${APP_VERSION}`;

/* Arquivos que serão cacheados na instalação */
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* Recursos externos (CDN) — cacheados dinamicamente */
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  console.log('[SW] Installing…', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating…', APP_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => {
            console.log('[SW] Deleting old cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET e extensões de browser
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // Estratégia: Cache First → Network → Offline fallback
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) {
        // Serve do cache e atualiza em background (stale-while-revalidate)
        const networkFetch = fetch(request)
          .then(networkRes => {
            if (networkRes && networkRes.ok) {
              const cacheName = isCDN(url.origin) ? CACHE_DYNAMIC : CACHE_STATIC;
              caches.open(cacheName).then(c => c.put(request, networkRes.clone()));
            }
            return networkRes;
          })
          .catch(() => {/* silencioso */});

        return cached;
      }

      // Não está no cache → busca na rede
      return fetch(request)
        .then(networkRes => {
          if (!networkRes || !networkRes.ok) return networkRes;

          const cacheName = isCDN(url.origin) ? CACHE_DYNAMIC : CACHE_STATIC;
          caches.open(cacheName).then(c => c.put(request, networkRes.clone()));
          return networkRes;
        })
        .catch(() => {
          // Offline: retorna página offline para navegação HTML
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('./offline.html');
          }
        });
    })
  );
});

/* ── BACKGROUND SYNC (backup automático) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-transactions') {
    console.log('[SW] Background sync triggered');
    // Espaço para sincronização futura com servidor
  }
});

/* ── PUSH NOTIFICATIONS ── */
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  const title   = data.title   || 'Finara';
  const options = {
    body:    data.body    || 'Você tem uma notificação do Finara.',
    icon:    './icons/icon-192.png',
    badge:   './icons/icon-96.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url || './' },
    actions: [
      { action: 'open',    title: 'Abrir app' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(list => {
      const url = event.notification.data?.url || './';
      for (const client of list) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

/* ── HELPERS ── */
function isCDN(origin) {
  return CDN_ORIGINS.some(cdn => origin.startsWith(cdn));
}
