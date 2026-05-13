import { auth } from '/js/core/auth.js';
import { api } from '/js/core/api.js';

const PAGE_POS = {
  '/': 0, '/index.html': 0,
  '/upload.html': 1,
  '/files.html': 2,
  '/news.html': 3,
  '/file.html': 4,
};

function onReady(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

// ── SPA Client-side navigation ─────────────────────────────────────────────────
const pageCache = new Map();
const cssCache = new Map();
let navigating = false;
let currentSpaPath = location.pathname + location.search;
const PERSISTENT_HEAD_SCRIPTS = new Set([
  location.origin + '/js/nav-theme.js'
]);
let pendingHeadCleanup = null;

function getDirection(fromPath, toPath) {
  const fromArticle = fromPath.startsWith('/news/articles/');
  const toArticle = toPath.startsWith('/news/articles/');
  const oldPos = PAGE_POS[fromPath] ?? null;
  const newPos = PAGE_POS[toPath] ?? null;

  if (oldPos !== null && newPos !== null && oldPos !== newPos)
    return newPos > oldPos ? 'forward' : 'back';
  if (toArticle) return 'forward';
  if (fromArticle && newPos !== null) return 'back';
  if (oldPos !== null && newPos === null) return 'forward';
  return null;
}

function preload(url) {
  try {
    const u = new URL(url, location.origin);
    if (u.origin !== location.origin) return;
    const cacheKey = u.pathname + u.search;
    if (pageCache.has(cacheKey)) return;
    fetch(url).then(r => r.text()).then(html => pageCache.set(cacheKey, html)).catch(() => { });
  } catch { }
}

function updateActiveNav(url) {
  const path = new URL(url, location.origin).pathname;
  document.querySelectorAll('.nav-links a, .nav-drawer a[href]').forEach(a => {
    try {
      const lp = new URL(a.href, location.origin).pathname;
      a.classList.toggle('active', lp === path);
    } catch { }
  });
}

// ── Phase 1: fetch + cache CSS (no DOM changes — old page unaffected) ──
async function preparePage(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const baseUrl = new URL(url, location.origin);

  const currentSheets = new Set(
    [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href)
  );
  document.querySelectorAll('[data-va-sheet]').forEach(el => currentSheets.add(el.getAttribute('data-va-sheet')));

  // Fetch missing CSS text and store it.  In swapPage we inject it as
  // <style> so it applies synchronously — the VT snapshot always sees the
  // correct styles even for page-specific CSS (e.g. news.css).
  for (const link of doc.querySelectorAll('link[rel="stylesheet"]')) {
    const href = new URL(link.getAttribute('href'), baseUrl).href;
    if (currentSheets.has(href)) continue;
    if (!cssCache.has(href)) {
      try {
        const res = await fetch(href);
        cssCache.set(href, await res.text());
      } catch { /* skip on failure */ }
    }
  }

  // Preload missing external scripts so they are available when inline scripts execute
  const currentScriptUrls = new Set(
    [...document.querySelectorAll('script[src]')].map(s => s.src)
  );
  const scriptExclusions = new Set([
    location.origin + '/js/nav.js',
    location.origin + '/js/particles.js',
    location.origin + '/js/nav-theme.js'
  ]);
  const scriptsToPreload = [];
  doc.querySelectorAll('script[src]').forEach(tag => {
    const src = new URL(tag.getAttribute('src'), baseUrl).href;
    if (currentScriptUrls.has(src) || scriptExclusions.has(src)) return;
    currentScriptUrls.add(src);
    scriptsToPreload.push(src);
  });

  if (scriptsToPreload.length > 0) {
    await Promise.all(scriptsToPreload.map(src => new Promise(resolve => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    })));
  }

  return doc;
}

function cloneHeadNode(node, baseUrl) {
  const clone = node.cloneNode(true);

  if (clone.nodeType !== Node.ELEMENT_NODE) {
    return clone;
  }

  if (clone.tagName === 'SCRIPT') {
    const src = clone.getAttribute('src');
    if (src) clone.setAttribute('src', new URL(src, baseUrl).href);
  }

  return clone;
}

