import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { webpProxy } from "@/lib/utils/img";

/**
 * Autocomplete inline para agrupación — mismo patrón que `NameAutocomplete`
 * pero contra `/api/agrupaciones/search`. Incluye logo + ciudad en cada
 * sugerencia para ayudar al usuario a reconocer su agrupación sin ambigüedad.
 *
 * Si el texto que dejó el usuario coincide exactamente con una sugerencia
 * (case/accent-insensitive), linkeamos `id_agrupacion` automáticamente.
 * Si no coincide, `id_agrupacion` queda null y el backend lo trata como
 * agrupación nueva — que en Solicitud solo vive en `registro_solicitud_2026.agrupacion`
 * y `prospectos_global.agrupacion_2026`, NUNCA crea fila en `instituciones`
 * (regla del festival: instituciones solo nacen desde Inscripción).
 */

type AgrupacionLite = {
  id_agrupacion: string;
  nombre_agrupacion: string;
  ciudad: string | null;
  enlace_del_logo: string | null;
};

type Props = {
  value: string;
  onTextChange: (value: string) => void;
  onMatch: (nombre: string, id_agrupacion: string, enlace_del_logo?: string | null) => void;
  /** Si se pasa, al abrir el dropdown sin texto se muestran las agrupaciones
   *  con las que esa persona tiene relación (como encargado, coreógrafo,
   *  director o agrupación principal). */
  idContacto?: string | null;
  id?: string;
  placeholder?: string;
  ariaInvalid?: boolean;
};

