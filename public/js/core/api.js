/**
 * Communication layer — all API interactions flow through this module.
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

// ─────────────────────────────
// Auth lazy reference (safe)
// ─────────────────────────────
let authRef = null;
const auth = {
  get _impl() {
    if (!authRef) authRef = window.__auth;
    return authRef;
  },
  getToken() {
    return this._impl?.getToken?.();
  },
  clearSession() {
    return this._impl?.clearSession?.();
  }
};

// ─────────────────────────────
// Core request
// ─────────────────────────────
async function request(method, path, options = {}) {
  const { body, params, skipAuth = false, signal, headers: extraHeaders } = options;

  const headers = {};

  if (!skipAuth) {
    const token = auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] =
      body instanceof ArrayBuffer || body instanceof Uint8Array
        ? 'application/octet-stream'
        : 'application/json';
  }

  Object.assign(headers, extraHeaders || {});

  let url = `${BASE_URL}${path}`;

  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const rawBody =
    body === undefined
      ? undefined
      : body instanceof ArrayBuffer || body instanceof Uint8Array
        ? body
        : JSON.stringify(body);

  const response = await fetch(url, {
    method,
    headers,
    body: rawBody,
    signal,
  });

  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return null;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok) {
    let errBody = {};
    try {
      errBody = await response.json();
    } catch { }

    if (response.status === 401) {
      auth.clearSession?.();
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

// ─────────────────────────────
// API groups
// ─────────────────────────────
export const api = {
  ApiError,
  request,

  auth: {
    login: (loginToken) =>
      request('POST', '/auth/login', {
        body: { login_token: loginToken },
        skipAuth: true,
      }),

    logout: () => request('POST', '/auth/logout'),
    logoutAll: () => request('POST', '/auth/logout_all'),

    me: async () => {
      const res = await request('GET', '/auth/me');
      return res?.user ?? res;
    },

    check: async () => {
      try {
        await request('GET', '/auth/verify');
        return true;
      } catch (err) {
        auth.clearSession?.();
        window.location.replace('/login.html');
        throw err;
      }
    },

    rotateToken: async () => {
      const res = await request('POST', '/auth/login-token/rotate');
      return {
        ...res,
        token: res?.login_token ?? res?.token,
      };
    },
  },

  upload: {
    init: (payload) => request('POST', '/upload/init', { body: payload }),
    chunk: (id, index, buffer, headers) =>
      request('PUT', `/upload/${id}/${index}`, {
        body: buffer,
        headers,
      }),
    complete: (payload) =>
      request('POST', '/upload/complete', { body: payload }),
    status: (id) => request('GET', `/upload/${id}/status`),
    cancel: (id) => request('DELETE', `/upload/${id}`),
  },

  files: {
    list: (params) => request('GET', '/files', { params }),
    get: (id) => request('GET', `/files/${id}`),
    setPublic: (id, pub) =>
      request('PATCH', `/files/${id}/public`, { body: { public: pub } }),
    delete: (id) => request('DELETE', `/files/${id}`),
    zip: (fileIds) =>
      request('POST', '/files/zip', { body: { file_ids: fileIds } }),
  },

  folders: {
    list: (params) => request('GET', '/folders', { params }),
    create: (name) =>
      request('POST', '/folders', { body: { name } }),
    rename: (id, name) =>
      request('PATCH', `/folders/${id}`, { body: { name } }),
    delete: (id) => request('DELETE', `/folders/${id}`),

    files: (id) =>
      request('GET', `/folders/${id}/files`),
  },

  admin: {
    users: {
      list: (params) => request('GET', '/admin/users', { params }),
      create: (payload) => request('POST', '/admin/users', { body: payload }),
      disable: (uid) => request('PATCH', `/admin/users/${uid}/disable`),
      enable: (uid) => request('PATCH', `/admin/users/${uid}/enable`),
      delete: (uid) => request('DELETE', `/admin/users/${uid}`),
      rotateToken: (uid) =>
        request('POST', `/admin/users/${uid}/login-token/rotate`),
      storageLimit: (uid, bytes) =>
        request('PATCH', `/admin/users/${uid}/storage-limit`, {
          body: { storageLimitBytes: bytes },
        }),
      fileLimit: (uid, bytes) =>
        request('PATCH', `/admin/users/${uid}/file-limit`, {
          body: { maxFileSizeBytes: bytes },
        }),
      iconReset: (uid) =>
        request('PATCH', `/admin/users/${uid}/icon/reset`),
      rename: (uid, username) =>
        request('PATCH', `/admin/users/${uid}/username`, {
          body: { username },
        }),
      sessions: (uid) =>
        request('GET', `/admin/users/${uid}/sessions`),
    },

    policies: {
      get: () => request('GET', '/admin/policies'),
      update: (payload) =>
        request('PATCH', '/admin/policies', { body: payload }),
    },

    files: {
      list: (params) => request('GET', '/admin/files', { params }),
      get: (id) => request('GET', `/admin/files/${id}`),
      delete: (id) => request('DELETE', `/admin/files/${id}`),
      setPublic: (id, pub) =>
        request('PATCH', `/admin/files/${id}/public`, {
          body: { public: pub },
        }),
      setExpire: (id, at) =>
        request('PATCH', `/admin/files/${id}/expire`, {
          body: { expiresAt: at },
        }),
    },
  },
};