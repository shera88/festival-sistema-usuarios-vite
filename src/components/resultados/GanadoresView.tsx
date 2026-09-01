import { useMemo, useState } from 'react';
import { Crown, Search, Trophy, X } from 'lucide-react';
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

/* Metales del podio, calcados de la página /ranking del sitio para que el podio
   se vea igual en los dos lados. */
const MEDALLAS = [
  { solid: 'var(--gold)', glow: 'rgba(232, 208, 152, 0.65)' },
  { solid: '#C7CED8', glow: 'rgba(199, 206, 216, 0.45)' },
  { solid: '#D08B52', glow: 'rgba(208, 139, 82, 0.45)' },
];

/** Numeral del puesto con las dos reglas finas a los costados. */
function Medalla({ puesto }: { puesto: 1 | 2 | 3 }) {
  const m = MEDALLAS[puesto - 1];
  const primero = puesto === 1;
  const regla = (dir: 'l' | 'r') => (
    <span
      aria-hidden
      className={`rounded-full ${primero ? 'w-8 sm:w-11' : 'w-6 sm:w-8'}`}
      style={{
        height: 1,
        background: `linear-gradient(90deg, ${dir === 'l' ? 'transparent, ' + m.solid : m.solid + ', transparent'})`,
        opacity: 0.85,
        boxShadow: primero ? `0 0 6px ${m.glow}` : 'none',
      }}
    />
  );
  return (
    <div className="flex items-center gap-1.5 sm:gap-2.5">
      {regla('l')}
      <span
        className={`font-display font-black leading-none tabular-nums ${primero ? 'text-3xl sm:text-5xl' : 'text-2xl sm:text-4xl'}`}
        style={{ color: m.solid }}
      >
        {puesto}
      </span>
      {regla('r')}
    </div>
  );
}

/** Sin acentos y en minúsculas: se busca «academico» y encuentra «ACADÉMICO». */
const norm = (t: unknown) =>
  String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

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

/**
 * Sólo la nota.
 *
 * Cuántos jurados la formaron NO se muestra en la lista: repetido 179 veces es
 * ruido, y con listas largas invita a comparar obras por el número de jurados
 * en vez de por la nota. El dato sigue estando —y con el desglose completo— al
 * abrir la obra.
 */
