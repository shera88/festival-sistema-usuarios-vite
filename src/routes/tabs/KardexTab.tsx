import { useMemo, useState } from 'react';
import { YearPills } from '@/components/filters/YearPills';
import { SearchInput } from '@/components/filters/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { KardexGroup } from '@/components/cards/KardexGroup';
import { useInscripciones, useKardex } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import type { Inscripcion, KardexRow, Year } from '@/types/domain';

const YEARS = ['2023', '2024', '2025', '2026'] as const satisfies readonly Year[];

export interface AgrupacionMeta {
  id_agrupacion: string | null;
  estado_credenciales: string | null;
}

export function KardexTab() {
  const { user } = useAuth();
  const [year, setYear] = useState<Year>('2026');
  const [search, setSearch] = useState('');

  const q = useKardex(year, !!user);
  const inscQ = useInscripciones(year, !!user);

  const rows = (q.data?.[year] ?? []) as KardexRow[];
  const inscripciones = (inscQ.data?.[year] ?? []) as Inscripcion[];

  const metaByName = useMemo<Record<string, AgrupacionMeta>>(() => {
    const m: Record<string, AgrupacionMeta> = {};
    for (const i of inscripciones) {
      const key = (i.agrupacion || '').toLowerCase().trim();
      if (!key || m[key]) continue;
      m[key] = {
        id_agrupacion: i.id_agrupacion,
        estado_credenciales: i.estado_credenciales ?? null,
      };
    }
    return m;
  }, [inscripciones]);

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
    // Agrupa por id_agrupacion cuando exista; sino por nombre normalizado.
    // Normalize: trim + collapse whitespace + upper + sin acentos.
    const norm = (s: string) =>
      s.trim().replace(/\s+/g, ' ').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const m: Record<
      string,
      { displayName: string; logo: string | null; rows: KardexRow[] }
    > = {};
    for (const r of filtered) {
      const rawName = r.agrupacion || 'Sin institución';
      // Agrupar SIEMPRE por nombre normalizado: una misma agrupación cuyos rows
      // vienen unos con id_agrupacion y otros en null (data mixta) se partía en
      // dos cards. Keyear por nombre las une en una sola.
      const key = `name:${norm(rawName)}`;
      if (!m[key]) m[key] = { displayName: rawName, logo: r.enlace_del_logo, rows: [] };
      if (!m[key].logo && r.enlace_del_logo) m[key].logo = r.enlace_del_logo;
      m[key].rows.push(r);
    }
    return m;
  }, [filtered]);

  const insts = useMemo(
    () =>
      Object.keys(groups).sort((a, b) =>
        groups[a].displayName.localeCompare(groups[b].displayName),
      ),
    [groups],
  );

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
        {insts.map((key) => {
          const g = groups[key];
          const metaKey = g.displayName.toLowerCase().trim();
          return (
            <KardexGroup
              key={key}
              year={year}
              agrupacion={g.displayName}
              logo={g.logo}
              rows={g.rows}
              meta={metaByName[metaKey] ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}
