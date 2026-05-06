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

// ── Navigation direction ───────────────────────────────────────────────────────
function initNavDirection() {
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    try {
      const url = new URL(link.href, location.origin);
      if (url.origin !== location.origin) return;
      const oldPos = PAGE_POS[location.pathname] ?? null;
      const newPos = PAGE_POS[url.pathname] ?? null;
      const fromArticle = location.pathname.startsWith('/news/articles/');
      const toArticle   = url.pathname.startsWith('/news/articles/');

      if (oldPos !== null && newPos !== null && oldPos !== newPos) {
        // Navigation between main pages — direction based on menu order
        sessionStorage.setItem('va_nav_dir', newPos > oldPos ? 'forward' : 'back');
        sessionStorage.removeItem('va_back_dir');
      } else if (toArticle) {
        // Any page → article: always slide right (forward)
        sessionStorage.setItem('va_nav_dir', 'forward');
        sessionStorage.removeItem('va_back_dir');
      } else if (fromArticle && newPos !== null) {
        // Article → main page (e.g. back to news list): slide left (back)
        sessionStorage.setItem('va_nav_dir', 'back');
        sessionStorage.removeItem('va_back_dir');
      } else if (oldPos !== null && newPos === null) {
        // Main page → unknown page (e.g. file preview)
        sessionStorage.setItem('va_nav_dir', 'forward');
        sessionStorage.setItem('va_back_dir', 'back');
      } else {
        sessionStorage.removeItem('va_nav_dir');
        sessionStorage.removeItem('va_back_dir');
      }
    } catch { /* ignore */ }
  }, true);
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
});

initNavDirection();
