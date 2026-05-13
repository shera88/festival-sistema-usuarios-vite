import { useMemo, useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { SearchInput } from '@/components/filters/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { InscripcionCard } from '@/components/cards/InscripcionCard';
import { useInscripciones, useCalificaciones } from '@/hooks/queries';
import { dayOrderIndex } from '@/lib/utils/days';
import { useAuth } from '@/hooks/useAuth';
import type { Inscripcion, Nota, Year, YearNotas } from '@/types/domain';

const YEARS = ['2023', '2024', '2025', '2026'] as const satisfies readonly Year[];

export function InscripcionesTab() {
  const { user } = useAuth();
  const [year, setYear] = useState<Year>('2026');
  const [search, setSearch] = useState('');

  const inscQ = useInscripciones(year, !!user);
  const califYear: YearNotas | null = year === '2026' ? null : (year as YearNotas);
  const califQ = useCalificaciones((califYear ?? '2025') as YearNotas, !!user && !!califYear);

  const inscripciones = (inscQ.data?.[year] ?? []) as Inscripcion[];
  const notasByInsc = useMemo(() => {
    const map: Record<string, Nota[]> = {};
    if (!califYear) return map;
    const all = (califQ.data?.[califYear] ?? []) as Nota[];
    for (const n of all) {
      if (!n.id_inscripcion) continue;
      (map[n.id_inscripcion] ||= []).push(n);
    }
    return map;
  }, [califQ.data, califYear]);

  const filtered = useMemo(() => {
    if (!search.trim()) return inscripciones;
    const s = search.toLowerCase();
    return inscripciones.filter(
      (i) =>
        (i.nombre_de_la_obra || '').toLowerCase().includes(s) ||
        (i.agrupacion || '').toLowerCase().includes(s) ||
        (i.categoria || '').toLowerCase().includes(s) ||
        (i.modalidad || '').toLowerCase().includes(s),
    );
  }, [inscripciones, search]);

  const byDay = useMemo(() => {
    const m: Record<string, Inscripcion[]> = {};
    for (const it of filtered) {
      const dia = (it.dia || 'SIN DÍA').toUpperCase();
      (m[dia] ||= []).push(it);
    }
    for (const k of Object.keys(m)) {
      m[k].sort((a, b) => (Number(a.orden) || 999) - (Number(b.orden) || 999));
    }
    return m;
  }, [filtered]);

  const days = Object.keys(byDay).sort((a, b) => dayOrderIndex(a) - dayOrderIndex(b));

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="text-xs uppercase text-text-45 tracking-wide">Filtrar por año</div>
        <YearPills years={YEARS} value={year} onChange={setYear} />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar obra o agrupación..." />
      </div>

      {inscQ.isLoading && <LoadingSkeleton rows={3} />}

      {!inscQ.isLoading && days.length === 0 && (
        <EmptyState>Sin inscripciones en {year}</EmptyState>
      )}

      {days.map((dia) => (
        <section key={dia} className="space-y-2">
          <h3 className="flex items-baseline gap-2 px-1 text-xs uppercase tracking-wider text-text-45">
            <span className="font-semibold text-text-90">{dia}</span>
            <span>
              {byDay[dia].length} obra{byDay[dia].length > 1 ? 's' : ''}
            </span>
          </h3>
          <div className="space-y-2">
            {byDay[dia].map((it) => (
              <InscripcionCard
                key={it.id_inscripcion}
                insc={it}
                notas={notasByInsc[it.id_inscripcion] || []}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
