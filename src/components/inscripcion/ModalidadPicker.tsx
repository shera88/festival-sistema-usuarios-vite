import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Selector de modalidad con buscador in-memory. Las 18 modalidades son lista
 * cerrada y chica — no hace falta fetch remoto, filtramos por string includes
 * accent-insensitive en el cliente. Mismo patrón visual que los otros pickers
 * (agrupación, coreógrafo, participante) para consistencia visual del Paso 2.
 *
 * El menú se renderiza en un PORTAL con position:fixed anclado al botón: así no
 * lo clippea ningún contenedor con overflow (ej. el form scrollable del modal de
 * edición) ni lo tapa un footer fijo. Flip automático arriba/abajo según el
 * espacio disponible y max-height limitado al viewport → funciona en móvil (360px).
 */

type Props = {
  modalidades: readonly string[];
  value?: string;
  onChange: (value: string) => void;
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type MenuPos = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

export function ModalidadPicker({ modalidades, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Calcula la posición fixed del menú a partir del botón, con flip arriba/abajo.
  const computePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 8;
    const vh = window.innerHeight;
    const spaceBelow = vh - r.bottom - GAP;
    const spaceAbove = r.top - GAP;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(180, Math.min(360, openUp ? spaceAbove : spaceBelow));
    setPos(openUp
      ? { left: r.left, width: r.width, bottom: vh - r.top + GAP, maxHeight }
      : { left: r.left, width: r.width, top: r.bottom + GAP, maxHeight });
  };

  useLayoutEffect(() => {
    if (!open) return;
    computePos();
    const onScroll = () => computePos();
    const onResize = () => computePos();
    // capture:true → escuchar scroll de CUALQUIER ancestro (el form del modal).
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchInputRef.current?.focus(), 50);
    else setSearch("");
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
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border bg-card/60 px-4 py-3 text-left text-base transition-all",
          value
            ? "border-[var(--amber-primary)] bg-[rgba(34,211,238,0.06)] font-semibold text-foreground"
            : "border-border text-foreground/60 hover:border-[rgba(34,211,238,0.4)] hover:bg-[rgba(34,211,238,0.03)]",
          open && "ring-2 ring-[rgba(34,211,238,0.3)]"
        )}
      >
        <span className="truncate">{value || "Seleccione la modalidad de su obra…"}</span>
        <svg
          viewBox="0 0 24 24"
          className={cn("h-5 w-5 shrink-0 text-foreground/60 transition-transform", open && "rotate-180")}
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed z-[300] flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)]"
          style={{
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            maxHeight: pos.maxHeight,
          }}
        >
          <div className="shrink-0 border-b border-border bg-card p-3">
            <div className="relative">
              <svg
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
                className="w-full rounded-lg border border-border bg-background/60 py-2.5 pl-9 pr-3 text-base text-foreground placeholder:text-foreground/50 focus:border-[var(--amber-primary)] focus:outline-none focus:ring-2 focus:ring-[rgba(34,211,238,0.2)]"
              />
            </div>
            <p className="mt-2 text-[11px] text-foreground/60">
              {filtered.length === modalidades.length
                ? `${modalidades.length} modalidades disponibles`
                : `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-foreground/70">
                Sin resultados para &ldquo;{search}&rdquo;
              </div>
            ) : (
              <ul>
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
                          "flex min-h-[44px] w-full items-center gap-3 px-4 py-3 text-left text-[15px] transition-colors",
                          selected
                            ? "bg-[rgba(34,211,238,0.12)] font-semibold text-foreground"
                            : "text-foreground/90 hover:bg-[rgba(34,211,238,0.06)] active:bg-[rgba(34,211,238,0.1)]"
                        )}
                      >
                        <span className="flex-1 truncate">{m}</span>
                        {selected && (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4 shrink-0 text-[var(--amber-primary)]"
                            fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
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
        </div>,
        document.body,
      )}
    </div>
  );
}
