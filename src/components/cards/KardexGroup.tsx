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
    <article
      className={`overflow-hidden rounded-xl border transition anim-fade-in-up ${
        open
          ? 'border-fuchsia/30'
          : 'border-fuchsia/15 hover:border-fuchsia/30 hover:shadow-[0_8px_24px_rgba(255,31,168,0.08)]'
      }`}
      style={{
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(0,0,0,0.2) 100%)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left transition"
        style={{
          background: open
            ? 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-card) 100%)'
            : 'transparent',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <div
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-fuchsia"
          style={{
            background: 'var(--bg-elevated)',
            boxShadow: '0 0 16px rgba(255,31,168,0.15)',
          }}
        >
          {logo ? (
            <img src={logo} alt={agrupacion} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-fuchsia">
              {initial}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="text-[14px] font-semibold uppercase text-text-white"
            style={{ letterSpacing: '0.5px' }}
          >
            {agrupacion}
          </div>
          <div className="mt-0.5 text-[11px] text-text-45">
            {rows.length} integrante{rows.length > 1 ? 's' : ''}
          </div>
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-fuchsia' : 'text-text-45'
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-glass-border anim-fade-in">
          {rows.map((r, i) => (
            <KardexRow key={i} row={r} />
          ))}
        </div>
      )}
    </article>
  );
}
