import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Volume1, Music } from 'lucide-react';

interface Props {
  src: string;
  title?: string;
}

function fmtTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function AudioPlayer({ src, title = 'Audio de la obra' }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

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

  function changeVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    setVolume(v);
    if (v > 0 && muted) setMuted(false);
  }

  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
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
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onEnded={() => setPlaying(false)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        className="hidden"
      />

      <div
        className="mb-2 flex items-center gap-2 text-[10px] font-medium uppercase text-cyan"
        style={{ letterSpacing: '0.6px' }}
      >
        <Music className="h-3.5 w-3.5" />
        {title}
      </div>

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

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          className="text-text-65 transition hover:text-cyan"
        >
          <VolIcon className="h-4 w-4" />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={changeVolume}
          aria-label="Volumen"
          className="audio-slider audio-slider--vol flex-1"
          style={{
            ['--pct' as string]: `${(muted ? 0 : volume) * 100}%`,
          }}
        />
        <span className="w-8 text-right text-[10px] text-text-45 tabular-nums">
          {Math.round((muted ? 0 : volume) * 100)}%
        </span>
      </div>
    </div>
  );
}
