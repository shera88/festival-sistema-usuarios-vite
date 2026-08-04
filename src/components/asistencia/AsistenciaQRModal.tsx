import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

interface Props {
  open: boolean;
  onClose: () => void;
  /** String que se codifica en el QR (JSON compacto de asistencia). */
  payload: string;
  obra: string | null;
  agrupacion: string | null;
}

/**
 * QR que muestra el representante/coreógrafo/director al staff. El super-admin lo
 * escanea y ESE escaneo registra la asistencia. Mientras tanto queda "pendiente".
 */
export function AsistenciaQRModal({ open, onClose, payload, obra, agrupacion }: Props) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toDataURL(payload, {
      width: 340,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0A0A0F', light: '#FFFFFF' },
    })
      .then((u) => { if (alive) setUrl(u); })
      .catch(() => { if (alive) setUrl(''); });
    return () => { alive = false; };
  }, [open, payload]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-glass-border bg-[#0d0b16] p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan">
            <QrCode className="h-5 w-5" />
            <span className="text-sm font-semibold">Marcar asistencia</span>
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

        <div className="mx-auto flex w-fit items-center justify-center rounded-xl bg-white p-3">
          {url ? (
            <img src={url} alt="QR de asistencia" width={280} height={280} className="block" />
          ) : (
            <div className="grid h-[280px] w-[280px] place-items-center text-[#0A0A0F]">Generando…</div>
          )}
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm font-semibold text-white">{obra || 'Inscripción'}</p>
          <p className="text-xs text-text-45">{agrupacion || ''}</p>
        </div>

        <p className="mt-4 rounded-xl border border-gold/25 bg-gold/[0.06] px-3 py-2.5 text-center text-[12px] leading-relaxed text-gold">
          Mostrá este QR al personal del festival. Cuando lo escaneen, tu asistencia
          queda registrada con la hora exacta.
        </p>
      </div>
    </div>,
    document.body,
  );
}
