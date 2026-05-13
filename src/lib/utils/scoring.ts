import type { Nota } from '@/types/domain';

export function calcularPromedioJurado(n: Nota): number {
  const tem = Number(n.tematica) || 0;
  const intr = Number(n.interpretacion) || 0;
  const cor = Number(n.coreografia) || 0;
  const dif = Number(n.dificultad_y_ejecucion) || 0;
  return tem + intr + cor + dif;
}

export function calcularPromedioFinal(notas: Nota[]): number | null {
  if (!notas || notas.length === 0) return null;
  const sum = notas.reduce((s, n) => s + calcularPromedioJurado(n), 0);
  return sum / notas.length;
}

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return Number(n).toFixed(1);
}
