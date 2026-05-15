import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileText, ChevronDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { PagoModal } from '@/components/cards/PagoModal';
import { webpProxy } from '@/lib/utils/img';
import type { CompromisoDeuda, PagoHistorial, PagoEstado } from '@/types/domain';

/** Format estilo Wise/Mercury: 3.080 Bs */
function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Bs';
}

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripciones',
  convenio_entradas: 'Pre-Venta de Entradas',
  credencial: 'Credenciales',
  credencial_unit: 'Credenciales Unitarias',
};

/** Solid colors flat — sin gradients, estilo Cash App / Wise.
 * Pensados con contraste blanco sobre cada color (WCAG AA o cercano).
 */
const conceptoColor: Record<string, string> = {
  inscripcion:       '#0891B2', // cyan oscuro (contraste blanco AA)
  convenio_entradas: '#BE185D', // fuchsia oscuro (contraste blanco AA)
  credencial:        '#D97706', // amber/oro oscuro (contraste blanco AA)
  credencial_unit:   '#D97706',
};

/** Variantes claras (para acentos como progress bar + icons) */
const conceptoColorLight: Record<string, string> = {
  inscripcion:       '#00E5FF',
  convenio_entradas: '#FF1FA8',
  credencial:        '#FCD34D',
  credencial_unit:   '#FCD34D',
};

/** Family de fuentes:
 * - font-display: Inter Tight (headlines + montos hero) — tighter geometric
 * - font-sans: Inter (body)
 * - font-mono: JetBrains Mono (números tabulares)
 */
