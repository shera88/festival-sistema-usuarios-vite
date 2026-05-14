import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  modalidades: readonly string[];
  value?: string;
  onChange: (value: string) => void;
};

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function ModalidadPicker({ modalidades, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = stripAccents(search.trim());
    if (!q) return modalidades;
    return modalidades.filter((m) => stripAccents(m).includes(q));
  }, [search, modalidades]);

  const handleSelect = (m: string) => {
    onChange(m);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border bg-elev px-4 py-3 text-left text-[13px] transition-all',
          value
            ? 'border-cyan/50 bg-cyan/[0.06] font-semibold text-text-white'
            : 'border-glass-border text-text-45 hover:border-cyan/40 hover:bg-cyan/[0.03]',
          open && 'ring-2 ring-cyan/30',
        )}
      >
        <span className="truncate">{value || 'Seleccione la modalidad de su obra…'}</span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-text-45 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-glass-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]" style={{ background: 'var(--bg-card)' }}>
          <div className="border-b border-glass-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-45" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modalidad…"
                className="w-full rounded-lg border border-glass-border bg-elev py-2 pl-9 pr-3 text-[13px] text-text-90 placeholder:text-text-45 focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
              />
            </div>
            <p className="mt-2 text-[10px] uppercase tracking-[0.1em] text-text-45">
              {filtered.length === modalidades.length
                ? `${modalidades.length} modalidades disponibles`
                : `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-[13px] text-text-65">
                Sin resultados para “{search}”
              </div>
            ) : (
              <ul role="listbox">
                {filtered.map((m) => {
                  const selected = value === m;
                  return (
                    <li key={m}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => handleSelect(m)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors',
                          selected
                            ? 'bg-cyan/10 font-semibold text-text-white'
                            : 'text-text-90 hover:bg-cyan/[0.05]',
                        )}
                      >
                        <span className="flex-1 truncate">{m}</span>
                        {selected && <Check className="h-4 w-4 shrink-0 text-cyan" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
