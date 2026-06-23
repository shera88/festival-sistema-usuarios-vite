const MOBILE_API_BASE = 'https://festivaldanzarte.com/app-portal/php';
const isMobile = typeof window !== 'undefined' && typeof window.__MOBILE_VERSION__ === 'string';
// Respeta el base path de Vite: en prod /portal/ -> /portal/api, en dev / -> /api
const API_BASE = isMobile
  ? MOBILE_API_BASE
  : (import.meta.env.VITE_API_URL || `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) || `HTTP ${res.status}`;
    throw new ApiError(res.status, msg);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
};
