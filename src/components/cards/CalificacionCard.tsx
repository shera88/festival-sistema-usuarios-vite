import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Nota } from '@/types/domain';
import { calcularPromedioFinal, fmtScore } from '@/lib/utils/scoring';
import { JuradoCard } from './JuradoCard';

interface Props {
  notas: Nota[];
}

export function CalificacionCard({ notas }: Props) {
  const [open, setOpen] = useState(false);
  const first = notas[0];
  const promedio = calcularPromedioFinal(notas);
  const inst = first.inst_nombre || first.agrupacion || 'Obra';
  const logo = first.inst_logo;
  const initial = inst.charAt(0).toUpperCase();
  const orden = first.insc_orden ?? first.orden;
  const obra = first.insc_obra || inst;

  return (
    <article
      className={`overflow-hidden rounded-xl border transition anim-fade-in-up ${
        open
          ? 'border-gold/35'
          : 'border-gold/10 hover:-translate-y-px hover:border-gold/25 hover:shadow-[0_6px_24px_rgba(232,208,152,0.06)]'
      }`}
      style={{
        background: open
          ? 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-void) 100%)'
          : 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-gold"
          style={{
            background: 'var(--bg-elevated)',
            boxShadow: '0 0 16px rgba(232, 208, 152, 0.15)',
          }}
        >
          {logo ? (
            <img src={logo} alt={inst} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-gold">
              {initial}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-baseline gap-2">
            {orden !== null && orden !== undefined && (
              <span className="font-display text-base font-semibold leading-none gradient-text-cf">
                {orden}
              </span>
            )}
            <span className="truncate text-[14px] font-bold text-text-white">{obra}</span>
          </div>
          <div
            className="truncate text-[11px] font-medium uppercase text-text-65"
            style={{ letterSpacing: '0.5px' }}
          >
            {inst}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <div
            className="font-display text-3xl font-extrabold leading-none gradient-text-gc"
            style={{ letterSpacing: '-0.5px' }}
          >
            {fmtScore(promedio)}
            <small className="text-sm font-normal text-text-45" style={{ WebkitTextFillColor: 'var(--text-45)' as string }}>
              /100
            </small>
          </div>
          <div
            className="text-[8px] font-light uppercase text-text-45"
            style={{ letterSpacing: '0.3px' }}
          >
            {notas.length} jurado{notas.length > 1 ? 's' : ''}
          </div>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-gold' : 'text-text-45'
          }`}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-glass-border px-3.5 pb-3.5 pt-3 anim-fade-in">
          {notas.map((n, i) => (
            <JuradoCard key={i} nota={n} />
          ))}
        </div>
      )}
    </article>
  );
}
