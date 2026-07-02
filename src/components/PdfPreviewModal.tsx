import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2, ExternalLink } from 'lucide-react';

// pdf.js cargado bajo demanda desde CDN (igual que en la gestión). Render de la
// 1ª página del PDF a un canvas → vista previa tipo "imagen" del recibo/convenio.
let _pdfjsPromise: Promise<any> | null = null;
function ensurePdfJs(): Promise<any> {
  const w = window as any;
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      try {
        w.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      } catch {
        /* noop */
      }
      resolve(w.pdfjsLib);
    };
    s.onerror = () => reject(new Error('pdf.js no cargó'));
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

interface Props {
  /** URL del PDF a previsualizar (público, p.ej. recibo_pdf_url). */
  url: string;
  title?: string;
  /** Acción del botón inferior (descargar/abrir). Si se omite, no se muestra. */
  onAction?: () => void;
  actionLabel?: string;
  actionLoading?: boolean;
  /** URL para "abrir en pestaña" (fallback si el render falla). */
  openUrl?: string;
  onClose: () => void;
}

export function PdfPreviewModal({
  url,
  title = 'Vista previa',
  onAction,
  actionLabel = 'Descargar / Abrir',
  actionLoading = false,
  openUrl,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await ensurePdfJs();
        const pdf = await pdfjs.getDocument(url).promise;
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const vp = page.getViewport({ scale: 720 / base.width });
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp }).promise;
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setErr(true);
          setLoading(false);
        }
      }
    })();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
    };
  }, [url, onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10"
        style={{ background: '#0c0a1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <span className="text-sm font-semibold text-text-90">{title}</span>
          <button onClick={onClose} aria-label="Cerrar" className="text-text-45 hover:text-text-90">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-4" style={{ background: 'rgba(0,0,0,0.3)' }}>
          {loading && <Loader2 className="h-6 w-6 animate-spin text-text-45" />}
          {err && (
            <a
              href={openUrl || url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-cyan-400 underline"
            >
              <ExternalLink className="h-4 w-4" /> Abrir PDF
            </a>
          )}
          <canvas
            ref={canvasRef}
            className={`max-w-full rounded-lg ${loading || err ? 'hidden' : ''}`}
            style={{ background: '#fff' }}
          />
        </div>
        {onAction && (
          <div className="border-t border-white/8 px-4 py-3">
            <button
              onClick={onAction}
              disabled={actionLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-bold uppercase text-white transition-transform active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', letterSpacing: '0.6px' }}
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {actionLabel}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
