import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { dataApi } from '@/lib/api/data';
import { X, Trophy } from 'lucide-react';
import { useGanadorDetalle } from '@/hooks/queries';
import type { CalificacionFinal } from '@/types/domain';

/**
 * Detalle de una obra de la RONDA FINAL: lo que puso cada jurado.
 *
 * Es el mismo modal que la app de jurados. Sólo lo abre un super admin, y el
 * servidor lo exige aparte (ganador-detalle.php → requireSuperAdmin): esto no
 * es una pantalla protegida, es una pantalla que sólo se le muestra a quien el
 * servidor ya autorizó.
 *
 * Acá se ve QUIÉN puso qué, que es más sensible que la nota final. No hay ningún
 * cartel que lo recuerde en pantalla —se sacó a pedido—, así que queda anotado
 * acá: si alguna vez se abre esta vista a alguien más, hay que releer el gate del
 * servidor antes, no sólo esconder la pestaña.
 */

/** Cada criterio con su color, como en la app de jurados. */
const CRITERIOS: Array<[string, keyof CalificacionFinal, string]> = [
  ['Temática', 'tematica', 'text-pink-400'],
  ['Interpretación', 'interpretacion', 'text-cyan-300'],
  ['Coreografía', 'coreografia', 'text-purple-300'],
  ['Dificultad', 'dificultad', 'text-amber-300'],
];

function Dato({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-text-45">{rotulo}</p>
      <p className="truncate text-[13px] font-semibold text-text-90">{valor || '—'}</p>
    </div>
  );
}

export function DetalleObraFinalModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useGanadorDetalle(id);

  // Escape cierra, y mientras está abierto la página de atrás no scrollea.
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previo;
    };
  }, [id, onClose]);

  if (!id) return null;

  const o = data?.obra;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 px-3 py-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-glass-border bg-surface-1 shadow-2xl"
        style={{ background: 'var(--bg-base)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-glass-border px-4 py-3.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-glass-border">
            {o?.logo
              ? <img src={o.logo} alt="" className="h-full w-full object-cover" />
              : <span className="font-display text-base font-bold text-gold">
                  {(o?.agrupacion ?? '?').charAt(0).toUpperCase()}
                </span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-text-90">{o?.agrupacion ?? '…'}</p>
            <p className="truncate text-[12px] text-text-45">{o?.obra ?? ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-45 transition-colors hover:bg-white/5 hover:text-text-90">
            <X className="h-4 w-4" />
          </button>
        </header>

        {isLoading && (
          <p className="px-4 py-10 text-center text-[12px] text-text-45">Cargando detalle…</p>
        )}
        {error && (
          <p className="px-4 py-10 text-center text-[13px] text-text-70">
            No se pudo cargar el detalle de esta obra.
          </p>
        )}

        {data && o && (
          <div className="px-4 py-4">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-glass-border bg-glass-bg px-3.5 py-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-text-45">Nota de la ronda final</p>
                {o.dia_final && (
                  <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300 ring-1 ring-amber-400/30">
                    <Trophy className="h-3 w-3" />
                    Clasificado {o.dia_final}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[28px] font-bold leading-none tabular-nums" style={{ color: 'var(--gold)' }}>
                {data.nota ?? '—'}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
              <Dato rotulo="Modalidad" valor={o.modalidad} />
              <Dato rotulo="Categoría" valor={o.categoria} />
              <Dato rotulo="División" valor={o.division} />
              <Dato rotulo="Subdivisión" valor={o.subdivision} />
              <Dato rotulo="Coreógrafo" valor={o.coreografo} />
              <Dato rotulo="Día" valor={o.dia_final ?? o.dia} />
            </div>

            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-90">
              Calificaciones de la ronda final{o.dia_final ? ` (${o.dia_final})` : ''} ({data.jurados})
            </p>

            <ul className="space-y-2">
              {data.calificaciones.map((c, i) => (
                <li key={`${c.id_jurado ?? i}`} className="rounded-xl border border-glass-border bg-glass-bg px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-glass-border">
                      {c.foto
                        ? <img src={c.foto} alt="" className="h-full w-full object-cover" />
                        : <span className="text-[11px] font-bold text-gold">{c.jurado.charAt(0)}</span>}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[12px] font-bold uppercase tracking-wide text-text-90">
                      {c.jurado}
                    </p>
                    <span className="shrink-0 text-[17px] font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
                      {c.total ?? '—'}
                    </span>
                  </div>
                  <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-text-45">
                    {CRITERIOS.map(([rotulo, clave, color]) => (
                      <span key={rotulo}>
                        {rotulo}: <b className={color}>{(c[clave] as number | null) ?? '—'}</b>
                      </span>
                    ))}
                  </p>
                  {c.comentario && (
                    <p className="mt-1.5 text-[11px] italic text-text-45">“{c.comentario}”</p>
                  )}
                </li>
              ))}
              {data.calificaciones.length === 0 && (
                <li className="rounded-xl border border-glass-border bg-glass-bg px-3 py-4 text-center text-[12px] text-text-45">
                  Esta obra todavía no tiene notas de la ronda final.
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Estado del modal + PRECARGA.
 *
 * `precargar` se engancha al hover de la fila: cuando el dedo llega al click, la
 * respuesta ya suele estar en cache y el modal abre sin espera. Cuesta una
 * consulta que quizá no se use, pero es la misma que se iba a pedir igual.
 */
export function useDetalleObra() {
  const [id, setId] = useState<string | null>(null);
  const qc = useQueryClient();
  const precargar = useCallback((obraId: string) => {
    qc.prefetchQuery({
      queryKey: ['ganador-detalle', obraId],
      queryFn: () => dataApi.ganadorDetalle(obraId),
      staleTime: 5 * 60 * 1000,
    });
  }, [qc]);
  return { id, abrir: setId, cerrar: () => setId(null), precargar };
}
