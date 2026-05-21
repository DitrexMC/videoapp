/**
 * Sidebar + header shell renderer.
 * Injects the sidebar and header into the page, marks the active link,
 * and handles mobile open/close.
 */
import { auth } from '../core/auth.js';
import { theme } from './theme.js';
import { api }  from '../core/api.js';
import { toast } from './toast.js';
import { dialog } from './dialog.js';

const NAV_ITEMS = [
  {
    section: 'メイン',
    links: [
      { href: '/files.html',     label: 'マイファイル',     icon: folderIcon() },
      { href: '/upload.html',    label: 'アップロード',     icon: uploadIcon() },
    ],
  },
  {
    section: 'アカウント',
    links: [
      { href: '/settings.html',  label: '設定',             icon: settingsIcon() },
    ],
  },
];

const ADMIN_SECTION = {
  section: '管理',
  links: [
    { href: '/admin.html',     label: '管理パネル',       icon: shieldIcon() },
  ],
};

export function renderShell(opts = {}) {
  const { pageTitle = '', breadcrumbs = [] } = opts;

  const user    = auth.getUser();
  const isAdmin = user?.role === 'admin';

  const navItems = isAdmin ? [...NAV_ITEMS, ADMIN_SECTION] : NAV_ITEMS;
  const currentPath = window.location.pathname;

  // Build sidebar
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.innerHTML = `
    <a class="sidebar-logo" href="/files.html">
      <span class="sidebar-logo-icon">${logoIcon()}</span>
      <span class="sidebar-logo-text">videoapp</span>
    </a>
    <nav class="sidebar-nav">
      ${navItems.map(section => `
        <div class="sidebar-section">
          <div class="sidebar-section-label">${section.section}</div>
          ${section.links.map(link => `
            <a class="sidebar-link${currentPath === link.href ? ' active' : ''}"
               href="${link.href}">
              ${link.icon}
              <span>${link.label}</span>
            </a>
          `).join('')}
        </div>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebar-user-btn">
        <div class="sidebar-user-avatar" id="sidebar-avatar">
          ${user?.icon
            ? `<img src="${escHtml(user.icon)}" alt="" loading="lazy">`
            : escHtml((user?.username ?? '?')[0].toUpperCase())}
        </div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${escHtml(user?.username ?? 'ゲスト')}</div>
          <div class="sidebar-user-role">${isAdmin ? '管理者' : 'ユーザー'}</div>
        </div>
        ${chevronIcon()}
      </div>
    </div>
  `;

  // Overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';

  // Build header
  const header = document.createElement('header');
  header.className = 'header';
  header.innerHTML = `
    <div class="header-left">
      <button class="sidebar-toggle" id="sidebar-toggle" aria-label="サイドバー切替">
        ${menuIcon()}
      </button>
      ${breadcrumbs.length
        ? `<nav class="header-breadcrumb">
            ${breadcrumbs.map((b, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (isLast || !b.href)
                ? `<span>${escHtml(b.label)}</span>`
                : `<a href="${b.href}">${escHtml(b.label)}</a>
                   <span class="header-breadcrumb-sep">/</span>`;
            }).join('')}
           </nav>`
        : `<span class="header-title">${escHtml(pageTitle)}</span>`
      }
    </div>
    <div class="header-right">
      <button class="theme-toggle" id="theme-toggle" aria-label="テーマ切替">
        <span class="icon-dark">${moonIcon()}</span>
        <span class="icon-light">${sunIcon()}</span>
      </button>
    </div>
  `;

  // Insert into page
  document.body.prepend(overlay);
  document.body.prepend(header);
  document.body.prepend(sidebar);

  // ── Bind events ──
  theme.bindToggle(document.getElementById('theme-toggle'));

  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebarEl = document.getElementById('sidebar');
  const overlayEl = document.getElementById('sidebar-overlay');

  function openSidebar() {
    sidebarEl.classList.add('open');
    overlayEl.classList.add('visible');
  }
  function closeSidebar() {
    sidebarEl.classList.remove('open');
    overlayEl.classList.remove('visible');
  }

  toggleBtn?.addEventListener('click', () => {
    sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  overlayEl.addEventListener('click', closeSidebar);

  // User menu (logout)
  document.getElementById('sidebar-user-btn')?.addEventListener('click', async () => {
    const confirmed = window.confirm('ログアウトしますか？');
    if (!confirmed) return;
    try {
      await api.auth.logout();
    } catch { /* ignore */ }
    auth.clearSession();
    window.location.href = '/login.html';
  });
}

// ── Icon helpers ──────────────────────────────────────
function logoIcon() {
  return `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0L1 4v8l7 4 7-4V4L8 0zm0 2.18L13 5v6l-5 2.86L3 11V5l5-2.82z"/></svg>`;
}
function folderIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>`;
}
function uploadIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>`;
}
function settingsIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>`;
}
function shieldIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`;
}
function chevronIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="width:14px;height:14px;color:var(--text-muted);flex-shrink:0"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>`;
}
function menuIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor" style="width:18px;height:18px"><path fill-rule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>`;
}
function moonIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`;
}
function sunIcon() {
  return `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"/></svg>`;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
