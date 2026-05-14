import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Nota } from '@/types/domain';
import { appsheetJuradoFoto } from '@/lib/utils/appsheet';
import { calcularPromedioJurado } from '@/lib/utils/scoring';
import { webpProxy } from '@/lib/utils/img';

interface Props {
  nota: Nota;
}

export function JuradoCard({ nota }: Props) {
  const [open, setOpen] = useState(false);
  const total = calcularPromedioJurado(nota);
  const foto = appsheetJuradoFoto(nota.jurado_foto);
  const nombre = nota.jurado_nombre || nota.jurado || 'Jurado';
  const initial = nombre.charAt(0).toUpperCase();
  const generos = (nota.jurado_generos || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  return (
    <article
      className={`overflow-hidden rounded-lg border transition ${
        open
          ? 'border-gold/30 shadow-[0_4px_18px_rgba(232,208,152,0.06)]'
          : 'border-glass-border'
      }`}
      style={{
        background: open
          ? 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-void) 100%)'
          : 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-gold">
          {foto ? (
            <img
              src={webpProxy(foto, 80) ?? foto}
              alt={nombre}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className="flex h-full w-full items-center justify-center font-display text-base font-bold text-gold"
              style={{
                background:
                  'linear-gradient(135deg, rgba(232,208,152,0.18) 0%, rgba(0,229,255,0.12) 100%)',
              }}
            >
              {initial}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-text-white">{nombre}</div>
          {generos.length > 0 && (
            <div
              className="mt-0.5 flex flex-wrap text-[8px] font-light uppercase text-text-45"
              style={{ letterSpacing: '0.5px', gap: '6px' }}
            >
              {generos.map((g, i) => (
                <span key={g} className="flex items-baseline">
                  {i > 0 && <span className="mr-1.5 text-text-25">·</span>}
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        <div
          className="shrink-0 font-display text-[15px] font-bold leading-none text-gold"
          style={{ letterSpacing: '-0.3px' }}
        >
          {total}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-gold' : 'text-text-45'
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-glass-border px-3 pb-3 pt-2.5 anim-fade-in">
          <div className="grid grid-cols-2 gap-1.5">
            <NotaItem label="Temática" value={nota.tematica} />
            <NotaItem label="Interpretación" value={nota.interpretacion} />
            <NotaItem label="Coreografía" value={nota.coreografia} />
            <NotaItem label="Dificultad" value={nota.dificultad_y_ejecucion} />
          </div>
          {nota.comentario && (
            <p
              className="mt-1.5 rounded-md border-l-2 border-cyan/30 px-3 py-2.5 text-[11px] italic text-text-65"
              style={{
                background: 'rgba(0,229,255,0.03)',
                lineHeight: '1.6',
              }}
            >
              "{nota.comentario}"
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function NotaItem({
  label,
  value,
}: {
  label: string;
  value: number | string | null;
}) {
  return (
    <div
      className="flex items-center justify-between gap-1.5 rounded-md border border-glass-border bg-white/[0.02] px-2 py-1.5"
    >
      <span
        className="min-w-0 truncate text-[9px] font-medium uppercase text-text-65"
        style={{ letterSpacing: '0.3px' }}
      >
        {label}
      </span>
      <b className="font-display text-[12px] font-bold leading-none text-cyan">
        {value ?? '—'}
      </b>
    </div>
  );
}