function getHeadNodeKey(node, baseUrl, index) {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return `text:${index}:${node.textContent}`;
  }

  if (node.tagName === 'TITLE') {
    return null;
  }

  if (node.tagName === 'SCRIPT') {
    const src = node.getAttribute('src');
    if (!src) return `script:inline:${index}`;
    return `script:${new URL(src, baseUrl).href}`;
  }

  if (node.tagName === 'LINK') {
    const rel = node.getAttribute('rel') || '';
    const href = node.getAttribute('href') || '';
    return `link:${rel}:${href ? new URL(href, baseUrl).href : index}`;
  }

  if (node.tagName === 'META') {
    const name = node.getAttribute('name');
    if (name) return `meta:name:${name}`;
    const property = node.getAttribute('property');
    if (property) return `meta:property:${property}`;
    const httpEquiv = node.getAttribute('http-equiv');
    if (httpEquiv) return `meta:http-equiv:${httpEquiv}`;
    const charset = node.getAttribute('charset');
    if (charset) return 'meta:charset';
  }

  if (node.id) {
    return `${node.tagName.toLowerCase()}#${node.id}`;
  }

  return `${node.tagName.toLowerCase()}:${index}`;
}

function syncHead(doc, url) {
  const baseUrl = new URL(url, location.origin);
  const existingNodes = new Map();

  Array.from(document.head.childNodes).forEach((node, index) => {
    const key = getHeadNodeKey(node, location.origin, index);
    if (!key) return;

    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
      const src = node.getAttribute('src');
      if (src) {
        const absSrc = new URL(src, location.origin).href;
        if (PERSISTENT_HEAD_SCRIPTS.has(absSrc)) {
          existingNodes.set(key, { node, preserve: true });
          return;
        }
      }
    }

    existingNodes.set(key, { node, preserve: false });
  });

  const desiredKeys = new Set();
  const fragment = document.createDocumentFragment();

  Array.from(doc.head.childNodes).forEach((node, index) => {
    const key = getHeadNodeKey(node, baseUrl, index);
    if (!key) return;

    if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
      const src = node.getAttribute('src');
      if (src) {
        const absSrc = new URL(src, baseUrl).href;
        if (PERSISTENT_HEAD_SCRIPTS.has(absSrc)) {
          desiredKeys.add(key);
          return;
        }
      }
    }

    desiredKeys.add(key);
    const existing = existingNodes.get(key);
    const desiredNode = cloneHeadNode(node, baseUrl);

    if (!existing) {
      fragment.appendChild(desiredNode);
      return;
    }

    if (existing.node.nodeType === Node.ELEMENT_NODE) {
      if (existing.node.outerHTML !== desiredNode.outerHTML) {
        existing.node.replaceWith(desiredNode);
        existingNodes.set(key, { node: desiredNode, preserve: existing.preserve });
      }
      return;
    }

    if (existing.node.textContent !== desiredNode.textContent) {
      existing.node.textContent = desiredNode.textContent;
    }
  });

  if (fragment.childNodes.length > 0) {
    document.head.appendChild(fragment);
  }

  const staleNodes = [];
  existingNodes.forEach(({ node, preserve }, key) => {
    if (preserve || desiredKeys.has(key)) {
      return;
    }
    staleNodes.push(node);
  });

  return () => {
    staleNodes.forEach(node => node.remove());
  };
}

