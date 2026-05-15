import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileText, Sparkles } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { PagoModal } from '@/components/cards/PagoModal';
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

const conceptoAccent: Record<string, { from: string; to: string; tint: string }> = {
  inscripcion:       { from: 'var(--cyan)',    to: 'var(--fuchsia)', tint: 'rgba(0,229,255,0.05)' },
  convenio_entradas: { from: 'var(--fuchsia)', to: '#7C3AED',         tint: 'rgba(255,31,168,0.05)' },
  credencial:        { from: '#FCD34D',        to: 'var(--cyan)',     tint: 'rgba(252,211,77,0.04)' },
  credencial_unit:   { from: '#FCD34D',        to: 'var(--fuchsia)',  tint: 'rgba(252,211,77,0.04)' },
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

  const { compromisos, historial, totales, metodos_pago } = q.data;

  const porConcepto: Record<string, CompromisoDeuda[]> = {};
  for (const c of compromisos) (porConcepto[c.concepto] ??= []).push(c);

  const progresoTotal =
    totales.total_deuda > 0
      ? Math.min(100, ((totales.pagado_verificado + totales.pagado_pendiente) / totales.total_deuda) * 100)
      : 0;

  return (
    <>
      <div className="space-y-5 p-3 sm:p-6">
        {/* HERO — Saldo principal */}
        <section
          className="relative overflow-hidden rounded-2xl border border-glass-border p-4 sm:p-5"
          style={{
            background:
              'radial-gradient(120% 100% at 100% 0%, rgba(255,31,168,0.10) 0%, rgba(255,31,168,0) 50%), radial-gradient(100% 80% at 0% 100%, rgba(0,229,255,0.10) 0%, rgba(0,229,255,0) 55%), var(--bg-elevated)',
          }}
        >
          <div className="flex items-baseline justify-between">
            <span
              className="text-[9px] font-semibold uppercase text-text-45"
              style={{ letterSpacing: '1.2px' }}
            >
              Saldo pendiente
            </span>
            {totales.saldo <= 0 && totales.total_deuda > 0 && (
              <span
                className="flex items-center gap-1 rounded-full border border-green/40 bg-green/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-green"
                style={{ letterSpacing: '0.6px' }}
              >
                <Sparkles className="h-2.5 w-2.5" />
                Todo pagado
              </span>
            )}
          </div>
          <div
            className="mt-1 bg-clip-text font-display text-3xl font-light text-transparent tabular-nums sm:text-4xl"
            style={{
              backgroundImage:
                totales.saldo > 0
                  ? 'linear-gradient(135deg, var(--cyan), var(--fuchsia))'
                  : 'linear-gradient(135deg, var(--green), var(--cyan))',
              letterSpacing: '-0.03em',
            }}
          >
            {bs(totales.saldo)}
          </div>

          {/* Mini stats row */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Deuda total" value={bs(totales.total_deuda)} tone="default" />
            <MiniStat label="Pagado" value={bs(totales.pagado_verificado)} tone="green" />
            <MiniStat
              label="Pendiente"
              value={bs(totales.pagado_pendiente)}
              tone={totales.pagado_pendiente > 0 ? 'cyan' : 'default'}
            />
          </div>

          {totales.total_deuda > 0 && (
            <div className="mt-3">
              <div className="relative h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-500"
                  style={{
                    width: `${progresoTotal}%`,
                    background: 'linear-gradient(90deg, var(--cyan), var(--fuchsia))',
                  }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[9px] uppercase text-text-45" style={{ letterSpacing: '0.5px' }}>
                <span>{Math.round(progresoTotal)}% cubierto</span>
                <span className="tabular-nums">{bs(totales.total_deuda - totales.pagado_verificado - totales.pagado_pendiente)} restantes</span>
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
              <header className="mb-2 flex items-baseline justify-between px-1">
                <h3
                  className="text-[10px] font-semibold uppercase text-text-90"
                  style={{ letterSpacing: '1.4px' }}
                >
                  {conceptoLabel[concepto] ?? concepto}
                </h3>
                <span className="text-[10px] text-text-45 tabular-nums">{items.length}</span>
              </header>
              <div className="space-y-2">
                {items.map((c) => (
                  <CompromisoCard key={c.id_referencia} c={c} onPagar={() => setPagoTarget(c)} />
                ))}
              </div>
            </section>
          ))
        )}

        {/* HISTORIAL */}
        {historial.length > 0 && (
          <section>
            <header className="mb-2 flex items-baseline justify-between px-1">
              <h3
                className="text-[10px] font-semibold uppercase text-text-90"
                style={{ letterSpacing: '1.4px' }}
              >
                Historial
              </h3>
              <span className="text-[10px] text-text-45 tabular-nums">{historial.length}</span>
            </header>
            <div className="overflow-hidden rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
              <div className="divide-y divide-glass-border">
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

/** Stat compacto en una columna del hero */
function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'default' | 'green' | 'cyan' | 'fuchsia';
}) {
  const toneText: Record<typeof tone, string> = {
    default: 'var(--text-white)',
    green: 'var(--green)',
    cyan: 'var(--cyan)',
    fuchsia: 'var(--fuchsia)',
  };
  return (
    <div className="rounded-xl border border-white/[0.04] bg-black/20 px-2.5 py-2">
      <div
        className="text-[8.5px] font-semibold uppercase text-text-45"
        style={{ letterSpacing: '0.7px' }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-[12px] font-medium tabular-nums sm:text-[13px]"
        style={{ color: toneText[tone], letterSpacing: '-0.01em' }}
      >
        {value}
      </div>
    </div>
  );
}

/** Card de compromiso — ticket-stub style */
function CompromisoCard({ c, onPagar }: { c: CompromisoDeuda; onPagar: () => void }) {
  const isPaid = c.saldo <= 0.01;
  const accent = conceptoAccent[c.concepto] ?? conceptoAccent.inscripcion;
  const pct =
    c.monto_total > 0
      ? Math.min(100, ((c.monto_total - c.saldo) / c.monto_total) * 100)
      : 0;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-glass-border transition-all duration-300 hover:border-white/10"
      style={{
        background: `linear-gradient(135deg, ${accent.tint} 0%, transparent 60%), var(--bg-elevated)`,
      }}
    >
      {/* Accent stripe — ticket stub */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: `linear-gradient(180deg, ${accent.from}, ${accent.to})`,
          boxShadow: `0 0 12px ${accent.from}40`,
        }}
      />

      <div className="pl-4 pr-3 py-3.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h4
              className="truncate text-[13px] font-medium leading-tight text-text-white"
              style={{ letterSpacing: '-0.01em' }}
            >
              {c.descripcion}
            </h4>
            {(c.subdivision || c.bailarines != null) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {c.subdivision && (
                  <span
                    className="rounded-md border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-text-65"
                    style={{ letterSpacing: '0.5px' }}
                  >
                    {c.subdivision}
                  </span>
                )}
                {c.bailarines != null && (
                  <span className="text-[10px] text-text-45 tabular-nums">{c.bailarines} {c.concepto === 'credencial' ? 'unid.' : 'bail.'}</span>
                )}
              </div>
            )}
          </div>

          {isPaid ? (
            <div
              className="flex shrink-0 items-center gap-1 rounded-full border border-green/40 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-green"
              style={{ background: 'rgba(16,185,129,0.08)' }}
            >
              <CheckCircle2 className="h-3 w-3" />
              Pagado
            </div>
          ) : (
            <button
              type="button"
              onClick={onPagar}
              className="group/btn relative shrink-0 overflow-hidden rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#04020F] transition-transform active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                boxShadow: `0 4px 14px ${accent.from}35, 0 0 0 1px ${accent.from}30 inset`,
                letterSpacing: '0.8px',
              }}
            >
              <span className="relative z-10">Pagar</span>
              <span
                className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover/btn:opacity-100"
                style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.2), transparent)' }}
              />
            </button>
          )}
        </div>

        {/* Montos en línea horizontal */}
        <div className="mt-3 flex items-baseline gap-3 text-[11px]">
          <span className="text-text-45">Total</span>
          <span className="font-medium text-text-90 tabular-nums">{bs(c.monto_total)}</span>

          <span className="ml-auto text-text-45">Saldo</span>
          <span
            className="font-bold tabular-nums"
            style={{
              color: isPaid ? 'var(--green)' : 'var(--text-white)',
              letterSpacing: '-0.01em',
            }}
          >
            {bs(c.saldo)}
          </span>
        </div>

        {/* Progreso */}
        {!isPaid && (
          <div className="mt-2.5">
            <div className="relative h-[3px] overflow-hidden rounded-full bg-white/[0.04]">
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accent.from}, ${accent.to})`,
                  boxShadow: `0 0 8px ${accent.from}60`,
                }}
              />
            </div>
            {(c.pagado_verificado > 0 || c.pagado_pendiente > 0) && (
              <div className="mt-1 flex justify-between text-[9px] tabular-nums">
                {c.pagado_verificado > 0 && (
                  <span className="text-green">✓ {bs(c.pagado_verificado)}</span>
                )}
                {c.pagado_pendiente > 0 && (
                  <span className="text-cyan">⏳ {bs(c.pagado_pendiente)}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fila de historial — compacta con badge de estado */
const estadoConfig: Record<PagoEstado, { dot: string; label: string; text: string }> = {
  verificado: { dot: 'var(--green)',    label: 'Verificado', text: 'var(--green)' },
  enviado:    { dot: 'var(--cyan)',     label: 'En revisión', text: 'var(--cyan)' },
  pendiente:  { dot: 'var(--text-45)',  label: 'Pendiente',  text: 'var(--text-45)' },
  rechazado:  { dot: '#ef4444',         label: 'Rechazado',  text: '#ef4444' },
  anulado:    { dot: '#ef4444',         label: 'Anulado',    text: '#ef4444' },
};

function HistorialRow({ p }: { p: PagoHistorial }) {
  const e = estadoConfig[p.estado] ?? estadoConfig.pendiente;
  const Icon =
    p.estado === 'verificado'
      ? CheckCircle2
      : p.estado === 'rechazado' || p.estado === 'anulado'
        ? AlertCircle
        : p.estado === 'enviado'
          ? Clock
          : Clock;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.015]">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
        style={{ background: `${e.dot}15`, color: e.text }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-text-90">
            {conceptoLabel[p.concepto]?.replace('Inscripciones', 'Inscripción') ?? p.concepto}
          </span>
          <span className="shrink-0 text-[13px] font-semibold tabular-nums text-text-white" style={{ letterSpacing: '-0.01em' }}>
            {bs(p.monto)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2 text-[9.5px] text-text-45">
          <div className="flex items-center gap-1.5 truncate">
            <span>{p.fecha}</span>
            {p.hora && <span>· {p.hora.slice(0, 5)}</span>}
            <span>·</span>
            <span className="truncate">{p.metodo_pago}</span>
          </div>
          <span
            className="shrink-0 font-semibold uppercase tabular-nums"
            style={{ color: e.text, letterSpacing: '0.5px' }}
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
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-45 transition hover:bg-white/5 hover:text-cyan"
        >
          <FileText className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
