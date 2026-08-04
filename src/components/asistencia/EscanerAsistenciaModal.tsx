import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ScanLine, CheckCircle2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Html5Qrcode } from 'html5-qrcode';
import { marcarAsistencia, parseQrPayload } from '@/lib/api/asistencia';
import { useAsistencias } from '@/hooks/useAsistencias';
import { dayChipClasses, dayLabel } from '@/lib/utils/dayColor';

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
 * Escáner de QR para el SUPER-ADMIN. Al leer un QR de asistencia la registra
 * (hora = escaneo) y muestra el panel en vivo (realtime) con TODO lo escaneado.
 * En móvil ocupa toda la pantalla: cámara arriba (acotada) + lista scrolleable abajo.
 */
export function EscanerAsistenciaModal({ open, onClose }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<
    { obra: string; hora: string; nuevo: boolean; orden: string | null; dia: string | null } | null
  >(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const busyRef = useRef(false);

  const asisQ = useAsistencias(open);
  const registradas = asisQ.data ?? [];

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    async function onDecode(text: string) {
      const now = Date.now();
      if (busyRef.current) return;
      if (lastScanRef.current.code === text && now - lastScanRef.current.at < 4000) return;
      lastScanRef.current = { code: text, at: now };

      const payload = parseQrPayload(text);
      if (!payload) { setError('QR no reconocido'); return; }
      busyRef.current = true;
      try {
        const r = await marcarAsistencia(payload.i, payload.n ?? null, payload.r ?? null);
        setUltimo({
          obra: r.obra || 'Inscripción',
          hora: hora(r.marcada_at),
          nuevo: !r.ya_estaba,
          orden: r.orden ?? null,
          dia: r.dia_obra ?? null,
        });
        if (r.ya_estaba) toast(`Ya estaba marcada: ${r.obra ?? ''} · ${hora(r.marcada_at)}`);
        else toast.success(`Asistencia registrada: ${r.obra ?? ''} · ${hora(r.marcada_at)}`);
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
        {
          fps: 10,
          // qrbox adaptable al tamaño de la cámara (funciona en móvil y desktop).
          qrbox: (vw: number, vh: number) => {
            const m = Math.max(140, Math.floor(Math.min(vw, vh) * 0.75));
            return { width: m, height: m };
          },
        },
        (decoded) => { void onDecode(decoded); },
        () => { /* frame sin QR */ },
      )
      .catch((e) => { if (!cancelled) setError('No se pudo abrir la cámara: ' + (e?.message || e)); });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) s.stop().then(() => s.clear()).catch(() => { try { s.clear(); } catch { /* noop */ } });
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-stretch justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden bg-[#0d0b16] shadow-2xl sm:h-auto sm:max-h-[92dvh] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-glass-border"
      >
        {/* Header siempre visible */}
        <div className="flex shrink-0 items-center justify-between border-b border-glass-border px-4 py-3">
          <div className="flex items-center gap-2 text-cyan">
            <ScanLine className="h-5 w-5" />
            <span className="text-sm font-semibold">Escanear asistencia</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-text-45 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido: móvil = columna (cámara arriba, lista abajo); desktop = fila */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Cámara (acotada, no se come la lista) */}
          <div className="shrink-0 border-b border-glass-border p-4 md:w-[46%] md:border-b-0 md:border-r">
            <div id={REGION_ID} className="mx-auto aspect-square w-full max-w-[300px] overflow-hidden rounded-xl bg-black" />
            {error && <p className="mt-3 text-center text-xs text-[#EF4444]">{error}</p>}
            {ultimo && (
              <div className="mt-3 rounded-xl border border-cyan/25 bg-cyan/[0.06] px-3 py-2.5 text-cyan">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-semibold">
                    {ultimo.nuevo ? 'Asistencia registrada' : 'Ya estaba marcada'} · {ultimo.hora}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  {ultimo.orden && (
                    <span className="shrink-0 rounded-md bg-cyan/15 px-1.5 py-0.5 text-[11px] font-bold tabular-nums">#{ultimo.orden}</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{ultimo.obra}</span>
                  {ultimo.dia && (
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase leading-none ${dayChipClasses(ultimo.dia)}`}>
                      {dayLabel(ultimo.dia)}
                    </span>
                  )}
                </div>
              </div>
            )}
            <p className="mt-3 text-center text-[11px] text-text-45">
              Apunte la cámara al código QR del representante. El registro es inmediato.
            </p>
          </div>

          {/* Lista en vivo (scrollable, muestra TODAS) */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-glass-border px-4 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-45">Asistencias registradas</span>
              <span className="rounded-full bg-cyan/15 px-2 py-0.5 text-[11px] font-bold tabular-nums text-cyan">
                {registradas.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {registradas.length === 0 && (
                <p className="px-2 py-8 text-center text-xs text-text-45">Sin asistencias registradas todavía.</p>
              )}
              {registradas.map((a) => (
                <div key={a.id_inscripcion} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-white/[0.03]">
                  {a.orden ? (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cyan/15 text-[11px] font-bold tabular-nums text-cyan">
                      {a.orden}
                    </span>
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#10B981]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-white">{a.obra || 'Inscripción'}</p>
                    <p className="truncate text-[11px] text-text-45">
                      {a.agrupacion || ''}{a.persona_nombre ? ` · ${a.persona_nombre}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {a.dia_obra && (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none ${dayChipClasses(a.dia_obra)}`}>
                        {dayLabel(a.dia_obra)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-text-45">
                      <Clock className="h-3 w-3" /> {hora(a.marcada_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
