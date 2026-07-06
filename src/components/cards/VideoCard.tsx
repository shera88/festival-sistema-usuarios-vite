import { Play, Lock } from 'lucide-react';
import type { VideoItem } from '@/types/domain';
import { extractVimeoId, vimeoThumbUrl, isDirectVideoUrl } from '@/lib/utils/vimeo';

interface Props {
  video: VideoItem;
  onClick: () => void;
  /** Video 2026 sin membresía pagada: miniatura difuminada + candado + "Vista previa". */
  locked?: boolean;
}

export function VideoCard({ video, onClick, locked = false }: Props) {
  const id = extractVimeoId(video.url_video);
  const directUrl = !id && isDirectVideoUrl(video.url_video) ? String(video.url_video) : null;
  const thumb = id ? vimeoThumbUrl(id) : null;
  const inst = video.agrupacion || 'Sin institución';
  const obra = video.nombre_de_la_obra || 'Sin obra';
  const dia = (video.dia || '').toUpperCase();
  const dim = locked ? 'scale-105 blur-[3px] brightness-[0.5]' : 'group-hover:scale-105';

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-xl border border-purple/20 text-left transition hover:-translate-y-px hover:border-purple/50 hover:shadow-[0_8px_24px_rgba(124,58,237,0.15)]"
      style={{ background: 'var(--bg-card)' }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-base">
        {thumb ? (
          <img src={thumb} alt={obra} className={`h-full w-full object-cover transition ${dim}`} />
        ) : directUrl ? (
          // Miniatura = un frame del mp4 (poster). #t=3 → muestra el segundo 3.
          <video
            src={`${directUrl}#t=3`}
            preload="metadata"
            muted
            playsInline
            tabIndex={-1}
            className={`pointer-events-none h-full w-full object-cover transition ${dim}`}
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

        {locked ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 px-3 text-center">
            <Lock className="h-7 w-7 text-white drop-shadow" />
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur">
              Vista previa · 20s
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
            <Play className="h-14 w-14 text-white drop-shadow-lg" fill="white" />
          </div>
        )}
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
