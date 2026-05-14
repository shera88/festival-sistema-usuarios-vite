import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Item = { id: string; label: string; sub?: string | null; img?: string | null };

interface Props {
  id?: string;
  value: string;
  onTextChange: (value: string) => void;
  onMatch?: (item: Item) => void;
  fetchItems: (q: string) => Promise<Item[]>;
  placeholder?: string;
  emptyHint?: string;
  ariaInvalid?: boolean;
  minChars?: number;
  debounceMs?: number;
}

export function Autocomplete({
  id,
  value,
  onTextChange,
  onMatch,
  fetchItems,
  placeholder,
  emptyHint = 'No hay coincidencias. Al enviar se registrará como nuevo.',
  ariaInvalid,
  minChars = 2,
  debounceMs = 250,
}: Props) {
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<{ aborted: boolean } | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < minChars) {
      setResults([]);
      setLoading(false);
      return;
    }
    const token = { aborted: false };
    abortRef.current = token;

    const timer = setTimeout(() => {
      setLoading(true);
      fetchItems(q)
        .then((items) => {
          if (token.aborted) return;
          setResults(Array.isArray(items) ? items : []);
          setLoading(false);
        })
        .catch((err) => {
          if (token.aborted) return;
          console.warn('[Autocomplete] fetch error:', err);
          setResults([]);
          setLoading(false);
        });
    }, debounceMs);

    return () => {
      token.aborted = true;
      clearTimeout(timer);
    };
  }, [value, minChars, debounceMs, fetchItems]);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocusIdx(-1);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  function pick(it: Item) {
    setOpen(false);
    setFocusIdx(-1);
    onTextChange(it.label);
    onMatch?.(it);
  }

  const showDropdown = open && value.trim().length >= minChars;

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onTextChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showDropdown || results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusIdx((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusIdx((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === 'Enter' && focusIdx >= 0) {
            e.preventDefault();
            pick(results[focusIdx]);
          } else if (e.key === 'Escape') {
            setOpen(false);
            setFocusIdx(-1);
          }
        }}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-xl border bg-elev px-4 py-3 text-[14px] text-text-90 placeholder:text-text-45 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20',
          ariaInvalid ? 'border-red-500/50' : 'border-glass-border',
        )}
      />

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-glass-border shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
          style={{ background: 'var(--bg-card)' }}
        >
          {loading ? (
            <div className="px-4 py-3 text-[12px] text-text-65">Buscando…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-[12px] text-text-65">{emptyHint}</div>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
              {results.map((r, i) => {
                const active = i === focusIdx;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => pick(r)}
                      onMouseEnter={() => setFocusIdx(i)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors',
                        active ? 'bg-cyan/[0.08] text-text-white' : 'text-text-90 hover:bg-cyan/[0.05]',
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-glass-border bg-elev text-[11px] font-semibold uppercase text-text-65"
                      >
                        {r.img ? (
                          <img
                            src={r.img}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          (r.label?.charAt(0) ?? '?').toUpperCase()
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <span className="block truncate">{r.label}</span>
                        {r.sub && (
                          <span className="block truncate text-[11px] text-text-45">{r.sub}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
