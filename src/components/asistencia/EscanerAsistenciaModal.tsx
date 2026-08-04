import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ScanLine, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { marcarAsistencia, parseQrPayload } from '@/lib/api/asistencia';
import { useAsistencias } from '@/hooks/useAsistencias';

interface Props {
  open: boolean;
  onClose: () => void;
}

const REGION_ID = 'dz-asistencia-scanner';

function hora(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Escáner de QR para el SUPER-ADMIN. Al leer un QR de asistencia registra la
 * asistencia (hora = escaneo) y muestra el panel en vivo (realtime) de lo que se
 * va marcando.
 */
export function EscanerAsistenciaModal({ open, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<{ obra: string; hora: string; nuevo: boolean } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const busyRef = useRef(false);

  const asisQ = useAsistencias(open);
  const recientes = (asisQ.data ?? []).slice(0, 12);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    async function onDecode(text: string) {
      // Anti-rebote: ignora el mismo código leído dentro de 4s.
      const now = Date.now();
      if (busyRef.current) return;
      if (lastScanRef.current.code === text && now - lastScanRef.current.at < 4000) return;
      lastScanRef.current = { code: text, at: now };

      const payload = parseQrPayload(text);
      if (!payload) {
        setError('QR no reconocido');
        return;
      }
      busyRef.current = true;
      try {
        const r = await marcarAsistencia(payload.i, payload.n ?? null, payload.r ?? null);
        setUltimo({ obra: r.obra || 'Inscripción', hora: hora(r.marcada_at), nuevo: !r.ya_estaba });
        if (r.ya_estaba) {
          toast(`Ya estaba marcada: ${r.obra ?? ''} · ${hora(r.marcada_at)}`);
        } else {
          toast.success(`Asistencia registrada: ${r.obra ?? ''} · ${hora(r.marcada_at)}`);
        }
        asisQ.refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo registrar');
      } finally {
        setTimeout(() => { busyRef.current = false; }, 800);
      }
    }

    const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
    scannerRef.current = scanner;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { void onDecode(decoded); },
        () => { /* frame sin QR: ignorar */ },
      )
      .catch((e) => {
        if (!cancelled) setError('No se pudo abrir la cámara: ' + (e?.message || e));
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => { try { s.clear(); } catch { /* noop */ } });
      }
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-glass-border bg-[#0d0b16] shadow-2xl md:flex-row"
      >
        {/* Cámara */}
        <div className="flex-1 border-b border-glass-border p-4 md:border-b-0 md:border-r">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan">
              <ScanLine className="h-5 w-5" />
              <span className="text-sm font-semibold">Escanear asistencia</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-text-45 transition hover:bg-white/5 hover:text-white md:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div id={REGION_ID} className="mx-auto w-full max-w-[320px] overflow-hidden rounded-xl bg-black" />
          {error && <p className="mt-3 text-center text-xs text-[#EF4444]">{error}</p>}
          {ultimo && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan/25 bg-cyan/[0.06] px-3 py-2 text-cyan">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="text-xs">
                {ultimo.nuevo ? 'Registrada' : 'Ya estaba'}: <b>{ultimo.obra}</b> · {ultimo.hora}
              </span>
            </div>
          )}
          <p className="mt-3 text-center text-[11px] text-text-45">
            Apuntá la cámara al QR del representante. Se registra al instante.
          </p>
        </div>

        {/* Panel en vivo */}
        <div className="flex w-full flex-col md:w-80">
          <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-45">Asistencias en vivo</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="hidden rounded-lg p-1.5 text-text-45 transition hover:bg-white/5 hover:text-white md:block"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {recientes.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-text-45">Sin asistencias registradas todavía.</p>
            )}
            {recientes.map((a) => (
              <div key={a.id_inscripcion} className="flex items-center gap-2 rounded-lg px-2 py-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-white">{a.obra || 'Inscripción'}</p>
                  <p className="truncate text-[11px] text-text-45">{a.agrupacion || ''}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-text-45">
                  <Clock className="h-3 w-3" /> {hora(a.marcada_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
