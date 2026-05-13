import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
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

  return (
    <div className="space-y-4 p-4">
      {q.isLoading && <LoadingSkeleton rows={3} />}
      {!q.isLoading && byYear.length === 0 && <EmptyState>Sin videos disponibles.</EmptyState>}

      {byYear.map(({ year, items }) => (
        <section key={year} className="space-y-2">
          <h3 className="flex items-baseline gap-2 px-1 text-xs uppercase tracking-wider text-text-45">
            <span className="font-semibold text-text-90">{year}</span>
            <span>
              {items.length} video{items.length > 1 ? 's' : ''}
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((v) => (
              <VideoCard key={v.id_inscripcion} video={v} onClick={() => setActive(v)} />
            ))}
          </div>
        </section>
      ))}

      <VideoModal video={active} onClose={() => setActive(null)} />
    </div>
  );
}