function Nota({ o }: { o: GanadorItem }) {
  return (
    <span className="shrink-0 text-right">
      <span className="block text-[15px] font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
        {o.nota}
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
  const [vista, setVista] = useState<'categoria' | 'genero' | 'festival'>('categoria');
  const [busqueda, setBusqueda] = useState('');
  /* Filtro de la vista «Por género»: null = todos los cuadros. Sólo decide QUÉ
     cuadro se dibuja; no reordena ni recalcula nada — el contenido y el orden
     de cada cuadro llegan del servidor tal cual. */
  const [cuadroSel, setCuadroSel] = useState<string | null>(null);

  // Si el cuadro elegido desaparece (otro año, otra respuesta), se cae a «Todos»
  // en vez de mostrar una lista vacía sin explicación.
  const seleccionValida = cuadroSel !== null && cuadros.some((c) => c.clave === cuadroSel);
  const cuadrosVisibles = seleccionValida
    ? cuadros.filter((c) => c.clave === cuadroSel)
    : cuadros;
  const obrasVisibles = cuadrosVisibles.reduce((n, c) => n + c.total, 0);

  const q = norm(busqueda.trim());
  const buscando = q !== '';
  const coincide = (o: GanadorItem) =>
    !buscando || norm(`${o.agrupacion} ${o.obra}`).includes(q);

  /* FESTIVAL: todas las obras de la ronda final juntas, ordenadas por nota.
     Se arma en el navegador con lo que YA llega en `cuadros` — no se pide nada
     nuevo ni se recalcula ninguna nota: es el mismo dato, reagrupado. Se
     deduplica porque una obra puede estar en dos cuadros a la vez (el de su
     género y el de colegios). */
  const rankingFestival = useMemo(() => {
    const vistos = new Set<string>();
    const todas: GanadorItem[] = [];
    for (const c of cuadros) {
      for (const o of c.items) {
        if (vistos.has(o.id_inscripcion)) continue;
        vistos.add(o.id_inscripcion);
        todas.push(o);
      }
    }
    // A igualdad de nota desempata el nombre de la obra, para que el orden no
    // dependa de en qué orden llegaron las filas de las dos noches.
    return todas.sort(
      (x, y) => (y.nota ?? 0) - (x.nota ?? 0) || String(x.obra).localeCompare(String(y.obra), 'es'),
    );
  }, [cuadros]);

  const festivalFiltrado = rankingFestival.filter(coincide);
  // Mientras se busca no hay podio: el podio son los tres primeros del festival,
  // no los tres primeros de lo que quedó tras filtrar. Mismo criterio que la
  // página /ranking del sitio.
  const podio = buscando ? [] : rankingFestival.slice(0, 3);
  const resto = buscando ? festivalFiltrado : rankingFestival.slice(3);
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
            : vista === 'festival'
              ? `${rankingFestival.length} obras del festival · ordenadas por nota`
              : seleccionValida
                ? `${obrasVisibles} obras · ordenadas por nota`
                : `${cuadros.length} cuadros · toda la ronda final ordenada por nota`}
        </p>
      </header>

      {/* Las dos vistas, con el mismo par de pestañas que usa jurados. */}
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl border border-glass-border bg-glass-bg p-1">
        {([['categoria', 'Por categoría'], ['genero', 'Por género'], ['festival', 'General']] as const).map(([v, txt]) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            className={`rounded-lg px-2 py-2 text-[12px] font-semibold transition-colors ${
              vista === v ? 'text-black' : 'text-text-45 hover:text-text-90'
            }`}
            style={vista === v ? { background: 'var(--gold)' } : undefined}
          >
            {txt}
          </button>
        ))}
      </div>

      {/* Buscador. Filtra por agrupación u obra en la vista que esté abierta; no
          reordena nada, sólo esconde lo que no coincide. */}
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-45" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar agrupación u obra..."
          aria-label="Buscar agrupación u obra"
          className="min-h-11 w-full rounded-lg border border-glass-border bg-elev py-2 pl-9 pr-10 text-[13px] text-text-90 placeholder:text-text-45 focus:border-cyan focus:outline-none"
        />
        {busqueda && (
          <button
            type="button"
            onClick={() => setBusqueda('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-text-45 transition hover:text-text-90"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {vista === 'categoria' ? (
        <div className="space-y-4">
          {bloques
            .map((b) => ({ ...b, items: b.items.filter(coincide) }))
            .filter((b) => b.items.length > 0)
            .map((b) => (
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
      ) : vista === 'genero' ? (
        <div className="space-y-5">
          {/* Filtro por género. Con cuatro cuadros y 145 obras en el más grande,
              sin esto hay que recorrer toda la página para llegar al de abajo. */}
          {cuadros.length > 1 && (
            <div
              role="group"
              aria-label="Filtrar por género"
              className="-mx-1 flex flex-wrap gap-1.5 px-1"
            >
              {[{ clave: null as string | null, texto: 'Todos' }].concat(
                cuadros.map((c) => ({
                  clave: c.clave,
                  // El título viene como «GANADORES FOLKLORE»; en un botón, la
                  // primera palabra es ruido que se repite cuatro veces.
                  texto: c.titulo.replace(/^GANADORES\s+/i, ''),
                })),
              ).map(({ clave, texto }) => {
                const activo = clave === null ? !seleccionValida : cuadroSel === clave;
                return (
                  <button
                    key={clave ?? 'todos'}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => setCuadroSel(clave)}
                    className={`min-h-9 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                      activo
                        ? 'border-transparent text-black'
                        : 'border-glass-border text-text-45 hover:text-text-90'
                    }`}
                    style={activo ? { background: 'var(--gold)' } : undefined}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
          )}

          {cuadrosVisibles
            .map((c) => ({ ...c, items: c.items.filter(coincide) }))
            .filter((c) => c.items.length > 0)
            .map((c) => (
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
      ) : (
        /* ── FESTIVAL ─────────────────────────────────────────────────────
           Todas las obras de la ronda final en una sola tabla, ordenadas por
           nota, con el podio arriba. Es el mismo dato de «Por género» sin
           separar por cuadro: acá se compite contra todo el festival. */
        <div>
          {podio.length > 0 && (
            <section
              aria-label="Podio del festival"
              className="grid grid-cols-3 items-end gap-2 sm:gap-4"
            >
              {podio.map((o, i) => {
                const primero = i === 0;
                // El DOM va 1-2-3 (así se lee y así se apila en el teléfono);
                // en pantalla ancha se reordena a 2-1-3 con `order`.
                const orden = primero ? 'order-2' : i === 1 ? 'order-1' : 'order-3';
                const { className, ...resto } = propsFila(o.id_inscripcion);
                return (
                  <div
                    key={o.id_inscripcion}
                    {...resto}
                    className={`flex min-w-0 flex-col items-center rounded-xl border bg-glass-bg text-center transition-colors ${orden} ${className} ${
                      primero
                        ? 'border-gold/35 px-1.5 pb-4 pt-5 sm:px-5 sm:pb-8 sm:pt-8'
                        : 'border-glass-border px-1.5 pb-3 pt-3.5 sm:px-5 sm:pb-6 sm:pt-6'
                    }`}
                    style={
                      primero
                        ? { boxShadow: '0 0 60px -22px rgba(232, 208, 152, 0.55)' }
                        : undefined
                    }
                  >
                    <Medalla puesto={(i + 1) as 1 | 2 | 3} />

                    {primero && (
                      <span
                        className="mt-2 rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase leading-tight tracking-[0.08em] sm:mt-3 sm:px-3 sm:py-1 sm:text-[9.5px] sm:tracking-[0.16em]"
                        style={{
                          color: '#3C2B06',
                          background: 'linear-gradient(135deg, #F3E3B4 0%, #E8D098 50%, #CBAA63 100%)',
                        }}
                      >
                        Mejor del festival
                      </span>
                    )}

                    <span className={primero ? 'mt-2.5 sm:mt-4' : 'mt-2.5 sm:mt-4'}>
                      <Logo nombre={o.agrupacion} logo={o.logo} />
                    </span>

                    <p
                      className={`line-clamp-2 font-bold uppercase leading-tight tracking-wide text-text-90 ${
                        primero ? 'mt-2.5 text-[10px] sm:text-[15px]' : 'mt-2.5 text-[9px] sm:text-[13px]'
                      }`}
                    >
                      {o.obra}
                    </p>
                    <p className="mt-1 line-clamp-1 hidden text-[11px] uppercase tracking-wide text-text-45 sm:block">
                      {o.agrupacion}
                    </p>

                    <p
                      className={`font-black tabular-nums ${primero ? 'mt-2 text-2xl sm:mt-3 sm:text-4xl' : 'mt-2 text-lg sm:mt-3 sm:text-2xl'}`}
                      style={{ color: MEDALLAS[i].solid }}
                    >
                      {o.nota}
                    </p>
                  </div>
                );
              })}
            </section>
          )}

          <div className="mb-2 mt-8 flex items-center justify-between px-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-45">
              {buscando ? 'Resultados' : 'Clasificación completa'}
            </span>
            <span className="text-[11px] tabular-nums text-text-45">{resto.length} obras</span>
          </div>

          {resto.length === 0 ? (
            <p className="rounded-xl border border-glass-border bg-glass-bg px-4 py-8 text-center text-[13px] text-text-45">
              Sin resultados para la búsqueda.
            </p>
          ) : (
            <ul className="divide-y divide-glass-border overflow-hidden rounded-xl border border-glass-border">
              {resto.map((o, i) => {
                const { className, ...restoProps } = propsFila(o.id_inscripcion);
                return (
                  <li
                    key={o.id_inscripcion}
                    {...restoProps}
                    className={`flex items-center gap-3 bg-glass-bg px-3 py-2.5 ${className}`}
                  >
                    <span className="w-8 shrink-0 text-right text-[12px] font-semibold tabular-nums text-text-45">
                      {buscando ? rankingFestival.indexOf(o) + 1 : i + 4}
                    </span>
                    <Logo nombre={o.agrupacion} logo={o.logo} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-text-90">{o.agrupacion}</p>
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
          )}
        </div>
      )}

      {verDetalle && <DetalleObraFinalModal id={detalle.id} onClose={detalle.cerrar} />}
    </section>
  );
}
