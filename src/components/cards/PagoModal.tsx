import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { pagosApi } from '@/lib/api/pagos';
import type { CompromisoDeuda, MetodoPago } from '@/types/domain';

interface Props {
  compromiso: CompromisoDeuda | null;
  metodos: MetodoPago[];
  onClose: () => void;
  onSaved: () => void;
}

function bs(n: number): string {
  return new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2 }).format(n) + ' Bs';
}

export function PagoModal({ compromiso, metodos, onClose, onSaved }: Props) {
  const [monto, setMonto] = useState<string>('');
  const [idMetodo, setIdMetodo] = useState<string>('');
  const [observacion, setObservacion] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!compromiso) {
      setMonto('');
      setObservacion('');
      setComprobante(null);
      setComprobanteUrl(null);
      setErr(null);
      return;
    }
    setMonto(compromiso.saldo > 0 ? String(compromiso.saldo) : '');
    setIdMetodo(metodos[0]?.id_metodo ?? '');
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
        observacion: observacion.trim() || undefined,
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
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={() => !submitting && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[95vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-glass-border shadow-2xl sm:rounded-2xl"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <header className="flex items-center gap-2 border-b border-glass-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase text-cyan" style={{ letterSpacing: '0.8px' }}>
              Registrar pago
            </div>
            <div className="mt-0.5 truncate text-[13px] font-medium text-text-90">{compromiso.descripcion}</div>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            aria-label="Cerrar"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md text-text-45 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-auto p-4">
          {/* Resumen saldo */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-glass-border bg-glass-bg p-3 text-center text-[11px]">
            <div>
              <div className="text-text-45">Total</div>
              <div className="font-semibold text-text-90 tabular-nums">{bs(compromiso.monto_total)}</div>
            </div>
            <div>
              <div className="text-text-45">Pagado</div>
              <div className="font-semibold text-green tabular-nums">{bs(compromiso.pagado_verificado)}</div>
            </div>
            <div>
              <div className="text-text-45">Saldo</div>
              <div className="font-semibold text-fuchsia tabular-nums">{bs(compromiso.saldo)}</div>
            </div>
          </div>

          {/* Monto */}
          <Field label="Monto a pagar (Bs)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={compromiso.saldo}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              className="input-pago tabular-nums"
              placeholder="0.00"
            />
            <p className="mt-1 text-[10px] text-text-45">Pagos parciales permitidos · Máx: {bs(compromiso.saldo)}</p>
          </Field>

          {/* Método */}
          <Field label="Método de pago">
            <select
              value={idMetodo}
              onChange={(e) => setIdMetodo(e.target.value)}
              required
              className="input-pago"
            >
              {metodos.length === 0 && <option value="">Sin métodos disponibles</option>}
              {metodos.map((m) => (
                <option key={m.id_metodo} value={m.id_metodo}>
                  {m.metodo}
                </option>
              ))}
            </select>
          </Field>

          {/* Comprobante */}
          <Field label="Comprobante de pago">
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
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-cyan/40 bg-cyan/5 px-3 py-4 text-[12px] font-semibold uppercase text-cyan transition hover:bg-cyan/10"
                style={{ letterSpacing: '0.6px' }}
              >
                <Upload className="h-4 w-4" />
                Seleccionar archivo
              </button>
            ) : (
              <div className="space-y-2">
                {comprobanteUrl && (
                  <img
                    src={comprobanteUrl}
                    alt="Preview comprobante"
                    className="max-h-40 w-full rounded-lg object-contain"
                    style={{ background: 'var(--bg-card)' }}
                  />
                )}
                <div className="flex items-center justify-between gap-2 rounded-lg border border-glass-border bg-glass-bg p-2 text-[11px]">
                  <span className="truncate text-text-90">{comprobante.name}</span>
                  <button
                    type="button"
                    onClick={() => handleFile(null)}
                    className="rounded-md px-2 py-1 text-[10px] text-text-45 transition hover:bg-white/5 hover:text-red-400"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            )}
            <p className="mt-1 text-[10px] text-text-45">JPG / PNG / WEBP / PDF · máx 5 MB</p>
          </Field>

          {/* Observación */}
          <Field label="Observación (opcional)">
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={2}
              maxLength={300}
              className="input-pago resize-none"
              placeholder="Detalles adicionales..."
            />
          </Field>

          {err && (
            <div className="flex items-start gap-2 rounded-md border border-red-400/40 bg-red-400/5 px-3 py-2 text-[12px] text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          )}

          <div className="rounded-md border border-cyan/30 bg-cyan/5 px-3 py-2 text-[11px] text-cyan">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Una vez registrado, su pago quedará en <strong>estado "enviado"</strong> para verificación.
              </span>
            </div>
          </div>
        </form>

        <footer className="flex gap-2 border-t border-glass-border p-3">
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
            className="flex-1 rounded-lg border border-glass-border px-4 py-2.5 text-[12px] font-semibold uppercase text-text-65 transition hover:bg-white/5 disabled:opacity-50"
            style={{ letterSpacing: '0.6px' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            onClick={handleSubmit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-cyan px-4 py-2.5 text-[12px] font-semibold uppercase text-[#04020F] transition hover:bg-[#66F0FF] disabled:opacity-50"
            style={{ letterSpacing: '0.6px' }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar pago'}
          </button>
        </footer>
      </div>

      <style>{`
        .input-pago {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--glass-border);
          background: rgba(8, 5, 30, 0.6);
          padding: 0.6rem 0.85rem;
          font-size: 13px;
          color: var(--text-white);
          outline: none;
          transition: border-color 0.15s, background 0.15s;
        }
        .input-pago:focus {
          border-color: var(--cyan);
          background: rgba(8, 5, 30, 0.9);
        }
      `}</style>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="mb-1 block text-[10px] font-semibold uppercase text-text-65"
        style={{ letterSpacing: '0.6px' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}
