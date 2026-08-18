/**
 * URL de la miniatura de un video.
 *
 * Las portadas se generan una vez y viven junto a los videos, en `thumbs-2026/`
 * del mismo bucket. Se derivan del propio `url_video` en vez de fijar el dominio
 * aquí, así si el bucket cambia de host las miniaturas lo siguen solas.
 *
 *   https://…r2.dev/videos-2026/MARTES/02-obra.mp4
 *   https://…r2.dev/thumbs-2026/<id_inscripcion>.webp
 *
 * Devuelve null si la URL no es de R2 (por ejemplo, videos de Vimeo).
 */
export function urlMiniatura(urlVideo: string | null | undefined, idInscripcion: string | null | undefined): string | null {
  if (!urlVideo || !idInscripcion) return null;
  try {
    const u = new URL(String(urlVideo));
    if (!/\.r2\.dev$|r2\.cloudflarestorage\.com$/.test(u.hostname)) return null;
    return `${u.origin}/thumbs-2026/${idInscripcion}.webp`;
  } catch {
    return null;
  }
}
