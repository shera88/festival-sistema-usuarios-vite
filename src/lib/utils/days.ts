export const DAY_ORDER = [
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'MIÉRCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'SÁBADO',
  'DOMINGO',
] as const;

export function dayOrderIndex(d: string | null | undefined): number {
  const idx = DAY_ORDER.indexOf(String(d ?? '').toUpperCase() as (typeof DAY_ORDER)[number]);
  return idx === -1 ? 99 : idx;
}
