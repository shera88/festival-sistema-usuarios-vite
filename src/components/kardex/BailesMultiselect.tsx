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
  const selectedIds = new Set(value.map((v) => v.id_inscripcion));

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

  if (isLoading) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-3 text-xs text-foreground/55">
        Cargando bailes…
      </p>
    );
  }
  if (obras.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-3 text-xs text-foreground/55">
        Esta agrupación no tiene obras inscritas.
      </p>
    );
  }

  // Checklist SIEMPRE visible (no dropdown): las obras de la agrupación quedan al
  // frente para marcarlas de una. Cada obra muestra el logo del grupo + su nombre.
  return (
    <div>
      <div className="max-h-64 overflow-auto rounded-xl border border-border bg-[rgba(8,5,30,0.5)] p-1">
        {obras.map((o) => {
          const sel = selectedIds.has(o.id_inscripcion);
          return (
            <button
              key={o.id_inscripcion}
              type="button"
              role="checkbox"
              aria-checked={sel}
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
      <p className="mt-1.5 px-1 text-[11px] text-foreground/45">
        {value.length === 0
          ? "Marque los bailes en los que participa."
          : `${value.length} baile${value.length > 1 ? "s" : ""} seleccionado${value.length > 1 ? "s" : ""}.`}
      </p>
    </div>
  );
}
