import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { VideoItem } from '@/types/domain';
import { extractVimeoId, vimeoEmbedUrl } from '@/lib/utils/vimeo';

interface Props {
  video: VideoItem | null;
  onClose: () => void;
}

export function VideoModal({ video, onClose }: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  if (!video) return null;

  const id = extractVimeoId(video.url_video);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-glass-border bg-elev"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="aspect-video w-full bg-base">
          {id ? (
            <iframe
              src={vimeoEmbedUrl(id, { autoplay: true })}
              className="h-full w-full"
              allowFullScreen
              allow="autoplay; fullscreen; picture-in-picture"
              title={video.nombre_de_la_obra || 'Video'}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-text-45">
              Video no disponible
            </div>
          )}
        </div>
        <div className="border-t border-glass-border p-4">
          <div className="text-text-45 text-xs">{video.agrupacion}</div>
          <div className="text-text-90 font-semibold">{video.nombre_de_la_obra}</div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
            {video.categoria && (
              <span className="rounded border border-cyan/40 px-1.5 py-0.5 text-cyan uppercase">
                {video.categoria}
              </span>
            )}
            {video.division && (
              <span className="rounded border border-fuchsia/40 px-1.5 py-0.5 text-fuchsia uppercase">
                {video.division}
              </span>
            )}
            {video.subdivision && (
              <span className="rounded border border-gold/40 px-1.5 py-0.5 text-gold uppercase">
                {video.subdivision}
              </span>
            )}
            {video.modalidad && (
              <span className="rounded border border-white/20 px-1.5 py-0.5 text-text-90 uppercase">
                {video.modalidad}
              </span>
            )}
          </div>
          {(video.coreografo || video.director) && (
            <div className="mt-2 text-xs text-text-45">
              {video.coreografo && <span>Coreógrafo: {video.coreografo}</span>}
              {video.coreografo && video.director && ' • '}
              {video.director && <span>Director: {video.director}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
