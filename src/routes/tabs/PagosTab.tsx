import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, CheckCircle2, Clock, AlertCircle, Plus, FileText, Receipt, X } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { PagoModal } from '@/components/cards/PagoModal';
import type { CompromisoDeuda, PagoHistorial } from '@/types/domain';

function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2 }).format(n) + ' Bs';
}

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripción',
  convenio_entradas: 'Pre-Venta de Entradas',
  credencial: 'Credenciales',
  credencial_unit: 'Credenciales (Unitario)',
};

const estadoStyles: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  verificado: { bg: 'rgba(16,185,129,0.15)', text: 'var(--green)', icon: CheckCircle2 },
  enviado: { bg: 'rgba(0,229,255,0.12)', text: 'var(--cyan)', icon: Clock },
  pendiente: { bg: 'rgba(255,255,255,0.06)', text: 'var(--text-45)', icon: Clock },
  rechazado: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', icon: AlertCircle },
  anulado: { bg: 'rgba(239,68,68,0.10)', text: '#ef4444', icon: X },
};

export function PagosTab() {
  const qc = useQueryClient();
  const [pagoTarget, setPagoTarget] = useState<CompromisoDeuda | null>(null);

  const q = useQuery({
    queryKey: ['pagos-resumen'],
    queryFn: () => pagosApi.resumen(),
  });

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (q.error) {
    return (
      <div className="p-4">
        <EmptyState>Error al cargar pagos. {(q.error as Error).message}</EmptyState>
      </div>
    );
  }
  if (!q.data) return null;

  const { compromisos, historial, totales, metodos_pago } = q.data;

  const stats = [
    { label: 'Deuda Total', value: bs(totales.total_deuda), accent: 'cyan' as const },
    { label: 'Pagado', value: bs(totales.pagado_verificado), accent: 'green' as const },
    { label: 'Pendiente Verif.', value: bs(totales.pagado_pendiente), accent: 'gold' as const },
    { label: 'Saldo', value: bs(totales.saldo), accent: 'fuchsia' as const },
  ];

  // Agrupar compromisos por concepto
  const porConcepto: Record<string, CompromisoDeuda[]> = {};
  for (const c of compromisos) {
    (porConcepto[c.concepto] ??= []).push(c);
  }

  return (
    <>
      <div className="space-y-4 p-4 sm:p-6">
        <StatsCards stats={stats} />

        {compromisos.length === 0 ? (
          <EmptyState>No tiene compromisos de pago para 2026.</EmptyState>
        ) : (
          Object.entries(porConcepto).map(([concepto, items]) => (
            <section key={concepto} className="rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
              <header className="flex items-center gap-2 border-b border-glass-border px-4 py-3">
                <Wallet className="h-4 w-4 text-cyan" />
                <h3 className="text-[12px] font-semibold uppercase text-text-90" style={{ letterSpacing: '0.8px' }}>
                  {conceptoLabel[concepto] ?? concepto}
                </h3>
                <span className="ml-auto rounded-md border border-glass-border bg-elev px-2 py-0.5 text-[10px] text-text-65">
                  {items.length}
                </span>
              </header>
              <div className="divide-y divide-glass-border">
                {items.map((c) => (
                  <CompromisoRow key={c.id_referencia} c={c} onPagar={() => setPagoTarget(c)} />
                ))}
              </div>
            </section>
          ))
        )}

        {historial.length > 0 && (
          <section className="rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-md">
            <header className="flex items-center gap-2 border-b border-glass-border px-4 py-3">
              <Receipt className="h-4 w-4 text-fuchsia" />
              <h3 className="text-[12px] font-semibold uppercase text-text-90" style={{ letterSpacing: '0.8px' }}>
                Historial de pagos
              </h3>
              <span className="ml-auto rounded-md border border-glass-border bg-elev px-2 py-0.5 text-[10px] text-text-65">
                {historial.length}
              </span>
            </header>
            <div className="divide-y divide-glass-border">
              {historial.map((p) => <HistorialRow key={p.id_pago} p={p} />)}
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

function CompromisoRow({ c, onPagar }: { c: CompromisoDeuda; onPagar: () => void }) {
  const isPaid = c.saldo <= 0.01;
  const pct = c.monto_total > 0 ? Math.min(100, ((c.monto_total - c.saldo) / c.monto_total) * 100) : 0;

  return (
    <div className="p-4 transition hover:bg-white/[0.02]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-text-90">{c.descripcion}</div>
          {c.subdivision && (
            <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase text-text-45" style={{ letterSpacing: '0.5px' }}>
              <span>{c.subdivision}</span>
              {c.bailarines != null && <span>· {c.bailarines} bailarines</span>}
            </div>
          )}
        </div>
        {isPaid ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full border border-green/40 bg-green/10 px-2 py-1 text-[10px] font-semibold uppercase text-green"
            style={{ letterSpacing: '0.5px' }}
          >
            <CheckCircle2 className="h-3 w-3" />
            Pagado
          </span>
        ) : (
          <button
            type="button"
            onClick={onPagar}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-cyan px-3 py-1.5 text-[10px] font-semibold uppercase text-[#04020F] transition hover:bg-[#66F0FF]"
            style={{ letterSpacing: '0.5px' }}
          >
            <Plus className="h-3 w-3" />
            Pagar
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div>
          <div className="text-text-45">Total</div>
          <div className="font-semibold text-text-90 tabular-nums">{bs(c.monto_total)}</div>
        </div>
        <div>
          <div className="text-text-45">Pagado</div>
          <div className="font-semibold text-green tabular-nums">{bs(c.pagado_verificado)}</div>
          {c.pagado_pendiente > 0 && (
            <div className="text-[10px] text-cyan tabular-nums">+{bs(c.pagado_pendiente)} ⏳</div>
          )}
        </div>
        <div>
          <div className="text-text-45">Saldo</div>
          <div className={`font-semibold tabular-nums ${isPaid ? 'text-green' : 'text-fuchsia'}`}>
            {bs(c.saldo)}
          </div>
        </div>
      </div>

      {!isPaid && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full transition-all"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--cyan), var(--fuchsia))' }}
          />
        </div>
      )}
    </div>
  );
}

function HistorialRow({ p }: { p: PagoHistorial }) {
  const e = estadoStyles[p.estado] ?? estadoStyles.pendiente;
  const Icon = e.icon;
  return (
    <div className="flex items-center gap-3 p-3">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
        style={{ background: e.bg, color: e.text }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[12px] font-medium text-text-90">
          <span className="truncate">{conceptoLabel[p.concepto] ?? p.concepto}</span>
          <span className="text-text-45">·</span>
          <span className="tabular-nums">{bs(p.monto)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-45">
          <span>{p.fecha}</span>
          {p.hora && <span>{p.hora.slice(0, 5)}</span>}
          <span>·</span>
          <span>{p.metodo_pago}</span>
          {p.numero_recibo && (
            <>
              <span>·</span>
              <span className="font-mono">{p.numero_recibo}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
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
        <span
          className="rounded-md px-2 py-0.5 text-[9px] font-semibold uppercase"
          style={{ background: e.bg, color: e.text, letterSpacing: '0.6px' }}
        >
          {p.estado}
        </span>
      </div>
    </div>
  );
}
