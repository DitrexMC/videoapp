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

let progressBarRef = null;

function getProgressBar() {
  if (!progressBarRef) {
    try {
      progressBarRef = window.__progressBar;
    } catch { }
  }
  return progressBarRef;
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
  const { body, params, skipAuth = false, signal, headers: extraHeaders, retry } = options;

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

  const maxRetries = retry?.maxRetries ?? 0;
  const retryDelay = typeof retry?.retryDelay === 'number' ? retry.retryDelay : 2000;
  const timeout = retry?.timeout;
  let attempt = 0;

  const pb = getProgressBar();
  if (pb) pb.start();

  try {
    while (true) {
      let response;
      try {
        let fetchSignal = signal;
        let timeoutId = null;
        if (timeout && !fetchSignal) {
          const ac = new AbortController();
          fetchSignal = ac.signal;
          timeoutId = setTimeout(() => ac.abort(), timeout);
        }
        response = await fetch(url, {
          method,
          headers: { ...headers },
          body: rawBody,
          signal: fetchSignal,
        });
        if (timeoutId) clearTimeout(timeoutId);
      } catch (err) {
        const isRetryable = err instanceof TypeError || err.name === 'AbortError';
        if (isRetryable && attempt < maxRetries) {
          attempt++;
          await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt - 1)));
          continue;
        }
        throw err;
      }

      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';

      if (response.status === 429) {
        if (attempt < maxRetries) {
          const retryAfter = parseInt(response.headers.get('retry-after'), 10) * 1000 || retryDelay;
          attempt++;
          await new Promise(r => setTimeout(r, retryAfter));
          continue;
        }
      }

      if (response.status >= 500 && attempt < maxRetries) {
        attempt++;
        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt - 1)));
        continue;
      }

      if (!response.ok) {
        let errBody = {};
        try {
          errBody = await response.json();
        } catch { }

        if (response.status === 401 && headers['Authorization']) {
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
  } finally {
    if (pb) pb.done();
  }
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

    sessions: () => request('GET', '/auth/sessions'),
    revokeSession: (sessionId) =>
      request('DELETE', `/auth/sessions/${sessionId}`),
    updateUsername: (username) =>
      request('PATCH', '/auth/username', { body: { username } }),
  },

  upload: {
    init: (payload, opts) => request('POST', '/upload/init', {
      body: payload,
      retry: { maxRetries: 2, retryDelay: 2000, timeout: 30000 },
      ...opts
    }),
    chunk: (id, index, buffer, headers) =>
      request('PUT', `/upload/${id}/${index}`, {
        body: buffer,
        headers,
        retry: { maxRetries: 3, retryDelay: 2000, timeout: 60000 },
      }),
    complete: (payload) =>
      request('POST', '/upload/complete', {
        body: payload,
        retry: { maxRetries: 3, retryDelay: 2000, timeout: 30000 },
      }),
    status: (id) => request('GET', `/upload/${id}/status`),
    cancel: (id) => request('DELETE', `/upload/${id}`),
  },

  files: {
    list: (params) => request('GET', '/files', { params }),
    get: (id) => request('GET', `/files/${id}`),
    rename: (id, name) => request('PATCH', `/files/${id}/rename`, { body: { name } }),
    setPublic: (id, pub) => request('PATCH', `/files/${id}/public`, { body: { public: pub } }),
    setShowUploader: (id, showUploader) => request('PATCH', `/files/${id}/show-uploader`, { body: { showUploader } }),
    setExpire: (id, at) => request('PATCH', `/files/${id}/expire`, { body: { expiresAt: at } }),
    delete: (id) => request('DELETE', `/files/${id}`),
    zip: (fileIds) => request('POST', '/files/zip', { body: { file_ids: fileIds } }),
  },

  folders: {
    list: (params) => request('GET', '/folders', { params }),
    create: (name, isPublic) =>
      request('POST', '/folders', { body: { name, public: isPublic } }),
    rename: (id, name) =>
      request('PATCH', `/folders/${id}`, { body: { name } }),
    setVisibility: (id, isPublic) =>
      request('PATCH', `/folders/${id}/visibility`, { body: { public: isPublic } }),
    delete: (id) => request('DELETE', `/folders/${id}`),

    files: (id) =>
      request('GET', `/folders/${id}/files`),
  },

  groups: {
    list: (params) => request('GET', '/groups', { params }),
    rename: (id, label) =>
      request('PATCH', `/groups/${id}`, { body: { label } }),
    togglePrivacy: (id, isPrivate) =>
      request('PATCH', `/groups/${id}`, { body: { is_private: isPrivate } }),
    delete: (id) => request('DELETE', `/groups/${id}`),
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

  news: {
    readUrls: () => request('GET', '/api/news/read-urls'),
    markRead: (articleUrl) =>
      request('POST', '/api/news/read', { body: { article_url: articleUrl } }),
    articles: () => request('GET', '/api/news/articles'),
  },
};