import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Music,
  Video,
  Upload,
  Trash2,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { Inscripcion, MultimediaArchivo } from '@/types/domain';
import { multimediaApi } from '@/lib/api/multimedia';
import { AudioPlayer } from './AudioPlayer';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

interface Props {
  open: boolean;
  inscripcion: Inscripcion | null;
  onClose: () => void;
}

const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/x-m4a,audio/flac';
const VIDEO_ACCEPT = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/mpeg';
const AUDIO_MAX_BYTES = 100 * 1024 * 1024;        // 100 MB
const VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;   // 2 GB

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MultimediaDialog({ open, inscripcion, onClose }: Props) {
  const qc = useQueryClient();
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'audio' | 'video_led' | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'uploading' | 'processing'>('uploading');
  const [deleteConfirm, setDeleteConfirm] = useState<MultimediaArchivo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Pending = archivo seleccionado pero NO subido aún
  const [pendingAudio, setPendingAudio] = useState<File | null>(null);
  const [pendingVideo, setPendingVideo] = useState<File | null>(null);
  const pendingAudioUrl = useRef<string | null>(null);
  const pendingVideoUrl = useRef<string | null>(null);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const id_inscripcion = inscripcion?.id_inscripcion ?? '';
  const queryEnabled = open && !!id_inscripcion;

  const lista = useQuery({
    queryKey: ['multimedia', id_inscripcion],
    queryFn: () => multimediaApi.listar(id_inscripcion),
    enabled: queryEnabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !uploading) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, uploading, onClose]);

  function revokePending() {
    if (pendingAudioUrl.current) {
      URL.revokeObjectURL(pendingAudioUrl.current);
      pendingAudioUrl.current = null;
    }
    if (pendingVideoUrl.current) {
      URL.revokeObjectURL(pendingVideoUrl.current);
      pendingVideoUrl.current = null;
    }
  }

  // Reset pendings al cerrar
  useEffect(() => {
    if (!open) {
      revokePending();
      setPendingAudio(null);
      setPendingVideo(null);
      setErrMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !inscripcion) return null;

  const archivos = lista.data?.archivos ?? [];
  const confirmado = !!lista.data?.confirmado;
  const audio = archivos.find((a) => a.tipo === 'audio') ?? null;
  const video = archivos.find((a) => a.tipo === 'video_led') ?? null;

  function handleSelect(tipo: 'audio' | 'video_led', file: File) {
    setErrMsg(null);
    if (tipo === 'audio' && file.size > AUDIO_MAX_BYTES) {
      setErrMsg('Audio muy grande (máx 100 MB).');
      return;
    }
    if (tipo === 'video_led' && file.size > VIDEO_MAX_BYTES) {
      setErrMsg('Video muy grande (máx 2 GB).');
      return;
    }
    if (tipo === 'audio') {
      if (pendingAudioUrl.current) URL.revokeObjectURL(pendingAudioUrl.current);
      pendingAudioUrl.current = URL.createObjectURL(file);
      setPendingAudio(file);
    } else {
      if (pendingVideoUrl.current) URL.revokeObjectURL(pendingVideoUrl.current);
      pendingVideoUrl.current = URL.createObjectURL(file);
      setPendingVideo(file);
    }
  }

  function cancelarPending(tipo: 'audio' | 'video_led') {
    if (tipo === 'audio') {
      if (pendingAudioUrl.current) URL.revokeObjectURL(pendingAudioUrl.current);
      pendingAudioUrl.current = null;
      setPendingAudio(null);
      if (audioInputRef.current) audioInputRef.current.value = '';
    } else {
      if (pendingVideoUrl.current) URL.revokeObjectURL(pendingVideoUrl.current);
      pendingVideoUrl.current = null;
      setPendingVideo(null);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  async function subirPending(tipo: 'audio' | 'video_led') {
    const file = tipo === 'audio' ? pendingAudio : pendingVideo;
    if (!file) return;
    setErrMsg(null);
    setUploading(tipo);
    setProgress(0);
    setPhase('uploading');
    try {
      await multimediaApi.subir(id_inscripcion, tipo, file, (status) => {
        setPhase(status.phase);
        setProgress(status.pct);
      });
      // Invalida ambas queries: la del modal (lista detallada) Y la de
      // inscripciones (que tiene audio_url_multimedia/video_led_url_multimedia
      // enriquecidos por backend para mostrar el player en la card).
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['multimedia', id_inscripcion] }),
        qc.invalidateQueries({ queryKey: ['inscripciones'] }),
      ]);
      cancelarPending(tipo);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al subir';
      setErrMsg(msg);
    } finally {
      setUploading(null);
      setProgress(0);
      setPhase('uploading');
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await multimediaApi.eliminar(deleteConfirm.id_multimedia);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['multimedia', id_inscripcion] }),
        qc.invalidateQueries({ queryKey: ['inscripciones'] }),
      ]);
      setDeleteConfirm(null);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  }

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[180] flex items-end justify-center bg-black/85 backdrop-blur-md anim-fade-in sm:items-center sm:px-4"
        onClick={uploading ? undefined : onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg overflow-hidden rounded-t-2xl border-x border-t border-glass-border shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] anim-fade-in-up sm:rounded-2xl sm:border"
          style={{ background: 'var(--bg-card)', maxHeight: '92vh' }}
        >
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
            <div className="min-w-0">
              <h3
                className="truncate text-[14px] font-semibold uppercase text-text-white"
                style={{ letterSpacing: '0.6px' }}
              >
                Multimedia de la obra
              </h3>
              <p className="mt-0.5 truncate text-[11px] text-text-45">
                {inscripcion.nombre_de_la_obra || 'Sin obra'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={uploading !== null}
              aria-label="Cerrar"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-45 transition hover:bg-white/10 hover:text-text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4" style={{ maxHeight: 'calc(92vh - 110px)' }}>
            {confirmado && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/10 px-3 py-2 text-[11px] text-cyan">
                <Lock className="h-4 w-4 shrink-0" />
                <span>Multimedia confirmada. No se permiten cambios.</span>
              </div>
            )}

            {/* AUDIO */}
            <Section
              icon={<Music className="h-4 w-4" />}
              title="Audio (obligatorio)"
              hint="MP3, WAV, M4A, AAC, OGG, FLAC · máx 100 MB"
              accent="cyan"
            >
              {pendingAudio ? (
                <PendingItem
                  file={pendingAudio}
                  preview={
                    pendingAudioUrl.current ? (
                      <AudioPlayer src={pendingAudioUrl.current} title={pendingAudio.name} />
                    ) : null
                  }
                  uploading={uploading === 'audio'}
                  progress={uploading === 'audio' ? progress : 0}
                  phase={uploading === 'audio' ? phase : 'uploading'}
                  accent="cyan"
                  onSubir={() => subirPending('audio')}
                  onCancelar={() => cancelarPending('audio')}
                />
              ) : audio ? (
                <ArchivoExistente
                  archivo={audio}
                  locked={confirmado}
                  onReemplazar={() => audioInputRef.current?.click()}
                  onEliminar={() => setDeleteConfirm(audio)}
                  preview={<AudioPlayer src={audio.url_publica} title={audio.nombre_archivo ?? 'Audio'} />}
                />
              ) : (
                <DropZone
                  label="Seleccionar audio"
                  accent="cyan"
                  locked={confirmado}
                  onClick={() => audioInputRef.current?.click()}
                />
              )}
              <input
                ref={audioInputRef}
                type="file"
                accept={AUDIO_ACCEPT}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelect('audio', f);
                }}
              />
            </Section>

            {/* VIDEO LED */}
            <Section
              icon={<Video className="h-4 w-4" />}
              title="Video para pantallas LED (opcional)"
              accent="fuchsia"
            >
              {pendingVideo ? (
                <PendingItem
                  file={pendingVideo}
                  preview={
                    pendingVideoUrl.current ? (
                      <video
                        src={pendingVideoUrl.current}
                        controls
                        preload="metadata"
                        className="w-full rounded-md border border-glass-border"
                        style={{ maxHeight: 240 }}
                      />
                    ) : null
                  }
                  uploading={uploading === 'video_led'}
                  progress={uploading === 'video_led' ? progress : 0}
                  phase={uploading === 'video_led' ? phase : 'uploading'}
                  accent="fuchsia"
                  onSubir={() => subirPending('video_led')}
                  onCancelar={() => cancelarPending('video_led')}
                />
              ) : video ? (
                <ArchivoExistente
                  archivo={video}
                  locked={confirmado}
                  onReemplazar={() => videoInputRef.current?.click()}
                  onEliminar={() => setDeleteConfirm(video)}
                  preview={
                    <video
                      src={video.url_publica}
                      controls
                      preload="metadata"
                      className="w-full rounded-md border border-glass-border"
                      style={{ maxHeight: 240 }}
                    />
                  }
                />
              ) : (
                <DropZone
                  label="Seleccionar video LED"
                  accent="fuchsia"
                  locked={confirmado}
                  onClick={() => videoInputRef.current?.click()}
                />
              )}
              <input
                ref={videoInputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSelect('video_led', f);
                }}
              />
            </Section>

            {errMsg && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-400/40 bg-red-400/5 px-3 py-2 text-[12px] text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{errMsg}</span>
              </div>
            )}
          </div>

          <div
            className="flex border-t border-glass-border px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={uploading !== null}
              className="w-full rounded-full border border-glass-border bg-glass-bg px-4 py-2 text-[12px] font-semibold uppercase text-text-65 transition hover:border-text-45 hover:text-text-white disabled:opacity-50"
              style={{ letterSpacing: '0.6px' }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        variant="danger"
        title="¿Eliminar archivo?"
        message={
          <p>
            Se eliminará <strong className="text-text-white">{deleteConfirm?.nombre_archivo}</strong>.
            Esta acción no se puede deshacer.
          </p>
        }
        confirmText="Eliminar"
        cancelText="Cancelar"
        loading={deleting}
        onConfirm={handleDelete}
        onClose={() => {
          if (!deleting) setDeleteConfirm(null);
        }}
      />
    </>,
    document.body,
  );
}

