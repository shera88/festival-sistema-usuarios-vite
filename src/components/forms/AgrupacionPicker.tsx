import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { lookups, type AgrupacionLite } from '@/lib/api/lookups';
import { SmartImage } from './SmartImage';

interface Props {
  id?: string;
  value: string;
  valueId?: string;
  onSelect: (nombre: string, idAgrupacion: string) => void;
  /** Cambio de texto libre (sin match contra lista) */
  onTextChange?: (nombre: string) => void;
  ariaInvalid?: boolean;
  placeholder?: string;
  /** Si true, no permite texto libre — solo selección de lista */
  strict?: boolean;
  /** Si está presente, trae las agrupaciones de esta persona en lugar del user logueado */
  idContacto?: string;
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function AgrupacionPicker({
  id,
  value,
  valueId,
  onSelect,
  onTextChange,
  ariaInvalid,
  placeholder = 'Seleccione o escriba su agrupación…',
  strict = false,
  idContacto,
}: Props) {
  const [items, setItems] = useState<AgrupacionLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    const fetcher = idContacto
      ? lookups.agrupacionesDePersona(idContacto)
      : lookups.misAgrupaciones();
    fetcher
      .then((rows) => {
        if (aborted) return;
        setItems(rows);
        setLoading(false);
        if (valueId) return;
        if (value) {
          const match = rows.find(
            (r) => normalize(r.nombre_agrupacion) === normalize(value),
          );
          if (match) {
            onSelect(match.nombre_agrupacion, match.id_agrupacion);
            return;
          }
        }
        if (!value && rows.length === 1) {
          onSelect(rows[0].nombre_agrupacion, rows[0].id_agrupacion);
        }
      })
      .catch((err) => {
        console.warn('[AgrupacionPicker] fetch error:', err);
        if (!aborted) setLoading(false);
      });
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idContacto]);

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
    // Si el value coincide exacto con un item (caso típico: agrupación ya
    // seleccionada), mostramos toda la lista para que el user pueda cambiar.
    const exact = items.some((it) => normalize(it.nombre_agrupacion) === q);
    if (exact) return items;
    return items.filter((it) => normalize(it.nombre_agrupacion).includes(q));
  }, [value, items]);

  function pick(it: AgrupacionLite) {
    onSelect(it.nombre_agrupacion, it.id_agrupacion);
    setOpen(false);
    setFocusIdx(-1);
  }

  function handleInput(v: string) {
    if (strict) {
      // En modo strict el input solo se usa como buscador, no se setea el valor
      // hasta que se selecciona algo. Pero igual queremos filtrar — así que
      // exponemos el cambio como texto temporal vía onTextChange.
      onTextChange?.(v);
    } else {
      onTextChange?.(v);
      // Liberar id si el texto difiere del último match
      if (valueId) {
        const match = items.find((it) => it.id_agrupacion === valueId);
        if (match && normalize(match.nombre_agrupacion) !== normalize(v)) {
          onSelect(v, '');
        } else {
          // Solo actualiza nombre, conserva id
          onSelect(v, valueId);
        }
      } else {
        onSelect(v, '');
      }
    }
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
            <div className="px-4 py-4 text-[12px] text-text-65">Cargando sus agrupaciones…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-4 text-[12px] text-text-65">
              {strict
                ? 'No coincide con ninguna de sus agrupaciones registradas.'
                : 'Sin coincidencias. Puede escribir un nombre nuevo.'}
            </div>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.map((a, i) => {
                const selected = valueId === a.id_agrupacion;
                const active = i === focusIdx;
                const detail = [
                  a.ciudad,
                  a.count && a.count > 0
                    ? `${a.count} inscripción${a.count === 1 ? '' : 'es'}`
                    : null,
                  a.last_year ? `último ${a.last_year}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={a.id_agrupacion}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => pick(a)}
                      onMouseEnter={() => setFocusIdx(i)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors',
                        active && 'bg-cyan/[0.08]',
                        selected ? 'font-semibold text-text-white' : 'text-text-90 hover:bg-cyan/[0.05]',
                      )}
                    >
                      <SmartImage
                        src={a.enlace_del_logo}
                        name={a.nombre_agrupacion}
                        size={36}
                        rounded="md"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{a.nombre_agrupacion}</span>
                        {detail && (
                          <span className="block truncate text-[11px] text-text-45">{detail}</span>
                        )}
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-cyan" />}
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
