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
import { toast } from 'sonner';
import { dataApi } from '@/lib/api/data';
import { MEMBRESIA_VIDEOS, MEMBRESIA_PAQUETE } from '@/lib/membresia';
import type { VideoItem } from '@/types/domain';

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function VideosTab() {
  const { user } = useAuth();
  const q = useVideos(!!user);
  const [active, setActive] = useState<VideoItem | null>(null);
  const [query, setQuery] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const data = useMemo(() => q.data?.videos ?? {}, [q.data]);
  const membresia = q.data?.membresia;
  const unlockPrice = membresia?.reservo
    ? MEMBRESIA_VIDEOS.precioReserva
    : MEMBRESIA_VIDEOS.precioRegular;
  const paquetePrice = membresia?.paquete_reservo
    ? MEMBRESIA_PAQUETE.precioReserva
    : MEMBRESIA_PAQUETE.precioRegular;

  async function handleUnlock(tipo: 'videos' | 'paquete' = 'videos') {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const { pay_url } = await dataApi.membresiaCheckout(tipo);
      window.location.href = pay_url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo iniciar el pago.');
      setUnlocking(false);
    }
  }

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

      {membresia && (membresia.puede_comprar ?? membresia.tiene_kardex) && !membresia.paquete_pagada && (
        <>
          {!membresia.pagada && (
            <div className="flex flex-col gap-3 rounded-xl border border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.08)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-white">
                  Membresía de Videos 2026
                  {membresia.reservo && (
                    <span className="rounded-full border border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.14)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--amber-accent)]">
                      Oferta −{Math.round((1 - MEMBRESIA_VIDEOS.precioReserva / MEMBRESIA_VIDEOS.precioRegular) * 100)}%
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-text-65">
                  Accedé a los videos de tus bailes del Festival Danzarte 2026.
                </p>
                {membresia.reservo && (
                  <p className="mt-1 text-[11px] font-semibold text-[var(--amber-accent)]">
                    Precio de preventa · por tiempo limitado
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleUnlock('videos')}
                disabled={unlocking}
                className="shrink-0 rounded-full bg-primary-gradient px-5 py-2 text-sm font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
              >
                {unlocking ? (
                  'Abriendo pago…'
                ) : (
                  <>
                    Comprar ·{' '}
                    {membresia.reservo && (
                      <s className="mr-1 font-normal opacity-60">{MEMBRESIA_VIDEOS.precioRegular} Bs</s>
                    )}
                    {unlockPrice} Bs
                  </>
                )}
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-xl border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-text-white">
                Paquete Completo 2026
                <span className="rounded-full border border-[rgba(251,191,36,0.45)] bg-[rgba(251,191,36,0.14)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--amber-accent)]">
                  Oferta{membresia.paquete_reservo ? ` −${Math.round((1 - MEMBRESIA_PAQUETE.precioReserva / MEMBRESIA_PAQUETE.precioRegular) * 100)}%` : ''}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-text-65">
                Accedé a TODOS los videos del festival, no solo los tuyos.
              </p>
              {membresia.paquete_reservo && (
                <p className="mt-1 text-[11px] font-semibold text-[var(--amber-accent)]">
                  Precio de preventa · por tiempo limitado
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => handleUnlock('paquete')}
              disabled={unlocking}
              className="shrink-0 rounded-full bg-primary-gradient px-5 py-2 text-sm font-bold text-white shadow-[0_4px_16px_rgba(168,85,247,0.45)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
              {unlocking ? (
                'Abriendo pago…'
              ) : (
                <>
                  Comprar ·{' '}
                  {membresia.paquete_reservo && (
                    <s className="mr-1 font-normal opacity-60">{MEMBRESIA_PAQUETE.precioRegular} Bs</s>
                  )}
                  {paquetePrice} Bs
                </>
              )}
            </button>
          </div>
        </>
      )}

      {membresia?.paquete_pagada ? (
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(168,85,247,0.4)] bg-[rgba(168,85,247,0.12)] px-4 py-2.5 text-sm font-medium text-[rgb(196,181,253)]">
          <span aria-hidden>✓</span>
          <span>Paquete Completo activo — TODOS los videos del festival 2026 desbloqueados.</span>
        </div>
      ) : membresia?.pagada ? (
        <div className="flex items-center gap-2 rounded-xl border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-4 py-2.5 text-sm font-medium text-cyan">
          <span aria-hidden>✓</span>
          <span>Membresía de Videos activa — tus videos 2026 están desbloqueados.</span>
        </div>
      ) : null}

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
                <VideoCard
                  key={v.id_inscripcion}
                  video={v}
                  locked={v.bloqueado}
                  onClick={() => setActive(v)}
                />
              ))}
            </div>
          </DayGroup>
        ))}
      </div>

      <VideoModal
        video={active}
        onClose={() => setActive(null)}
        preview={active?.bloqueado ?? false}
        unlockPrice={unlockPrice}
        onUnlock={handleUnlock}
        unlocking={unlocking}
      />
    </div>
  );
}
