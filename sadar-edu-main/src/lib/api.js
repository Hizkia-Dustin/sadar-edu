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

async function request(path, { method = 'GET', body, query, signal } = {}, attempt = 0) {
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
    // Auto-retry 1x untuk request GET jika terjadi gangguan koneksi sesaat atau cold-start timeout
    if (method === 'GET' && attempt < 1) {
      await new Promise((r) => setTimeout(r, 350));
      return request(path, { method, body, query, signal }, attempt + 1);
    }
    throw new ApiError('Tidak dapat terhubung ke server. Pastikan koneksi internet stabil.', 0);
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respons bukan JSON */
  }

  if (!res.ok) {
    // Jika server 502/503 (cold start/database busy), coba ulang GET 1x setelah delay 500ms
    if (method === 'GET' && [502, 503, 504].includes(res.status) && attempt < 1) {
      await new Promise((r) => setTimeout(r, 500));
      return request(path, { method, body, query, signal }, attempt + 1);
    }
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
