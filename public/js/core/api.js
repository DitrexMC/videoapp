/**
 * Communication layer — all API interactions flow through this module.
 * Responsibilities: fetch wrapper, auth header injection, error handling.
 */

const BASE_URL = '';

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(method, path, options = {}) {
  const { body, params, skipAuth = false, signal, headers: extraHeaders } = options;

  const headers = {};

  if (!skipAuth) {
    const token = auth.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  if (body !== undefined) {
    if (body instanceof ArrayBuffer || body instanceof Uint8Array) {
      headers['Content-Type'] = 'application/octet-stream';
    } else {
      headers['Content-Type'] = 'application/json';
    }
  }

  if (extraHeaders) {
    Object.assign(headers, extraHeaders);
  }

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const rawBody = (() => {
    if (body === undefined) return undefined;
    if (body instanceof ArrayBuffer || body instanceof Uint8Array) return body;
    return JSON.stringify(body);
  })();

  const response = await fetch(url, { method, headers, body: rawBody, signal });

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    let errBody = {};
    try { errBody = await response.json(); } catch { /* ignore */ }

    // Auto-logout when session invalid (server restart/etc)
    if (response.status === 401) {
      try { auth.clearSession(); } catch { /* ignore */ }
      window.location.replace('/login.html');
    }

    throw new ApiError(
      response.status,
      errBody.code ?? 'unknown_error',
      errBody.message ?? `HTTP ${response.status}`,
      errBody.details
    );
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response;
}

export const api = {
  ApiError,
  request,

  // ── Auth ──────────────────────────────────────────
  auth: {
    login: (loginToken) => request('POST', '/auth/login', { body: { login_token: loginToken }, skipAuth: true }),
    logout: () => request('POST', '/auth/logout'),
    logoutAll: () => request('POST', '/auth/logout_all'),
    me: async () => {
      const response = await request('GET', '/auth/me');
      return response?.user ?? response;
    },
    check: async () => {
      try {
        await request('GET', '/auth/verify');
        return true;
      } catch (err) {
        auth.clearSession();
        window.location.replace('/login.html');
        throw err;
      }
    },
    rotateToken: async () => {
      const response = await request('POST', '/auth/login-token/rotate');
      return {
        ...response,
        token: response?.login_token ?? response?.token,
      };
    },
  },

  // ── Upload ────────────────────────────────────────
  upload: {
    init: (payload) => request('POST', '/upload/init', { body: payload }),
    chunk: (uploadId, index, buffer, chunkHeaders) =>
      request('PUT', `/upload/${uploadId}/${index}`, {
        body: buffer,
        headers: chunkHeaders,
      }),
    complete: (payload) => request('POST', '/upload/complete', { body: payload }),
    status: (uploadId) => request('GET', `/upload/${uploadId}/status`),
    cancel: (uploadId) => request('DELETE', `/upload/${uploadId}`),
  },

  // ── Files ─────────────────────────────────────────
  files: {
    list: (params) => request('GET', '/files', { params }),
    get: (id) => request('GET', `/files/${id}`),
    setPublic: (id, pub) => request('PATCH', `/files/${id}/public`, { body: { public: pub } }),
    delete: (id) => request('DELETE', `/files/${id}`),
    zip: (fileIds) => request('POST', '/files/zip', { body: { file_ids: fileIds } }),
  },

  // ── Folders ───────────────────────────────────────
  folders: {
    list: (params) => request('GET', '/folders', { params }),
    create: (name) => request('POST', '/folders', { body: { name } }),
    rename: (id, n) => request('PATCH', `/folders/${id}`, { body: { name: n } }),
    delete: (id) => request('DELETE', `/folders/${id}`),
    files: (id) => request('GET', `/folders/${id}/files`),
  },

  // ── Admin ─────────────────────────────────────────
  admin: {
    users: {
      list: (params) => request('GET', '/admin/users', { params }),
      create: (payload) => request('POST', '/admin/users', { body: payload }),
      disable: (uid) => request('PATCH', `/admin/users/${uid}/disable`),
      enable: (uid) => request('PATCH', `/admin/users/${uid}/enable`),
      delete: (uid) => request('DELETE', `/admin/users/${uid}`),
      rotateToken: (uid) => request('POST', `/admin/users/${uid}/login-token/rotate`),
      storageLimit: (uid, bytes) => request('PATCH', `/admin/users/${uid}/storage-limit`, { body: { storageLimitBytes: bytes } }),
      rename: (uid, username) => request('PATCH', `/admin/users/${uid}/username`, { body: { username } }),
      sessions: (uid) => request('GET', `/admin/users/${uid}/sessions`),
      updatePolicies: (payload) => request('PATCH', '/admin/policies', { body: payload }),
    },
    files: {
      list: (params) => request('GET', '/admin/files', { params }),
      get: (id) => request('GET', `/admin/files/${id}`),
      delete: (id) => request('DELETE', `/admin/files/${id}`),
      setPublic: (id, pub) => request('PATCH', `/admin/files/${id}/public`, { body: { public: pub } }),
      setExpire: (id, at) => request('PATCH', `/admin/files/${id}/expire`, { body: { expiresAt: at } }),
    },
  },
};

// Circular dep guard: auth is window.auth set by auth.js loaded before
// This guard lets api.js work regardless of load order.
let _authRef = null;
const auth = new Proxy({}, {
  get: (_, key) => {
    if (!_authRef) _authRef = window.__auth;
    return _authRef ? _authRef[key] : (() => null);
  }
});
