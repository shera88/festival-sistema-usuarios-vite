/**
 * Proxy de imágenes via wsrv.nl: cache CDN + conversión WebP + resize.
 * Útil para URLs externas (Drive, WP, etc.) que no están en Storage propio.
 *
 * Skip:
 *  - URLs vacías
 *  - data:/blob: URIs
 *  - Vimeo thumbs (ya vienen optimizados)
 *  - Locales (localhost / 127.0.0.1)
 */
const SKIP_HOSTS = ['vumbnail.com', 'i.vimeocdn.com', 'localhost', '127.0.0.1'];

export function webpProxy(url: string | null | undefined, width = 160, quality = 78): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

  let host = '';
  try {
    host = new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed;
  }
  if (SKIP_HOSTS.some((h) => host.includes(h))) return trimmed;

  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const w = Math.round(width * dpr);
  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}&output=webp&w=${w}&q=${quality}&fit=cover&we`;
}
