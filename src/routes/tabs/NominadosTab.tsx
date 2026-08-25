import { useState } from 'react';
import { Trophy, FileDown, Loader2 } from 'lucide-react';
import { useNominados } from '@/hooks/queries';
import { descargarNominadosPdf } from '@/lib/pdf/nominados-pdf';
import type { NominadosBloque, NominadoItem } from '@/types/domain';

/**
 * NOMINADOS — la misma lista que el «PDF público» de la app de jurados.
 *
 * Lo que NO se ve, y es a propósito: el lugar y la nota. Dentro de cada bloque
 * las agrupaciones vienen MEZCLADAS desde el servidor y numeradas después de
 * mezclar, así el orden no delata quién ganó qué. No reordenar acá, ni ordenar
 * la tabla por ninguna columna, ni agregar una columna de nota o de puesto.
 *
 * ABIERTA A TODO EL PORTAL (2026-08-24). Antes era sólo super admin; ahora la
 * ve cualquier persona con sesión iniciada. No hace falta guarda de rol acá
 * porque la respuesta ya no trae nada reservado — y el backend igual exige
 * sesión (nominados.php → requireAuth), que es donde vive la protección real.
 */

/** Color de la franja según el género, igual que la planilla oficial. */
const COLOR_GENERO: Record<string, string> = {
  ACADEMICO: '#8E7CC3',   // morado
  URBANO: '#3C78D8',      // azul
  FOLKLORE: '#5D9D42',    // verde
};

const ETIQUETA_GENERO: Record<string, string> = {
  ACADEMICO: 'ACADÉMICO',
  URBANO: 'URBANO',
  FOLKLORE: 'FOLCLORE',
};

export function NominadosTab() {
  return <NominadosContent />;
}

/** Logo de la agrupación; si no tiene o falla la carga, la inicial. */
function LogoAgrupacion({ nombre, logo }: { nombre: string; logo?: string | null }) {
  const [roto, setRoto] = useState(false);
  const inicial = (nombre || '?').charAt(0).toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-glass-border bg-glass-bg">
      {logo && !roto ? (
        <img
          src={logo}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setRoto(true)}
        />
      ) : (
        <span className="font-display text-[13px] font-bold text-gold">{inicial}</span>
      )}
    </span>
  );
}

function NominadosContent() {
  const { data, isLoading, error } = useNominados(true);
  const [bajando, setBajando] = useState(false);

  const bloques: NominadosBloque[] = data?.bloques ?? [];

  const bajarPdf = async () => {
    if (!bloques.length) return;
    setBajando(true);
    try {
      // Se le pasa el MISMO orden que está en pantalla (ya mezclado por el
      // servidor), para que el papel y la vista digan exactamente lo mismo.
      await descargarNominadosPdf(bloques, { ano: data?.ano ?? '2026', total: data?.total ?? 0 });
    } catch (e) {
      alert(`No se pudo generar el PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBajando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[12px] text-text-45">
        Cargando nominados…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-glass-border bg-glass-bg px-4 py-6 text-center text-[13px] text-text-70">
        No se pudieron cargar los nominados.
      </div>
    );
  }

  if (bloques.length === 0) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-glass-border bg-glass-bg px-4 py-6 text-center text-[13px] text-text-70">
        Todavía no hay nominados.
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl pb-24 pt-4">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-[17px] font-bold text-text-90">
            <Trophy className="h-5 w-5" style={{ color: 'var(--gold)' }} />
            Nominados
          </h1>
          <p className="mt-1 text-[12px] text-text-45">
            {data?.total ?? 0} nominados en {bloques.length} categorías · el orden es aleatorio y no
            indica ningún resultado
          </p>
        </div>
        <button
          type="button"
          onClick={bajarPdf}
          disabled={bajando}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-glass-border bg-glass-bg px-3.5 py-2 text-[12px] font-semibold text-text-90 transition-colors hover:bg-white/5 disabled:opacity-40"
        >
          {bajando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Descargar PDF
        </button>
      </header>

      <div className="space-y-4">
        {bloques.map((b) => (
          <article key={b.label} className="overflow-hidden rounded-xl border border-glass-border">
            <h2
              className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white"
              style={{ background: COLOR_GENERO[b.genero] ?? '#674EA7' }}
            >
              <span className="min-w-0 truncate">{b.label}</span>
              <span className="hidden shrink-0 rounded-full bg-black/25 px-2 py-0.5 text-[9px] tracking-wider text-white/85 sm:inline-block">
                {ETIQUETA_GENERO[b.genero] ?? b.genero}
              </span>
            </h2>

            <ul className="divide-y divide-glass-border">
              {b.items.map((o: NominadoItem) => (
                <li
                  key={`${b.label}-${o.n}`}
                  className="flex items-center gap-3 bg-glass-bg px-3 py-2.5"
                >
                  <span className="w-7 shrink-0 text-right text-[12px] font-semibold tabular-nums text-text-45">
                    {o.n}
                  </span>
                  <LogoAgrupacion nombre={o.agrupacion} logo={o.logo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-text-90">{o.agrupacion}</p>
                    <p className="truncate text-[12px] text-text-45">{o.obra}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
