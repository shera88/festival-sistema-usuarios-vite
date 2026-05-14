import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";

type CoreografoLite = { id_coreografo: string; coreografo: string };

type Props = {
  value?: string;
  onSelect: (nombre: string, id_coreografo: string | null) => void;
};

/** Iniciales del primer y último nombre — máximo 2 letras */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Color de avatar derivado del hash del nombre — consistente por coreógrafo */
function getAvatarGradient(name: string): string {
  const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradients = [
    "linear-gradient(135deg, #22d3ee 0%, #a855f7 100%)",
    "linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)",
    "linear-gradient(135deg, #a855f7 0%, #c084fc 100%)",
    "linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)",
    "linear-gradient(135deg, #22d3ee 0%, #c026d3 100%)",
  ];
  return gradients[hash % gradients.length];
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full text-white font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: getAvatarGradient(name),
      }}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CoreografoPicker({ value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<CoreografoLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounced(search, 250);

  // Fetch resultados solo cuando el panel está abierto y hay 2+ caracteres.
  // El endpoint ya limita a 30 resultados, así que no hay necesidad de paginar.
  useEffect(() => {
    if (!open) return;
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let aborted = false;
    setLoading(true);
    supabase.rpc("search_coreografos", { q }).then(({ data, error }) => {
      if (aborted) return;
      if (error) console.error("[CoreografoPicker] search:", error.message);
      setResults((data as CoreografoLite[] | null) ?? []);
      setLoading(false);
    });
    return () => { aborted = true; };
  }, [debouncedSearch, open]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setAddingNew(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus el search cuando se abre
  useEffect(() => {
    if (open && !addingNew) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [open, addingNew]);

  const showPrompt = useMemo(() => debouncedSearch.trim().length < 2, [debouncedSearch]);

  const handleSelect = (c: CoreografoLite) => {
    onSelect(c.coreografo, c.id_coreografo);
    setOpen(false);
    setSearch("");
  };

  const handleAddNew = () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) return;
    onSelect(trimmed, null);
    setNewName("");
    setAddingNew(false);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border bg-card/60 px-4 py-3 text-left transition-all",
          value
            ? "border-[var(--amber-primary)] bg-[rgba(34,211,238,0.06)]"
            : "border-border hover:border-[rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.03)]",
          open && "ring-2 ring-[rgba(34,211,238,0.3)]"
        )}
      >
        {value ? (
          <>
            <Avatar name={value} size={40} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-bold text-foreground">{value}</div>
              <div className="text-xs text-foreground/65">Haga clic para cambiar</div>
            </div>
          </>
        ) : (
          <>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background/60 text-foreground/50">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Seleccionar coreógrafo</div>
              <div className="text-xs text-foreground/65">
                Busque si ya está registrado o escriba si es nuevo
              </div>
            </div>
          </>
        )}
        <svg
          viewBox="0 0 24 24"
          className={cn(
            "h-5 w-5 shrink-0 text-foreground/60 transition-transform",
            open && "rotate-180"
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Panel del dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          {!addingNew && (
            <>
              {/* Buscador */}
              <div className="border-b border-border bg-card p-3">
                <div className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar por nombre…"
                    className="w-full rounded-lg border border-border bg-background/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/50 focus:border-[var(--amber-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)]"
                  />
                </div>
                {showPrompt ? (
                  <p className="mt-2 text-[11px] text-foreground/60">
                    Escriba al menos 2 letras para buscar.
                  </p>
                ) : loading ? (
                  <p className="mt-2 text-[11px] text-foreground/60">Buscando…</p>
                ) : (
                  <p className="mt-2 text-[11px] text-foreground/60">
                    {results.length} resultado{results.length === 1 ? "" : "s"} · máximo 30
                  </p>
                )}
              </div>

              {/* Lista */}
              <div className="max-h-80 overflow-y-auto">
                {showPrompt ? (
                  <div className="p-6 text-center text-sm text-foreground/70">
                    Empiece a escribir el nombre del coreógrafo para ver sugerencias.
                  </div>
                ) : !loading && results.length === 0 ? (
                  <div className="p-6 text-center">
                    <div className="text-sm text-foreground/70">
                      No se encontró ningún coreógrafo con ese nombre
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNewName(search);
                        setAddingNew(true);
                      }}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-gradient px-4 py-2 text-xs font-bold text-white"
                    >
                      + Agregar &ldquo;{search}&rdquo; como nuevo
                    </button>
                  </div>
                ) : (
                  <ul role="listbox">
                    {results.map((c) => {
                      const selected = value === c.coreografo;
                      return (
                        <li key={c.id_coreografo}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selected}
                            onClick={() => handleSelect(c)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              selected
                                ? "bg-[rgba(34,211,238,0.1)]"
                                : "hover:bg-[rgba(34,211,238,0.05)]"
                            )}
                          >
                            <Avatar name={c.coreografo} size={36} />
                            <span className="flex-1 truncate text-sm font-semibold text-foreground">
                              {c.coreografo}
                            </span>
                            {selected && (
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4 text-[var(--amber-primary)]"
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

              {/* Agregar nuevo (pie) */}
              <div className="border-t border-border bg-card p-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewName(search);
                    setAddingNew(true);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold text-[var(--amber-soft)] hover:bg-[rgba(34,211,238,0.06)]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-[var(--amber-primary)] text-[var(--amber-primary)]">
                    +
                  </span>
                  Agregar un coreógrafo nuevo
                </button>
              </div>
            </>
          )}

          {addingNew && (
            <div className="p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--amber-soft)]">
                Nuevo coreógrafo
              </div>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre y apellido del coreógrafo"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNew();
                  }
                }}
                className="w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/50 focus:border-[var(--amber-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)]"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={newName.trim().length < 2}
                  className="flex-1 rounded-full bg-primary-gradient px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Usar este nombre
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingNew(false);
                    setNewName("");
                  }}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/80 hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
