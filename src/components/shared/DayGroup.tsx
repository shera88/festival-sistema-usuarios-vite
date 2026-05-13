import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  label: string;
  count?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function DayGroup({ label, count, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="anim-fade-in-up">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-3 flex w-full items-center gap-3 rounded-xl border border-[var(--border-strong)] px-4 py-3 backdrop-blur-md transition hover:border-fuchsia/30"
        style={{
          background:
            'linear-gradient(135deg, var(--bg-base) 0%, rgba(255, 31, 168, 0.06) 100%)',
        }}
      >
        <span
          className="flex-1 text-left font-display text-[14px] font-bold uppercase text-cyan"
          style={{ letterSpacing: '2px' }}
        >
          {label}
        </span>
        {count !== undefined && (
          <span className="text-[11px] text-text-45" style={{ letterSpacing: '0.5px' }}>
            {count}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${
            open ? 'rotate-180 text-cyan' : 'text-text-45'
          }`}
          style={{ transitionDuration: '0.35s' }}
        />
      </button>
      {open && <div className="flex flex-col gap-2.5 anim-fade-in">{children}</div>}
    </section>
  );
}
