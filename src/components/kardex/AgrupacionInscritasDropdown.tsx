import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { webpProxy } from "@/lib/utils/img";

/**
 * Dropdown de agrupaciones inscritas al festival 2026 — trigger tipo input +
 * popover con buscador local + lista filtrable. Se precarga la lista completa
 * desde `/api/agrupaciones/inscritas/list` al montar (son pocas agrupaciones)
 * así el usuario ve todas desde el primer clic y filtra sin esperar al backend.
 *
 * A diferencia de `AgrupacionAutocomplete`, acá no se permite texto libre: el
 * usuario SOLO puede elegir de la lista. Si ninguna agrupación de inscritas
 * aún coincide con lo que busca, no puede crear una — Kárdex acredita gente
 * a agrupaciones que ya están inscritas, no las crea.
 */

type AgrupacionLite = {
  id_agrupacion: string;
  nombre_agrupacion: string;
  ciudad: string | null;
  enlace_del_logo: string | null;
};

type Props = {
  /** Nombre de agrupación actualmente seleccionado (para mostrar en el trigger). */
  value: string;
  /** id_agrupacion actualmente seleccionado (para marcar ✓ en la lista). */
  valueId: string;
  onSelect: (nombre_agrupacion: string, id_agrupacion: string) => void;
  id?: string;
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

export function AgrupacionInscritasDropdown({
  value,
  valueId,
  onSelect,
  id,
  ariaInvalid,
}: Props) {
  const [list, setList] = useState<AgrupacionLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focusIndex, setFocusIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch on mount — la lista es corta y el dropdown necesita tenerla lista
  // al primer clic. No hay paginación ni debounce porque no buscamos on-demand.
  useEffect(() => {
    let aborted = false;
    setLoading(true);
    supabase.rpc("listar_agrupaciones_inscritas").then(({ data, error }) => {
      if (aborted) return;
      if (error) {
        console.error("[AgrupacionInscritasDropdown]", error.message);
        setLoadError(true);
        setLoading(false);
        return;
      }
      setList((data as AgrupacionLite[] | null) ?? []);
      setLoading(false);
    });
    return () => { aborted = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(search);
    if (!q) return list;
    return list.filter((a) => normalize(a.nombre_agrupacion).includes(q));
  }, [search, list]);

  // Resetear el índice enfocado cuando cambia el filtro para evitar punteros
  // colgados fuera del array.
  useEffect(() => {
    setFocusIndex(-1);
  }, [search, open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (a: AgrupacionLite) => {
    onSelect(a.nombre_agrupacion, a.id_agrupacion);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[focusIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={ariaInvalid}
        className={cn(
          "flex h-11 w-full items-center gap-3 rounded-xl border bg-card/60 px-4 text-left text-sm transition-colors",
          "border-border hover:border-[rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.03)]",
          "focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)]",
          open && "border-[var(--amber-primary)] ring-2 ring-[rgba(34,211,238,0.2)]",
          ariaInvalid && "border-[var(--amber-accent)]"
        )}
      >
        {value ? (
          <span className="truncate font-semibold text-foreground">{value}</span>
        ) : (
          <span className="text-foreground/50">Seleccione una agrupación…</span>
        )}
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className={cn(
            "ml-auto h-4 w-4 shrink-0 text-foreground/60 transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          <div className="border-b border-border p-2">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar agrupación…"
              className="flex h-10 w-full rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground placeholder:text-foreground/50 focus:border-[var(--amber-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)]"
            />
          </div>
          {loading ? (
            <div className="px-4 py-3 text-xs text-foreground/60">
              Cargando agrupaciones inscritas…
            </div>
          ) : loadError ? (
            <div className="px-4 py-3 text-xs text-[var(--amber-accent)]">
              No se pudo cargar la lista. Intente de nuevo.
            </div>
          ) : list.length === 0 ? (
            <div className="px-4 py-3 text-xs text-foreground/60">
              Aún no hay agrupaciones inscritas al festival 2026.
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-foreground/60">
              Ninguna agrupación coincide con la búsqueda.
            </div>
          ) : (
            <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
              {filtered.map((a, i) => {
                const selected = valueId === a.id_agrupacion;
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
                      {a.enlace_del_logo ? (
                        <img
                          src={webpProxy(a.enlace_del_logo, 72) ?? a.enlace_del_logo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
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
