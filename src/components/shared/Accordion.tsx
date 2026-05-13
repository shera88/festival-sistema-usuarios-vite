import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  title: ReactNode;
  count?: string | number;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function Accordion({ title, count, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-white/5"
      >
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-text-90">{title}</span>
          {count !== undefined && (
            <span className="text-xs text-text-45">{count}</span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-text-45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-glass-border p-3 space-y-2">{children}</div>}
    </section>
  );
}
