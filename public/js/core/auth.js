/**
 * Auth state management.
 * Stores session_token in sessionStorage (cleared on tab close).
 * Falls back to localStorage when "remember" is set.
 *
 * User data is cached aggressively so every page can render
 * the UI shell (username, avatar, role badges) instantly without
 * waiting for the /auth/me network round-trip.
 */

const SESSION_KEY = 'va_session';
const USER_KEY = 'va_user';

function load() {
  const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function save(data, persist) {
  const json = JSON.stringify(data);
  if (persist) {
    localStorage.setItem(SESSION_KEY, json);
  } else {
    sessionStorage.setItem(SESSION_KEY, json);
  }
  if (data.user) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(data.user));
    if (persist) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    if (data.user.username) localStorage.setItem('va_username', data.user.username);
  }
}

function clear() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('va_username');
}

export const auth = {
  /** Get stored session token. */
  getToken() {
    return load()?.token ?? null;
  },

  /** Get cached user object synchronously — no network. */
  getUser() {
    const raw = sessionStorage.getItem(USER_KEY) ?? localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  /** True if a session token is present. */
  isLoggedIn() {
    return !!this.getToken();
  },

  /** True if the stored user is admin. */
  isAdmin() {
    return this.getUser()?.role === 'admin';
  },

  /** Store a session after successful login. */
  setSession(token, user, persist = false) {
    save({ token, user }, persist);
  },

  /** Update cached user data. */
  updateUser(user) {
    const session = load();
    if (session) {
      session.user = user;
      const inLocal = !!localStorage.getItem(SESSION_KEY);
      save(session, inLocal);
    }
    if (user?.username) localStorage.setItem('va_username', user.username);
  },

  /** Clear all auth state. */
  clearSession() {
    clear();
  },

  /**
   * Guard: redirect to login if not authenticated.
   * Returns true if authenticated, false (and redirects) if not.
   */
  requireAuth(loginPath = '/login.html') {
    if (!this.isLoggedIn()) {
      window.location.href = loginPath;
      return false;
    }
    return true;
  },

  /**
   * Guard: redirect to home if already authenticated.
   */
  requireGuest(nextPath = '/') {
    if (this.isLoggedIn()) {
      window.location.href = nextPath;
      return false;
    }
    return true;
  },
};

// Expose on window for the api.js circular-dep proxy.
window.__auth = auth;
