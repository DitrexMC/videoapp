const CACHE_VERSION = 'fv-v7';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const API_PREFIX    = '/api/';

const STATIC_ASSETS = [
  '/css/variables.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/js/core/api.js',
  '/js/core/auth.js',
  '/js/ui/toast.js',
  '/js/ui/theme.js',
  '/js/ui/shell.js',
  '/js/ui/modal.js',
  '/js/ui/format.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('fv-') && k !== STATIC_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const path = new URL(request.url).pathname;

  // Let all API routes pass through without SW interference
  // SW's fetch(request) can corrupt binary bodies (chunk uploads get 415)
  if (path.startsWith('/api/') || isApiRoute(path)) {
    return;
  }

  // Cache-first for static assets
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Network-first for HTML pages
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Default: network
  event.respondWith(fetch(request));
});

function isStaticAsset(url) {
  return /\.(css|js|png|jpg|jpeg|gif|svg|woff2?|ttf)(\?.*)?$/.test(url);
}

function isApiRoute(path) {
  return (
    path.startsWith('/upload/') ||
    path.startsWith('/files/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/auth/') ||
    path.startsWith('/folders/') ||
    path.startsWith('/groups/')
  );
}
