import { useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { DetalleObraFinalModal, useDetalleObra } from '@/components/cards/DetalleObraFinalModal';
import type { GanadorItem, GanadoresBloque, GanadoresCuadro } from '@/types/domain';

/**
 * GANADORES — los resultados reales del festival, con el estilo de la app de
 * jurados. Dos vistas de la misma información:
 *
 *   Por categoría — los bloques de premiación, cada obra con su LUGAR.
 *   Por género    — cuatro cuadros (folklore, urbano, académico, colegios o
 *                   universidades) con TODA la ronda final de ese género
 *                   ordenada por nota. El #1 lleva el trofeo.
 *
 * Vista PURA: recibe los datos ya resueltos. Quién puede verlos lo decide el
 * contenedor, y sobre todo el servidor.
 *
 * `verDetalle` existe porque el desglose por jurado sale de ganador-detalle.php,
 * que es sólo super admin. Con la prop en false las filas dejan de ser
 * clicables: más vale que no se pueda abrir a que se abra y devuelva 403.
 */

/** Color de la franja por género, igual que la planilla oficial. */
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

/** Los tres lugares, con el mismo código de color que usa jurados. */
const ESTILO_LUGAR: Record<string, string> = {
  PRIMER: 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40',
  SEGUNDO: 'bg-slate-300/15 text-slate-200 ring-1 ring-slate-300/30',
  TERCER: 'bg-orange-700/25 text-orange-300 ring-1 ring-orange-600/40',
};

function Logo({ nombre, logo }: { nombre: string; logo?: string | null }) {
  const [roto, setRoto] = useState(false);
  const inicial = (nombre || '?').charAt(0).toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-glass-border bg-glass-bg">
      {logo && !roto ? (
        <img src={logo} alt="" loading="lazy" className="h-full w-full object-cover"
          onError={() => setRoto(true)} />
      ) : (
        <span className="font-display text-[13px] font-bold text-gold">{inicial}</span>
      )}
    </span>
  );
}

/** Nota + cuántos jurados la formaron. Con menos de 3 el promedio no es
 *  representativo, así que se avisa en vez de mostrarla a secas. */
function Nota({ o }: { o: GanadorItem }) {
  const pocos = o.jurados < 3;
  return (
    <span className="shrink-0 text-right">
      <span className="block text-[15px] font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
        {o.nota}
      </span>
      <span className={`block text-[9px] uppercase tracking-wide ${pocos ? 'text-amber-300' : 'text-text-45'}`}>
        {o.jurados} {o.jurados === 1 ? 'jurado' : 'jurados'}
      </span>
    </span>
  );
}

interface Props {
  bloques: GanadoresBloque[];
  cuadros: GanadoresCuadro[];
  total: number;
  cargando?: boolean;
  error?: boolean;
  /** Si las filas abren el desglose por jurado. Sólo para super admin. */
  verDetalle?: boolean;
}

