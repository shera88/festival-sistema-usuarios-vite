import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, AlertCircle, FileText, ChevronDown, ArrowUpRight, Sparkles, Receipt, Loader2 } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { PagoModal } from '@/components/cards/PagoModal';
import { webpProxy } from '@/lib/utils/img';
import {
  descargarArchivo,
  abrirArchivoLocal,
  checkArchivoLocal,
  sanitizeFilename,
  extFromUrl,
  type DescargaResult,
} from '@/lib/utils/descargarArchivo';
import type { CompromisoDeuda, PagoHistorial, PagoEstado, PagoHistorialAno, AnoConPagos } from '@/types/domain';

function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Bs';
}

const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripciones',
  convenio_entradas: 'Pre-Venta de Entradas',
  credencial: 'Credenciales',
  credencial_unit: 'Credenciales Unitarias',
};

/** Gradientes por concepto — versión moderna con dirección + 2 stops */
const conceptoGrad: Record<string, { grad: string; glow: string; accent: string }> = {
  inscripcion: {
    grad: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
    glow: 'rgba(6,182,212,0.35)',
    accent: '#06B6D4',
  },
  convenio_entradas: {
    grad: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
    glow: 'rgba(236,72,153,0.35)',
    accent: '#EC4899',
  },
  credencial: {
    grad: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    glow: 'rgba(245,158,11,0.32)',
    accent: '#F59E0B',
  },
  credencial_unit: {
    grad: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)',
    glow: 'rgba(245,158,11,0.32)',
    accent: '#F59E0B',
  },
};

