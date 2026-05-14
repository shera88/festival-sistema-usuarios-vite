import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lookups, type CoreografoLite } from '@/lib/api/lookups';
import { AvatarFallback } from './AvatarFallback';

interface Props {
  id?: string;
  value: string;
  idAgrupacion?: string;
  onSelect: (nombre: string, idCoreografo: string) => void;
  onTextChange: (nombre: string) => void;
  ariaInvalid?: boolean;
  placeholder?: string;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function useDebounced<T>(value: T, delay: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function CoreografoPicker({
  id,
  value,
  idAgrupacion,
  onSelect,
  onTextChange,
  ariaInvalid,
  placeholder = 'Nombre del coreógrafo…',
}: Props) {
  const [agrupacionItems, setAgrupacionItems] = useState<CoreografoLite[]>([]);
  const [globalItems, setGlobalItems] = useState<CoreografoLite[]>([]);
  const [loadingAgrupacion, setLoadingAgrupacion] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce 500ms para búsqueda global (más relajado que el típico 250ms
  // porque el filtro local cubre la respuesta instantánea)
  const debouncedValue = useDebounced(value, 500);

  // Carga la lista de la agrupación una sola vez por idAgrupacion (cache PHP).
  useEffect(() => {
    if (!idAgrupacion) {
      setAgrupacionItems([]);
      return;
    }
    let aborted = false;
    setLoadingAgrupacion(true);
    lookups
      .coreografosDisponibles({ idAgrupacion })
      .then((rows) => {
        if (!aborted) {
          setAgrupacionItems(rows);
          setLoadingAgrupacion(false);
        }
      })
      .catch(() => {
        if (!aborted) setLoadingAgrupacion(false);
      });
    return () => {
      aborted = true;
    };
  }, [idAgrupacion]);

  // Búsqueda global SOLO si:
  //  - el user tipeó ≥ 3 chars
  //  - no encuentra match local en la lista de la agrupación
  // Esto evita golpear el backend en cada tecla.
  useEffect(() => {
    const q = debouncedValue.trim();
    if (q.length < 3) {
      setGlobalItems([]);
      return;
    }
    const localMatch = agrupacionItems.some((it) =>
      normalize(it.nombre_y_apellido).includes(normalize(q)),
    );
    if (localMatch) {
      setGlobalItems([]);
      return;
    }
    let aborted = false;
    setLoadingGlobal(true);
    lookups
      .coreografosDisponibles({ q })
      .then((rows) => {
        if (!aborted) {
          setGlobalItems(rows);
          setLoadingGlobal(false);
        }
      })
      .catch(() => {
        if (!aborted) setLoadingGlobal(false);
      });
    return () => {
      aborted = true;
    };
  }, [debouncedValue, agrupacionItems]);

  const items = useMemo(() => {
    // Merge sin duplicados: agrupación primero, luego globales
    const seen = new Set<string>();
    const out: CoreografoLite[] = [];
    for (const it of agrupacionItems) {
      const key = normalize(it.nombre_y_apellido);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    for (const it of globalItems) {
      const key = normalize(it.nombre_y_apellido);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(it);
      }
    }
    return out;
  }, [agrupacionItems, globalItems]);

  const loading = loadingAgrupacion || loadingGlobal;

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

  const filtered = useMemo(() => {
    const q = normalize(value);
    if (!q) return items;
    const exact = items.some((it) => normalize(it.nombre_y_apellido) === q);
    if (exact) return items;
    return items.filter((it) => normalize(it.nombre_y_apellido).includes(q));
  }, [value, items]);

  function pick(it: CoreografoLite) {
    onSelect(it.nombre_y_apellido, it.id_coreografo);
    setOpen(false);
    setFocusIdx(-1);
  }

  function handleInput(v: string) {
    onTextChange(v);
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-invalid={ariaInvalid}
          autoComplete="off"
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || filtered.length === 0) {
              if (e.key === 'ArrowDown') setOpen(true);
              return;
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setFocusIdx((i) => (i + 1) % filtered.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setFocusIdx((i) => (i <= 0 ? filtered.length - 1 : i - 1));
            } else if (e.key === 'Enter' && focusIdx >= 0) {
              e.preventDefault();
              pick(filtered[focusIdx]);
            } else if (e.key === 'Escape') {
              setOpen(false);
              setFocusIdx(-1);
            }
          }}
          placeholder={placeholder}
          className={cn(
            'w-full rounded-xl border bg-elev px-4 py-3 pr-10 text-[14px] text-text-90 placeholder:text-text-45 outline-none transition focus:border-cyan focus:ring-2 focus:ring-cyan/20',
            ariaInvalid ? 'border-red-500/50' : 'border-glass-border',
          )}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-45 transition hover:text-text-90"
          aria-label="Abrir lista"
        >
          <ChevronDown className={cn('h-5 w-5 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-glass-border shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
          style={{ background: 'var(--bg-card)' }}
        >
          {loading ? (
            <div className="px-4 py-4 text-[12px] text-text-65">Buscando coreógrafos…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-4 text-[12px] text-text-65">
              {value.trim().length < 2
                ? 'Escriba al menos 2 letras o seleccione la agrupación primero.'
                : `Sin coincidencias. Al enviar se registrará "${value}" como coreógrafo nuevo.`}
            </div>
          ) : (
            <>
              <div className="border-b border-glass-border bg-elev px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-45">
                {filtered.some((x) => x.from_agrupacion)
                  ? 'De la agrupación seleccionada · escriba para buscar otros'
                  : 'Resultados'}
              </div>
              <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
                {filtered.map((c, i) => {
                  const active = i === focusIdx;
                  const detail = [
                    c.from_agrupacion ? 'De esta agrupación' : null,
                    c.count && c.count > 0
                      ? `${c.count} inscripción${c.count === 1 ? '' : 'es'}`
                      : null,
                    c.last_year ? `último ${c.last_year}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <li key={c.id_coreografo || c.nombre_y_apellido}>
                      <button
                        type="button"
                        role="option"
                        onClick={() => pick(c)}
                        onMouseEnter={() => setFocusIdx(i)}
                        className={cn(
                          'flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors',
                          active && 'bg-cyan/[0.08]',
                          'text-text-90 hover:bg-cyan/[0.05]',
                        )}
                      >
                        <AvatarFallback name={c.nombre_y_apellido} size={36} rounded="full" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{c.nombre_y_apellido}</span>
                          {detail && (
                            <span className="block truncate text-[11px] text-text-45">{detail}</span>
                          )}
                        </span>
                        {c.from_agrupacion && (
                          <Check className="h-4 w-4 shrink-0 text-cyan" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