const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

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
      <div className="space-y-7 px-3 py-5 sm:px-6 sm:py-6">
        {/* HERO — Wise × Mercury style */}
        <section
          className="relative overflow-hidden rounded-2xl border border-white/[0.06]"
          style={{
            background: '#0c0a1e',
          }}
        >
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase text-text-45"
                style={{ letterSpacing: '1.5px', fontFamily: FONT_DISPLAY }}
              >
                Saldo pendiente
              </span>
              {totales.saldo <= 0 && totales.total_deuda > 0 && (
                <span
                  className="flex items-center gap-1 rounded-full border border-green/40 px-2 py-0.5 text-[9px] font-semibold uppercase text-green"
                  style={{ background: 'rgba(16,185,129,0.10)', letterSpacing: '0.8px' }}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  Al día
                </span>
              )}
            </div>

            {/* Saldo número — Inter Tight, peso 500, proporcionado */}
            <div
              className="mt-2 text-white tabular-nums"
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: '38px',
                fontWeight: 500,
                letterSpacing: '-0.035em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {bs(totales.saldo)}
            </div>

            {/* Stats horizontal — Wise style con divisores verticales */}
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.06]">
              <StatColumn label="Deuda" value={bs(totales.total_deuda)} />
              <StatColumn label="Pagado" value={bs(totales.pagado_verificado)} accent="var(--green)" />
              <StatColumn
                label="Pendiente"
                value={bs(totales.pagado_pendiente)}
                accent={totales.pagado_pendiente > 0 ? 'var(--cyan)' : undefined}
              />
            </div>

            {totales.total_deuda > 0 && (
              <div className="mt-5">
                {/* Barra SÓLIDA cyan — sin gradient */}
                <div
                  className="relative h-1 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{
                      width: `${progresoTotal}%`,
                      background: '#00E5FF',
                    }}
                  />
                </div>
                <div
                  className="mt-2 flex justify-between text-[10px] font-medium text-text-45 tabular-nums"
                  style={{ fontFamily: FONT_MONO }}
                >
                  <span>{Math.round(progresoTotal)}% pagado</span>
                  <span>{bs(totales.total_deuda - totalPagado)} restantes</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* COMPROMISOS */}
        {compromisos.length === 0 ? (
          <EmptyState>No tiene compromisos de pago para 2026.</EmptyState>
        ) : (
          Object.entries(porConcepto).map(([concepto, items]) => (
            <section key={concepto}>
              <header className="mb-3 flex items-baseline justify-between px-1">
                <h3
                  className="text-[10px] font-bold uppercase text-text-65"
                  style={{ letterSpacing: '1.8px', fontFamily: FONT_DISPLAY }}
                >
                  {conceptoLabel[concepto] ?? concepto}
                </h3>
                <span
                  className="text-[10px] font-medium text-text-45 tabular-nums"
                  style={{ fontFamily: FONT_MONO }}
                >
                  {items.length}
                </span>
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

function StatColumn({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <div
        className="text-[9px] font-semibold uppercase text-text-45"
        style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[13px] leading-none tabular-nums"
        style={{
          fontFamily: FONT_DISPLAY,
          fontWeight: 600,
          color: accent ?? 'var(--text-white)',
          letterSpacing: '-0.015em',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Card — Mercury + Cash App style, sin gradients */
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
  const color = conceptoColor[c.concepto] ?? '#0891B2';
  const colorLight = conceptoColorLight[c.concepto] ?? '#00E5FF';
  const pct = c.monto_total > 0 ? Math.min(100, ((c.monto_total - c.saldo) / c.monto_total) * 100) : 0;
  const initial = (nombreAgrupacion || '?').charAt(0).toUpperCase();

  const pagosSorted = useMemo(
    () => [...pagosParciales].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    [pagosParciales],
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/[0.06] transition-colors hover:border-white/[0.10]"
      style={{ background: '#0c0a1e' }}
    >
      <div className="px-4 py-4">
        {/* HEADER */}
        <div className="flex items-start gap-3">
          <div
            className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/[0.08]"
            style={{ background: '#171429' }}
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
                className="grid h-full w-full place-items-center text-[13px] font-semibold"
                style={{ color: colorLight, fontFamily: FONT_DISPLAY }}
              >
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-[13.5px] font-semibold leading-tight text-text-white"
              style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.015em' }}
            >
              {c.descripcion}
            </h4>
            <div
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-45"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              {c.subdivision && (
                <>
                  <span className="font-semibold uppercase" style={{ letterSpacing: '0.6px' }}>
                    {c.subdivision}
                  </span>
                  {c.bailarines != null && <span className="text-text-25">·</span>}
                </>
              )}
              {c.bailarines != null && (
                <span className="tabular-nums" style={{ fontFamily: FONT_MONO }}>
                  {c.bailarines} {c.concepto === 'credencial' ? 'unid.' : 'bail.'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MONTOS + botón */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="flex items-end gap-6">
            <div>
              <div
                className="text-[9px] font-semibold uppercase text-text-45"
                style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}
              >
                Total
              </div>
              <div
                className="mt-1 text-[14px] leading-none text-text-90 tabular-nums"
                style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, letterSpacing: '-0.015em' }}
              >
                {bs(c.monto_total)}
              </div>
            </div>
            <div>
              <div
                className="text-[9px] font-semibold uppercase text-text-45"
                style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}
              >
                Saldo
              </div>
              <div
                className="mt-1 leading-none tabular-nums"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: '20px',
                  fontWeight: 600,
                  color: isPaid ? 'var(--green)' : 'var(--text-white)',
                  letterSpacing: '-0.025em',
                }}
              >
                {bs(c.saldo)}
              </div>
            </div>
          </div>

          {isPaid ? (
            <div
              className="flex shrink-0 items-center gap-1 rounded-full border border-green/40 px-2.5 py-1.5 text-[9px] font-bold uppercase text-green"
              style={{ background: 'rgba(16,185,129,0.10)', letterSpacing: '0.8px', fontFamily: FONT_DISPLAY }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Pagado
            </div>
          ) : (
            <button
              type="button"
              onClick={onPagar}
              className="group/btn shrink-0 rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase transition-all active:scale-[0.97]"
              style={{
                background: color,
                color: '#FFFFFF',
                letterSpacing: '1px',
                fontFamily: FONT_DISPLAY,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.18) inset, 0 1px 0 0 rgba(255,255,255,0.22) inset, 0 4px 12px rgba(0,0,0,0.35)`,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              <span className="flex items-center gap-1">
                Pagar
                <ArrowUpRight className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </button>
          )}
        </div>

        {/* Progreso SÓLIDO color concepto — sin gradient */}
        {!isPaid && c.monto_total > 0 && (
          <div className="mt-3">
            <div
              className="relative h-[3px] overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: colorLight }}
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
            style={{ fontFamily: FONT_DISPLAY }}
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
          style={{ background: '#080614' }}
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
          <span
            className="text-[12.5px] font-semibold tabular-nums text-text-white"
            style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.015em' }}
          >
            {bs(p.monto)}
          </span>
          <span
            className="text-[9px] font-bold uppercase tabular-nums"
            style={{ color: e.dot, letterSpacing: '0.6px', fontFamily: FONT_DISPLAY }}
          >
            {e.label}
          </span>
        </div>
        <div
          className="mt-0.5 flex items-center gap-1.5 text-[9.5px] text-text-45 tabular-nums"
          style={{ fontFamily: FONT_MONO }}
        >
          <span>{p.fecha}</span>
          {p.hora && <span>· {p.hora.slice(0, 5)}</span>}
          <span>·</span>
          <span className="truncate" style={{ fontFamily: FONT_DISPLAY }}>{p.metodo_pago}</span>
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
