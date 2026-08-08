/**
 * Clasificación a la final (Sábado/Domingo) — misma regla que la app de jurados
 * (`finalDeCampos`): corte 75 para colegios/universidades, 80 para el resto;
 * si clasifica → Folklore va el Domingo, el resto el Sábado.
 *
 * OJO: esa regla por género es sólo el RESPALDO. Si el servidor ya trae el día
 * asignado por el admin (`dia_final` de registro_de_inscripcion_2026), ese día
 * manda — ver `diaFinalDe`.
 */
/**
 * Días cuyas calificaciones son públicas en el portal: Martes a Viernes
 * (clasificatorias). Sábado y Domingo (finales) NO se muestran — son sorpresa
 * para la premiación.
 */
export function esDiaClasificatoria(dia: string | null): boolean {
  const d = (dia ?? '').toUpperCase();
  return d === 'MARTES' || d === 'MIERCOLES' || d === 'MIÉRCOLES' || d === 'JUEVES' || d === 'VIERNES';
}

/** Nota mínima para clasificar a la final, según categoría. */
export const NOTA_MINIMA_FINAL_COLEGIOS = 75;
export const NOTA_MINIMA_FINAL_RESTO = 80;

export function notaMinimaFinal(categoria: string | null): number {
  return /COLEGIO|UNIVERSID/.test((categoria ?? '').toUpperCase())
    ? NOTA_MINIMA_FINAL_COLEGIOS
    : NOTA_MINIMA_FINAL_RESTO;
}

export function clasificacionDe(
  nota: number | null,
  modalidad: string | null,
  genero: string | null,
  categoria: string | null,
): 'Sábado' | 'Domingo' | null {
  if (nota == null) return null;
  const corte = notaMinimaFinal(categoria);
  if (nota < corte) return null;
  return /FOLCLOR|FOLKLOR/.test(`${modalidad ?? ''} ${genero ?? ''}`.toUpperCase())
    ? 'Domingo'
    : 'Sábado';
}

/* ─────────────────────────── Cupos de la final ───────────────────────────
   La final tiene un tope de CUPO_FINAL obras POR DÍA (Sábado y Domingo cada
   uno). Superar el corte (≥75 / ≥80) es NECESARIO pero no suficiente: si el día
   ya llenó su cupo, las obras que quedan por debajo de la 100.ª mejor nota NO
   entran, aunque pasen el corte. El programa es FLEXIBLE — se recalcula con cada
   refresco del ranking, así que una obra puede caer fuera cuando llegan notas
   más altas. Mantener este número alineado con la app de jurados. */
export const CUPO_FINAL = 100;

export type DiaFinal = 'Sábado' | 'Domingo';

type ObraFinalizable = {
  nota_final: number | null;
  modalidad: string | null;
  genero: string | null;
  categoria: string | null;
  // Día asignado por el admin (registro_de_inscripcion_2026.dia_final).
  // Opcional: el RPC puede no traerlo todavía; en ese caso rige la heurística.
  dia_final?: string | null;
};

/**
 * Normaliza el `dia_final` que manda el servidor ('SABADO'/'DOMINGO', con o sin
 * tilde, cualquier caja) al formato de la app. Cualquier otro valor → null.
 */
export function normalizarDiaFinal(dia: string | null | undefined): DiaFinal | null {
  const d = (dia ?? '').trim().toUpperCase();
  if (d === 'SABADO' || d === 'SÁBADO') return 'Sábado';
  if (d === 'DOMINGO') return 'Domingo';
  return null;
}

/**
 * Día de la final de una obra, con la precedencia correcta:
 * 1. El gate por nota/corte sigue vigente SIEMPRE — sin nota que clasifique no
 *    hay final, tenga o no día asignado.
 * 2. Si el servidor trae `dia_final` (asignado por el admin, p. ej. folclore
 *    movido al Sábado), ese día MANDA.
 * 3. Si no, respaldo: la heurística por género de `clasificacionDe`.
 */
export function diaFinalDe(o: ObraFinalizable): DiaFinal | null {
  const heuristica = clasificacionDe(o.nota_final, o.modalidad, o.genero, o.categoria);
  if (!heuristica) return null;
  return normalizarDiaFinal(o.dia_final) ?? heuristica;
}

/**
 * Reparte las obras en las finales de Sábado y Domingo, ya recortadas al cupo.
 * Para cada día: toma las que pasan el corte, las ordena por nota (mejor primero)
 * y se queda con las primeras CUPO_FINAL. El resto queda afuera (cupo lleno).
 *
 * OJO: acá el orden es por NOTA sólo para ELEGIR quién entra (las 100 mejores).
 * El orden en que se MUESTRA el programa es otro — ver `ordenarPrograma`.
 */