export function GanadoresView({
  bloques,
  cuadros,
  total,
  cargando = false,
  error = false,
  verDetalle = true,
}: Props) {
  const [vista, setVista] = useState<'categoria' | 'genero'>('categoria');
  // Click en cualquier fila -> el desglose por jurado, como en jurados.
  const detalle = useDetalleObra();

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-24 text-[12px] text-text-45">
        Cargando ganadores…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-glass-border bg-glass-bg px-4 py-6 text-center text-[13px] text-text-70">
        No se pudieron cargar los ganadores.
      </div>
    );
  }

  // Con el detalle apagado la fila no se comporta como botón: sin cursor, sin
  // rol, sin foco. Una fila que parece clicable y no hace nada es peor que una
  // que no lo parece.
  const propsFila = (id: string) =>
    verDetalle
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick: () => detalle.abrir(id),
          onMouseEnter: () => detalle.precargar(id),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              detalle.abrir(id);
            }
          },
          title: 'Ver las notas de la ronda final',
          className: 'cursor-pointer outline-none transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.06]',
        }
      : { className: '' };

  return (
    <section className="mx-auto w-full max-w-5xl pb-24 pt-4">
      <header className="mb-4 px-1">
        <h1 className="flex items-center gap-2 text-[17px] font-bold text-text-90">
          <Crown className="h-5 w-5" style={{ color: 'var(--gold)' }} />
          Ganadores
        </h1>
        <p className="mt-1 text-[12px] text-text-45">
          {vista === 'categoria'
            ? `${total} placas en ${bloques.length} categorías`
            : `${cuadros.length} cuadros · toda la ronda final ordenada por nota`}
        </p>
      </header>

      {/* Las dos vistas, con el mismo par de pestañas que usa jurados. */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-glass-border bg-glass-bg p-1">
        {([['categoria', 'Por categoría'], ['genero', 'Por género']] as const).map(([v, txt]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
              vista === v ? 'text-black' : 'text-text-45 hover:text-text-90'
            }`}
            style={vista === v ? { background: 'var(--gold)' } : undefined}
          >
            {txt}
          </button>
        ))}
      </div>

      {vista === 'categoria' ? (
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
                {b.items.map((o) => {
                  const { className, ...resto } = propsFila(o.id_inscripcion);
                  return (
                    <li
                      key={o.id_inscripcion}
                      {...resto}
                      className={`flex items-center gap-3 bg-glass-bg px-3 py-2.5 ${className}`}
                    >
                      <span className="w-7 shrink-0 text-right text-[12px] font-semibold tabular-nums text-text-45">
                        {o.n}
                      </span>
                      <Logo nombre={o.agrupacion} logo={o.logo} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-text-90">{o.agrupacion}</p>
                        <p className="truncate text-[12px] text-text-45">{o.obra}</p>
                      </div>
                      {o.lugar && (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ESTILO_LUGAR[o.lugar] ?? ''}`}>
                          {o.lugar}
                        </span>
                      )}
                      <Nota o={o} />
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {cuadros.map((c) => (
            <article key={c.clave} className="overflow-hidden rounded-xl border border-gold/25">
              <h2
                className="flex items-center justify-between gap-2 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide"
                style={{ background: 'linear-gradient(90deg, rgba(232,208,152,0.18), transparent)', color: 'var(--gold)' }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Trophy className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">{c.titulo}</span>
                </span>
                <span className="shrink-0 text-[10px] font-semibold text-text-45">
                  {c.total} obras
                </span>
              </h2>
              <ul className="divide-y divide-glass-border">
                {c.items.map((o) => {
                  const ganador = o.pos === 1;
                  const { className, ...resto } = propsFila(o.id_inscripcion);
                  return (
                    <li
                      key={o.id_inscripcion}
                      {...resto}
                      className={`flex items-center gap-3 px-3 py-2.5 ${ganador ? 'bg-amber-400/[0.07]' : 'bg-glass-bg'} ${className}`}
                    >
                      <span className="grid w-8 shrink-0 place-items-center">
                        {ganador ? (
                          <Trophy className="h-5 w-5" style={{ color: 'var(--gold)' }} />
                        ) : (
                          <span className="text-[12px] font-semibold tabular-nums text-text-45">
                            {o.pos}
                          </span>
                        )}
                      </span>
                      <Logo nombre={o.agrupacion} logo={o.logo} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] font-semibold ${ganador ? 'text-gold' : 'text-text-90'}`}>
                          {o.agrupacion}
                        </p>
                        <p className="truncate text-[12px] text-text-45">
                          {o.obra}
                          <span className="text-text-45/70"> · {o.categoria.toLowerCase()} · {o.division.toLowerCase()}</span>
                        </p>
                      </div>
                      {o.lugar && (
                        <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline-block ${ESTILO_LUGAR[o.lugar] ?? ''}`}>
                          {o.lugar}
                        </span>
                      )}
                      <Nota o={o} />
                    </li>
                  );
                })}
              </ul>
            </article>
          ))}
        </div>
      )}

      {verDetalle && <DetalleObraFinalModal id={detalle.id} onClose={detalle.cerrar} />}
    </section>
  );
}
