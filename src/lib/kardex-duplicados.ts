import type { KardexRow } from '@/types/domain';

/**
 * Detección de carnets repetidos en el kárdex de una agrupación.
 *
 * Por qué existe: el conteo de participantes se hace por persona, y una persona
 * es "mismo nombre + mismo carnet". Cuando un profesor carga a sus alumnos con
 * su propio CI, o cuando alguien se registra dos veces, la cantidad real deja de
 * verse bien. Esta vista los agrupa para que el encargado los corrija.
 *
 * No interviene en pagos ni en deudas: es solo una ayuda de gestión.
 */

/** Nombre comparable: sin acentos, sin espacios de más, en mayúsculas. */
export function normNombre(s: string | null | undefined): string {
  return (s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Carnet comparable: solo dígitos. Vacío = sin carnet cargado. */
export function normCI(ci: string | number | null | undefined): string {
  return String(ci ?? '').replace(/\D/g, '');
}

/** Una persona = mismo nombre Y mismo carnet. */
export function clavePersona(r: KardexRow): string {
  return `${normNombre(r.nombre_y_apellido)}|${normCI(r.ci)}`;
}

export type TipoConflicto =
  /** Mismo carnet en personas con nombres distintos → hay que corregir el CI. */
  | 'mismo-carnet'
  /** Mismo nombre y mismo carnet en más de una fila → está cargada dos veces. */
  | 'repetida';

export interface GrupoConflicto {
  id: string;
  tipo: TipoConflicto;
  ci: string;
  /** Cuántas personas distintas hay dentro del grupo (para 'repetida' siempre 1). */
  personas: number;
  rows: KardexRow[];
}

export interface ResumenKardex {
  /** Personas distintas de la agrupación (nombre + carnet). */
  unicos: number;
  /** Filas cargadas en total (una persona en varias obras cuenta una sola vez acá). */
  filas: number;
  grupos: GrupoConflicto[];
  /** Grupos donde varias personas comparten un carnet. */
  conflictosCarnet: number;
  /** Personas cargadas más de una vez. */
  repetidas: number;
  /** Filas sin carnet — no se pueden contrastar con nadie. */
  sinCarnet: number;
}

/**
 * Analiza las filas de kárdex de UNA agrupación. `rows` puede traer la misma
 * fila repetida si el llamador la expandió por obra; se deduplica por id_kardex.
 */
export function analizarKardex(rows: KardexRow[]): ResumenKardex {
  // Una fila = un registro de kárdex. Deduplicar por id_kardex evita contar dos
  // veces a quien participa en varias obras.
  const filasUnicas = new Map<string, KardexRow>();
  rows.forEach((r, i) => {
    const k = r.id_kardex ? String(r.id_kardex) : `sin-id-${i}-${clavePersona(r)}`;
    if (!filasUnicas.has(k)) filasUnicas.set(k, r);
  });
  const filas = [...filasUnicas.values()];

  // Agrupar por persona (nombre + carnet) y por carnet.
  const porPersona = new Map<string, KardexRow[]>();
  const porCI = new Map<string, KardexRow[]>();
  let sinCarnet = 0;

  for (const r of filas) {
    const ci = normCI(r.ci);
    const kp = clavePersona(r);
    if (!porPersona.has(kp)) porPersona.set(kp, []);
    porPersona.get(kp)!.push(r);
    if (!ci) { sinCarnet++; continue; }
    if (!porCI.has(ci)) porCI.set(ci, []);
    porCI.get(ci)!.push(r);
  }

  const grupos: GrupoConflicto[] = [];

  // 1) Mismo carnet, nombres distintos → el CI está mal en alguno.
  for (const [ci, rs] of porCI) {
    const nombres = new Set(rs.map((r) => normNombre(r.nombre_y_apellido)));
    if (nombres.size > 1) {
      grupos.push({ id: `ci-${ci}`, tipo: 'mismo-carnet', ci, personas: nombres.size, rows: rs });
    }
  }

  // 2) Misma persona cargada más de una vez.
  for (const [kp, rs] of porPersona) {
    if (rs.length > 1) {
      grupos.push({ id: `dup-${kp}`, tipo: 'repetida', ci: normCI(rs[0].ci), personas: 1, rows: rs });
    }
  }

  // Primero los carnets compartidos por más gente (impacto mayor).
  grupos.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'mismo-carnet' ? -1 : 1;
    return b.rows.length - a.rows.length;
  });

  return {
    unicos: porPersona.size,
    filas: filas.length,
    grupos,
    conflictosCarnet: grupos.filter((g) => g.tipo === 'mismo-carnet').length,
    repetidas: grupos.filter((g) => g.tipo === 'repetida').length,
    sinCarnet,
  };
}
