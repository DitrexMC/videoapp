const CACHE_VERSION = 'fv-v18';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const HTML_CACHE = `${CACHE_VERSION}-html`;

const STATIC_ASSETS = [
  '/css/variables.css',
  '/css/reset.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/animations.css',
  '/css/file-preview.css',
  '/css/news.css',
  '/css/common.css',
  '/css/app.css',
  '/js/ui/toast.js',
  '/js/ui/theme.js',
  '/js/ui/shell.js',
  '/js/ui/modal.js',
  '/js/ui/format.js',
  '/js/nav.js',
  '/js/nav-theme.js',
  '/js/file-row.js',
  '/js/particles.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.json',
];

const HTML_PAGES = [
  '/',
  '/index.html',
  '/files.html',
  '/file.html',
  '/upload.html',
  '/login.html',
  '/settings.html',
  '/admin.html',
  '/news.html',
  '/privacy.html',
  '/terms.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS)),
      caches.open(HTML_CACHE).then(cache => cache.addAll(HTML_PAGES)),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('fv-') && ![STATIC_CACHE, HTML_CACHE].includes(k))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method !== 'GET') return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (isHtmlPage(request, path)) {
    event.respondWith(networkFirst(request, HTML_CACHE));
    return;
  }

  event.respondWith(fetch(request));
});

function cacheFirst(request, cacheName) {
  return caches.match(request).then(cached => {
    const fetchPromise = fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(cacheName).then(cache => cache.put(request, clone));
      }
      return response;
    }).catch(() => cached);
    return cached || fetchPromise;
  });
}

function staleWhileRevalidate(_request, _cacheName) { return fetch(_request); }

function networkFirst(request, cacheName) {
  return fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(cacheName).then(cache => cache.put(request, clone));
    }
    return response;
  }).catch(() => caches.match(request));
}

function isStaticAsset(url) {
  if (url.href.includes('/js/core/')) return false;
  return /\.(css|js|png|jpg|jpeg|gif|svg|woff2?|ttf)(\?.*)?$/.test(url.href);
}

function isHtmlPage(request, path) {
  if (request.headers.get('accept')?.includes('text/html')) return true;
  if (path === '/' || path.endsWith('.html')) return true;
  return false;
}
