import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, AlertCircle, ShieldCheck, ArrowUpRight, Trash2, TrendingDown, CheckCircle2 } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import { webpProxy } from '@/lib/utils/img';
import type { CompromisoDeuda, MetodoPago } from '@/types/domain';

interface Props {
  compromiso: CompromisoDeuda | null;
  metodos: MetodoPago[];
  onClose: () => void;
  onSaved: () => void;
}

const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', 'SF Mono', Menlo, monospace";

const conceptoAccent: Record<string, { grad: string; accent: string; glow: string }> = {
  inscripcion:       { grad: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)', accent: '#06B6D4', glow: 'rgba(6,182,212,0.35)' },
  convenio_entradas: { grad: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)', accent: '#EC4899', glow: 'rgba(236,72,153,0.35)' },
  credencial:        { grad: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)', accent: '#F59E0B', glow: 'rgba(245,158,11,0.32)' },
  credencial_unit:   { grad: 'linear-gradient(135deg, #F59E0B 0%, #EC4899 100%)', accent: '#F59E0B', glow: 'rgba(245,158,11,0.32)' },
};

function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Bs';
}

export function PagoModal({ compromiso, metodos, onClose, onSaved }: Props) {
  const [monto, setMonto] = useState<string>('');
  const [idMetodo, setIdMetodo] = useState<string>('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLightbox, setQrLightbox] = useState(false);
  const QR_URL = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/qr-inscripcion.png';
  const fileRef = useRef<HTMLInputElement>(null);

  // Solo QR habilitado en portal de usuarios
  const metodosQR = metodos.filter((m) => /qr/i.test(m.metodo));

  useEffect(() => {
    if (!compromiso) {
      setMonto('');
      setComprobante(null);
      setComprobanteUrl(null);
      setErr(null);
      return;
    }
    setMonto('');
    setIdMetodo(metodosQR[0]?.id_metodo ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compromiso, metodos]);

  useEffect(() => {
    if (!compromiso) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [compromiso, onClose, submitting]);

  if (!compromiso) return null;

  const cfg = conceptoAccent[compromiso.concepto] ?? conceptoAccent.inscripcion;

  const montoNum = (() => {
    const n = Number(monto);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.min(n, compromiso.saldo);
  })();
  const saldoRestante = Math.max(0, compromiso.saldo - montoNum);
  const cubreTotal = montoNum > 0 && montoNum >= compromiso.saldo - 0.5;
  const progresoActual = compromiso.monto_total > 0
    ? Math.min(1, compromiso.pagado_verificado / compromiso.monto_total)
    : 0;
  const progresoPreview = compromiso.monto_total > 0
    ? Math.min(1, (compromiso.pagado_verificado + montoNum) / compromiso.monto_total)
    : 0;

  function handleMontoChange(raw: string) {
    if (raw === '') { setMonto(''); return; }
    const n = Number(raw);
    if (!isFinite(n) || n < 0) return;
    if (n > compromiso!.saldo) {
      setMonto(String(Math.round(compromiso!.saldo)));
      return;
    }
    setMonto(raw);
  }

  function handleFile(f: File | null) {
    if (comprobanteUrl) {
      URL.revokeObjectURL(comprobanteUrl);
      setComprobanteUrl(null);
    }
    setComprobante(f);
    if (f && f.type.startsWith('image/')) {
      setComprobanteUrl(URL.createObjectURL(f));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    const c = compromiso;
    if (!c) return;

    const m = Number(monto);
    if (!isFinite(m) || m <= 0) {
      setErr('Monto inválido');
      return;
    }
    if (m > c.saldo + 0.01) {
      setErr(`Monto excede el saldo (${bs(c.saldo)})`);
      return;
    }
    if (!idMetodo) {
      setErr('Seleccione método de pago');
      return;
    }
    if (!comprobante) {
      setErr('Suba un comprobante de pago');
      return;
    }

    setSubmitting(true);
    try {
      await pagosApi.crear({
        concepto: c.concepto,
        id_referencia: c.id_referencia,
        monto: m,
        id_metodo_pago: idMetodo,
        comprobante,
      });
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error al registrar el pago');
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <>
      <style>{MODAL_CSS}</style>
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center bg-black/92 sm:items-center sm:p-6"
        onClick={() => !submitting && onClose()}
        style={{ animation: 'modalFade 0.18s ease-out' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[95vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/[0.08] shadow-2xl sm:rounded-3xl"
          style={{
            background: '#0a0817',
            animation: 'modalSlide 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
            boxShadow: `0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -20px ${cfg.glow}`,
            contain: 'paint',
            transform: 'translateZ(0)',
          }}
        >

          <header className="relative flex items-center gap-3 border-b border-white/[0.05] px-5 py-4">
            <div className="min-w-0 flex-1">
              <div
                className="text-[9.5px] font-bold uppercase"
                style={{ letterSpacing: '1.6px', color: cfg.accent, fontFamily: FONT_DISPLAY }}
              >
                Registrar pago
              </div>
              <div
                className="mt-1 truncate text-[14px] font-semibold text-text-white"
                style={{ fontFamily: FONT_DISPLAY, letterSpacing: '-0.015em' }}
              >
                {compromiso.descripcion}
              </div>
            </div>
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              aria-label="Cerrar"
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-text-45 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <form
            onSubmit={handleSubmit}
            className="relative flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-5 py-5"
            style={{
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
              transform: 'translateZ(0)',
            }}
          >
            {/* Resumen saldo — grid 3 con dividers · saldo es LIVE */}
            <div
              className="grid grid-cols-3 divide-x divide-white/[0.06] rounded-2xl border border-white/[0.06] py-3"
              style={{ background: 'rgba(255,255,255,0.02)' }}
            >
              <StatBox label="Total" value={bs(compromiso.monto_total)} />
              <StatBox label="Pagado" value={bs(compromiso.pagado_verificado + montoNum)} color="#10B981" />
              <StatBox
                label={montoNum > 0 ? 'Quedará' : 'Saldo'}
                value={bs(saldoRestante)}
                color={cubreTotal ? '#10B981' : cfg.accent}
                bold
                hint={montoNum > 0 ? `de ${bs(compromiso.saldo)}` : undefined}
              />
            </div>

            {/* Monto a pagar — hero input */}
            <div>
              <label className="block">
                <span
                  className="mb-2 block text-[9.5px] font-bold uppercase text-text-45"
                  style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}
                >
                  Monto a pagar
                </span>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max={compromiso.saldo}
                    value={monto}
                    onChange={(e) => handleMontoChange(e.target.value)}
                    required
                    placeholder="0"
                    className="pago-input-hero w-full"
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: '28px',
                      fontWeight: 600,
                      letterSpacing: '-0.025em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                  <span
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-semibold text-text-45"
                    style={{ fontFamily: FONT_DISPLAY }}
                  >
                    Bs
                  </span>
                </div>
              </label>

              {/* Quick chips: 25/50/75/100% */}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {[0.25, 0.5, 0.75, 1].map((frac) => {
                  const amount = Math.round(compromiso.saldo * frac);
                  if (amount <= 0) return null;
                  const isAll = frac === 1;
                  const label = isAll ? 'Todo' : `${Math.round(frac * 100)}%`;
                  const isActive = Math.abs(montoNum - amount) < 1;
                  return (
                    <button
                      key={frac}
                      type="button"
                      onClick={() => setMonto(String(amount))}
                      className="rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold uppercase transition hover:bg-white/[0.04]"
                      style={{
                        borderColor: isActive ? cfg.accent : `${cfg.accent}30`,
                        background: isActive ? `${cfg.accent}14` : 'transparent',
                        color: cfg.accent,
                        letterSpacing: '0.8px',
                        fontFamily: FONT_DISPLAY,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
                <span
                  className="ml-auto text-[10px] text-text-45"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  Máx <span style={{ fontFamily: FONT_MONO, color: 'var(--text-65)' }}>{bs(compromiso.saldo)}</span>
                </span>
              </div>

              {/* Preview en vivo: barra progreso + delta */}
              <div
                className="mt-3 rounded-2xl border px-3.5 py-3"
                style={{
                  borderColor: cubreTotal ? 'rgba(16,185,129,0.32)' : 'rgba(255,255,255,0.06)',
                  background: cubreTotal ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.015)',
                  transition: 'background 0.25s, border-color 0.25s',
                }}
              >
                <div className="flex items-center justify-between text-[10px]" style={{ fontFamily: FONT_DISPLAY }}>
                  <span className="font-semibold uppercase text-text-45" style={{ letterSpacing: '1px' }}>
                    Progreso deuda
                  </span>
                  <span
                    className="font-bold tabular-nums"
                    style={{ fontFamily: FONT_MONO, color: cubreTotal ? '#10B981' : 'var(--text-90)' }}
                  >
                    {Math.round(progresoPreview * 100)}%
                  </span>
                </div>
                <div
                  className="relative mt-2 h-2 overflow-hidden rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {/* Pagado actual */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${progresoActual * 100}%`,
                      background: '#10B981',
                      transition: 'width 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  />
                  {/* Preview (este pago) */}
                  <div
                    className="absolute inset-y-0 rounded-r-full"
                    style={{
                      left: `${progresoActual * 100}%`,
                      width: `${Math.max(0, (progresoPreview - progresoActual) * 100)}%`,
                      background: cubreTotal
                        ? 'linear-gradient(90deg, #10B981, #34D399)'
                        : `linear-gradient(90deg, ${cfg.accent}, ${cfg.accent}99)`,
                      transition: 'width 0.18s ease-out, background 0.25s',
                      boxShadow: montoNum > 0 ? `0 0 12px ${cfg.glow}` : undefined,
                    }}
                  />
                </div>
                <div
                  className="mt-2 flex items-center justify-between text-[10.5px]"
                  style={{ fontFamily: FONT_DISPLAY }}
                >
                  {montoNum > 0 ? (
                    <span
                      className="flex items-center gap-1 font-semibold"
                      style={{ color: cubreTotal ? '#10B981' : cfg.accent }}
                    >
                      <TrendingDown className="h-3 w-3" strokeWidth={2.5} />
                      Saldo baja <span style={{ fontFamily: FONT_MONO, fontWeight: 700 }}>{bs(montoNum)}</span>
                    </span>
                  ) : (
                    <span className="text-text-45">Ingrese un monto para ver el impacto</span>
                  )}
                  {cubreTotal && (
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase"
                      style={{
                        background: 'rgba(16,185,129,0.14)',
                        color: '#10B981',
                        letterSpacing: '0.8px',
                      }}
                    >
                      <CheckCircle2 className="h-3 w-3" strokeWidth={2.6} />
                      Saldará deuda
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Método de pago — texto fijo (solo QR habilitado) */}
            <div>
              <span
                className="mb-2 block text-[9.5px] font-bold uppercase text-text-45"
                style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}
              >
                Método de pago
              </span>
              {metodosQR.length === 0 ? (
                <p className="text-[12px] text-text-45">Sin métodos disponibles</p>
              ) : (
                <div
                  className="text-[13px] font-semibold uppercase text-text-white"
                  style={{ fontFamily: FONT_DISPLAY, letterSpacing: '0.5px' }}
                >
                  {metodosQR[0].metodo}
                </div>
              )}
            </div>

            {/* Generar QR — placeholder hasta integrar API banco */}
            <div>
              <button
                type="button"
                onClick={() => setQrOpen((v) => !v)}
                className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-[11.5px] font-bold uppercase text-white transition-transform active:scale-[0.98]"
                style={{
                  background: cfg.grad,
                  fontFamily: FONT_DISPLAY,
                  letterSpacing: '0.9px',
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.18) inset, 0 1px 0 0 rgba(255,255,255,0.25) inset, 0 8px 24px ${cfg.glow}`,
                  textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                }}
              >
                <span
                  className="pointer-events-none absolute inset-0 -translate-x-full transition-transform ease-in-out group-hover:translate-x-full"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
                    transitionDuration: '1800ms',
                  }}
                />
                <span className="relative grid h-5 w-5 place-items-center rounded-md" style={{ background: 'rgba(255,255,255,0.22)' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" className="h-3 w-3">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3M17 17v4M21 14v3M14 21h7" />
                  </svg>
                </span>
                <span className="relative">{qrOpen ? 'Ocultar QR' : 'Generar QR de pago'}</span>
              </button>

              {/* QR placeholder — imagen estática hasta integrar API banco */}
              {qrOpen && (
                <div
                  className="mt-3 overflow-hidden rounded-2xl border anim-fade-in"
                  style={{
                    borderColor: `${cfg.accent}40`,
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  }}
                >
                  <div className="px-4 py-3 text-center" style={{ background: `${cfg.accent}10` }}>
                    <div
                      className="text-[9.5px] font-bold uppercase"
                      style={{
                        color: cfg.accent,
                        letterSpacing: '0.22em',
                        fontFamily: FONT_DISPLAY,
                      }}
                    >
                      Escanee con su app bancaria
                    </div>
                    <div
                      className="mt-1 text-[10.5px] text-text-45"
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      Monto a transferir: <span className="font-semibold text-text-white" style={{ fontFamily: FONT_MONO }}>{bs(montoNum)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrLightbox(true)}
                    aria-label="Ampliar QR"
                    className="block w-full cursor-pointer transition-opacity hover:opacity-95"
                  >
                    <img
                      src={webpProxy(QR_URL, 600) ?? QR_URL}
                      alt="QR de pago Festival Danzarte"
                      className="block h-auto w-full"
                      loading="lazy"
                      decoding="async"
                      width={600}
                      height={848}
                    />
                  </button>
                  <div className="flex px-3 py-2.5" style={{ background: 'rgba(0,0,0,0.25)' }}>
                    <a
                      href={QR_URL}
                      download="festival-danzarte-qr.png"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-[10px] font-bold uppercase text-white transition-transform active:scale-[0.97]"
                      style={{
                        background: cfg.grad,
                        fontFamily: FONT_DISPLAY,
                        letterSpacing: '0.6px',
                        boxShadow: `0 0 0 1px rgba(255,255,255,0.18) inset, 0 4px 12px ${cfg.glow}`,
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3 w-3">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Descargar
                    </a>
                  </div>
                  <div
                    className="px-4 py-2 text-center text-[9.5px]"
                    style={{
                      background: 'rgba(0,0,0,0.25)',
                      color: 'var(--text-45)',
                      fontFamily: FONT_DISPLAY,
                      letterSpacing: '0.04em',
                    }}
                  >
                    Después de pagar, suba el comprobante abajo
                  </div>
                </div>
              )}
            </div>

            {/* Comprobante */}
            <div>
              <span
                className="mb-2 block text-[9.5px] font-bold uppercase text-text-45"
                style={{ letterSpacing: '1.4px', fontFamily: FONT_DISPLAY }}
              >
                Comprobante de pago
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
              {!comprobante ? (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-6 text-[11px] font-semibold uppercase transition-colors"
                  style={{
                    borderColor: `${cfg.accent}40`,
                    background: `${cfg.accent}08`,
                    color: cfg.accent,
                    letterSpacing: '0.8px',
                    fontFamily: FONT_DISPLAY,
                  }}
                >
                  <Upload className="h-5 w-5" strokeWidth={2.2} />
                  <span>Seleccionar archivo</span>
                  <span className="text-[9px] font-medium text-text-45" style={{ letterSpacing: '0.3px' }}>
                    JPG · PNG · WEBP · PDF · máx 5 MB
                  </span>
                </button>
              ) : (
                <div className="space-y-2">
                  {comprobanteUrl && (
                    <img
                      src={comprobanteUrl}
                      alt="Preview comprobante"
                      className="max-h-48 w-full rounded-xl object-contain"
                      style={{ background: '#171429', border: '1px solid rgba(255,255,255,0.06)' }}
                    />
                  )}
                  <div
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px]"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <span
                      className="truncate text-text-90"
                      style={{ fontFamily: FONT_DISPLAY }}
                    >
                      {comprobante.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleFile(null)}
                      className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase text-text-45 transition hover:bg-red-500/10 hover:text-red-400"
                      style={{ letterSpacing: '0.5px', fontFamily: FONT_DISPLAY }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Quitar
                    </button>
                  </div>
                </div>
              )}
            </div>


            {err && (
              <div
                className="flex items-start gap-2 rounded-xl border border-red-500/35 px-3 py-2.5 text-[11.5px] text-red-400"
                style={{ background: 'rgba(239,68,68,0.05)', fontFamily: FONT_DISPLAY }}
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}

            <div
              className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[10.5px]"
              style={{
                borderColor: `${cfg.accent}30`,
                background: `${cfg.accent}08`,
                color: cfg.accent,
                fontFamily: FONT_DISPLAY,
              }}
            >
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Una vez registrado, su pago quedará en{' '}
                <strong style={{ fontWeight: 700 }}>estado enviado</strong> para verificación.
              </span>
            </div>
          </form>

          <footer className="relative flex gap-2 border-t border-white/[0.05] px-5 py-4">
            <button
              type="button"
              onClick={() => !submitting && onClose()}
              disabled={submitting}
              className="flex-1 rounded-full border border-white/[0.08] px-4 py-3 text-[10.5px] font-bold uppercase text-text-65 transition hover:bg-white/[0.04] disabled:opacity-50"
              style={{ letterSpacing: '0.9px', fontFamily: FONT_DISPLAY }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              onClick={handleSubmit}
              className="group/btn relative flex flex-[1.5] items-center justify-center gap-1.5 overflow-hidden rounded-full px-4 py-3 text-[10.5px] font-bold uppercase text-white transition-transform active:scale-[0.97] disabled:opacity-50"
              style={{
                background: cfg.grad,
                letterSpacing: '0.9px',
                fontFamily: FONT_DISPLAY,
                boxShadow: `0 0 0 1px rgba(255,255,255,0.18) inset, 0 1px 0 0 rgba(255,255,255,0.22) inset, 0 6px 20px ${cfg.glow}`,
                textShadow: '0 1px 2px rgba(0,0,0,0.4)',
              }}
            >
              <span
                className="absolute inset-0 -translate-x-full transition-transform duration-700 group-hover/btn:translate-x-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)' }}
              />
              <span className="relative flex items-center gap-1.5">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando
                  </>
                ) : (
                  <>
                    Registrar pago
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.8} />
                  </>
                )}
              </span>
            </button>
          </footer>
        </div>
      </div>

      {/* Lightbox QR — overlay sobre el modal */}
      {qrLightbox && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/95 p-4"
          onClick={() => setQrLightbox(false)}
          style={{ animation: 'modalFade 0.18s ease-out' }}
        >
          <button
            type="button"
            onClick={() => setQrLightbox(false)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 grid h-10 w-10 cursor-pointer place-items-center rounded-full text-white transition hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          >
            <X className="h-5 w-5" />
          </button>
          <a
            href={QR_URL}
            download="festival-danzarte-qr.png"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-2.5 text-[11px] font-bold uppercase text-white transition-transform active:scale-[0.97]"
            style={{
              background: cfg.grad,
              fontFamily: FONT_DISPLAY,
              letterSpacing: '0.9px',
              boxShadow: `0 0 0 1px rgba(255,255,255,0.18) inset, 0 8px 24px ${cfg.glow}`,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="h-3.5 w-3.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Descargar QR
          </a>
          <img
            src={webpProxy(QR_URL, 1200) ?? QR_URL}
            alt="QR de pago Festival Danzarte"
            className="max-h-[85vh] max-w-[90vw] rounded-xl shadow-2xl"
            decoding="async"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>,
    document.body,
  );
}

function StatBox({
  label,
  value,
  color,
  bold,
  hint,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
  hint?: string;
}) {
  return (
    <div className="px-3 text-center first:pl-3 last:pr-3">
      <div
        className="text-[9px] font-bold uppercase text-text-45"
        style={{ letterSpacing: '1px', fontFamily: FONT_DISPLAY }}
      >
        {label}
      </div>
      <div
        className="mt-1 leading-none tabular-nums transition-colors"
        style={{
          fontFamily: FONT_MONO,
          fontSize: '13.5px',
          fontWeight: bold ? 700 : 600,
          color: color ?? 'var(--text-white)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="mt-0.5 text-[8.5px] font-medium text-text-45"
          style={{ letterSpacing: '0.3px', fontFamily: FONT_DISPLAY }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

const MODAL_CSS = `
@keyframes modalFade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes modalSlide {
  from { opacity: 0; transform: translateY(20px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.pago-input-hero {
  border-radius: 1rem;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.02);
  padding: 1rem 3rem 1rem 1.25rem;
  color: var(--text-white);
  outline: none;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.pago-input-hero:focus {
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.04);
  box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
}
.pago-input-hero::-webkit-outer-spin-button,
.pago-input-hero::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.pago-input-hero[type=number] {
  -moz-appearance: textfield;
}
.pago-input {
  border-radius: 0.75rem;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02);
  padding: 0.7rem 0.9rem;
  font-size: 12.5px;
  color: var(--text-white);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.pago-input:focus {
  border-color: rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.04);
}
.pago-input::placeholder {
  color: var(--text-25);
}
`;