export function finalistasPorDia<T extends ObraFinalizable>(
  obras: T[],
  cupo = CUPO_FINAL,
): Record<DiaFinal, T[]> {
  const buckets: Record<DiaFinal, T[]> = { Sábado: [], Domingo: [] };
  for (const o of obras) {
    // `diaFinalDe`: el día del admin manda si viene; si no, heurística por género.
    const dia = diaFinalDe(o);
    if (dia) buckets[dia].push(o);
  }
  const porNota = (a: T, b: T) => (b.nota_final ?? -1) - (a.nota_final ?? -1);
  return {
    Sábado: [...buckets.Sábado].sort(porNota).slice(0, cupo),
    Domingo: [...buckets.Domingo].sort(porNota).slice(0, cupo),
  };
}

/* ─────────────────── Orden canónico del programa (gemelo de jurados) ───────────────────
   EXACTAMENTE el mismo que la app de jurados (app-jurados .../presets.ts, PRESET_DEFAULT):
   bloque → división → modalidad → subdivisión, y a igualdad de todo, por nombre de obra.
   Los arrays fijos y la forma canónica (FOLKLORE→FOLCLORE, índice 999 para lo no listado)
   son idénticos, así que el portal muestra la final en el MISMO orden que jurados. Si cambia
   uno, cambian los dos. */
const ORD_PROGRAMA: Record<'bloque' | 'division' | 'subdivision' | 'modalidad', string[]> = {
  bloque: ['MENOR', 'MAYOR'],
  division: ['PRE INFANTIL', 'INFANTIL', 'PRE JUVENIL', 'JUVENIL', 'MAYORES', 'ADULTOS'],
  subdivision: ['SOLO', 'DUO', 'GRUPO PEQUEÑO', 'GRUPO GRANDE'],
  modalidad: [
    // académico
    'JAZZ DANCE - CONTEMPORÁNEO', 'BAILES TROPICALES', 'BALLET CLÁSICO Y NEOCLÁSICO',
    'DANZA ÁRABE O DANZAS DE LA INDIA', 'MODALIDAD LIBRE',
    // urbano
    'DANZA URBANA LIBRE', 'COMERCIAL DANCE', 'HIP HOP',
    // folklore
    'FOLKLORE DEL CHACO', 'FOLKLORE DE LOS VALLES', 'FOLKLORE ORIENTAL DE PROYECCION',
    'FOLKLORE ORIENTAL TRADICIONAL', 'FOLKLORE POPULAR SAYA CAPORAL', 'FOLKLORE ANDINO',
    'FOLKLORE LATINOAMERICANO', 'FOLKLORE ANDINO TINKU',
  ],
};

const canonProg = (s: string) => s.replace(/^FOLKLORE\b/, 'FOLCLORE');

function rangoProg(key: keyof typeof ORD_PROGRAMA, val: string | null | undefined): number {
  const u = canonProg((val ?? '').toString().toUpperCase());
  const i = ORD_PROGRAMA[key].findIndex((x) => canonProg(x) === u);
  return i < 0 ? 999 : i;
}

type ObraOrdenable = {
  bloque: string | null;
  division: string | null;
  modalidad: string | null;
  subdivision?: string | null;
  obra: string | null;
};

/** Comparador del programa: bloque → división → modalidad → subdivisión → obra. */
export function cmpPrograma(a: ObraOrdenable, b: ObraOrdenable): number {
  for (const key of ['bloque', 'division', 'modalidad', 'subdivision'] as const) {
    const ra = rangoProg(key, a[key]);
    const rb = rangoProg(key, b[key]);
    if (ra !== rb) return ra - rb;
  }
  return (a.obra ?? '').localeCompare(b.obra ?? '', 'es');
}

/** Ordena una lista de obras con el orden canónico del programa (gemelo de jurados). */
export function ordenarPrograma<T extends ObraOrdenable>(obras: T[]): T[] {
  return [...obras].sort(cmpPrograma);
}

/* ─────────────────── Orden de la NOCHE según el ADMIN ───────────────────
   Cuando la RPC trae `orden_final` (migración 054), el programa de la final se
   muestra EXACTAMENTE en el orden que armó el admin de jurados (arrastres, gala
   estelar incluida). Las obras sin orden_final van al final, con el preset
   canónico como respaldo — así el portal nunca inventa un orden distinto. */
export function ordenarNoche<T extends ObraOrdenable & { orden_final?: number | null }>(obras: T[]): T[] {
  return [...obras].sort((a, b) => {
    const oa = a.orden_final ?? Number.POSITIVE_INFINITY;
    const ob = b.orden_final ?? Number.POSITIVE_INFINITY;
    if (oa !== ob) return oa - ob;
    return cmpPrograma(a, b);
  });
}

/* Ids de las obras DENTRO del cupo de 100 de su noche. El chip «Final sábado /
   Final domingo» solo se muestra para estas: estar clasificada pero fuera del
   cupo no es estar en la final. */
export function idsEnCupo<T extends ObraFinalizable & { id_inscripcion: string }>(
  obras: T[],
  cupo = CUPO_FINAL,
): Set<string> {
  const por = finalistasPorDia(obras, cupo);
  return new Set([...por['Sábado'], ...por.Domingo].map((o) => o.id_inscripcion));
}
