import { useAuthStore } from '../store/useAuthStore';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', body, query, signal } = {}) {
  const token = useAuthStore.getState().token;
  const qs = query
    ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
    : '';

  let res;
  try {
    res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('Tidak dapat terhubung ke server. Pastikan backend berjalan dan VITE_API_URL benar.', 0);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respons bukan JSON */
  }

  if (!res.ok) {
    // Sesi berakhir: keluarkan pengguna agar diarahkan ke halaman login
    if (res.status === 401 && token) useAuthStore.getState().logout();
    throw new ApiError((json && json.message) || `Permintaan gagal (${res.status}).`, res.status, json && json.detail);
  }
  return json;
}

export const api = {
  get: (path, query, opts) => request(path, { ...opts, query }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body: body ?? {} }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body: body ?? {} }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body: body ?? {} }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
};
