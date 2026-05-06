import { auth } from '/js/core/auth.js';
import { api } from '/js/core/api.js';

const PAGE_POS = {
  '/': 0, '/index.html': 0,
  '/upload.html': 1,
  '/files.html': 2,
  '/news.html': 3,
};

function onReady(fn) {
  if (document.readyState !== 'loading') fn();
  else document.addEventListener('DOMContentLoaded', fn);
}

// ── SPA Client-side navigation ─────────────────────────────────────────────────
const pageCache = new Map();
const cssCache = new Map();
let navigating = false;

function getDirection(fromPath, toPath) {
  const fromArticle = fromPath.startsWith('/news/articles/');
  const toArticle   = toPath.startsWith('/news/articles/');
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
    fetch(url).then(r => r.text()).then(html => pageCache.set(cacheKey, html)).catch(() => {});
  } catch {}
}

function updateActiveNav(url) {
  const path = new URL(url, location.origin).pathname;
  document.querySelectorAll('.nav-links a, .nav-drawer a[href]').forEach(a => {
    try {
      const lp = new URL(a.href, location.origin).pathname;
      a.classList.toggle('active', lp === path);
    } catch {}
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

  // Fetch missing CSS, cache it, but do NOT inject yet
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

  return doc;
}

// ── Phase 2: all DOM mutations inside VT callback (atomic visual change) ──
function swapPage(doc, url) {
  const oldMain = document.querySelector('main');
  const newMain = doc.querySelector('main');
  if (!oldMain || !newMain) return false;

  const baseUrl = new URL(url, location.origin);

  // Inject cached CSS as <style> (immediate, no network delay)
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
    if (link.id) s.id = link.id;
    s.setAttribute('data-va-sheet', href);
    document.head.appendChild(s);
    currentSheets.add(href);
  });

  // Load missing CDN scripts
  const currentScripts = new Set(
    [...document.querySelectorAll('script[src]')].map(s => s.src)
  );
  doc.querySelectorAll('script[src]').forEach(old => {
    const src = new URL(old.getAttribute('src'), baseUrl).href;
    if (!currentScripts.has(src) && src !== location.origin + '/js/nav.js'
        && src !== location.origin + '/js/particles.js'
        && src !== location.origin + '/js/nav-theme.js') {
      const s = document.createElement('script');
      s.src = src;
      if (old.defer) s.defer = true;
      if (old.async) s.async = true;
      if (old.type) s.type = old.type;
      document.body.appendChild(s);
    }
  });

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

  // Swap main
  oldMain.replaceWith(newMain);

  // Execute inline scripts
  scriptDefs.forEach(def => {
    const s = document.createElement('script');
    if (def.type) s.type = def.type;
    s.textContent = def.text;
    document.body.appendChild(s);
  });

  if (window.__revealObserver) {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      window.__revealObserver.observe(el);
    });
  }

  return true;
}

async function navigate(url, pushState = true) {
  if (navigating) return;
  navigating = true;

  const href = typeof url === 'string' ? url : url.href;
  const u = new URL(href, location.origin);
  if (u.origin !== location.origin) { location.href = href; return; }
  if (u.pathname === location.pathname && u.search === location.search) { navigating = false; return; }

  const direction = getDirection(location.pathname, u.pathname);
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

  // Phase 2: atomic DOM swap inside VT
  try {
    const transition = document.startViewTransition(() => {
      if (!swapPage(doc, href)) {
        throw new Error('no main element');
      }
    });
    await transition.finished;
  } catch {
    if (pushState) history.replaceState(null, '', oldUrl);
    location.href = href;
    return;
  }

  document.documentElement.removeAttribute('data-nav-dir');
  window.scrollTo(0, 0);

  navigating = false;
}

function initSpaNav() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('download') || link.target === '_blank') return;
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
});