function Section({
  icon,
  title,
  hint,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  accent: 'cyan' | 'fuchsia';
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4 last:mb-0">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="grid h-7 w-7 place-items-center rounded-md"
          style={{
            background: accent === 'cyan' ? 'rgba(0,229,255,0.12)' : 'rgba(255,31,168,0.12)',
            color: accent === 'cyan' ? 'var(--cyan)' : 'var(--fuchsia)',
          }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-[12px] font-semibold uppercase text-text-white" style={{ letterSpacing: '0.5px' }}>
            {title}
          </h4>
          {hint ? <p className="text-[10px] text-text-45">{hint}</p> : null}
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function DropZone({
  label,
  accent,
  locked,
  onClick,
}: {
  label: string;
  accent: 'cyan' | 'fuchsia';
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 text-[12px] font-semibold uppercase transition disabled:opacity-50 ${
        accent === 'cyan'
          ? 'border-cyan/30 bg-cyan/5 text-cyan hover:border-cyan/60 hover:bg-cyan/10'
          : 'border-fuchsia/30 bg-fuchsia/5 text-fuchsia hover:border-fuchsia/60 hover:bg-fuchsia/10'
      }`}
      style={{ letterSpacing: '0.5px' }}
    >
      <Upload className="h-4 w-4" />
      {label}
    </button>
  );
}

function PendingItem({
  file,
  preview,
  uploading,
  progress,
  phase,
  accent,
  onSubir,
  onCancelar,
}: {
  file: File;
  preview: React.ReactNode;
  uploading: boolean;
  progress: number;
  phase: 'uploading' | 'processing';
  accent: 'cyan' | 'fuchsia';
  onSubir: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className={`rounded-lg border bg-black/20 p-3 ${accent === 'cyan' ? 'border-cyan/40' : 'border-fuchsia/40'}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-text-white">{file.name}</p>
          <p className={`text-[10px] ${accent === 'cyan' ? 'text-cyan' : 'text-fuchsia'}`}>
            Pendiente · {fmtBytes(file.size)}
          </p>
        </div>
      </div>
      <div className="mb-2.5">{preview}</div>
      {uploading ? (
        <div>
          <div className="flex items-center gap-2 text-[11px] text-text-65">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan" />
            {phase === 'uploading' ? `Enviando… ${progress}%` : 'Procesando en servidor…'}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all ${phase === 'processing' ? 'animate-pulse' : ''}`}
              style={{
                width: `${progress}%`,
                background: accent === 'cyan' ? 'var(--cyan)' : 'var(--fuchsia)',
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-md border border-glass-border bg-glass-bg px-3 py-1.5 text-[10px] font-semibold uppercase text-text-65 transition hover:border-text-45 hover:text-text-white"
            style={{ letterSpacing: '0.5px' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubir}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase transition ${
              accent === 'cyan'
                ? 'bg-cyan text-[#04020F] hover:bg-[#66F0FF]'
                : 'bg-fuchsia text-white hover:bg-[#FF66C4]'
            }`}
            style={{ letterSpacing: '0.5px' }}
          >
            <Upload className="h-3 w-3" />
            Subir ahora
          </button>
        </div>
      )}
    </div>
  );
}

function ArchivoExistente({
  archivo,
  locked,
  onReemplazar,
  onEliminar,
  preview,
}: {
  archivo: MultimediaArchivo;
  locked: boolean;
  onReemplazar: () => void;
  onEliminar: () => void;
  preview: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-glass-border bg-black/20 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 shrink-0 text-green" />
            <p className="truncate text-[12px] font-medium text-text-white">
              {archivo.nombre_archivo || `archivo.${archivo.extension}`}
            </p>
          </div>
          <p className="ml-4 text-[10px] text-text-45">
            {archivo.extension.toUpperCase()} · {fmtBytes(archivo.peso_bytes)}
          </p>
        </div>
        {!locked && (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={onReemplazar}
              aria-label="Reemplazar"
              className="grid h-7 w-7 place-items-center rounded-md border border-glass-border text-text-65 transition hover:border-cyan/60 hover:text-cyan"
            >
              <Upload className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onEliminar}
              aria-label="Eliminar"
              className="grid h-7 w-7 place-items-center rounded-md border border-glass-border text-text-65 transition hover:border-red-400/60 hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <div>{preview}</div>
    </div>
  );
}