// ── Phase 2: all DOM mutations inside VT callback (atomic visual change) ──
function swapPage(doc, url) {
  const oldMain = document.querySelector('main');
  const newMain = doc.querySelector('main');
  if (!oldMain || !newMain) return false;

  const baseUrl = new URL(url, location.origin);

  // ── Inject page-specific CSS as inline <style> ──
  // syncHead would add them as <link> but those load asynchronously.
  // Injecting as <style> with cached text applies synchronously, so the
  // VT snapshot always sees the correct styles (fixes news.css height).
  const currentSheets = new Set(
    [...document.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href)
  );
  document.querySelectorAll('[data-va-sheet]').forEach(el => currentSheets.add(el.getAttribute('data-va-sheet')));

  doc.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    const href = new URL(link.getAttribute('href'), baseUrl).href;
    if (currentSheets.has(href)) return;
    const cssText = cssCache.get(href);
    if (!cssText) return;
    const s = document.createElement('style');
    s.textContent = cssText;
    s.setAttribute('data-va-sheet', href);
    document.head.appendChild(s);
    currentSheets.add(href);
  });

  pendingHeadCleanup = syncHead(doc, url);

  // Mirror body class + title
  document.body.className = doc.body.className;
  document.title = doc.title;
  updateActiveNav(url);

  // Collect inline scripts
  const scriptDefs = [];
  doc.body.querySelectorAll('script').forEach(s => {
    if (!s.src && s.textContent.trim()) {
      scriptDefs.push({ text: s.textContent, type: s.type || '' });
    }
  });

  // Scroll to top so the new-page snapshot is captured at top.
  // (old-page snapshot was already captured at current scroll position.)
  window.scrollTo(0, 0);

  // Swap main
  oldMain.replaceWith(newMain);

  // Clean up previously injected inline scripts to avoid accumulation
  document.querySelectorAll('script[data-va-inline]').forEach(s => s.remove());

  // Execute inline scripts (with error isolation so one failure doesn't break others)
  scriptDefs.forEach((def, idx) => {
    try {
      const s = document.createElement('script');
      if (def.type) s.type = def.type;
      s.textContent = def.text;
      s.setAttribute('data-va-inline', String(idx));
      document.body.appendChild(s);
    } catch (err) {

    }
  });

  // Re-observe reveal elements with a fresh observer if the old one is stale
  if (window.__revealObserver) {
    try { window.__revealObserver.disconnect(); } catch (_) { }
  }
  const revEls = document.querySelectorAll('.reveal');
  if (revEls.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1 });
    revEls.forEach(el => io.observe(el));
    window.__revealObserver = io;
  }

  return true;
}

async function navigate(url, pushState = true) {
  if (navigating) return;
  navigating = true;

  const href = typeof url === 'string' ? url : url.href;
  const u = new URL(href, location.origin);
  if (u.origin !== location.origin) { location.href = href; return; }
  if (pushState && u.pathname === location.pathname && u.search === location.search) { navigating = false; return; }

  // Mark news article as read on navigation
  if (u.pathname.startsWith('/news/articles/')) {
    api.news.markRead(u.pathname + u.search).catch(() => { });
  }

  const fromPath = pushState ? location.pathname : currentSpaPath;
  const direction = getDirection(fromPath, u.pathname);
  const cacheKey = u.pathname + u.search;
  let html = pageCache.get(cacheKey);
  if (!html) {
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error('fetch failed');
      html = await res.text();
      pageCache.set(cacheKey, html);
    } catch {
      location.href = href;
      return;
    }
  }

  if (!document.startViewTransition) {
    if (direction) {
      sessionStorage.setItem('va_nav_dir', direction);
      sessionStorage.setItem('va_vt_nav', '1');
    }
    location.href = href;
    return;
  }

  // Phase 1: pre-fetch CSS (no DOM changes)
  let doc;
  try {
    doc = await preparePage(html, href);
  } catch {
    location.href = href;
    return;
  }

  if (direction) document.documentElement.setAttribute('data-nav-dir', direction);

  const oldUrl = location.href;
  if (pushState) {
    history.pushState({ path: u.pathname + u.search, scrollY: 0 }, '', href);
  }

  document.documentElement.classList.add('vt-navigated');

  // Dispatch cleanup event so current page scripts can tear down
  document.dispatchEvent(new CustomEvent('va:navigate-away', { detail: { url: href } }));

  // Phase 2: atomic DOM swap inside VT
  try {
    const transition = document.startViewTransition(() => {
      if (!swapPage(doc, href)) {
        throw new Error('no main element');
      }
    });
    await transition.finished;
    pendingHeadCleanup?.();
    pendingHeadCleanup = null;
  } catch {
    pendingHeadCleanup = null;
    if (pushState) history.replaceState(null, '', oldUrl);
    location.href = href;
    return;
  }

  document.documentElement.removeAttribute('data-nav-dir');

  // Dispatch arrival event so new page scripts can set up
  document.dispatchEvent(new CustomEvent('va:navigate', { detail: { url: href } }));

  currentSpaPath = u.pathname + u.search;
  navigating = false;
}

