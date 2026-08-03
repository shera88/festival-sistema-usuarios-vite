/**
 * Fechas del XVIII Festival Danzarte 2026.
 *
 * El festival va del martes 4 al domingo 9 de agosto. Cada agrupación ensaya el
 * día ANTERIOR al que se presenta; sábado y domingo —las finales— no tienen
 * ensayo.
 */

/** Día del programa → fecha de la presentación (ISO, sin hora). */
export const FECHA_PRESENTACION: Record<string, string> = {
  MARTES: '2026-08-04',
  MIERCOLES: '2026-08-05',
  JUEVES: '2026-08-06',
  VIERNES: '2026-08-07',
  SABADO: '2026-08-08',
  DOMINGO: '2026-08-09',
};

/** Días que no tienen ensayo: las finales del fin de semana. */
const SIN_ENSAYO = new Set(['SABADO', 'DOMINGO']);

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const normalizar = (d: string | null | undefined) => String(d ?? '').toUpperCase().trim();

/** 'YYYY-MM-DD' → Date en UTC. Se evita el constructor con hora local, que según
 *  la zona horaria del equipo puede correr la fecha un día. */
function aFecha(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Fecha de la presentación de ese día (ISO), o null si no se reconoce. */
export function fechaPresentacionDe(dia: string | null | undefined): string | null {
  return FECHA_PRESENTACION[normalizar(dia)] ?? null;
}

/**
 * Fecha del ensayo de ese día (ISO): el día anterior a la presentación.
 * Devuelve null para sábado y domingo, que no tienen ensayo, y para un día
 * que no esté en el calendario.
 */
export function fechaEnsayoDe(dia: string | null | undefined): string | null {
  const clave = normalizar(dia);
  if (SIN_ENSAYO.has(clave)) return null;
  const iso = FECHA_PRESENTACION[clave];
  if (!iso) return null;
  const f = aFecha(iso);
  if (!f) return null;
  f.setUTCDate(f.getUTCDate() - 1);
  return f.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'Lunes 03 de agosto'. Cadena vacía si la fecha no es válida. */
export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '';
  const f = aFecha(iso);
  if (!f) return '';
  const dia = DIAS_SEMANA[f.getUTCDay()];
  const numero = String(f.getUTCDate()).padStart(2, '0');
  return `${dia} ${numero} de ${MESES[f.getUTCMonth()]}`;
}

/** Texto listo para mostrar: 'Lunes 03 de agosto', o '' si ese día no ensaya. */
export function textoFechaEnsayo(dia: string | null | undefined): string {
  return fechaLarga(fechaEnsayoDe(dia));
}
