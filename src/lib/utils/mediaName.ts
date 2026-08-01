import type { Inscripcion } from '@/types/domain';
import { apiUrl } from '@/lib/api/url';

/** Title Case unicode-aware: "THE BLACK PANTER" → "The Black Panter". */
function titleCase(s: string | number | null | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nombre base para descargar el audio/video de una obra, en el formato:
 *   "01.- Danzarte - The Black Panter - Martes"
 *   = Orden(2 dígitos) - Agrupación - Nombre de la obra - Día
 * Sin extensión (la agrega quien descarga según el archivo real).
 * Omite las partes vacías (p.ej. si no hay día aún).
 */
export function mediaBaseName(
  insc: Pick<Inscripcion, 'orden' | 'agrupacion' | 'nombre_de_la_obra' | 'dia'>,
): string {
  const digits = String(insc.orden ?? '').replace(/\D/g, '');
  const ord = digits ? digits.padStart(2, '0') : '';
  const tail = [insc.agrupacion, insc.nombre_de_la_obra, insc.dia]
    .map(titleCase)
    .filter(Boolean)
    .join(' - ');
  return ord ? `${ord}.- ${tail}` : tail;
}

/**
 * URL del proxy PHP same-origin para descargar un archivo de media con nombre
 * dinámico. Los hosts de storage (supabase / R2) no mandan CORS, así que un
 * fetch()+blob directo no puede renombrar la descarga; el proxy lo resuelve
 * server-side con Content-Disposition.
 */
export function mediaDownloadUrl(rawUrl: string, name: string): string {
  return `${apiUrl('descargar-media.php')}?u=${encodeURIComponent(rawUrl)}&n=${encodeURIComponent(name)}`;
}
