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
  const dia = (video.dia || '').toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-purple/20 text-left transition hover:-translate-y-px hover:border-purple/50 hover:shadow-[0_8px_24px_rgba(124,58,237,0.15)]"
      style={{ background: 'var(--bg-card)' }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-base">
        {thumb ? (
          <img
            src={thumb}
            alt={obra}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-purple"
            style={{ background: 'rgba(124,58,237,0.08)' }}
          >
            <Play className="h-12 w-12" />
          </div>
        )}
        {video.orden !== null && video.orden !== undefined && (
          <span className="absolute left-2 top-2 rounded-md bg-black/60 px-2 py-0.5 font-display text-sm font-bold text-cyan backdrop-blur">
            {video.orden}
          </span>
        )}
        {dia && (
          <span
            className="absolute right-2 top-2 rounded-md border border-purple/40 bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase text-purple backdrop-blur"
            style={{ letterSpacing: '0.5px' }}
          >
            {dia}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
          <Play className="h-14 w-14 text-white drop-shadow-lg" fill="white" />
        </div>
      </div>
      <div className="p-3">
        <div
          className="truncate text-[10px] font-semibold uppercase text-text-65"
          style={{ letterSpacing: '0.5px' }}
        >
          {inst}
        </div>
        <div className="truncate text-[13px] font-bold text-text-white">{obra}</div>
      </div>
    </button>
  );
}
