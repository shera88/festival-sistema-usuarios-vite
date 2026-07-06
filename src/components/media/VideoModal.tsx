import { useEffect, useRef, useState } from 'react';
import { X, Lock } from 'lucide-react';
import type { VideoItem } from '@/types/domain';
import { extractVimeoId, vimeoEmbedUrl, isDirectVideoUrl } from '@/lib/utils/vimeo';

const PREVIEW_SECONDS = 20;

interface Props {
  video: VideoItem | null;
  onClose: () => void;
  /** Video bloqueado (membresía no pagada): reproduce solo una vista previa. */
  preview?: boolean;
  /** Precio a mostrar en el botón de desbloqueo (20 si reservó, 50 si no). */
  unlockPrice?: number;
  /** Abre el checkout de la membresía. */
  onUnlock?: () => void;
  /** true mientras se abre el checkout. */
  unlocking?: boolean;
}

export function VideoModal({ video, onClose, preview = false, unlockPrice, onUnlock, unlocking = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [previewEnded, setPreviewEnded] = useState(false);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Reinicia el estado de la vista previa al cambiar de video.
  useEffect(() => {
    setPreviewEnded(false);
  }, [video?.id_inscripcion]);

  if (!video) return null;

  const id = extractVimeoId(video.url_video);
  const directUrl = !id && isDirectVideoUrl(video.url_video) ? String(video.url_video) : null;

  // Corta la vista previa a los 20s y no deja adelantar más allá.
  function clampPreview() {
    const el = videoRef.current;
    if (!preview || !el) return;
    if (el.currentTime >= PREVIEW_SECONDS) {
      el.pause();
      el.currentTime = PREVIEW_SECONDS;
      setPreviewEnded(true);
    }
  }

  const UnlockOverlay = (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
      <Lock className="h-9 w-9 text-white/90" />
      <p className="text-base font-semibold text-white">Vista previa terminada</p>
      <p className="max-w-sm text-xs text-white/70">
        Comprá la Membresía de Videos para ver este video completo y todos tus videos del Festival 2026.
      </p>
      {onUnlock && (
        <button
          type="button"
          onClick={onUnlock}
          disabled={unlocking}
          className="mt-1 rounded-full bg-primary-gradient px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.5)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {unlocking ? 'Abriendo pago…' : `Desbloquear${unlockPrice ? ` · ${unlockPrice} Bs` : ''}`}
        </button>
      )}
    </div>
  );

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
          className="absolute right-2 top-2 z-20 rounded-full bg-black/60 p-1.5 text-white hover:bg-black"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="relative aspect-video w-full bg-base">
          {preview && !directUrl ? (
            // Video bloqueado sin fuente reproducible acá (ej. Vimeo): CTA directo.
            UnlockOverlay
          ) : directUrl ? (
            <>
              <video
                ref={videoRef}
                src={directUrl}
                className="h-full w-full bg-black"
                controls
                autoPlay
                playsInline
                controlsList="nodownload noplaybackrate"
                onTimeUpdate={clampPreview}
                onSeeking={clampPreview}
              />
              {preview && !previewEnded && (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                  Vista previa · {PREVIEW_SECONDS}s
                </span>
              )}
              {preview && previewEnded && UnlockOverlay}
            </>
          ) : id ? (
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
