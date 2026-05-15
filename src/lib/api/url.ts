/**
 * Resuelve la URL de un endpoint PHP.
 * - Mobile (Capacitor): URL absoluta a backend remoto.
 * - Web dev: `/api/<endpoint>` via Vite proxy.
 * - Web prod (Vercel): `/api/<endpoint>` via Vercel rewrite.
 */
const MOBILE_API_BASE = 'https://festivaldanzarte.com/app-portal/php';

function isMobile(): boolean {
  return typeof window !== 'undefined' && typeof window.__MOBILE_VERSION__ === 'string';
}

export function apiUrl(endpoint: string): string {
  const clean = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  if (isMobile()) return `${MOBILE_API_BASE}/${clean}`;
  return `${import.meta.env.BASE_URL}api/${clean}`;
}
