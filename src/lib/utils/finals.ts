/**
 * Clasificación a la final (Sábado/Domingo) — misma regla que la app de jurados
 * (`finalDeCampos`): corte 70 para colegios/universidades, 75 para el resto;
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

export function clasificacionDe(
  nota: number | null,
  modalidad: string | null,
  genero: string | null,
  categoria: string | null,
): 'Sábado' | 'Domingo' | null {
  if (nota == null) return null;
  const corte = /COLEGIO|UNIVERSID/.test((categoria ?? '').toUpperCase()) ? 70 : 75;
  if (nota < corte) return null;
  return /FOLCLOR|FOLKLOR/.test(`${modalidad ?? ''} ${genero ?? ''}`.toUpperCase())
    ? 'Domingo'
    : 'Sábado';
}
