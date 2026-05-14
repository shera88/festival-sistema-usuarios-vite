import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { DayGroup } from '@/components/shared/DayGroup';
import { VideoCard } from '@/components/cards/VideoCard';
import { VideoModal } from '@/components/media/VideoModal';
import { useVideos } from '@/hooks/queries';
import { dayOrderIndex } from '@/lib/utils/days';
import { useAuth } from '@/hooks/useAuth';
import type { VideoItem } from '@/types/domain';

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function VideosTab() {
  const { user } = useAuth();
  const q = useVideos(!!user);
  const [active, setActive] = useState<VideoItem | null>(null);
  const [query, setQuery] = useState('');

  const data = useMemo(() => (q.data ?? {}) as Record<string, VideoItem[]>, [q.data]);

  const byYearAll = useMemo(() => {
    const years = Object.keys(data).sort((a, b) => Number(b) - Number(a));
    return years
      .map((year) => ({
        year,
        items: [...data[year]].sort((a, b) => {
          const d = dayOrderIndex((a.dia || '').toUpperCase()) - dayOrderIndex((b.dia || '').toUpperCase());
          if (d !== 0) return d;
          return (Number(a.orden) || 999) - (Number(b.orden) || 999);
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [data]);

  const byYearFiltered = useMemo(() => {
    const qn = norm(query.trim());
    if (!qn) return byYearAll;
    return byYearAll
      .map((g) => ({
        year: g.year,
        items: g.items.filter(
          (v) =>
            norm(v.agrupacion).includes(qn) ||
            norm(v.nombre_de_la_obra).includes(qn) ||
            norm(v.dia).includes(qn),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [byYearAll, query]);

  const totalFiltered = useMemo(
    () => byYearFiltered.reduce((sum, g) => sum + g.items.length, 0),
    [byYearFiltered],
  );

  const stats = useMemo(() => {
    const total = byYearAll.reduce((sum, g) => sum + g.items.length, 0);
    const yearMax = byYearAll.reduce(
      (best, g) => (g.items.length > (best?.items.length ?? -1) ? g : best),
      null as null | (typeof byYearAll)[number],
    );
    return [
      { label: 'Total Videos', value: total, accent: 'cyan' as const },
      { label: 'Años con Video', value: byYearAll.length, accent: 'fuchsia' as const },
      {
        label: 'Año con Más',
        value: yearMax ? `${yearMax.year} (${yearMax.items.length})` : '—',
        accent: 'gold' as const,
      },
    ];
  }, [byYearAll]);

  const wasEmptyRef = useRef(true);
  useEffect(() => {
    const isEmpty = !query.trim();
    if (!isEmpty && wasEmptyRef.current) {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    wasEmptyRef.current = isEmpty;
  }, [query]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <StatsCards stats={stats} />

      <div
        className="sticky top-[112px] z-20 -mx-4 px-4 py-2 sm:-mx-6 sm:px-6"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="group relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-45 transition-colors group-focus-within:text-cyan" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar agrupación, obra o día…"
            className="w-full rounded-full border border-glass-border bg-[rgba(8,5,30,0.85)] px-10 py-2.5 text-[13px] text-text-white placeholder:text-text-45 outline-none backdrop-blur-md transition-colors focus:border-cyan focus:shadow-[0_0_18px_rgba(0,229,255,0.18)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Limpiar"
              className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-text-45 transition hover:bg-white/10 hover:text-text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {query && !q.isLoading && (
          <p className="mt-1.5 text-center text-[11px] text-text-45">
            {totalFiltered} {totalFiltered === 1 ? 'resultado' : 'resultados'} para
            <span className="ml-1 font-mono text-cyan">"{query}"</span>
          </p>
        )}
      </div>

      {q.isLoading && <LoadingSkeleton rows={3} />}
      {!q.isLoading && byYearFiltered.length === 0 && (
        <EmptyState>
          {query ? `Sin resultados para "${query}".` : 'Sin videos disponibles.'}
        </EmptyState>
      )}

      <div className="space-y-4">
        {byYearFiltered.map(({ year, items }) => (
          <DayGroup
            key={year}
            label={year}
            count={`${items.length} video${items.length > 1 ? 's' : ''}`}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((v) => (
                <VideoCard key={v.id_inscripcion} video={v} onClick={() => setActive(v)} />
              ))}
            </div>
          </DayGroup>
        ))}
      </div>

      <VideoModal video={active} onClose={() => setActive(null)} />
    </div>
  );
}
