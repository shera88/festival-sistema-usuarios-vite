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
    <div className="overflow-hidden rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-glass-border">
          {logo ? (
            <img src={logo} alt={inst} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center text-white font-semibold"
              style={{ background: 'linear-gradient(135deg,var(--cyan),var(--fuchsia))' }}
            >
              {initial}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-text-90 font-medium truncate">
            {orden !== null && orden !== undefined && (
              <span className="mr-2 inline-block rounded bg-glass-bg px-1.5 py-0.5 text-[10px] text-text-45">
                {orden}
              </span>
            )}
            {obra}
          </div>
          <div className="text-text-45 text-xs truncate">{inst}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-text-90">
            {fmtScore(promedio)}
            <small className="text-xs text-text-45">/100</small>
          </div>
          <div className="text-[10px] text-text-45">
            {notas.length} jurado{notas.length > 1 ? 's' : ''}
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-text-45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-glass-border bg-base/40 p-3">
          {notas.map((n, i) => (
            <JuradoCard key={i} nota={n} />
          ))}
        </div>
      )}
    </div>
  );
}
