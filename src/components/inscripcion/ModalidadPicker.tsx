import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Selector de modalidad con buscador in-memory. Las 18 modalidades son lista
 * cerrada y chica — no hace falta fetch remoto, filtramos por string includes
 * accent-insensitive en el cliente. Mismo patrón visual que los otros pickers
 * (agrupación, coreógrafo, participante) para consistencia visual del Paso 2.
 */

type Props = {
  modalidades: readonly string[];
  value?: string;
  onChange: (value: string) => void;
};

function stripAccents(s: string): string {
  // Normaliza a NFD (separa letras de diacríticos combinantes) y remueve los
  // diacríticos del rango Unicode U+0300 a U+036F. Así "MODALIDAD LIBRE" y
  // "DANZA ÉTNICA" se comparan contra queries sin tildes.
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function ModalidadPicker({ modalidades, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border bg-card/60 px-4 py-3 text-left text-sm transition-all",
          value
            ? "border-[var(--amber-primary)] bg-[rgba(34,211,238,0.06)] font-semibold text-foreground"
            : "border-border text-foreground/60 hover:border-[rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.03)]",
          open && "ring-2 ring-[rgba(34,211,238,0.3)]"
        )}
      >
        <span className="truncate">{value || "Seleccione la modalidad de su obra…"}</span>
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

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
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
                placeholder="Buscar modalidad…"
                className="w-full rounded-lg border border-border bg-background/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/50 focus:border-[var(--amber-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)]"
              />
            </div>
            <p className="mt-2 text-[11px] text-foreground/60">
              {filtered.length === modalidades.length
                ? `${modalidades.length} modalidades disponibles`
                : `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-foreground/70">
                Sin resultados para &ldquo;{search}&rdquo;
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
                          "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                          selected
                            ? "bg-[rgba(34,211,238,0.1)] font-semibold text-foreground"
                            : "text-foreground/90 hover:bg-[rgba(34,211,238,0.05)]"
                        )}
                      >
                        <span className="flex-1 truncate">{m}</span>
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
        </div>
      )}
    </div>
  );
}
