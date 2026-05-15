import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileText, ChevronDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { PagoModal } from '@/components/cards/PagoModal';
import { webpProxy } from '@/lib/utils/img';
import type { CompromisoDeuda, PagoHistorial, PagoEstado } from '@/types/domain';

/** Formato boliviano sin decimales: 3.080 Bs */
function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Bs';
}

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripciones',
  convenio_entradas: 'Pre-Venta de Entradas',
  credencial: 'Credenciales',
  credencial_unit: 'Credenciales Unitarias',
};

const conceptoAccent: Record<string, { from: string; to: string }> = {
  inscripcion:       { from: '#00E5FF', to: '#FF1FA8' },
  convenio_entradas: { from: '#FF1FA8', to: '#7C3AED' },
  credencial:        { from: '#FCD34D', to: '#00E5FF' },
  credencial_unit:   { from: '#FCD34D', to: '#FF1FA8' },
};

export function PagosTab() {
  const qc = useQueryClient();
  const [pagoTarget, setPagoTarget] = useState<CompromisoDeuda | null>(null);

  const q = useQuery({
    queryKey: ['pagos-resumen'],
    queryFn: () => pagosApi.resumen(),
  });

  if (q.isLoading) return <div className="p-4"><LoadingSkeleton rows={4} /></div>;
  if (q.error) {
    return (
      <div className="p-4">
        <EmptyState>Error al cargar pagos. {(q.error as Error).message}</EmptyState>
      </div>
    );
  }
  if (!q.data) return null;

  const { compromisos, historial, totales, metodos_pago, enlace_del_logo, nombre_agrupacion } = q.data;

  const porConcepto: Record<string, CompromisoDeuda[]> = {};
  for (const c of compromisos) (porConcepto[c.concepto] ??= []).push(c);

  // Mapa: (concepto + id_ref) → pagos parciales de ese compromiso
  const pagosByCompromiso: Record<string, PagoHistorial[]> = {};
  for (const p of historial) {
    const k = `${p.concepto}::${p.id_referencia}`;
    (pagosByCompromiso[k] ??= []).push(p);
  }

  const totalPagado = totales.pagado_verificado + totales.pagado_pendiente;
  const progresoTotal =
    totales.total_deuda > 0 ? Math.min(100, (totalPagado / totales.total_deuda) * 100) : 0;

  const logoUrl = enlace_del_logo ? webpProxy(enlace_del_logo, 96) : null;

  return (
    <>
      <div className="space-y-6 px-3 py-5 sm:px-6 sm:py-6">
        {/* HERO — Editorial Glass */}
        <section
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-5"
          style={{
            background:
              'radial-gradient(120% 80% at 100% 0%, rgba(255,31,168,0.08) 0%, transparent 55%), radial-gradient(100% 70% at 0% 100%, rgba(0,229,255,0.07) 0%, transparent 60%), rgba(255,255,255,0.02)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-medium uppercase text-text-45"
              style={{ letterSpacing: '1.4px' }}
            >
              Saldo pendiente
            </span>
            {totales.saldo <= 0 && totales.total_deuda > 0 && (
              <span
                className="flex items-center gap-1 rounded-full border border-green/40 bg-green/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-green"
                style={{ letterSpacing: '0.8px' }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                Al día
              </span>
            )}
          </div>

          {/* MONTO — proporcionado, no gigante */}
          <div
            className="mt-1 font-display tabular-nums"
            style={{
              fontSize: '32px',
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.1,
              color: totales.saldo > 0 ? 'var(--text-white)' : 'var(--green)',
            }}
          >
            {bs(totales.saldo)}
          </div>

          {/* Stats inline horizontal */}
          <div className="mt-4 flex items-center divide-x divide-white/[0.06] text-[11px]">
            <div className="pr-3">
              <div className="text-text-45" style={{ letterSpacing: '0.3px' }}>Deuda</div>
              <div className="mt-0.5 font-semibold text-text-90 tabular-nums">{bs(totales.total_deuda)}</div>
            </div>
            <div className="px-3">
              <div className="text-text-45">Pagado</div>
              <div className="mt-0.5 font-semibold text-green tabular-nums">{bs(totales.pagado_verificado)}</div>
            </div>
            <div className="pl-3">
              <div className="text-text-45">Pendiente</div>
              <div
                className="mt-0.5 font-semibold tabular-nums"
                style={{ color: totales.pagado_pendiente > 0 ? 'var(--cyan)' : 'var(--text-90)' }}
              >
                {bs(totales.pagado_pendiente)}
              </div>
            </div>
          </div>

          {totales.total_deuda > 0 && (
            <div className="mt-4">
              <div
                className="relative h-1 overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                  style={{
                    width: `${progresoTotal}%`,
                    background: 'linear-gradient(90deg, #00E5FF, #FF1FA8)',
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[9.5px] uppercase text-text-45" style={{ letterSpacing: '0.6px' }}>
                <span>{Math.round(progresoTotal)}% pagado</span>
                <span className="tabular-nums">{bs(totales.total_deuda - totalPagado)} restantes</span>
              </div>
            </div>
          )}
        </section>

        {/* COMPROMISOS */}
        {compromisos.length === 0 ? (
          <EmptyState>No tiene compromisos de pago para 2026.</EmptyState>
        ) : (
          Object.entries(porConcepto).map(([concepto, items]) => (
            <section key={concepto}>
              <header className="mb-3 flex items-baseline justify-between px-1">
                <h3
                  className="text-[10px] font-semibold uppercase text-text-65"
                  style={{ letterSpacing: '1.6px' }}
                >
                  {conceptoLabel[concepto] ?? concepto}
                </h3>
                <span className="text-[10px] text-text-45 tabular-nums">{items.length}</span>
              </header>
              <div className="space-y-2">
                {items.map((c) => (
                  <CompromisoCard
                    key={c.id_referencia}
                    c={c}
                    logoUrl={logoUrl}
                    nombreAgrupacion={nombre_agrupacion}
                    pagosParciales={pagosByCompromiso[`${c.concepto}::${c.id_referencia}`] ?? []}
                    onPagar={() => setPagoTarget(c)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {historial.length === 0 && compromisos.length > 0 && (
          <p className="px-2 text-center text-[11px] text-text-45">
            Aún no hay pagos registrados.
          </p>
        )}
      </div>

      <PagoModal
        compromiso={pagoTarget}
        metodos={metodos_pago}
        onClose={() => setPagoTarget(null)}
        onSaved={() => {
          setPagoTarget(null);
          qc.invalidateQueries({ queryKey: ['pagos-resumen'] });
        }}
      />
    </>
  );
}

/** Card de compromiso — Editorial Glass */
function CompromisoCard({
  c,
  logoUrl,
  nombreAgrupacion,
  pagosParciales,
  onPagar,
}: {
  c: CompromisoDeuda;
  logoUrl: string | null;
  nombreAgrupacion: string;
  pagosParciales: PagoHistorial[];
  onPagar: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPaid = c.saldo <= 0.01;
  const accent = conceptoAccent[c.concepto] ?? conceptoAccent.inscripcion;
  const pct = c.monto_total > 0 ? Math.min(100, ((c.monto_total - c.saldo) / c.monto_total) * 100) : 0;
  const initial = (nombreAgrupacion || '?').charAt(0).toUpperCase();

  const pagosSorted = useMemo(
    () => [...pagosParciales].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    [pagosParciales],
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/[0.06] transition-colors hover:border-white/[0.10]"
      style={{
        background: 'rgba(255,255,255,0.025)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="px-4 py-4">
        {/* HEADER: logo + título + chips */}
        <div className="flex items-start gap-3">
          <div
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/[0.08]"
            style={{ background: 'var(--bg-card)' }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={nombreAgrupacion}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="grid h-full w-full place-items-center font-display text-[13px] font-semibold"
                style={{ color: accent.from }}
              >
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-[13.5px] font-medium leading-tight text-text-white"
              style={{ letterSpacing: '-0.01em' }}
            >
              {c.descripcion}
            </h4>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-45">
              {c.subdivision && (
                <>
                  <span className="font-medium uppercase" style={{ letterSpacing: '0.5px' }}>{c.subdivision}</span>
                  {c.bailarines != null && <span className="text-text-25">·</span>}
                </>
              )}
              {c.bailarines != null && (
                <span className="tabular-nums">
                  {c.bailarines} {c.concepto === 'credencial' ? 'unid.' : 'bail.'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MONTOS — Total + Saldo grandes + botón */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-end gap-5">
            <div>
              <div
                className="text-[9px] font-medium uppercase text-text-45"
                style={{ letterSpacing: '0.8px' }}
              >
                Total
              </div>
              <div className="mt-0.5 text-[15px] font-medium leading-none text-text-90 tabular-nums">
                {bs(c.monto_total)}
              </div>
            </div>
            <div>
              <div
                className="text-[9px] font-medium uppercase text-text-45"
                style={{ letterSpacing: '0.8px' }}
              >
                Saldo
              </div>
              <div
                className="mt-0.5 leading-none tabular-nums"
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: isPaid ? 'var(--green)' : 'var(--text-white)',
                  letterSpacing: '-0.02em',
                }}
              >
                {bs(c.saldo)}
              </div>
            </div>
          </div>

          {isPaid ? (
            <div
              className="flex shrink-0 items-center gap-1 rounded-full border border-green/40 px-2.5 py-1.5 text-[9px] font-semibold uppercase text-green"
              style={{ background: 'rgba(16,185,129,0.10)', letterSpacing: '0.8px' }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Pagado
            </div>
          ) : (
            <button
              type="button"
              onClick={onPagar}
              className="group/btn relative shrink-0 overflow-hidden rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase text-white transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                boxShadow: `0 4px 16px ${accent.from}40, 0 0 0 1px rgba(255,255,255,0.12) inset`,
                letterSpacing: '0.9px',
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              <span className="relative z-10 flex items-center gap-1">
                Pagar
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </button>
          )}
        </div>

        {/* Progreso fino */}
        {!isPaid && c.monto_total > 0 && (
          <div className="mt-3">
            <div
              className="relative h-[3px] overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                }}
              />
            </div>
          </div>
        )}

        {/* Toggle pagos parciales */}
        {pagosSorted.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[10.5px] font-medium text-text-65 transition hover:bg-white/[0.025] hover:text-text-90"
            aria-expanded={expanded}
          >
            <span>
              {pagosSorted.length} {pagosSorted.length === 1 ? 'pago parcial' : 'pagos parciales'}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Drawer pagos parciales */}
      {expanded && pagosSorted.length > 0 && (
        <div
          className="border-t border-white/[0.04] divide-y divide-white/[0.03]"
          style={{ background: 'rgba(0,0,0,0.15)' }}
        >
          {pagosSorted.map((p) => (
            <PagoParcialRow key={p.id_pago} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

const estadoConfig: Record<PagoEstado, { dot: string; label: string }> = {
  verificado: { dot: 'var(--green)',    label: 'Verificado'  },
  enviado:    { dot: 'var(--cyan)',     label: 'En revisión' },
  pendiente:  { dot: 'var(--text-45)',  label: 'Pendiente'   },
  rechazado:  { dot: '#ef4444',         label: 'Rechazado'   },
  anulado:    { dot: '#ef4444',         label: 'Anulado'     },
};

function PagoParcialRow({ p }: { p: PagoHistorial }) {
  const e = estadoConfig[p.estado] ?? estadoConfig.pendiente;
  const Icon =
    p.estado === 'verificado' ? CheckCircle2
    : p.estado === 'rechazado' || p.estado === 'anulado' ? AlertCircle
    : Clock;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.018]">
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
        style={{ background: `${e.dot}18`, color: e.dot }}
      >
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11.5px] font-medium tabular-nums text-text-90">{bs(p.monto)}</span>
          <span
            className="text-[9px] font-semibold uppercase tabular-nums"
            style={{ color: e.dot, letterSpacing: '0.5px' }}
          >
            {e.label}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[9.5px] text-text-45">
          <span>{p.fecha}</span>
          {p.hora && <span>· {p.hora.slice(0, 5)}</span>}
          <span>·</span>
          <span className="truncate">{p.metodo_pago}</span>
        </div>
      </div>
      {p.comprobante_url && (
        <a
          href={p.comprobante_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver comprobante"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-45 transition hover:bg-white/[0.04] hover:text-cyan"
        >
          <FileText className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}
