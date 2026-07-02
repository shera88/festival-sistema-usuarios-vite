import { useState, useEffect, type ElementType, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Receipt, Users, TrendingUp, ChevronRight, X, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api/admin';
import { pagosApi } from '@/lib/api/pagos';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import type {
  PagoConcepto,
  PagoEstado,
  AdminPagoReciente,
  AdminAgrupacionPagos,
  CompromisoDeuda,
  PagoHistorial,
} from '@/types/domain';

const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' Bs';
}

const conceptoLabel: Record<string, string> = {
  inscripcion: 'Inscripciones',
  por_participante: 'Inscripciones',
  pre_venta: 'Pre-Venta',
  credencial: 'Credenciales',
  credencial_unitaria: 'Cred. Unitarias',
};

const estadoStyle: Record<string, { bg: string; border: string; color: string; label: string }> = {
  verificado: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.40)', color: '#10B981', label: 'Verificado' },
  enviado:    { bg: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.40)',  color: '#06B6D4', label: 'Enviado' },
  pendiente:  { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.40)', color: '#F59E0B', label: 'Pendiente' },
  rechazado:  { bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.40)',  color: '#EF4444', label: 'Rechazado' },
  anulado:    { bg: 'rgba(148,163,184,0.10)',border: 'rgba(148,163,184,0.35)', color: '#94A3B8', label: 'Anulado' },
};

function EstadoBadge({ estado }: { estado: string }) {
  const s = estadoStyle[estado] ?? estadoStyle.pendiente;
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase"
      style={{ background: s.bg, borderColor: s.border, color: s.color, letterSpacing: '0.6px', fontFamily: FONT_DISPLAY }}
    >
      {s.label}
    </span>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-green" />
      <h2 className="text-[12px] font-semibold uppercase text-text-90" style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}>
        {children}
      </h2>
    </div>
  );
}

function Logo({ url, name }: { url: string | null; name: string | null }) {
  const initials = (name ?? '?').trim().slice(0, 2).toUpperCase();
  if (url) {
    return <img src={url} alt={name ?? ''} className="h-9 w-9 shrink-0 rounded-lg object-cover" loading="lazy" />;
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-glass-border bg-glass-bg text-[10px] font-bold text-text-45">
      {initials}
    </div>
  );
}

const SELECT_CLS =
  'rounded-lg border border-glass-border bg-glass-bg px-3 py-1.5 text-[11px] text-text-90';

// ──────────────────────────── gate ────────────────────────────
export function AdminPagosTab() {
  const { user } = useAuth();
  if (!user?.es_admin) return <Navigate to="/inscripciones" replace />;
  return <AdminPagosContent />;
}

