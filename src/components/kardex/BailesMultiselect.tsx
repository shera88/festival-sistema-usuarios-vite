import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useObrasAgrupacion, useAgrupacion } from "@/lib/api/agrupaciones";
import { webpProxy } from "@/lib/utils/img";

export interface BaileSel {
  id_inscripcion: string;
  nombre_de_la_obra: string;
}

/** Avatar con el logo de la agrupación (mismo para todos los bailes del grupo). */
function AgrupLogo({ src, name, size = 24 }: { src: string | null; name: string; size?: number }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-card"
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[10px] font-semibold text-foreground/70">{initial}</span>
      )}
    </span>
  );
}

/**
 * Selector (dropdown multiselect) de "en qué bailes del grupo participa la
 * persona". Lista las obras (inscripciones 2026) de la agrupación elegida; se
 * pueden marcar varias y quedan como chips debajo. Se habilita solo cuando ya
 * hay una agrupación seleccionada.
 */
export function BailesMultiselect({
  idAgrupacion,
  value,
  onChange,
}: {
  idAgrupacion: string;
  value: BaileSel[];
  onChange: (v: BaileSel[]) => void;
}) {
  const { data: obras = [], isLoading } = useObrasAgrupacion(idAgrupacion || null);
  const { data: agrup } = useAgrupacion(idAgrupacion || null);
  const logoUrl = agrup?.enlace_del_logo ? webpProxy(agrup.enlace_del_logo, 64) : null;
  const agrupName = agrup?.nombre_agrupacion ?? "";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedIds = new Set(value.map((v) => v.id_inscripcion));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (o: BaileSel) => {
    if (selectedIds.has(o.id_inscripcion)) {
      onChange(value.filter((v) => v.id_inscripcion !== o.id_inscripcion));
    } else {
      onChange([...value, { id_inscripcion: o.id_inscripcion, nombre_de_la_obra: o.nombre_de_la_obra }]);
    }
  };

  if (!idAgrupacion) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-3 text-xs text-foreground/55">
        Seleccione primero una agrupación para ver sus bailes.
      </p>
    );
  }

  const disabled = isLoading || obras.length === 0;
  const triggerLabel = isLoading
    ? "Cargando bailes…"
    : obras.length === 0
      ? "Esta agrupación no tiene obras inscritas"
      : value.length === 0
        ? "Seleccione los bailes…"
        : `${value.length} baile${value.length > 1 ? "s" : ""} seleccionado${value.length > 1 ? "s" : ""}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card/60 px-4 text-sm text-foreground transition-colors hover:border-[rgba(34,211,238,0.4)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={value.length ? "truncate text-foreground" : "truncate text-foreground/50"}>
          {triggerLabel}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-foreground/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-border bg-[#0f0d1e] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
        >
          {obras.map((o) => {
            const sel = selectedIds.has(o.id_inscripcion);
            return (
              <button
                key={o.id_inscripcion}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => toggle(o)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  sel ? "bg-[rgba(34,211,238,0.10)] text-foreground" : "text-foreground/85 hover:bg-white/5"
                }`}
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                    sel ? "border-[rgba(34,211,238,0.9)] bg-[rgba(34,211,238,0.95)]" : "border-border"
                  }`}
                >
                  {sel && (
                    <svg viewBox="0 0 24 24" className="h-3 w-3 text-black" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                <AgrupLogo src={logoUrl} name={agrupName} size={24} />
                <span className="truncate">{o.nombre_de_la_obra}</span>
              </button>
            );
          })}
        </div>
      )}

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v.id_inscripcion}
              className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,211,238,0.4)] bg-[rgba(34,211,238,0.08)] py-1 pl-1 pr-2.5 text-xs text-foreground"
            >
              <AgrupLogo src={logoUrl} name={agrupName} size={18} />
              {v.nombre_de_la_obra}
              <button
                type="button"
                onClick={() => toggle(v)}
                aria-label={`Quitar ${v.nombre_de_la_obra}`}
                className="text-foreground/60 transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
