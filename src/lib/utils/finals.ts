/**
 * Clasificación a la final (Sábado/Domingo) — misma regla que la app de jurados
 * (`finalDeCampos`): corte 75 para colegios/universidades, 80 para el resto;
 * si clasifica → Folklore va el Domingo, el resto el Sábado.
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