function initSpaNav() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('download') || link.dataset.noSpa === '1' || link.target === '_blank') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    let url;
    try {
      url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;
      if (url.pathname === '/login.html') return;
      if (url.pathname === location.pathname && url.search === location.search && !url.hash) return;
    } catch { return; }

    if (navigating) return;

    e.preventDefault();
    navigate(url).catch(() => { location.href = url.href; });
  }, true);

  document.addEventListener('pointerover', e => {
    const link = e.target.closest('a[href]');
    if (link) preload(link.href);
  }, { passive: true });

  window.addEventListener('popstate', e => {
    if (e.state?.path) {
      navigate(new URL(e.state.path, location.origin), false)
        .catch(() => { location.href = e.state.path; });
    }
  });

  if (!history.state?.path) {
    history.replaceState({ path: location.pathname + location.search, scrollY: 0 }, '', location.href);
  }
}

// ── Drawer ────────────────────────────────────────────────────────────────────
function initDrawer() {
  const hamburger = document.getElementById('hamburger');
  const drawer = document.getElementById('navDrawer');
  const overlay = document.getElementById('drawerOverlay');
  const closeBtn = document.getElementById('drawerClose');
  if (!hamburger || !drawer) return;

  function openDrawer() {
    drawer.classList.add('open');
    overlay.classList.add('open');
    hamburger.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    hamburger.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  });

  overlay?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
  });

  drawer.querySelectorAll('a[href]').forEach(a => {
    a.addEventListener('click', () => closeDrawer());
  });
}

// ── Auth state for drawer ─────────────────────────────────────────────────────
function initNavAuth() {
  const user = auth.getUser();
  if (!user) return;

  const drawerUsername = document.getElementById('drawerUsername');
  if (drawerUsername) drawerUsername.textContent = user.username ?? '';

  if (user.role === 'admin') {
    document.getElementById('drawer-admin')?.classList.remove('hidden');
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
function initLogout() {
  const btn = document.getElementById('drawer-logout');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    await api.auth.logout().catch(() => { });
    auth.clearSession();
    localStorage.removeItem('va_username');
    location.href = '/login.html';
  });
}

// ── Scroll shadow ─────────────────────────────────────────────────────────────
function initScrollShadow() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  const update = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ── Init ──────────────────────────────────────────────────────────────────────
onReady(() => {
  initDrawer();
  initNavAuth();
  initLogout();
  initScrollShadow();
  initSpaNav();
  initNotifyBell();
  updateNotifyBadge();

  // Mark news article as read on direct page load (old static pages)
  if (location.pathname.startsWith('/news/articles/')) {
    api.news.markRead(location.pathname + location.search).catch(() => { });
  }
  // Mark dynamic article as read
  if (location.pathname === '/news/article.html') {
    const slug = new URLSearchParams(location.search).get('slug');
    if (slug) api.news.markRead(slug).catch(() => { });
  }
});

// ── Update badge after SPA navigation ─────────────────────────────────────────
document.addEventListener('va:navigate', () => {
  updateNotifyBadge();
});

// ── Notification bell ─────────────────────────────────────────────────────────
function initNotifyBell() {
  const navRight = document.querySelector('#nav .nav-right');
  if (!navRight || document.getElementById('nav-notify')) return;

  const bell = document.createElement('a');
  bell.id = 'nav-notify';
  bell.className = 'nav-notify';
  bell.href = '/news.html';
  bell.setAttribute('aria-label', 'お知らせ');
  bell.innerHTML = `
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 7A6 6 0 0 0 4 7c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M11.73 18a2 2 0 0 1-3.46 0"/>
    </svg>
    <span class="nav-notify-badge" id="nav-notify-badge"></span>
  `;

  const usernameEl = document.getElementById('nav-username');
  if (usernameEl && usernameEl.nextSibling) {
    navRight.insertBefore(bell, usernameEl.nextSibling);
  } else {
    navRight.appendChild(bell);
  }
}

async function updateNotifyBadge() {
  const badge = document.getElementById('nav-notify-badge');
  const btn = document.getElementById('nav-notify');
  if (!badge || !btn) return;

  try {
    const [readData, articlesData] = await Promise.all([
      api.news.readUrls(),
      api.news.articles(),
    ]);

    const read_urls = readData?.read_urls || [];
    const articles = Array.isArray(articlesData) ? articlesData : [];

    const readSet = new Set(read_urls);
    const unread = articles.filter((a) => !readSet.has(a.slug)).length;
    if (unread > 0) {
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.classList.add('visible');
      btn.classList.add('has-unread');
    } else {
      badge.classList.remove('visible');
      btn.classList.remove('has-unread');
    }
  } catch {
    // Silently ignore
  }
}
