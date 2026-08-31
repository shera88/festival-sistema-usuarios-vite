import { useEffect, useMemo, useState } from 'react';
import { Search, X, Lock } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { DayGroup } from '@/components/shared/DayGroup';
import { VideoCard } from '@/components/cards/VideoCard';
import { VideoModal } from '@/components/media/VideoModal';
import { useCliente } from '@/hooks/useCliente';
import { clientesApi } from '@/lib/api/clientes';
import { useVideosCliente } from '@/hooks/queries-clientes';
import { dayOrderIndex } from '@/lib/utils/days';
import { MEMBRESIA_PAQUETE } from '@/lib/membresia';
import { conFinales } from '@/lib/videos-finales';
import type { VideoItem } from '@/types/domain';

/**
 * Videos del festival para un CLIENTE.
 *
 * Se arma con las MISMAS piezas que usa el portal (VideoCard, VideoModal,
 * DayGroup): lo que cambia es el ensamblado, no los componentes. Por eso no se
 * copió VideosTab: aquel tiene el upsell de participantes —membresía por
 * agrupación, precios de reserva, kárdex— que aquí no aplica. Un cliente compra
 * el Paquete Completo o no compra: una sola decisión.
 */
export function ClienteVideosPage() {
  const { cliente, membresia, refrescar } = useCliente();
  const { data, isLoading, error } = useVideosCliente(!!cliente);
  const [busqueda, setBusqueda] = useState('');
  const [dia, setDia] = useState<string | null>(null);
  const [activo, setActivo] = useState<VideoItem | null>(null);
  const [comprando, setComprando] = useState(false);

  // Un cliente nunca reservó en el kárdex, así que o paga la oferta o el precio
  // regular. El tachado sale del mismo dato, no de un texto suelto.
  const precioPaquete = MEMBRESIA_PAQUETE.precioOferta ?? MEMBRESIA_PAQUETE.precioRegular;
  const hayOferta = precioPaquete < MEMBRESIA_PAQUETE.precioRegular;

  /**
   * Crea la orden en WooCommerce y manda a pagar.
   *
   * Se sale del sitio con location.href y no en una pestaña nueva: la pasarela
   * de pago necesita la ventana completa, y volver es lo esperado después de
   * pagar. Al regresar, el useEffect de abajo vuelve a preguntar por la
   * membresía.
   */
  const comprar = async () => {
    setComprando(true);
    try {
      const { pay_url } = await clientesApi.checkout();
      window.location.href = pay_url;
    } catch (e) {
      setComprando(false);
      alert(e instanceof Error ? e.message : 'No se pudo iniciar el pago. Intente de nuevo.');
    }
  };

  const pagado = data?.membresia?.paquete_pagada ?? membresia?.paquete_pagada ?? false;

  // Al volver del checkout, WooCommerce devuelve con ?pago=ok — pero la membresía
  // todavía puede figurar impaga: quien la marca es n8n, unos segundos después de
  // que Woo cobra. Sin esto el comprador vuelve y ve TODO bloqueado justo después
  // de pagar, que es el peor momento posible para desconfiar.
  //
  // Se pregunta varias veces y se corta al confirmar. Fuera de ese regreso no se
  // consulta nada: no tiene sentido sondear a quien sólo está mirando.
  const volviendoDePagar =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pago') === 'ok';

  useEffect(() => {
    if (pagado || !volviendoDePagar) return;
    let intentos = 0;
    const id = window.setInterval(() => {
      intentos += 1;
      void refrescar();
      if (intentos >= 6) window.clearInterval(id);   // ~30 s y se deja de insistir
    }, 5000);
    return () => window.clearInterval(id);
  }, [pagado, volviendoDePagar, refrescar]);

  // Los videos de las noches finales (sábado y domingo) son presentaciones
  // distintas de las clasificatorias, así que entran como entradas propias.
  const todos: VideoItem[] = useMemo(
    () => conFinales(data?.videos?.['2026'] ?? []),
    [data],
  );

  const dias = useMemo(() => {
    const s = new Set<string>();
    todos.forEach((v) => { if (v.dia) s.add(v.dia); });
    return [...s].sort((a, b) => dayOrderIndex(a) - dayOrderIndex(b));
  }, [todos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return todos.filter((v) => {
      if (dia && v.dia !== dia) return false;
      if (!q) return true;
      return `${v.agrupacion ?? ''} ${v.nombre_de_la_obra ?? ''} ${v.coreografo ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [todos, busqueda, dia]);

  const porDia = useMemo(() => {
    const mapa = new Map<string, VideoItem[]>();
    filtrados.forEach((v) => {
      const clave = v.dia ?? 'Sin día';
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(v);
    });
    return [...mapa.entries()].sort((a, b) => dayOrderIndex(a[0]) - dayOrderIndex(b[0]));
  }, [filtrados]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-[12px] text-text-45">
        Cargando videos…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-glass-border bg-glass-bg px-4 py-6 text-center text-[13px] text-text-70">
        No se pudieron cargar los videos.
      </div>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl pb-24 pt-4">
      {pagado ? (
        <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-[12px] text-green-300">
          Su membresía está activa: puede ver todos los videos del Festival 2026.
        </div>
      ) : (
        <div className="mb-4 rounded-xl border border-gold/30 bg-gold/6 px-4 py-4">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-text-90">
            <Lock className="h-4 w-4" style={{ color: 'var(--gold)' }} />
            Desbloquee todos los videos del festival
          </h2>
          <p className="mt-1.5 text-[12px] text-text-45">
            Con el Paquete Completo ve las {todos.length} presentaciones del XVIII Festival
            Danzarte 2026. Sin la membresía puede ver una vista previa de cada una.
          </p>
          {hayOferta && (
            <p className="mt-1.5 text-[12px] font-semibold" style={{ color: 'var(--gold)' }}>
              Oferta especial · hasta que termine la premiación
            </p>
          )}
          <button
            type="button"
            onClick={comprar}
            disabled={comprando}
            className="mt-3 inline-flex items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] px-5 py-2.5 text-[12px] font-semibold uppercase tracking-wide text-white shadow-lg transition hover:opacity-95 disabled:opacity-50"
          >
            {comprando ? (
              'Abriendo el pago…'
            ) : (
              <>
                Comprar por{' '}
                {hayOferta && (
                  <s className="mx-1 font-normal opacity-60">Bs {MEMBRESIA_PAQUETE.precioRegular}</s>
                )}
                Bs {precioPaquete}
              </>
            )}
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-45" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busque una agrupación u obra..."
            className="w-full rounded-lg border border-glass-border bg-elev py-2 pl-9 pr-9 text-[13px] text-text-90 placeholder:text-text-45 focus:outline-none focus:border-cyan"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              aria-label="Limpiar búsqueda"
              className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-text-45 hover:text-text-90"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {dias.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDia(null)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
              dia === null ? 'bg-white/10 text-text-90' : 'text-text-45 hover:bg-white/5'
            }`}
          >
            Todos
          </button>
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDia(d === dia ? null : d)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                d === dia ? 'bg-white/10 text-text-90' : 'text-text-45 hover:bg-white/5'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {filtrados.length === 0 ? (
        <EmptyState>No hay videos que coincidan con su búsqueda.</EmptyState>
      ) : (
        <div className="space-y-4">
          {porDia.map(([etiqueta, items]) => (
            <DayGroup
              key={etiqueta}
              label={etiqueta}
              count={`${items.length} video${items.length > 1 ? 's' : ''}`}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((v) => (
                  <VideoCard
                    key={v.id_inscripcion}
                    video={v}
                    locked={v.bloqueado}
                    /* Con el modal abierto las miniaturas dejan de descargar: todo
                       el ancho de banda va al video que se está viendo. */
                    pausado={activo !== null}
                    onClick={() => setActivo(v)}
                  />
                ))}
              </div>
            </DayGroup>
          ))}
        </div>
      )}

      <VideoModal
        video={activo}
        onClose={() => setActivo(null)}
        preview={activo?.bloqueado ?? false}
        unlockPrice={precioPaquete}
        onUnlock={comprar}
        unlocking={comprando}
      />
    </section>
  );
}
