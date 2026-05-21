/**
 * Theme management (dark / light).
 * Persists choice in localStorage.
 */

const STORAGE_KEY = 'va_theme';
const DARK  = 'dark';
const LIGHT = 'light';

function getCurrent() {
  return localStorage.getItem(STORAGE_KEY) ?? DARK;
}

function apply(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  // Update toggle icon labels
  document.querySelectorAll('[data-theme-toggle]').forEach(el => {
    el.setAttribute('aria-label', theme === DARK ? 'ライトモードに切替' : 'ダークモードに切替');
    const iconDark  = el.querySelector('.icon-dark');
    const iconLight = el.querySelector('.icon-light');
    if (iconDark)  iconDark.style.display  = theme === DARK  ? 'none' : '';
    if (iconLight) iconLight.style.display = theme === LIGHT ? 'none' : '';
  });
}

export const theme = {
  init() {
    apply(getCurrent());
  },
  toggle() {
    const next = getCurrent() === DARK ? LIGHT : DARK;
    apply(next);
  },
  bindToggle(el) {
    if (!el) return;
    el.setAttribute('data-theme-toggle', '');
    el.addEventListener('click', () => this.toggle());
    apply(getCurrent());
  },
};
