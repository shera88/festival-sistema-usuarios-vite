import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

/**
 * Autocomplete inline para coreógrafo — mismo patrón que `NameAutocomplete` y
 * `AgrupacionAutocomplete`, contra `/api/coreografos/search`. Si el texto
 * coincide exacto (case/accent-insensitive) con una sugerencia, linkea
 * `id_coreografo` sin clic. Si no coincide, el backend lo trata como
 * coreógrafo nuevo al enviar (queda en la inscripción pero no se crea fila
 * en `coreografos` desde este camino — eso lo hace el endpoint).
 */

type CoreografoLite = {
  id_coreografo: string | null;
  coreografo: string;
  foto_url?: string | null;
};

type Props = {
  value: string;
  onTextChange: (value: string) => void;
  onMatch: (nombre: string, id_coreografo: string) => void;
  /** Si se pasa, al abrir el dropdown sin texto se muestran los coreógrafos
   *  que han trabajado con esa agrupación (deduplicados). */
  idAgrupacion?: string | null;
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function CoreografoAutocomplete({
  value,
  onTextChange,
  onMatch,
  idAgrupacion,
  id,
  placeholder = "Nombre del coreógrafo…",
  ariaInvalid,
}: Props) {
  const [results, setResults] = useState<CoreografoLite[]>([]);
  // Coreógrafos relacionados con la agrupación seleccionada — visibles en el
  // dropdown cuando el campo está vacío y hay idAgrupacion.
  const [related, setRelated] = useState<CoreografoLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [brokenAvatars, setBrokenAvatars] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(value, 250);

  // Precarga coreógrafos de la agrupación cuando cambia idAgrupacion.
  useEffect(() => {
    if (!idAgrupacion) {
      setRelated([]);
      return;
    }
    let aborted = false;
    supabase
      .rpc("obtener_coreografos_de_agrupacion", { p_id_agrupacion: idAgrupacion })
      .then(({ data, error }) => {
        if (aborted) return;
        if (error) {
          console.error("[CoreografoAutocomplete] related:", error.message);
          setRelated([]);
          return;
        }
        setRelated((data as CoreografoLite[] | null) ?? []);
      });
    return () => {
      aborted = true;
    };
  }, [idAgrupacion]);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let aborted = false;
    setLoading(true);
    supabase.rpc("search_coreografos", { q }).then(({ data, error }) => {
      if (aborted) return;
      if (error) console.error("[CoreografoAutocomplete] search:", error.message);
      setResults((data as CoreografoLite[] | null) ?? []);
      setLoading(false);
    });
    return () => { aborted = true; };
  }, [debounced]);

  const exactMatch = useMemo(() => {
    const needle = normalize(value);
    if (!needle) return null;
    return results.find((r) => normalize(r.coreografo) === needle) ?? null;
  }, [value, results]);

  useEffect(() => {
    if (exactMatch && exactMatch.id_coreografo !== matchedId) {
      setMatchedId(exactMatch.id_coreografo);
      onMatch(exactMatch.coreografo, exactMatch.id_coreografo ?? "");
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

  const handleSelect = (c: CoreografoLite) => {
    setOpen(false);
    setFocusIndex(-1);
    setMatchedId(c.id_coreografo);
    onMatch(c.coreografo, c.id_coreografo ?? "");
  };

  const inSearchMode = debounced.trim().length >= 2;
  const showRelated = open && !inSearchMode && related.length > 0;
  const showDropdown = open && (inSearchMode || showRelated);
  const visibleList: CoreografoLite[] = inSearchMode ? results : related;

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
              Coreógrafos de esta agrupación · escriba para buscar otro
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
              {visibleList.map((c, i) => {
                const selected = !!c.id_coreografo && matchedId === c.id_coreografo;
                const active = i === focusIndex;
                const key = c.id_coreografo ?? `nameonly-${c.coreografo}`;
                const avatarKey = c.id_coreografo ?? c.coreografo;
                const showImg = !!c.foto_url && !brokenAvatars.has(avatarKey);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(c)}
                      onMouseEnter={() => setFocusIndex(i)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-[rgba(34,211,238,0.08)]"
                          : "hover:bg-[rgba(34,211,238,0.05)]"
                      )}
                    >
                      {showImg ? (
                        <img
                          src={c.foto_url!}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                          onError={() => {
                            setBrokenAvatars((prev) => {
                              const next = new Set(prev);
                              next.add(avatarKey);
                              return next;
                            });
                          }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-gradient text-[10px] font-bold text-white"
                        >
                          {getInitials(c.coreografo)}
                        </span>
                      )}
                      <span
                        className={cn(
                          "flex-1 truncate",
                          selected ? "font-semibold text-[var(--amber-cream)]" : "text-foreground/90"
                        )}
                      >
                        {c.coreografo}
                      </span>
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