/** Hook: cuenta de 0 a value animado (count-up) */
function useCountUp(value: number, durationMs = 900) {
  const [current, setCurrent] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    fromRef.current = current;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setCurrent(Math.round(fromRef.current + (value - fromRef.current) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  return current;
}

const ANO_ACTUAL = 2026;

export function PagosTab() {
  const qc = useQueryClient();
  const [pagoTarget, setPagoTarget] = useState<CompromisoDeuda | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [anoActivo, setAnoActivo] = useState<number>(ANO_ACTUAL);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Lista de años disponibles (siempre cargada — para construir tabs)
  const anosQ = useQuery({
    queryKey: ['pagos-anos'],
    queryFn: () => pagosApi.historial(),
    staleTime: 5 * 60_000,
  });

  const q = useQuery({
    queryKey: ['pagos-resumen'],
    queryFn: () => pagosApi.resumen(),
    enabled: anoActivo === ANO_ACTUAL,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });

  // Renderizar vista histórica si el año activo no es el actual
  if (anoActivo !== ANO_ACTUAL) {
    return (
      <HistorialAnoView
        ano={anoActivo}
        anosDisponibles={anosQ.data?.anos_disponibles ?? []}
        onChangeAno={setAnoActivo}
      />
    );
  }

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

  const saldoReal = Math.max(0, totales.total_deuda - totales.pagado_verificado);
  const progresoTotal =
    totales.total_deuda > 0 ? Math.min(100, (totales.pagado_verificado / totales.total_deuda) * 100) : 0;

  const logoUrl = enlace_del_logo ? webpProxy(enlace_del_logo, 96) : null;

  return (
    <>
      <style>{ANIM_CSS}</style>
      <div className="space-y-7 px-3 py-5 sm:px-6 sm:py-6">
        <YearTabs
          anoActivo={anoActivo}
          anosDisponibles={anosQ.data?.anos_disponibles ?? []}
          onChange={setAnoActivo}
        />
        {/* HERO con aurora animada + count-up — saldo solo descuenta verificados */}
        <HeroSaldo
          saldo={saldoReal}
          deuda={totales.total_deuda}
          pagado={totales.pagado_verificado}
          pendiente={totales.pagado_pendiente}
          progreso={progresoTotal}
        />

        {compromisos.length === 0 ? (
          <EmptyState>No tiene compromisos de pago para 2026.</EmptyState>
        ) : (
          Object.entries(porConcepto).map(([concepto, items], sectionIdx) => {
            const isCollapsed = collapsedSections.has(concepto);
            const pendingCount = items.filter((c) => c.saldo > 0.01).length;
            const reviewCount = items.filter((c) => c.saldo <= 0.01 && c.pagado_pendiente > 0.01).length;
            return (
              <section key={concepto} style={{ animation: `fadeUp 0.55s ${100 + sectionIdx * 80}ms ease-out both` }}>
                <button
                  type="button"
                  onClick={() => toggleSection(concepto)}
                  className="mb-3 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.025]"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-text-65 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : ''}`}
                    strokeWidth={2.5}
                  />
                  <h3
                    className="flex-1 text-[10.5px] font-semibold uppercase text-text-90"
                    style={{ letterSpacing: '1.8px', fontFamily: FONT_DISPLAY }}
                  >
                    {conceptoLabel[concepto] ?? concepto}
                  </h3>
                  {pendingCount > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                      style={{
                        background: 'rgba(245,158,11,0.15)',
                        color: '#F59E0B',
                        fontFamily: FONT_MONO,
                        letterSpacing: '0.2px',
                      }}
                    >
                      {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {reviewCount > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
                      style={{
                        background: 'rgba(6,182,212,0.15)',
                        color: '#06B6D4',
                        fontFamily: FONT_MONO,
                        letterSpacing: '0.2px',
                      }}
                    >
                      {reviewCount} en revisión
                    </span>
                  )}
                  <span
                    className="text-[10px] font-medium text-text-45 tabular-nums"
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {items.length}
                  </span>
                </button>
                <div
                  className="overflow-hidden transition-all duration-400 ease-out"
                  style={{
                    maxHeight: isCollapsed ? '0px' : `${items.length * 260 + 100}px`,
                    opacity: isCollapsed ? 0 : 1,
                  }}
                >
                  <div className="space-y-3">
                    {items.map((c, idx) => (
                      <CompromisoCard
                        key={c.id_referencia}
                        c={c}
                        logoUrl={logoUrl}
                        nombreAgrupacion={nombre_agrupacion}
                        pagosParciales={pagosByCompromiso[`${c.concepto}::${c.id_referencia}`] ?? []}
                        onPagar={() => setPagoTarget(c)}
                        delayMs={sectionIdx * 80 + idx * 50}
                      />
                    ))}
                  </div>
                </div>
              </section>
            );
          })
        )}

        {historial.length === 0 && compromisos.length > 0 && (
          <p
            className="px-2 text-center text-[11px] text-text-45"
            style={{ fontFamily: FONT_DISPLAY }}
          >
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

function HeroSaldo({
  saldo,
  deuda,
  pagado,
  pendiente,
  progreso,
}: {
  saldo: number;
  deuda: number;
  pagado: number;
  pendiente: number;
  progreso: number;
}) {
  const saldoCount = useCountUp(saldo);
  const isClear = saldo <= 0 && deuda > 0;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/[0.07]"
      style={{
        background: '#0a0817',
        animation: 'fadeUp 0.7s 0ms ease-out both',
      }}
    >
      {/* Aurora animada — radial blooms drifting */}
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div
          className="absolute -top-1/3 -right-1/4 h-[300px] w-[300px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(255,31,168,0.28) 0%, transparent 70%)',
            animation: 'aurora1 14s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-1/3 -left-1/4 h-[280px] w-[280px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.26) 0%, transparent 70%)',
            animation: 'aurora2 16s ease-in-out infinite',
          }}
        />
        <div
          className="absolute top-1/3 left-1/3 h-[160px] w-[160px] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)',
            animation: 'aurora3 18s ease-in-out infinite',
          }}
        />
      </div>

      {/* Grain noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <div className="relative px-5 py-5">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-semibold uppercase text-text-45"
            style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}
          >
            Saldo pendiente
          </span>
          {isClear && (
            <span
              className="flex items-center gap-1 rounded-full border border-green/40 px-2.5 py-0.5 text-[9px] font-semibold uppercase text-green"
              style={{ background: 'rgba(16,185,129,0.12)', letterSpacing: '0.8px' }}
            >
              <Sparkles className="h-2.5 w-2.5" />
              Al día
            </span>
          )}
        </div>

        {/* Monto con gradient text + pulse glow sutil */}
        <div
          className="mt-2 bg-clip-text text-transparent tabular-nums"
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: '40px',
            fontWeight: 500,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            backgroundImage: saldo > 0
              ? 'linear-gradient(135deg, #FFFFFF 0%, #FFFFFF 40%, #C7D2FE 100%)'
              : 'linear-gradient(135deg, #10B981, #06B6D4)',
            fontVariantNumeric: 'tabular-nums',
            filter: 'drop-shadow(0 0 24px rgba(255,255,255,0.06))',
          }}
        >
          {bs(saldoCount)}
        </div>

        {/* Stats horizontal con dividers */}
        <div
          className="mt-5 grid grid-cols-3 divide-x divide-white/[0.06]"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          <StatColumn label="Deuda" value={bs(deuda)} />
          <StatColumn label="Pagado" value={bs(pagado)} color="#10B981" />
          <StatColumn
            label="En revisión"
            value={bs(pendiente)}
            color={pendiente > 0 ? '#06B6D4' : undefined}
          />
        </div>

        {totales(deuda) && (
          <div className="mt-5">
            {/* Progress con gradient + animated shimmer */}
            <div
              className="relative h-1.5 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${progreso}%`,
                  background: 'linear-gradient(90deg, #06B6D4 0%, #8B5CF6 50%, #EC4899 100%)',
                  boxShadow: '0 0 16px rgba(139,92,246,0.35)',
                }}
              />
            </div>
            <div
              className="mt-2 flex justify-between text-[10px] font-medium text-text-45 tabular-nums"
              style={{ fontFamily: FONT_MONO }}
            >
              <span>{Math.round(progreso)}% pagado</span>
              <span>{bs(deuda - pagado)} restantes</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
function totales(d: number): boolean { return d > 0; }

type EstadoBadge = 'completado' | 'revision' | 'pendiente';

function StatusBadge({ estado }: { estado: EstadoBadge }) {
  if (estado === 'completado') {
    return (
      <span
        className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase"
        style={{
          background: 'rgba(16,185,129,0.12)',
          borderColor: 'rgba(16,185,129,0.40)',
          color: '#10B981',
          letterSpacing: '0.8px',
          fontFamily: FONT_DISPLAY,
        }}
      >
        <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={3} />
        Completado
      </span>
    );
  }
  if (estado === 'revision') {
    return (
      <span
        className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase"
        style={{
          background: 'rgba(6,182,212,0.10)',
          borderColor: 'rgba(6,182,212,0.40)',
          color: '#06B6D4',
          letterSpacing: '0.8px',
          fontFamily: FONT_DISPLAY,
        }}
      >
        <Clock className="h-2.5 w-2.5" strokeWidth={2.8} />
        En revisión
      </span>
    );
  }
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase"
      style={{
        background: 'rgba(245,158,11,0.10)',
        borderColor: 'rgba(245,158,11,0.40)',
        color: '#F59E0B',
        letterSpacing: '0.8px',
        fontFamily: FONT_DISPLAY,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }}
      />
      Pendiente
    </span>
  );
}

function StatColumn({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <div
        className="text-[9.5px] font-semibold uppercase text-text-45"
        style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[14px] font-medium leading-none tabular-nums"
        style={{
          fontFamily: FONT_MONO,
          color: color ?? 'var(--text-white)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function CompromisoCard({
  c,
  logoUrl,
  nombreAgrupacion,
  pagosParciales,
  onPagar,
  delayMs = 0,
}: {
  c: CompromisoDeuda;
  logoUrl: string | null;
  nombreAgrupacion: string;
  pagosParciales: PagoHistorial[];
  onPagar: () => void;
  delayMs?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const saldoVerificado = Math.max(0, c.monto_total - c.pagado_verificado);
  const isCompletado = saldoVerificado <= 0.01;
  const isRevision = !isCompletado && c.saldo <= 0.01 && c.pagado_pendiente > 0.01;
  const isPaid = isCompletado;
  const estadoBadge: EstadoBadge = isCompletado ? 'completado' : isRevision ? 'revision' : 'pendiente';
  const isCredencial = c.concepto === 'credencial' || c.concepto === 'credencial_unit';
  const cfg = conceptoGrad[c.concepto] ?? conceptoGrad.inscripcion;
  const pct = c.monto_total > 0 ? Math.min(100, (c.pagado_verificado / c.monto_total) * 100) : 0;
  const initial = (nombreAgrupacion || '?').charAt(0).toUpperCase();
  const saldoCount = useCountUp(saldoVerificado, 700);

  const pagosSorted = useMemo(
    () => [...pagosParciales].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? '')),
    [pagosParciales],
  );

  return (
    <div
      className="group/card relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-px"
      style={{
        background: '#0a0817',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 0 rgba(255,255,255,0.025) inset',
        animation: `fadeUp 0.5s ${delayMs}ms ease-out both`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = `linear-gradient(135deg, ${cfg.accent}10 0%, transparent 55%), #0a0817`;
        (e.currentTarget as HTMLDivElement).style.borderColor = `${cfg.accent}38`;
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 1px 0 0 rgba(255,255,255,0.025) inset, 0 10px 32px -10px ${cfg.glow}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = '#0a0817';
        (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 0 0 rgba(255,255,255,0.025) inset';
      }}
    >
      <div className="relative px-5 py-5">
        <div className="flex items-start gap-3.5">
          {/* Logo con ring gradient sutil */}
          <div className="relative h-11 w-11 shrink-0">
            <div
              className="absolute inset-0 rounded-full opacity-40"
              style={{ background: cfg.grad, filter: 'blur(6px)' }}
            />
            <div
              className="relative h-full w-full overflow-hidden rounded-full border border-white/[0.10]"
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
                  style={{ color: cfg.accent, fontFamily: FONT_DISPLAY }}
                >
                  {initial}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h4
                className="truncate text-[13px] leading-tight"
                style={{
                  fontFamily: FONT_DISPLAY,
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  color: cfg.accent,
                }}
              >
                {isCredencial ? nombreAgrupacion : c.descripcion}
              </h4>
              <StatusBadge estado={estadoBadge} />
            </div>
            {isCredencial && (
              <div
                className="mt-0.5 text-[10px] font-medium text-text-65"
                style={{ fontFamily: FONT_DISPLAY }}
              >
                {c.descripcion}
              </div>
            )}
            <div
              className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9.5px] text-text-45"
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
                <span style={{ fontFamily: FONT_MONO, fontVariantNumeric: 'tabular-nums' }}>
                  {c.bailarines}{' '}
                  {c.concepto === 'credencial'
                    ? c.bailarines === 1 ? 'unidad' : 'unidades'
                    : c.bailarines === 1 ? 'bailarín' : 'bailarines'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="flex items-end gap-7">
            <div>
              <div
                className="text-[9px] font-semibold uppercase text-text-45"
                style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}
              >
                Total
              </div>
              <div
                className="mt-1 text-[13px] leading-none text-text-90 tabular-nums"
                style={{
                  fontFamily: FONT_MONO,
                  fontWeight: 500,
                  letterSpacing: '-0.015em',
                  fontVariantNumeric: 'tabular-nums',
                }}
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
                  fontFamily: FONT_MONO,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: isPaid ? 'var(--green)' : 'var(--text-white)',
                  letterSpacing: '-0.015em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {bs(saldoCount)}
              </div>
            </div>
          </div>

          {isPaid || isRevision ? (
            <div className="shrink-0" />
          ) : (
            <button
              type="button"
              onClick={onPagar}
              className="group/btn relative shrink-0 overflow-hidden rounded-full px-4 py-2 text-[10.5px] font-semibold uppercase text-white transition-transform active:scale-[0.96]"
              style={{
                background: cfg.grad,
                color: '#FFFFFF',
                letterSpacing: '0.9px',
                fontFamily: FONT_DISPLAY,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.18) inset, 0 1px 0 0 rgba(255,255,255,0.25) inset, 0 6px 20px ${cfg.glow}`,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              {/* Shimmer sweep on hover */}
              <span
                className="absolute inset-0 -translate-x-full transition-transform duration-700 group-hover/btn:translate-x-full"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                }}
              />
              <span className="relative flex items-center gap-1">
                Pagar
                <ArrowUpRight className="h-3 w-3 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" strokeWidth={2.5} />
              </span>
            </button>
          )}
        </div>

        {/* Progress con gradient + shimmer */}
        {!isPaid && c.monto_total > 0 && (
          <div className="mt-4">
            <div
              className="relative h-1 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: cfg.grad,
                  boxShadow: `0 0 6px ${cfg.glow}`,
                }}
              />
            </div>
          </div>
        )}

        {pagosSorted.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold transition-colors duration-200"
            style={{
              fontFamily: FONT_DISPLAY,
              background: `${cfg.accent}14`,
              border: `1px solid ${cfg.accent}33`,
              color: cfg.accent,
              letterSpacing: '0.2px',
            }}
            aria-expanded={expanded}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold tabular-nums"
                style={{
                  background: cfg.grad,
                  color: '#FFFFFF',
                  fontFamily: FONT_MONO,
                }}
              >
                {pagosSorted.length}
              </span>
              {pagosSorted.length === 1 ? 'pago' : 'pagos'}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              strokeWidth={2.5}
            />
          </button>
        )}
      </div>

      {/* Drawer con animación slide */}
      <div
        className="overflow-hidden transition-all duration-400 ease-out"
        style={{
          maxHeight: expanded ? `${pagosSorted.length * 88 + 64}px` : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div
          className="border-t border-white/[0.04] divide-y divide-white/[0.03]"
          style={{ background: '#080614' }}
        >
          {/* Encabezados de columna */}
          <div className="flex items-center gap-2.5 px-4 py-1.5" style={{ background: '#06030f' }}>
            <div className="h-3 w-7 shrink-0" />
            <div className="min-w-0 flex-1" />
            <div className="mr-3 grid shrink-0 grid-cols-2 gap-2" style={{ width: '4.25rem' }}>
              <div
                className="text-center text-[7.5px] font-bold uppercase text-text-65"
                style={{ letterSpacing: '0.04em', fontFamily: FONT_DISPLAY }}
              >
                Recibo
              </div>
              <div
                className="text-center text-[7.5px] font-bold uppercase text-text-65"
                style={{ letterSpacing: '0.04em', fontFamily: FONT_DISPLAY }}
              >
                Comp.
              </div>
            </div>
          </div>
          {pagosSorted.map((p) => (
            <PagoParcialRow key={p.id_pago} p={p} nombreAgrupacion={nombreAgrupacion} />
          ))}
        </div>
      </div>
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

const RECIBO_GRAD = 'linear-gradient(135deg, #10B981 0%, #059669 100%)';
const RECIBO_GLOW = 'rgba(16,185,129,0.40)';
const COMPROBANTE_GRAD = 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)';
const COMPROBANTE_GLOW = 'rgba(59,130,246,0.40)';
const ABRIR_RECIBO_GRAD = 'linear-gradient(135deg, #6EE7B7 0%, #10B981 100%)';
const ABRIR_RECIBO_GLOW = 'rgba(110,231,183,0.45)';
const ABRIR_COMPROBANTE_GRAD = 'linear-gradient(135deg, #93C5FD 0%, #3B82F6 100%)';
const ABRIR_COMPROBANTE_GLOW = 'rgba(147,197,253,0.45)';

function ActionButton({
  onClick,
  grad,
  glow,
  children,
  ariaLabel,
  title,
  pulse = false,
  loading = false,
}: {
  onClick: () => void;
  grad: string;
  glow: string;
  children: React.ReactNode;
  ariaLabel: string;
  title: string;
  pulse?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={loading}
      className="group/btn relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-white transition-transform active:scale-[0.90] disabled:opacity-90"
      style={{
        background: grad,
        letterSpacing: '0.6px',
        fontFamily: FONT_DISPLAY,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.20) inset, 0 1px 0 0 rgba(255,255,255,0.28) inset, 0 4px 14px ${glow}`,
        textShadow: '0 1px 1px rgba(0,0,0,0.30)',
        animation: pulse ? 'fadeUpBtn 0.4s ease-out both, pulseGlow 2.4s ease-in-out 0.5s infinite' : undefined,
      }}
    >
      <span
        className="absolute inset-0 -translate-x-full transition-transform duration-700 group-hover/btn:translate-x-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.40) 50%, transparent 100%)',
        }}
      />
      <span className="relative flex items-center gap-1">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.4} /> : children}
      </span>
    </button>
  );
}

function PagoParcialRow({ p, nombreAgrupacion }: { p: PagoHistorial; nombreAgrupacion: string }) {
  const e = estadoConfig[p.estado] ?? estadoConfig.pendiente;
  const Icon =
    p.estado === 'verificado' ? CheckCircle2
    : p.estado === 'rechazado' || p.estado === 'anulado' ? AlertCircle
    : Clock;
  const [reciboDl, setReciboDl] = useState<DescargaResult | null>(null);
  const [comprobanteDl, setComprobanteDl] = useState<DescargaResult | null>(null);
  const [loading, setLoading] = useState<{ recibo: boolean; comprobante: boolean }>({
    recibo: false,
    comprobante: false,
  });

  function buildFilename(tipo: 'recibo' | 'comprobante'): string {
    const persona = (p.nombre_pagador || 'Pagador').toUpperCase();
    const agrup = (nombreAgrupacion || 'Agrupacion').toUpperCase();
    const concepto = conceptoLabel[p.concepto] ?? p.concepto;
    const metodo = p.metodo_pago || 'Pago';
    const prefix = tipo === 'recibo' ? 'Recibo de Pago' : 'Comprobante';
    const base = `${prefix} - ${persona} - ${agrup} - ${concepto} - ${metodo}`;
    const ext = tipo === 'recibo'
      ? '.pdf'
      : extFromUrl(p.comprobante_url || '', '.bin');
    return sanitizeFilename(base) + ext;
  }

  // Restaurar estado "ya descargado" al montar: chequea Filesystem (Capacitor).
  // Persiste entre reinicios de app sin localStorage — verdad la tiene el filesystem.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      if (p.estado === 'verificado' && p.recibo_pdf_url) {
        const dl = await checkArchivoLocal(buildFilename('recibo'), 'application/pdf');
        if (!cancelled && dl) setReciboDl(dl);
      }
      if (p.comprobante_url) {
        const dl = await checkArchivoLocal(buildFilename('comprobante'));
        if (!cancelled && dl) setComprobanteDl(dl);
      }
    }
    void restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id_pago, p.recibo_pdf_url, p.comprobante_url, p.nombre_pagador, nombreAgrupacion]);

  async function handleClick(tipo: 'recibo' | 'comprobante') {
    if (loading[tipo]) return;
    const dl = tipo === 'recibo' ? reciboDl : comprobanteDl;
    if (dl?.uri) {
      void abrirArchivoLocal(dl.uri, dl.filename, dl.mime);
      return;
    }
    const url = tipo === 'recibo' ? p.recibo_pdf_url : p.comprobante_url;
    if (!url) return;
    const label = tipo === 'recibo' ? 'Recibo' : 'Comprobante';
    setLoading((prev) => ({ ...prev, [tipo]: true }));
    try {
      const result = await descargarArchivo(url, buildFilename(tipo), label);
      if (tipo === 'recibo') setReciboDl(result);
      else setComprobanteDl(result);
    } catch {
      // toast.error lo muestra
    } finally {
      setLoading((prev) => ({ ...prev, [tipo]: false }));
    }
  }
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-white/[0.018]">
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
        style={{ background: `${e.dot}1A`, color: e.dot }}
      >
        <Icon className="h-3 w-3" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 whitespace-nowrap">
          <span
            className="text-[12.5px] font-semibold text-text-90 tabular-nums"
            style={{ fontFamily: FONT_MONO, letterSpacing: '-0.01em' }}
          >
            {bs(p.monto)}
          </span>
          <span
            className="text-[8.5px] font-semibold uppercase"
            style={{ color: e.dot, letterSpacing: '0.5px', fontFamily: FONT_DISPLAY }}
          >
            {e.label}
          </span>
        </div>
        <div
          className="mt-0.5 flex items-center gap-1 truncate text-[9.5px] text-text-45"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          <span style={{ fontFamily: FONT_MONO }}>{p.fecha}</span>
          {p.hora && <span style={{ fontFamily: FONT_MONO }}>· {p.hora.slice(0, 5)}</span>}
          <span>·</span>
          <span className="truncate">{p.metodo_pago}</span>
        </div>
      </div>
      <div className="mr-3 grid shrink-0 grid-cols-2 gap-2" style={{ width: '4.25rem' }}>
        {/* Columna Recibo */}
        <div className="flex w-full">
          {p.estado === 'verificado' && p.recibo_pdf_url ? (
            <ActionButton
              onClick={() => handleClick('recibo')}
              grad={reciboDl ? ABRIR_RECIBO_GRAD : RECIBO_GRAD}
              glow={reciboDl ? ABRIR_RECIBO_GLOW : RECIBO_GLOW}
              ariaLabel={reciboDl ? 'Abrir recibo descargado' : 'Descargar recibo PDF'}
              title={reciboDl ? 'Abrir recibo descargado' : 'Descargar recibo PDF'}
              loading={loading.recibo}
              pulse={!!reciboDl}
            >
              <Receipt className="h-3.5 w-3.5" strokeWidth={2.3} />
            </ActionButton>
          ) : p.estado === 'verificado' ? (
            <span
              aria-label="Generando recibo PDF"
              title="Generando recibo, aparecerá en segundos"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-white/8 bg-white/2 text-text-45"
            >
              <Receipt className="h-3.5 w-3.5 animate-pulse" strokeWidth={2.3} />
            </span>
          ) : (
            <span className="h-7 w-full" />
          )}
        </div>
        {/* Columna Comprobante */}
        <div className="flex w-full">
          {p.comprobante_url ? (
            <ActionButton
              onClick={() => handleClick('comprobante')}
              grad={comprobanteDl ? ABRIR_COMPROBANTE_GRAD : COMPROBANTE_GRAD}
              glow={comprobanteDl ? ABRIR_COMPROBANTE_GLOW : COMPROBANTE_GLOW}
              ariaLabel={comprobanteDl ? 'Abrir comprobante descargado' : 'Descargar comprobante'}
              title={comprobanteDl ? 'Abrir comprobante descargado' : 'Descargar comprobante subido'}
              loading={loading.comprobante}
              pulse={!!comprobanteDl}
            >
              <FileText className="h-3.5 w-3.5" strokeWidth={2.3} />
            </ActionButton>
          ) : (
            <span className="h-7 w-full" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tabs por año + vista de historial read-only (años pasados)
// ─────────────────────────────────────────────────────────────

function YearTabs({
  anoActivo,
  anosDisponibles,
  onChange,
}: {
  anoActivo: number;
  anosDisponibles: AnoConPagos[];
  onChange: (a: number) => void;
}) {
  const ANO_ACTUAL = 2026;
  // Siempre mostrar el filtro con 2025 (historico) + 2026 (actual) como mínimo,
  // así el usuario puede consultar histórico aunque su agrupación no tenga registros aún.
  const anosSet = new Set<number>([ANO_ACTUAL, 2025]);
  for (const a of anosDisponibles) anosSet.add(a.ano);
  const anos = [...anosSet].sort((x, y) => y - x);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (anos.length < 2) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="group/dd flex items-center gap-2.5 rounded-full px-4 py-2 transition-all"
        style={{
          background: open
            ? 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 100%)'
            : 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: open
            ? '0 1px 0 0 rgba(255,255,255,0.10) inset, 0 4px 14px rgba(0,0,0,0.28)'
            : '0 1px 0 0 rgba(255,255,255,0.04) inset',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span
          className="text-[8.5px] font-bold uppercase"
          style={{
            color: 'var(--text-45)',
            letterSpacing: '0.25em',
            fontFamily: FONT_DISPLAY,
          }}
        >
          Año
        </span>
        <span
          className="tabular-nums"
          style={{
            fontFamily: FONT_MONO,
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-white)',
            letterSpacing: '-0.005em',
          }}
        >
          {anoActivo}
        </span>
        <ChevronDown
          className="transition-transform duration-200"
          style={{
            width: 13,
            height: 13,
            color: 'var(--text-65)',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
          }}
          strokeWidth={2.4}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 z-20 mt-2 min-w-[160px] overflow-hidden rounded-xl"
          style={{
            background: 'rgba(15,13,30,0.96)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.45), 0 1px 0 0 rgba(255,255,255,0.04) inset',
            backdropFilter: 'blur(20px)',
            animation: 'dropDown 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {anos.map((a) => {
            const active = a === anoActivo;
            const isActual = a === ANO_ACTUAL;
            return (
              <button
                key={a}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(a);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 transition-colors"
                style={{
                  background: active ? 'rgba(6,182,212,0.10)' : 'transparent',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="tabular-nums"
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: '13px',
                      fontWeight: active ? 700 : 500,
                      color: active ? 'var(--cyan)' : 'var(--text-90)',
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {a}
                  </span>
                  {isActual && (
                    <span
                      className="rounded-full px-1.5 py-0.5"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-45)',
                        fontSize: '7.5px',
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        fontFamily: FONT_DISPLAY,
                        textTransform: 'uppercase',
                      }}
                    >
                      Actual
                    </span>
                  )}
                </span>
                {active && (
                  <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--cyan)' }} strokeWidth={2.4} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const conceptoLabelHist: Record<string, string> = {
  inscripcion: 'Inscripción',
  convenio_entradas: 'Pre-venta entradas',
  credencial: 'Credenciales',
  credencial_unit: 'Credencial unitaria',
  kardex: 'Kardex',
  otro: 'Otro',
};

function HistorialAnoView({
  ano,
  anosDisponibles,
  onChangeAno,
}: {
  ano: number;
  anosDisponibles: AnoConPagos[];
  onChangeAno: (a: number) => void;
}) {
  const q = useQuery({
    queryKey: ['pagos-historial', ano],
    queryFn: () => pagosApi.historial(ano),
  });

  return (
    <>
      <style>{ANIM_CSS}</style>
      <div className="space-y-5 px-3 py-5 sm:px-6 sm:py-6">
        <YearTabs anoActivo={ano} anosDisponibles={anosDisponibles} onChange={onChangeAno} />

        <div
          className="rounded-2xl border border-glass-border px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div
            className="text-[10px] font-bold uppercase text-text-45"
            style={{ letterSpacing: '1.5px', fontFamily: FONT_DISPLAY }}
          >
            Historial · {ano}
          </div>
          <div
            className="mt-1 text-[12px] text-text-65"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            Pagos registrados en el sistema festival de ese año.
            Solo lectura — no se pueden agregar pagos retroactivos.
          </div>
        </div>

        {q.isLoading && <LoadingSkeleton rows={4} />}
        {q.error && (
          <EmptyState>Error al cargar historial. {(q.error as Error).message}</EmptyState>
        )}
        {q.data && q.data.historial.length === 0 && (
          <EmptyState>No se encontraron pagos en {ano}.</EmptyState>
        )}
        {q.data && q.data.historial.length > 0 && (
          <HistorialAgrupadoList items={q.data.historial} />
        )}
      </div>
    </>
  );
}

function HistorialAgrupadoList({ items }: { items: PagoHistorialAno[] }) {
  const porConcepto = useMemo(() => {
    const map: Record<string, PagoHistorialAno[]> = {};
    for (const p of items) (map[p.concepto] ??= []).push(p);
    return map;
  }, [items]);

  const totalPagado = items.reduce((s, p) => s + (p.monto || 0), 0);

  return (
    <>
      {/* Total año */}
      <div
        className="rounded-2xl border border-glass-border px-5 py-4"
        style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.08), rgba(139,92,246,0.05))' }}
      >
        <div
          className="text-[9.5px] font-bold uppercase text-text-45"
          style={{ letterSpacing: '1.5px', fontFamily: FONT_DISPLAY }}
        >
          Total pagado
        </div>
        <div
          className="mt-1 leading-none"
          style={{
            fontSize: '24px',
            fontWeight: 700,
            fontFamily: FONT_MONO,
            color: 'var(--text-white)',
            letterSpacing: '-0.025em',
          }}
        >
          {bs(totalPagado)}
        </div>
        <div
          className="mt-1 text-[10.5px] text-text-45"
          style={{ fontFamily: FONT_DISPLAY }}
        >
          {items.length} pago{items.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Secciones por concepto */}
      {Object.entries(porConcepto).map(([concepto, pagos]) => (
        <section key={concepto}>
          <h3
            className="mb-3 px-2 text-[10.5px] font-semibold uppercase text-text-90"
            style={{ letterSpacing: '1.8px', fontFamily: FONT_DISPLAY }}
          >
            {conceptoLabelHist[concepto] ?? concepto}
            <span
              className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums"
              style={{
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-65)',
                fontFamily: FONT_MONO,
              }}
            >
              {pagos.length}
            </span>
          </h3>
          <div className="space-y-2">
            {pagos.map((p) => (
              <HistorialPagoCard key={p.id_pago} p={p} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function HistorialPagoCard({ p }: { p: PagoHistorialAno }) {
  const isCredencial = p.concepto === 'credencial' || p.concepto === 'credencial_unit';
  const titulo = isCredencial ? p.agrupacion : (p.nombre_obra || p.agrupacion || '—');
  return (
    <div
      className="rounded-xl border border-glass-border px-3 py-2.5"
      style={{ background: '#0a0817' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[11.5px] text-text-white"
            style={{ fontFamily: FONT_DISPLAY, fontWeight: 350, letterSpacing: '-0.005em' }}
          >
            {titulo}
          </div>
          <div
            className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[8.5px] text-text-45"
            style={{ fontFamily: FONT_DISPLAY }}
          >
            {p.fecha && <span style={{ fontFamily: FONT_MONO }}>{p.fecha}</span>}
            {p.hora && <span style={{ fontFamily: FONT_MONO }}>· {p.hora.slice(0, 5)}</span>}
            {p.metodo_pago && (
              <>
                <span>·</span>
                <span className="truncate">{p.metodo_pago}</span>
              </>
            )}
            {p.subdivision && (
              <>
                <span>·</span>
                <span>{p.subdivision}</span>
              </>
            )}
          </div>
        </div>
        <div
          className="shrink-0 text-right tabular-nums"
          style={{
            fontFamily: FONT_MONO,
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--green)',
            letterSpacing: '-0.015em',
          }}
        >
          {bs(p.monto)}
        </div>
      </div>
    </div>
  );
}

/** CSS keyframes — aurora drift, shimmer sweep, fade-up stagger */
const ANIM_CSS = `
@keyframes aurora1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(-20px, 30px) scale(1.1); }
}
@keyframes aurora2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(25px, -20px) scale(1.15); }
}
@keyframes aurora3 {
  0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.7; }
  50%      { transform: translate(-15px, -25px) scale(0.9); opacity: 1; }
}
@keyframes shimmer {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes dropDown {
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes fadeUpBtn {
  from { opacity: 0; transform: translateY(6px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulseGlow {
  0%, 100% { filter: brightness(1) drop-shadow(0 0 0 transparent); }
  50%      { filter: brightness(1.10) drop-shadow(0 0 6px rgba(255,255,255,0.30)); }
}
`;
