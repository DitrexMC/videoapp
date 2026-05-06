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
    const path = u.pathname;
    if (pageCache.has(path)) return;
    fetch(url).then(r => r.text()).then(html => pageCache.set(path, html)).catch(() => {});
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

function updatePage(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  document.title = doc.title;
  updateActiveNav(url);

  const oldMain = document.querySelector('main');
  const newMain = doc.querySelector('main');
  if (!oldMain || !newMain) return;

  // Collect page-specific inline scripts from the fetched body.
  // Only scripts without src (inline) are re-executed — global scripts
  // (nav.js, particles.js, etc.) are already running and must not re-execute.
  const scriptDefs = [];
  doc.body.querySelectorAll('script').forEach(s => {
    if (!s.src && s.textContent.trim()) {
      scriptDefs.push({ text: s.textContent, type: s.type || '' });
    }
  });

  // Replace main content
  oldMain.replaceWith(newMain);

  // Re-execute page-specific inline scripts (attach to body so they run)
  scriptDefs.forEach(def => {
    const s = document.createElement('script');
    if (def.type) s.type = def.type;
    s.textContent = def.text;
    document.body.appendChild(s);
  });

  // Re-observe reveal elements for new content
  if (window.__revealObserver) {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      window.__revealObserver.observe(el);
    });
  }
}

async function navigate(url, pushState = true) {
  if (navigating) return;
  navigating = true;

  const href = typeof url === 'string' ? url : url.href;
  const u = new URL(href, location.origin);
  if (u.origin !== location.origin) { location.href = href; return; }
  if (u.pathname === location.pathname && u.search === location.search) { navigating = false; return; }

  const direction = getDirection(location.pathname, u.pathname);
  let html = pageCache.get(u.pathname);
  if (!html) {
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error('fetch failed');
      html = await res.text();
      pageCache.set(u.pathname, html);
    } catch {
      location.href = href;
      return;
    }
  }

  if (!document.startViewTransition) {
    // No VT support — fallback to full-page navigation
    if (direction) {
      sessionStorage.setItem('va_nav_dir', direction);
      sessionStorage.setItem('va_vt_nav', '1');
    }
    location.href = href;
    return;
  }

  if (direction) document.documentElement.setAttribute('data-nav-dir', direction);

  // Suppress fadeUp on the new main content during and after transition
  document.documentElement.classList.add('vt-navigated');

  try {
    const transition = document.startViewTransition(() => updatePage(html, href));
    await transition.finished;
  } catch { /* transition skipped */ }

  document.documentElement.removeAttribute('data-nav-dir');
  window.scrollTo(0, 0);

  if (pushState) {
    history.pushState({ path: u.pathname + u.search, scrollY: 0 }, '', href);
  }

  navigating = false;
}

function initSpaNav() {
  // Intercept same-origin link clicks
  document.addEventListener('click', e => {
    if (navigating) { e.preventDefault(); return; }
    const link = e.target.closest('a[href]');
    if (!link) return;
    if (link.hasAttribute('download') || link.target === '_blank') return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;

    try {
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;
      if (url.pathname === '/login.html') return; // full navigation for login
      if (url.pathname === location.pathname && url.search === location.search && !url.hash) return;

      e.preventDefault();
      navigate(url);
    } catch {}
  }, true);

  // Preload on hover/pointer
  document.addEventListener('pointerover', e => {
    const link = e.target.closest('a[href]');
    if (link) preload(link.href);
  }, { passive: true });

  // Browser back/forward
  window.addEventListener('popstate', e => {
    if (e.state?.path) {
      navigate(new URL(e.state.path, location.origin), false);
    }
  });

  // Store initial state for back navigation
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
