import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { webpProxy } from "@/lib/utils/img";

/**
 * Input de texto con autocomplete inline contra `/api/participantes/search`.
 *
 * Diferencia vs `ParticipantePicker`: acá no hay modal ni botones — el input
 * se ve como cualquier otro campo del formulario y las sugerencias caen como
 * dropdown mientras el usuario tipea. El flujo que habilita es:
 *
 * 1. El usuario escribe. A los 250ms sin tipear se lanza la búsqueda.
 * 2. Si una sugerencia aparece y el usuario hace clic, se autocompleta el
 *    texto y se linkea el `id_contacto` (más el prefill de ciudad/teléfono/
 *    correo del participante, que el componente le devuelve al formulario
 *    vía `onMatch`).
 * 3. Si el usuario sigue tipeando y el texto coincide EXACTAMENTE con una
 *    sugerencia cargada (case / accent-insensitive), disparamos `onMatch`
 *    solo — no hace falta clic. Si deja de coincidir, liberamos el id.
 * 4. Si al enviar el formulario el texto no coincide con nada, el backend
 *    de `/api/solicitud` ya maneja el caso "persona nueva" (rama prospecto).
 */

type ParticipanteLite = {
  id_contacto: string;
  nombre_y_apellido: string;
  foto_url?: string | null;
};

export type ParticipanteDetalle = {
  id_contacto: string;
  nombre_y_apellido: string;
  numero_de_carnet?: number | null;
  telefono?: number | null;
  ciudad?: string | null;
  correo_electronico?: string | null;
  foto_url?: string | null;
};

type Props = {
  /** Valor actual del campo en el formulario padre (RHF). */
  value: string;
  /** El usuario cambió el texto pero aún no hay match — el padre actualiza
   *  `nombre_y_apellido` y libera `id_contacto`. */
  onTextChange: (value: string) => void;
  /** El texto coincide con un participante existente (por clic o match exacto).
   *  El padre autocompleta `id_contacto` + los campos de contacto. */
  onMatch: (p: ParticipanteDetalle) => void;
  id?: string;
  placeholder?: string;
  ariaInvalid?: boolean;
};

/** Quita tildes/diacríticos preservando ñ (misma tabla que backend). */
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

export function NameAutocomplete({
  value,
  onTextChange,
  onMatch,
  id,
  placeholder = "Nombre y apellido…",
  ariaInvalid,
}: Props) {
  const [results, setResults] = useState<ParticipanteLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [matchedId, setMatchedId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(value, 250);

  // Fetch de sugerencias con debounce — solo si hay ≥ 2 chars y el input está focuseado
  // (para no consultar cuando un setValue externo rellena el campo al prefillear).
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
      .rpc("search_participantes", { q })
      .then(({ data, error }) => {
        if (aborted) return;
        if (error) console.error("[NameAutocomplete] search:", error.message);
        setResults((data as ParticipanteLite[] | null) ?? []);
        setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [debounced]);

  // Match exacto reactivo: cada vez que llegan resultados nuevos o cambia el
  // texto, busco si alguno coincide exacto (case/accent-insensitive). Si sí,
  // fetcheo el detalle y disparamos onMatch. Si el match desaparece (porque
  // el usuario borró o cambió el texto), liberamos el id.
  const exactMatch = useMemo(() => {
    const needle = normalize(value);
    if (!needle) return null;
    return results.find((r) => normalize(r.nombre_y_apellido) === needle) ?? null;
  }, [value, results]);

  useEffect(() => {
    if (exactMatch && exactMatch.id_contacto !== matchedId) {
      setMatchedId(exactMatch.id_contacto);
      // Fetch del detalle para prefillear el resto del formulario.
      let aborted = false;
      supabase
        .rpc("obtener_contacto_por_id", { p_id: exactMatch.id_contacto })
        .then(({ data, error }) => {
          if (aborted || error) return;
          const arr = data as ParticipanteDetalle[] | null;
          if (arr && arr[0]) onMatch(arr[0]);
        });
      return () => {
        aborted = true;
      };
    }
    if (!exactMatch && matchedId) {
      // El usuario cambió el texto y ya no coincide con nadie — liberar el id.
      // Usamos onTextChange con el mismo value para que el padre resetee id_contacto.
      setMatchedId(null);
      onTextChange(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactMatch]);

  // Cerrar dropdown al hacer clic fuera.
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

  const handleSelect = async (p: ParticipanteLite) => {
    // El click ya autocompleta: seteamos el texto y el id de inmediato.
    setOpen(false);
    setFocusIndex(-1);
    setMatchedId(p.id_contacto);
    try {
      const { data, error } = await supabase.rpc(
        "obtener_contacto_por_id",
        { p_id: p.id_contacto },
      );
      if (!error) {
        const arr = data as ParticipanteDetalle[] | null;
        if (arr && arr[0]) {
          onMatch(arr[0]);
          return;
        }
      }
    } catch {
      /* silenciar — onMatch abajo se hace con el mínimo */
    }
    onMatch({ id_contacto: p.id_contacto, nombre_y_apellido: p.nombre_y_apellido });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      handleSelect(results[focusIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocusIndex(-1);
    }
  };

  const showDropdown =
    open && debounced.trim().length >= 2;

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
          {loading ? (
            <div className="px-4 py-3 text-xs text-foreground/60">Buscando…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-foreground/60">
              No hay coincidencias. Al enviar se registrará como persona nueva.
            </div>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
              {results.map((p, i) => {
                const selected = matchedId === p.id_contacto;
                const active = i === focusIndex;
                return (
                  <li key={p.id_contacto}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleSelect(p)}
                      onMouseEnter={() => setFocusIndex(i)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-[rgba(34,211,238,0.08)] text-foreground"
                          : "text-foreground/85 hover:bg-[rgba(34,211,238,0.05)]",
                        selected && "font-semibold text-[var(--amber-cream)]"
                      )}
                    >
                      {/* Avatar / foto del participante. Fallback: inicial. */}
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card/80 text-[11px] font-semibold uppercase text-foreground/60"
                      >
                        {p.foto_url ? (
                          <img
                            src={webpProxy(p.foto_url, 72) ?? p.foto_url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          p.nombre_y_apellido.charAt(0).toUpperCase()
                        )}
                      </span>
                      <span className="flex-1 truncate">{p.nombre_y_apellido}</span>
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
