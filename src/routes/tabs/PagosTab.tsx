import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileText, Sparkles, ArrowUpRight } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { PagoModal } from '@/components/cards/PagoModal';
import { webpProxy } from '@/lib/utils/img';
import type { CompromisoDeuda, PagoHistorial, PagoEstado } from '@/types/domain';

/** Formato boliviano sin decimales: 3.335 Bs */
function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Bs';
}

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripciones',
  convenio_entradas: 'Pre-Venta de Entradas',
  credencial: 'Credenciales',
  credencial_unit: 'Credenciales Unitarias',
};

const conceptoAccent: Record<string, { from: string; to: string; tint: string; glow: string }> = {
  inscripcion:       { from: 'var(--cyan)',    to: 'var(--fuchsia)', tint: 'rgba(0,229,255,0.06)',  glow: 'rgba(0,229,255,0.25)' },
  convenio_entradas: { from: 'var(--fuchsia)', to: '#7C3AED',         tint: 'rgba(255,31,168,0.06)', glow: 'rgba(255,31,168,0.25)' },
  credencial:        { from: '#FCD34D',        to: 'var(--cyan)',     tint: 'rgba(252,211,77,0.05)', glow: 'rgba(252,211,77,0.22)' },
  credencial_unit:   { from: '#FCD34D',        to: 'var(--fuchsia)',  tint: 'rgba(252,211,77,0.05)', glow: 'rgba(252,211,77,0.22)' },
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

  const totalPagado = totales.pagado_verificado + totales.pagado_pendiente;
  const progresoTotal =
    totales.total_deuda > 0 ? Math.min(100, (totalPagado / totales.total_deuda) * 100) : 0;

  const logoUrl = enlace_del_logo ? webpProxy(enlace_del_logo, 96) : null;

  return (
    <>
      <div className="space-y-6 px-3 py-4 sm:px-6 sm:py-6">
        {/* HERO — Saldo principal estilo Revolut */}
        <section
          className="relative overflow-hidden rounded-3xl border border-white/[0.06] p-5 sm:p-6"
          style={{
            background:
              'radial-gradient(125% 90% at 100% 0%, rgba(255,31,168,0.14) 0%, rgba(255,31,168,0) 55%), radial-gradient(110% 75% at 0% 100%, rgba(0,229,255,0.13) 0%, rgba(0,229,255,0) 60%), linear-gradient(180deg, rgba(255,255,255,0.02), transparent), var(--bg-elevated)',
            boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -20px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[9.5px] font-bold uppercase text-text-45"
              style={{ letterSpacing: '1.6px' }}
            >
              Saldo pendiente
            </span>
            {totales.saldo <= 0 && totales.total_deuda > 0 && (
              <span
                className="flex items-center gap-1 rounded-full border border-green/40 bg-green/10 px-2.5 py-1 text-[9px] font-bold uppercase text-green"
                style={{ letterSpacing: '0.8px' }}
              >
                <Sparkles className="h-3 w-3" />
                Al día
              </span>
            )}
          </div>

          {/* MONTO HERO — peso fuerte tipo Revolut */}
          <div
            className="mt-2 bg-clip-text font-display text-[40px] font-bold leading-none text-transparent tabular-nums sm:text-[52px]"
            style={{
              backgroundImage:
                totales.saldo > 0
                  ? 'linear-gradient(135deg, #00E5FF 0%, #FF1FA8 100%)'
                  : 'linear-gradient(135deg, var(--green), var(--cyan))',
              letterSpacing: '-0.035em',
              textShadow: '0 0 80px rgba(255,31,168,0.15)',
            }}
          >
            {bs(totales.saldo)}
          </div>

          {/* Mini stats row */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <MiniStat label="Deuda" value={bs(totales.total_deuda)} tone="default" />
            <MiniStat label="Pagado" value={bs(totales.pagado_verificado)} tone="green" />
            <MiniStat
              label="Pendiente"
              value={bs(totales.pagado_pendiente)}
              tone={totales.pagado_pendiente > 0 ? 'cyan' : 'default'}
            />
          </div>

          {totales.total_deuda > 0 && (
            <div className="mt-4">
              <div
                className="relative h-[5px] overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.045)' }}
              >
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progresoTotal}%`,
                    background: 'linear-gradient(90deg, #00E5FF, #FF1FA8)',
                    boxShadow: '0 0 12px rgba(0,229,255,0.5)',
                  }}
                />
              </div>
              <div
                className="mt-2 flex justify-between text-[9.5px] font-semibold uppercase text-text-45"
                style={{ letterSpacing: '0.6px' }}
              >
                <span>{Math.round(progresoTotal)}% pagado</span>
                <span className="tabular-nums">
                  {bs(totales.total_deuda - totalPagado)} restantes
                </span>
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
                  className="text-[10px] font-bold uppercase text-text-90"
                  style={{ letterSpacing: '1.6px' }}
                >
                  {conceptoLabel[concepto] ?? concepto}
                </h3>
                <span className="text-[10px] font-semibold text-text-45 tabular-nums">{items.length}</span>
              </header>
              <div className="space-y-2.5">
                {items.map((c) => (
                  <CompromisoCard
                    key={c.id_referencia}
                    c={c}
                    logoUrl={logoUrl}
                    nombreAgrupacion={nombre_agrupacion}
                    onPagar={() => setPagoTarget(c)}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {/* HISTORIAL */}
        {historial.length > 0 && (
          <section>
            <header className="mb-3 flex items-baseline justify-between px-1">
              <h3
                className="text-[10px] font-bold uppercase text-text-90"
                style={{ letterSpacing: '1.6px' }}
              >
                Historial
              </h3>
              <span className="text-[10px] font-semibold text-text-45 tabular-nums">{historial.length}</span>
            </header>
            <div
              className="overflow-hidden rounded-2xl border border-white/[0.05]"
              style={{
                background: 'rgba(255,255,255,0.015)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <div className="divide-y divide-white/[0.04]">
                {historial.map((p) => <HistorialRow key={p.id_pago} p={p} />)}
              </div>
            </div>
          </section>
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

/** Stat compacto dentro del hero */
function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'green' | 'cyan' | 'fuchsia';
}) {
  const toneColor: Record<typeof tone, string> = {
    default: 'var(--text-white)',
    green: 'var(--green)',
    cyan: 'var(--cyan)',
    fuchsia: 'var(--fuchsia)',
  };
  return (
    <div
      className="rounded-xl border border-white/[0.04] px-2.5 py-2"
      style={{ background: 'rgba(0,0,0,0.25)' }}
    >
      <div
        className="text-[8.5px] font-bold uppercase text-text-45"
        style={{ letterSpacing: '0.9px' }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[13px] font-bold leading-none tabular-nums sm:text-[14px]"
        style={{ color: toneColor[tone], letterSpacing: '-0.015em' }}
      >
        {value}
      </div>
    </div>
  );
}

/** Card de compromiso — Revolut-meets-Linear style */
function CompromisoCard({
  c,
  logoUrl,
  nombreAgrupacion,
  onPagar,
}: {
  c: CompromisoDeuda;
  logoUrl: string | null;
  nombreAgrupacion: string;
  onPagar: () => void;
}) {
  const isPaid = c.saldo <= 0.01;
  const accent = conceptoAccent[c.concepto] ?? conceptoAccent.inscripcion;
  const pct = c.monto_total > 0 ? Math.min(100, ((c.monto_total - c.saldo) / c.monto_total) * 100) : 0;
  const initial = (nombreAgrupacion || '?').charAt(0).toUpperCase();

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-white/[0.05] transition-all duration-300 hover:-translate-y-[1px] hover:border-white/[0.10]"
      style={{
        background: `linear-gradient(135deg, ${accent.tint} 0%, transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.015), transparent), var(--bg-elevated)`,
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.5)',
      }}
    >
      {/* Accent stripe — ticket stub */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: `linear-gradient(180deg, ${accent.from}, ${accent.to})`,
          boxShadow: `0 0 14px ${accent.glow}`,
        }}
      />

      <div className="py-4 pl-4 pr-3.5">
        {/* HEADER: logo + nombre obra + chips + botón */}
        <div className="flex items-start gap-3">
          {/* Logo agrupación */}
          <div
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/[0.08]"
            style={{
              background: `linear-gradient(135deg, ${accent.from}30, ${accent.to}20), var(--bg-card)`,
            }}
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
                className="grid h-full w-full place-items-center font-display text-[14px] font-bold"
                style={{ color: accent.from }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-[13.5px] font-semibold leading-tight text-text-white"
              style={{ letterSpacing: '-0.015em' }}
            >
              {c.descripcion}
            </h4>
            {(c.subdivision || c.bailarines != null) && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {c.subdivision && (
                  <span
                    className="rounded-md border border-white/[0.05] px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-65"
                    style={{ background: 'rgba(255,255,255,0.025)', letterSpacing: '0.6px' }}
                  >
                    {c.subdivision}
                  </span>
                )}
                {c.bailarines != null && (
                  <span className="text-[10px] font-medium text-text-45 tabular-nums">
                    {c.bailarines} {c.concepto === 'credencial' ? 'unid.' : 'bail.'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action */}
          {isPaid ? (
            <div
              className="flex shrink-0 items-center gap-1 rounded-full border border-green/40 px-2.5 py-1.5 text-[9px] font-bold uppercase text-green"
              style={{ background: 'rgba(16,185,129,0.10)', letterSpacing: '0.8px' }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Pagado
            </div>
          ) : (
            <button
              type="button"
              onClick={onPagar}
              className="group/btn relative shrink-0 overflow-hidden rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#04020F] transition-all active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                boxShadow: `0 4px 18px ${accent.glow}, 0 0 0 1px ${accent.from}40 inset, 0 1px 0 0 rgba(255,255,255,0.25) inset`,
                letterSpacing: '0.9px',
              }}
            >
              <span className="relative z-10 flex items-center gap-1">
                Pagar
                <ArrowUpRight className="h-3 w-3" strokeWidth={3} />
              </span>
              <span
                className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover/btn:opacity-100"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), transparent)' }}
              />
            </button>
          )}
        </div>

        {/* MONTOS — Total + Saldo destacado */}
        <div className="mt-3.5 flex items-end justify-between">
          <div>
            <div
              className="text-[9px] font-bold uppercase text-text-45"
              style={{ letterSpacing: '0.9px' }}
            >
              Total
            </div>
            <div className="mt-0.5 text-[14px] font-semibold leading-none text-text-90 tabular-nums">
              {bs(c.monto_total)}
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[9px] font-bold uppercase text-text-45"
              style={{ letterSpacing: '0.9px' }}
            >
              Saldo
            </div>
            <div
              className="mt-0.5 font-bold leading-none tabular-nums"
              style={{
                fontSize: '20px',
                color: isPaid ? 'var(--green)' : 'var(--text-white)',
                letterSpacing: '-0.025em',
                textShadow: isPaid ? 'none' : `0 0 20px ${accent.glow}`,
              }}
            >
              {bs(c.saldo)}
            </div>
          </div>
        </div>

        {/* Progreso */}
        {!isPaid && (
          <div className="mt-3">
            <div
              className="relative h-[4px] overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.035)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                  boxShadow: `0 0 10px ${accent.glow}`,
                }}
              />
            </div>
            {(c.pagado_verificado > 0 || c.pagado_pendiente > 0) && (
              <div className="mt-1.5 flex justify-between text-[9.5px] font-semibold tabular-nums">
                {c.pagado_verificado > 0 ? (
                  <span className="text-green">✓ {bs(c.pagado_verificado)} verificado</span>
                ) : <span />}
                {c.pagado_pendiente > 0 && (
                  <span className="text-cyan">⏳ {bs(c.pagado_pendiente)} pendiente</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fila de historial — compacta */
const estadoConfig: Record<PagoEstado, { dot: string; label: string; text: string }> = {
  verificado: { dot: 'var(--green)',    label: 'Verificado',  text: 'var(--green)' },
  enviado:    { dot: 'var(--cyan)',     label: 'En revisión', text: 'var(--cyan)' },
  pendiente:  { dot: 'var(--text-45)',  label: 'Pendiente',   text: 'var(--text-45)' },
  rechazado:  { dot: '#ef4444',         label: 'Rechazado',   text: '#ef4444' },
  anulado:    { dot: '#ef4444',         label: 'Anulado',     text: '#ef4444' },
};

function HistorialRow({ p }: { p: PagoHistorial }) {
  const e = estadoConfig[p.estado] ?? estadoConfig.pendiente;
  const Icon =
    p.estado === 'verificado' ? CheckCircle2
    : p.estado === 'rechazado' || p.estado === 'anulado' ? AlertCircle
    : Clock;

  return (
    <div className="flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-white/[0.018]">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: `${e.dot}18`, color: e.text }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-semibold text-text-white">
            {conceptoLabel[p.concepto]?.replace('Inscripciones', 'Inscripción') ?? p.concepto}
          </span>
          <span className="shrink-0 text-[14px] font-bold leading-none tabular-nums text-text-white" style={{ letterSpacing: '-0.015em' }}>
            {bs(p.monto)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-medium text-text-45">
          <div className="flex items-center gap-1.5 truncate">
            <span>{p.fecha}</span>
            {p.hora && <span>· {p.hora.slice(0, 5)}</span>}
            <span>·</span>
            <span className="truncate">{p.metodo_pago}</span>
          </div>
          <span
            className="shrink-0 text-[9px] font-bold uppercase"
            style={{ color: e.text, letterSpacing: '0.6px' }}
          >
            {e.label}
          </span>
        </div>
      </div>
      {p.comprobante_url && (
        <a
          href={p.comprobante_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver comprobante"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-text-45 transition hover:bg-white/[0.05] hover:text-cyan"
        >
          <FileText className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
