import { useMemo, useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { SearchInput } from '@/components/filters/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { KardexGroup } from '@/components/cards/KardexGroup';
import { useKardex } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import type { KardexRow, Year } from '@/types/domain';

const YEARS = ['2023', '2024', '2025', '2026'] as const satisfies readonly Year[];

export function KardexTab() {
  const { user } = useAuth();
  const [year, setYear] = useState<Year>('2026');
  const [search, setSearch] = useState('');

  const q = useKardex(year, !!user);
  const rows = (q.data?.[year] ?? []) as KardexRow[];

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (k) =>
        (k.nombre_y_apellido || '').toLowerCase().includes(s) ||
        (k.cargo || '').toLowerCase().includes(s) ||
        (k.agrupacion || '').toLowerCase().includes(s),
    );
  }, [rows, search]);

  const groups = useMemo(() => {
    const m: Record<string, { logo: string | null; rows: KardexRow[] }> = {};
    for (const r of filtered) {
      const inst = r.agrupacion || 'Sin institución';
      if (!m[inst]) m[inst] = { logo: r.enlace_del_logo, rows: [] };
      if (!m[inst].logo && r.enlace_del_logo) m[inst].logo = r.enlace_del_logo;
      m[inst].rows.push(r);
    }
    return m;
  }, [filtered]);

  const insts = Object.keys(groups).sort();

  const stats = useMemo(() => {
    const totalIntegrantes = rows.length;
    const agrupaciones = new Set(rows.map((r) => r.agrupacion).filter(Boolean)).size;
    const cargos = new Set(rows.map((r) => r.cargo).filter(Boolean)).size;
    return [
      { label: `Integrantes ${year}`, value: totalIntegrantes, accent: 'fuchsia' as const },
      { label: 'Agrupaciones', value: agrupaciones, accent: 'cyan' as const },
      { label: 'Cargos distintos', value: cargos, accent: 'gold' as const },
    ];
  }, [rows, year]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <StatsCards stats={stats} />

      <div className="space-y-3 rounded-2xl border border-glass-border bg-glass-bg p-4 backdrop-blur-md">
        <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>
          Filtrar por año
        </div>
        <YearPills years={YEARS} value={year} onChange={setYear} />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar integrante..." />
      </div>

      {q.isLoading && <LoadingSkeleton rows={3} />}

      {!q.isLoading && insts.length === 0 && (
        <EmptyState>Sin integrantes registrados en {year}</EmptyState>
      )}

      <div className="space-y-3">
        {insts.map((inst) => (
          <KardexGroup
            key={inst}
            agrupacion={inst}
            logo={groups[inst].logo}
            rows={groups[inst].rows}
          />
        ))}
      </div>
    </div>
  );
}
