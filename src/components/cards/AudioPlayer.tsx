import { useRef, useState } from 'react';
import { Play, Pause, Music, Download } from 'lucide-react';
import { extFromUrl, sanitizeFilename } from '@/lib/utils/descargarArchivo';
import { mediaDownloadUrl } from '@/lib/utils/mediaName';

interface Props {
  src: string;
  title?: string;
  /** Nombre base para descargar (sin extensión). Si se pasa, muestra el nombre + botón. */
  downloadName?: string;
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function AudioPlayer({ src, title = 'Audio de la obra', downloadName }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const fileName = downloadName
    ? sanitizeFilename(downloadName + extFromUrl(src, '.mp3'))
    : null;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      setLoading(true);
      a.play()
        .then(() => setLoading(false))
        .catch(() => setLoading(false));
    } else {
      a.pause();
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const a = audioRef.current;
    if (!a) return;
    const v = Number(e.target.value);
    a.currentTime = v;
    setCurrent(v);
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div
      className="rounded-xl border border-cyan/25 p-3"
      style={{
        background:
          'linear-gradient(135deg, rgba(0,229,255,0.08) 0%, rgba(255,31,168,0.05) 100%)',
      }}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        crossOrigin="anonymous"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        className="hidden"
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <div
          className="flex items-center gap-2 text-[10px] font-medium uppercase text-cyan"
          style={{ letterSpacing: '0.6px' }}
        >
          <Music className="h-3.5 w-3.5" />
          {title}
        </div>
        {fileName && (
          <a
            href={mediaDownloadUrl(src, fileName)}
            download={fileName}
            className="flex shrink-0 items-center gap-1 rounded-md border border-cyan/40 bg-cyan/10 px-2 py-1 text-[10px] font-semibold uppercase text-cyan transition hover:bg-cyan/20"
            style={{ letterSpacing: '0.4px' }}
          >
            <Download className="h-3 w-3" />
            Descargar
          </a>
        )}
      </div>

      {fileName && (
        <div className="mb-2 truncate text-[11px] text-text-90" title={fileName}>
          {fileName}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Pausar' : 'Reproducir'}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan text-bg-void transition hover:scale-105"
          style={{ color: '#04020F', boxShadow: '0 4px 14px rgba(0,229,255,0.4)' }}
        >
          {loading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : playing ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="h-4 w-4 translate-x-0.5 fill-current" />
          )}
        </button>

        <div className="flex flex-1 flex-col gap-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={current}
            onChange={seek}
            aria-label="Progreso"
            className="audio-slider"
            style={{
              ['--pct' as string]: `${pct}%`,
            }}
          />
          <div className="flex items-center justify-between text-[10px] text-text-65 tabular-nums">
            <span>{fmtTime(current)}</span>
            <span>{fmtTime(duration)}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