// ────────────────────────── contenido ─────────────────────────
function AdminPagosContent() {
  const [estado, setEstado] = useState<'' | PagoEstado>('');
  const [concepto, setConcepto] = useState<'' | PagoConcepto>('');
  const [detalle, setDetalle] = useState<{ id: string; nombre: string } | null>(null);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const qc = useQueryClient();

  const handleDelete = async (id_pago: string) => {
    if (!window.confirm('¿Eliminar este registro de pago? Esta acción no se puede deshacer.')) return;
    setEliminando(id_pago);
    try {
      await adminApi.eliminarPago(id_pago);
      ['admin-recaudado', 'admin-recientes', 'admin-por-agrupacion', 'admin-agrup-detalle'].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      );
    } catch (e) {
      window.alert('Error al eliminar: ' + (e as Error).message);
    } finally {
      setEliminando(null);
    }
  };

  const resumenQ = useQuery({
    queryKey: ['admin-recaudado'],
    queryFn: adminApi.resumen,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const recientesQ = useQuery({
    queryKey: ['admin-recientes', estado, concepto],
    queryFn: () => adminApi.recientes({ limit: 100, estado: estado || undefined, concepto: concepto || undefined }),
    refetchInterval: 20_000,
  });
  const agrupQ = useQuery({
    queryKey: ['admin-por-agrupacion'],
    queryFn: adminApi.porAgrupacion,
    refetchInterval: 30_000,
  });

  const resumen = resumenQ.data?.resumen ?? [];
  const totVerif = resumen.reduce((a, r) => a + Number(r.total_verificado || 0), 0);
  const totPend = resumen.reduce((a, r) => a + Number(r.total_pendiente || 0), 0);
  const totPagos = resumen.reduce((a, r) => a + Number(r.n_pagos || 0), 0);

  const pagos = recientesQ.data?.pagos ?? [];
  // Solo agrupaciones con deuda real o con pagos (las de deuda 0 sin pagos son ruido:
  // se inscribieron pero su monto calculó 0 — subdivisión sin precio / convenio).
  const agrupaciones = (agrupQ.data?.agrupaciones ?? []).filter(
    (a) => Number(a.total_deuda) > 0.01 || Number(a.n_pagos) > 0,
  );

  return (
    <div className="mx-auto w-full max-w-5xl py-4">
      {/* Hero recaudado */}
      <div
        className="mb-6 overflow-hidden rounded-2xl border border-glass-border bg-glass-bg p-5"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase text-text-45" style={{ letterSpacing: '1.2px' }}>
          <ShieldCheck className="h-3.5 w-3.5 text-green" /> Panel de Pagos · Administración
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
          <div>
            <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>Recaudado (verificado)</div>
            <div className="text-[clamp(26px,6vw,34px)] font-thin leading-none tabular-nums" style={{ fontFamily: FONT_MONO, color: '#10B981' }}>{bs(totVerif)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>En revisión</div>
            <div className="text-[20px] font-thin leading-none tabular-nums" style={{ fontFamily: FONT_MONO, color: '#06B6D4' }}>{bs(totPend)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>Pagos</div>
            <div className="text-[20px] font-thin leading-none tabular-nums" style={{ fontFamily: FONT_MONO, color: 'var(--text-white)' }}>{totPagos}</div>
          </div>
        </div>
      </div>

      {/* 1) Recaudado por concepto */}
      <section className="mb-8">
        <SectionTitle icon={TrendingUp}>Recaudado por concepto</SectionTitle>
        {resumenQ.isLoading ? (
          <LoadingSkeleton rows={2} />
        ) : resumenQ.error ? (
          <EmptyState>Error al cargar el resumen. {(resumenQ.error as Error).message}</EmptyState>
        ) : resumen.length === 0 ? (
          <EmptyState>Aún no hay pagos registrados.</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {resumen.map((r) => (
              <div key={r.concepto} className="card-depth rounded-xl p-4">
                <div className="text-[11px] font-semibold uppercase text-text-90" style={{ letterSpacing: '0.6px' }}>
                  {conceptoLabel[r.concepto] ?? r.concepto}
                </div>
                <div className="mt-2 flex items-end gap-4">
                  <div>
                    <div className="text-[9px] uppercase text-text-45">Verificado</div>
                    <div className="text-[18px] font-thin tabular-nums" style={{ fontFamily: FONT_MONO, color: '#10B981' }}>{bs(Number(r.total_verificado))}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase text-text-45">En revisión</div>
                    <div className="text-[14px] font-thin tabular-nums" style={{ fontFamily: FONT_MONO, color: '#06B6D4' }}>{bs(Number(r.total_pendiente))}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-[9px] uppercase text-text-45">Pagos</div>
                    <div className="text-[14px] font-thin tabular-nums" style={{ fontFamily: FONT_MONO }}>{r.n_pagos}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2) Pagos recientes */}
      <section className="mb-8">
        <SectionTitle icon={Receipt}>Pagos recientes</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-2">
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as '' | PagoEstado)}
            className={SELECT_CLS}
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Todos los estados</option>
            <option value="verificado">Verificado</option>
            <option value="enviado">Enviado</option>
            <option value="pendiente">Pendiente</option>
            <option value="rechazado">Rechazado</option>
            <option value="anulado">Anulado</option>
          </select>
          <select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value as '' | PagoConcepto)}
            className={SELECT_CLS}
            style={{ colorScheme: 'dark' }}
          >
            <option value="">Todos los conceptos</option>
            <option value="por_participante">Inscripciones</option>
            <option value="pre_venta">Pre-Venta</option>
            <option value="credencial">Credenciales</option>
            <option value="credencial_unitaria">Cred. Unitarias</option>
          </select>
        </div>
        {recientesQ.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : recientesQ.error ? (
          <EmptyState>Error al cargar pagos. {(recientesQ.error as Error).message}</EmptyState>
        ) : pagos.length === 0 ? (
          <EmptyState>No hay pagos con esos filtros.</EmptyState>
        ) : (
          <div className="space-y-2">
            {pagos.map((p) => (
              <PagoRow
                key={p.id_pago}
                p={p}
                onOpen={() => setDetalle({ id: p.id_agrupacion, nombre: p.nombre_agrupacion ?? p.id_agrupacion })}
                onDelete={() => handleDelete(p.id_pago)}
                deleting={eliminando === p.id_pago}
              />
            ))}
          </div>
        )}
      </section>

      {/* 3) Por agrupación */}
      <section className="mb-8">
        <SectionTitle icon={Users}>Por agrupación</SectionTitle>
        {agrupQ.isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : agrupQ.error ? (
          <EmptyState>Error al cargar. {(agrupQ.error as Error).message}</EmptyState>
        ) : agrupaciones.length === 0 ? (
          <EmptyState>Ninguna agrupación con deuda o pagos todavía.</EmptyState>
        ) : (
          <div className="space-y-2">
            {agrupaciones.map((a) => (
              <AgrupRow
                key={a.id_agrupacion}
                a={a}
                onClick={() => setDetalle({ id: a.id_agrupacion, nombre: a.nombre_agrupacion ?? a.id_agrupacion })}
              />
            ))}
          </div>
        )}
      </section>

      {detalle && (
        <DetalleModal
          idAgrupacion={detalle.id}
          nombre={detalle.nombre}
          onClose={() => setDetalle(null)}
          onDelete={handleDelete}
          eliminando={eliminando}
        />
      )}
    </div>
  );
}

function PagoRow({
  p,
  onOpen,
  onDelete,
  deleting,
}: {
  p: AdminPagoReciente;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const fecha = [p.fecha, p.hora?.slice(0, 5)].filter(Boolean).join(' ');
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      className="card-depth flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition hover:border-green/40 hover:bg-white/[0.03]"
    >
      <Logo url={p.enlace_del_logo} name={p.nombre_agrupacion} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[12px] font-medium text-text-white">{p.nombre_agrupacion ?? '—'}</span>
          <EstadoBadge estado={p.estado} />
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-45">
          <span>{conceptoLabel[p.concepto] ?? p.concepto}</span>
          {p.nombre_pagador && (<><span>·</span><span className="truncate">{p.nombre_pagador}</span></>)}
          {p.telefono_pagador && (<><span>·</span><span>{p.telefono_pagador}</span></>)}
          {fecha && (<><span>·</span><span>{fecha}</span></>)}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[14px] font-medium tabular-nums" style={{ fontFamily: FONT_MONO }}>{bs(Number(p.monto))}</div>
        {p.estado === 'verificado' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); window.open(pagosApi.reciboUrl(p.id_pago), '_blank'); }}
            className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-green hover:underline"
          >
            <Receipt className="h-3 w-3" /> Recibo
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        disabled={deleting}
        title="Eliminar pago"
        aria-label="Eliminar pago"
        className="shrink-0 rounded-lg p-2 text-text-45 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function AgrupRow({ a, onClick }: { a: AdminAgrupacionPagos; onClick: () => void }) {
  const deuda = Number(a.total_deuda || 0);
  const verif = Number(a.pagado_verificado || 0);
  const pend = Number(a.pagado_pendiente || 0);
  const saldo = Number(a.saldo || 0);
  const prog = deuda > 0 ? Math.min(100, (verif / deuda) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="card-depth block w-full rounded-xl px-3 py-3 text-left transition hover:border-green/40 hover:bg-white/[0.03]"
    >
      <div className="flex items-center gap-3">
        <Logo url={a.enlace_del_logo} name={a.nombre_agrupacion} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-text-white">{a.nombre_agrupacion ?? a.id_agrupacion}</div>
          <div className="mt-0.5 text-[10px] text-text-45">{a.n_pagos} pago(s)</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[9px] uppercase text-text-45">Saldo</div>
          <div className="text-[14px] font-medium tabular-nums" style={{ fontFamily: FONT_MONO, color: saldo > 0.01 ? '#F59E0B' : '#10B981' }}>{bs(saldo)}</div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-text-45" />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-full rounded-full" style={{ width: `${prog}%`, background: '#10B981' }} />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-[9.5px] tabular-nums text-text-45" style={{ fontFamily: FONT_MONO }}>
        <span>Deuda {bs(deuda)}</span>
        <span style={{ color: '#10B981' }}>Verif. {bs(verif)}</span>
        {pend > 0.01 && <span style={{ color: '#06B6D4' }}>Rev. {bs(pend)}</span>}
      </div>
    </button>
  );
}

// Inscripción (compromiso) expandible → muestra SUS pagos (filtrados de lo ya cargado).
function CompromisoItem({ c, pagos }: { c: CompromisoDeuda; pagos: PagoHistorial[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-glass-border bg-glass-bg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full p-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-text-white">
            {c.descripcion || conceptoLabel[c.concepto] || c.concepto}
          </span>
          <span
            className="shrink-0 text-[13px] font-medium tabular-nums"
            style={{ fontFamily: FONT_MONO, color: c.saldo > 0.01 ? '#F59E0B' : '#10B981' }}
          >
            {bs(c.saldo)}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[10px] text-text-45">
          <span>{conceptoLabel[c.concepto] ?? c.concepto}</span>
          {c.subdivision && <span>· {c.subdivision}</span>}
          {c.bailarines ? <span>· {c.bailarines} bailarines</span> : null}
          <span>· Total {bs(c.monto_total)}</span>
          <span>· Verif. {bs(c.pagado_verificado)}</span>
          <span className="ml-auto inline-flex items-center gap-1 text-text-65">
            {pagos.length} pago(s)
            <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-glass-border px-3 py-2" style={{ background: 'rgba(0,0,0,0.2)' }}>
          {pagos.length === 0 ? (
            <div className="py-1 text-[11px] italic text-text-45">Sin pagos para esta inscripción.</div>
          ) : (
            <div className="space-y-1.5">
              {pagos.map((p) => (
                <div key={p.id_pago} className="flex items-center justify-between gap-2 text-[11px]">
                  <div className="flex min-w-0 items-center gap-2">
                    <EstadoBadge estado={p.estado} />
                    <span className="truncate text-text-65">
                      {[p.fecha, p.hora?.slice(0, 5)].filter(Boolean).join(' ')}
                      {p.metodo_pago ? ` · ${p.metodo_pago}` : ''}
                      {p.nombre_pagador ? ` · ${p.nombre_pagador}` : ''}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="tabular-nums" style={{ fontFamily: FONT_MONO }}>{bs(Number(p.monto))}</span>
                    {p.recibo_pdf_url && p.estado === 'verificado' && (
                      <button
                        type="button"
                        onClick={() => window.open(pagosApi.reciboUrl(p.id_pago), '_blank')}
                        className="text-green hover:underline"
                      >
                        Recibo
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────── modal de detalle por agrupación ────────────────────
function DetalleModal({
  idAgrupacion,
  nombre,
  onClose,
  onDelete,
  eliminando,
}: {
  idAgrupacion: string;
  nombre: string;
  onClose: () => void;
  onDelete: (id_pago: string) => void;
  eliminando: string | null;
}) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  const q = useQuery({
    queryKey: ['admin-agrup-detalle', idAgrupacion],
    queryFn: () => adminApi.agrupacionDetalle(idAgrupacion),
  });

  const compromisos = q.data?.compromisos ?? [];
  const historial = q.data?.historial ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-glass-border sm:rounded-3xl"
        style={{ background: 'var(--bg-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-glass-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] uppercase text-text-45" style={{ letterSpacing: '1px' }}>Detalle de agrupación</div>
            <div className="truncate text-[15px] font-medium text-text-white">{nombre}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-full p-2 text-text-45 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {q.isLoading ? (
            <div className="p-5"><LoadingSkeleton rows={3} /></div>
          ) : q.error ? (
            <div className="p-5"><EmptyState>Error: {(q.error as Error).message}</EmptyState></div>
          ) : (
            <div className="space-y-5 p-5">
              {/* Inscripciones / deudas */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase text-text-90" style={{ letterSpacing: '0.8px' }}>
                  Inscripciones / deudas
                </div>
                {compromisos.length === 0 ? (
                  <div className="text-[12px] italic text-text-45">Sin inscripciones.</div>
                ) : (
                  <>
                    <div className="mb-1.5 text-[10px] text-text-45">Tocá una inscripción para ver sus pagos.</div>
                    <div className="space-y-2">
                      {compromisos.map((c, i) => (
                        <CompromisoItem
                          key={i}
                          c={c}
                          pagos={historial.filter(
                            (p) =>
                              p.concepto === c.concepto &&
                              String(p.id_referencia ?? '') === String(c.id_referencia ?? ''),
                          )}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Pagos registrados (con fecha/hora) */}
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase text-text-90" style={{ letterSpacing: '0.8px' }}>
                  Pagos registrados
                </div>
                {historial.length === 0 ? (
                  <div className="text-[12px] italic text-text-45">Sin pagos registrados.</div>
                ) : (
                  <div className="space-y-2">
                    {historial.map((p) => (
                      <div key={p.id_pago} className="rounded-xl border border-glass-border bg-glass-bg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-text-white">{conceptoLabel[p.concepto] ?? p.concepto}</span>
                            <EstadoBadge estado={p.estado} />
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[13px] font-medium tabular-nums" style={{ fontFamily: FONT_MONO }}>{bs(Number(p.monto))}</span>
                            <button
                              type="button"
                              onClick={() => onDelete(p.id_pago)}
                              disabled={eliminando === p.id_pago}
                              title="Eliminar pago"
                              aria-label="Eliminar pago"
                              className="rounded-md p-1.5 text-text-45 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[10px] text-text-45">
                          {p.metodo_pago && <span>{p.metodo_pago}</span>}
                          {p.nombre_pagador && <span>· {p.nombre_pagador}</span>}
                          {(p.fecha || p.hora) && <span>· {[p.fecha, p.hora?.slice(0, 5)].filter(Boolean).join(' ')}</span>}
                          {p.recibo_pdf_url && p.estado === 'verificado' && (
                            <button
                              type="button"
                              onClick={() => window.open(pagosApi.reciboUrl(p.id_pago), '_blank')}
                              className="text-green hover:underline"
                            >
                              · Recibo
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
