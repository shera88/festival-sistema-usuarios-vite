import { useMemo, useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { SearchInput } from '@/components/filters/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { DayGroup } from '@/components/shared/DayGroup';
import { CalificacionCard } from '@/components/cards/CalificacionCard';
import { useCalificaciones } from '@/hooks/queries';
import { dayOrderIndex } from '@/lib/utils/days';
import { calcularPromedioFinal, fmtScore } from '@/lib/utils/scoring';
import { useAuth } from '@/hooks/useAuth';
import type { Nota, YearNotas } from '@/types/domain';

const YEARS = ['2023', '2024', '2025'] as const satisfies readonly YearNotas[];

export function CalificacionesTab() {
  const { user } = useAuth();
  const [year, setYear] = useState<YearNotas>('2025');
  const [search, setSearch] = useState('');

  const q = useCalificaciones(year, !!user);
  const notas = (q.data?.[year] ?? []) as Nota[];

  const filtered = useMemo(() => {
    if (!search.trim()) return notas;
    const s = search.toLowerCase();
    return notas.filter(
      (n) =>
        (n.jurado_nombre || '').toLowerCase().includes(s) ||
        (n.agrupacion || '').toLowerCase().includes(s) ||
        (n.insc_obra || '').toLowerCase().includes(s),
    );
  }, [notas, search]);

  const byDay = useMemo(() => {
    const groups: Record<string, Record<string, Nota[]>> = {};
    for (const n of filtered) {
      const dia = (n.insc_dia || n.dia || 'SIN DÍA').toUpperCase();
      const key = n.id_inscripcion || `${n.agrupacion}-${n.dia}`;
      groups[dia] ||= {};
      groups[dia][key] ||= [];
      groups[dia][key].push(n);
    }
    return groups;
  }, [filtered]);

  const days = Object.keys(byDay).sort((a, b) => dayOrderIndex(a) - dayOrderIndex(b));

  const stats = useMemo(() => {
    const grouped: Record<string, Nota[]> = {};
    for (const n of notas) {
      const k = n.id_inscripcion || `${n.agrupacion}-${n.dia}`;
      (grouped[k] ||= []).push(n);
    }
    const obras = Object.values(grouped);
    const promedios = obras.map((arr) => calcularPromedioFinal(arr)).filter((v): v is number => v !== null);
    const promedioGlobal = promedios.length === 0 ? null : promedios.reduce((a, b) => a + b, 0) / promedios.length;
    const mejor = promedios.length === 0 ? null : Math.max(...promedios);
    return [
      { label: `Obras Calificadas ${year}`, value: obras.length, accent: 'gold' as const },
      { label: 'Promedio', value: fmtScore(promedioGlobal), accent: 'cyan' as const },
      { label: 'Mejor Puntaje', value: fmtScore(mejor), accent: 'fuchsia' as const },
    ];
  }, [notas, year]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <StatsCards stats={stats} />

      <div className="space-y-3 rounded-2xl border border-glass-border bg-glass-bg p-4 backdrop-blur-md">
        <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>
          Filtrar por año
        </div>
        <YearPills years={YEARS} value={year} onChange={setYear} />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar obra o jurado..." />
      </div>

      {q.isLoading && <LoadingSkeleton rows={3} />}

      {!q.isLoading && days.length === 0 && (
        <EmptyState>Sin calificaciones en {year}</EmptyState>
      )}

      <div className="space-y-4">
        {days.map((dia) => {
          const obras = Object.entries(byDay[dia]).sort(([, a], [, b]) => {
            const oa = Number(a[0].insc_orden ?? a[0].orden);
            const ob = Number(b[0].insc_orden ?? b[0].orden);
            if (isNaN(oa) && isNaN(ob)) return 0;
            if (isNaN(oa)) return 1;
            if (isNaN(ob)) return -1;
            return oa - ob;
          });
          return (
            <DayGroup
              key={dia}
              label={dia}
              count={`${obras.length} obra${obras.length > 1 ? 's' : ''}`}
            >
              {obras.map(([key, ns]) => (
                <CalificacionCard key={key} notas={ns} />
              ))}
            </DayGroup>
          );
        })}
      </div>
    </div>
  );
}
