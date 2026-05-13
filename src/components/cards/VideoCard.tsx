import { Play } from 'lucide-react';
import type { VideoItem } from '@/types/domain';
import { extractVimeoId, vimeoThumbUrl } from '@/lib/utils/vimeo';

interface Props {
  video: VideoItem;
  onClick: () => void;
}

export function VideoCard({ video, onClick }: Props) {
  const id = extractVimeoId(video.url_video);
  const thumb = id ? vimeoThumbUrl(id) : null;
  const inst = video.agrupacion || 'Sin institución';
  const obra = video.nombre_de_la_obra || 'Sin obra';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md text-left transition hover:border-cyan/40"
    >
      <div className="aspect-video w-full overflow-hidden bg-base">
        {thumb ? (
          <img
            src={thumb}
            alt={obra}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,var(--cyan),var(--fuchsia))' }}
          >
            <Play className="h-10 w-10 text-white" />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <Play className="h-12 w-12 text-white" fill="white" />
        </div>
      </div>
      <div className="p-3">
        <div className="text-text-45 text-xs truncate">{inst}</div>
        <div className="text-text-90 text-sm font-medium truncate">{obra}</div>
      </div>
    </button>
  );
}
