import { useMemo, useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { SearchInput } from '@/components/filters/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { CalificacionCard } from '@/components/cards/CalificacionCard';
import { useCalificaciones } from '@/hooks/queries';
import { dayOrderIndex } from '@/lib/utils/days';
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

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="text-xs uppercase text-text-45 tracking-wide">Filtrar por año</div>
        <YearPills years={YEARS} value={year} onChange={setYear} />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
      </div>

      {q.isLoading && <LoadingSkeleton rows={3} />}

      {!q.isLoading && days.length === 0 && (
        <EmptyState>Sin calificaciones en {year}</EmptyState>
      )}

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
          <section key={dia} className="space-y-2">
            <h3 className="flex items-baseline gap-2 px-1 text-xs uppercase tracking-wider text-text-45">
              <span className="font-semibold text-text-90">{dia}</span>
              <span>
                {obras.length} obra{obras.length > 1 ? 's' : ''}
              </span>
            </h3>
            <div className="space-y-2">
              {obras.map(([key, ns]) => (
                <CalificacionCard key={key} notas={ns} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
