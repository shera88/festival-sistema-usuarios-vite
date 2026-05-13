import { useMemo, useState } from 'react';
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

export function VideosTab() {
  const { user } = useAuth();
  const q = useVideos(!!user);
  const [active, setActive] = useState<VideoItem | null>(null);

  const byYear = useMemo(() => {
    const data = (q.data ?? {}) as Record<string, VideoItem[]>;
    const years = Object.keys(data).sort((a, b) => Number(b) - Number(a));
    const result: { year: string; items: VideoItem[] }[] = [];
    for (const y of years) {
      const items = [...data[y]].sort((a, b) => {
        const d = dayOrderIndex((a.dia || '').toUpperCase()) - dayOrderIndex((b.dia || '').toUpperCase());
        if (d !== 0) return d;
        return (Number(a.orden) || 999) - (Number(b.orden) || 999);
      });
      if (items.length > 0) result.push({ year: y, items });
    }
    return result;
  }, [q.data]);

  const stats = useMemo(() => {
    const total = byYear.reduce((sum, y) => sum + y.items.length, 0);
    const yearsWithVideo = byYear.length;
    const yearMax = byYear.reduce(
      (best, y) => (y.items.length > (best?.items.length ?? -1) ? y : best),
      null as null | (typeof byYear)[number],
    );
    return [
      { label: 'Total Videos', value: total, accent: 'cyan' as const },
      { label: 'Años con Video', value: yearsWithVideo, accent: 'fuchsia' as const },
      {
        label: 'Año con Más',
        value: yearMax ? `${yearMax.year} (${yearMax.items.length})` : '—',
        accent: 'gold' as const,
      },
    ];
  }, [byYear]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <StatsCards stats={stats} />

      {q.isLoading && <LoadingSkeleton rows={3} />}
      {!q.isLoading && byYear.length === 0 && <EmptyState>Sin videos disponibles.</EmptyState>}

      <div className="space-y-4">
        {byYear.map(({ year, items }) => (
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
