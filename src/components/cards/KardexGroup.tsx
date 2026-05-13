import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { KardexRow } from './KardexRow';

interface Props {
  agrupacion: string;
  logo: string | null;
  rows: KRow[];
}

export function KardexGroup({ agrupacion, logo, rows }: Props) {
  const [open, setOpen] = useState(true);
  const initial = agrupacion.charAt(0).toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-glass-border">
          {logo ? (
            <img src={logo} alt={agrupacion} className="h-full w-full object-cover" />
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
          <div className="text-text-90 font-medium truncate">{agrupacion}</div>
          <div className="text-text-45 text-xs">
            {rows.length} integrante{rows.length > 1 ? 's' : ''}
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-text-45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-glass-border p-2 space-y-2">
          {rows.map((r, i) => (
            <KardexRow key={i} row={r} />
          ))}
        </div>
      )}
    </div>
  );
}