const ACCENTS: Record<string, string> = {
  "á": "a", "à": "a", "ä": "a", "â": "a", "ã": "a",
  "é": "e", "è": "e", "ë": "e", "ê": "e",
  "í": "i", "ì": "i", "ï": "i", "î": "i",
  "ó": "o", "ò": "o", "ö": "o", "ô": "o", "õ": "o",
  "ú": "u", "ù": "u", "ü": "u", "û": "u",
  "Á": "A", "À": "A", "Ä": "A", "Â": "A", "Ã": "A",
  "É": "E", "È": "E", "Ë": "E", "Ê": "E",
  "Í": "I", "Ì": "I", "Ï": "I", "Î": "I",
  "Ó": "O", "Ò": "O", "Ö": "O", "Ô": "O", "Õ": "O",
  "Ú": "U", "Ù": "U", "Ü": "U", "Û": "U",
};
function normalize(s: string): string {
  return s
    .replace(/[À-ü]/g, (c) => ACCENTS[c] ?? c)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function AgrupacionAutocomplete({
  value,
  onTextChange,
  onMatch,
  idContacto,
  id,
  placeholder = "Nombre de su agrupación…",
  ariaInvalid,
}: Props) {
  const [results, setResults] = useState<AgrupacionLite[]>([]);
  // Sugerencias precargadas para una persona ya conocida — visibles cuando
  // el campo está abierto y todavía no hay texto suficiente para buscar.
  const [related, setRelated] = useState<AgrupacionLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  // Logos que fallaron al cargar (404 / corrupto) — caen al fallback de iniciales.
  const [brokenLogos, setBrokenLogos] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(value, 250);

  // Cuando llega un idContacto nuevo (persona seleccionada), precargamos sus
  // agrupaciones históricas. Si idContacto se libera (volvió a ser persona
  // nueva), limpiamos las sugerencias.
  useEffect(() => {
    if (!idContacto) {
      setRelated([]);
      return;
    }
    let aborted = false;
    supabase
      .rpc("obtener_agrupaciones_de_contacto", { p_id_contacto: idContacto })
      .then(({ data, error }) => {
        if (aborted) return;
        if (error) {
          console.error("[AgrupacionAutocomplete] related:", error.message);
          setRelated([]);
          return;
        }
        setRelated((data as AgrupacionLite[] | null) ?? []);
      });
    return () => {
      aborted = true;
    };
  }, [idContacto]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let aborted = false;
    setLoading(true);
    supabase
      .rpc("search_agrupaciones", { q })
      .then(({ data, error }) => {
        if (aborted) return;
        if (error) console.error("[AgrupacionAutocomplete] search:", error.message);
        setResults((data as AgrupacionLite[] | null) ?? []);
        setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [debounced]);

  const exactMatch = useMemo(() => {
    const needle = normalize(value);
    if (!needle) return null;
    return results.find((r) => normalize(r.nombre_agrupacion) === needle) ?? null;
  }, [value, results]);

  useEffect(() => {
    if (exactMatch && exactMatch.id_agrupacion !== matchedId) {
      setMatchedId(exactMatch.id_agrupacion);
      onMatch(exactMatch.nombre_agrupacion, exactMatch.id_agrupacion, exactMatch.enlace_del_logo);
    }
    if (!exactMatch && matchedId) {
      setMatchedId(null);
      onTextChange(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactMatch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setFocusIndex(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (a: AgrupacionLite) => {
    setOpen(false);
    setFocusIndex(-1);
    setMatchedId(a.id_agrupacion);
    onMatch(a.nombre_agrupacion, a.id_agrupacion, a.enlace_del_logo);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || visibleList.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => (i + 1) % visibleList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => (i <= 0 ? visibleList.length - 1 : i - 1));
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      handleSelect(visibleList[focusIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocusIndex(-1);
    }
  };

  // El dropdown muestra dos modos:
  //   - búsqueda: cuando el usuario tipeó ≥ 2 chars → resultados de search_agrupaciones.
  //   - relacionadas: cuando hay idContacto y el campo está vacío/casi vacío →
  //     agrupaciones históricas de la persona, antes de que tipee nada.
  const inSearchMode = debounced.trim().length >= 2;
  const showRelated = open && !inSearchMode && related.length > 0;
  const showDropdown = open && (inSearchMode || showRelated);
  const visibleList: AgrupacionLite[] = inSearchMode ? results : related;

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
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
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex h-11 w-full rounded-xl border border-border bg-card/60 px-4 text-base text-foreground placeholder:text-foreground/50 focus:border-[var(--amber-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)] aria-invalid:border-[var(--amber-accent)] sm:text-sm"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          {showRelated && (
            <div className="border-b border-border bg-card/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--amber-soft)]">
              Sus agrupaciones · escriba para buscar otra
            </div>
          )}
          {inSearchMode && loading ? (
            <div className="px-4 py-3 text-xs text-foreground/60">Buscando…</div>
          ) : visibleList.length === 0 ? (
            <div className="px-4 py-3 text-xs text-foreground/60">
              No hay coincidencias. Se guardará tal cual la escribió.
            </div>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
              {visibleList.map((a, i) => {
                const selected = matchedId === a.id_agrupacion;
                const active = i === focusIndex;
                return (
                  <li key={a.id_agrupacion}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(a)}
                      onMouseEnter={() => setFocusIndex(i)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-[rgba(34,211,238,0.08)]"
                          : "hover:bg-[rgba(34,211,238,0.05)]"
                      )}
                    >
                      {a.enlace_del_logo && !brokenLogos.has(a.id_agrupacion) ? (
                        <img
                          src={webpProxy(a.enlace_del_logo, 72) ?? a.enlace_del_logo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                          onError={() => {
                            setBrokenLogos((prev) => {
                              const next = new Set(prev);
                              next.add(a.id_agrupacion);
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-border text-[10px] font-bold text-foreground/60"
                        >
                          {a.nombre_agrupacion.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "truncate",
                            selected ? "font-semibold text-[var(--amber-cream)]" : "text-foreground/90"
                          )}
                        >
                          {a.nombre_agrupacion}
                        </div>
                        {a.ciudad && (
                          <div className="truncate text-[11px] text-foreground/55">
                            {a.ciudad}
                          </div>
                        )}
                      </div>
                      {selected && (
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 shrink-0 text-[var(--amber-primary)]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
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
