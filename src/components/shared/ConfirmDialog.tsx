import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warn' | 'primary' | 'info';
  loading?: boolean;
  /** Modo info: solo botón confirmText (default "Aceptar"), sin Cancelar */
  hideCancel?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

const VARIANT_BTN: Record<NonNullable<Props['variant']>, string> = {
  danger: 'bg-[#EF4444] text-white hover:bg-[#dc2626]',
  warn: 'bg-fuchsia text-white hover:bg-[#FF66C4]',
  primary: 'bg-cyan text-[#04020F] hover:bg-[#66F0FF]',
  info: 'bg-cyan text-[#04020F] hover:bg-[#66F0FF]',
};

const VARIANT_ICON_BG: Record<NonNullable<Props['variant']>, string> = {
  danger: 'rgba(239,68,68,0.12)',
  warn: 'rgba(255,31,168,0.12)',
  primary: 'rgba(0,229,255,0.12)',
  info: 'rgba(0,229,255,0.12)',
};

const VARIANT_ICON_COLOR: Record<NonNullable<Props['variant']>, string> = {
  danger: '#EF4444',
  warn: 'var(--fuchsia)',
  primary: 'var(--cyan)',
  info: 'var(--cyan)',
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText,
  cancelText = 'Cancelar',
  variant = 'primary',
  loading = false,
  hideCancel = false,
  onConfirm,
  onClose,
}: Props) {
  const finalConfirmText = confirmText ?? (hideCancel ? 'Aceptar' : 'Confirmar');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, loading, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md anim-fade-in"
      onClick={loading ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-glass-border shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)] anim-fade-in-up"
        style={{ background: 'var(--bg-card)' }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full text-text-45 transition hover:bg-white/10 hover:text-text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-3 pt-6">
          <div className="flex items-start gap-3">
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
              style={{
                background: VARIANT_ICON_BG[variant],
                color: VARIANT_ICON_COLOR[variant],
              }}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h3
                className="text-[15px] font-semibold text-text-white"
                style={{ letterSpacing: '-0.01em' }}
              >
                {title}
              </h3>
              <div className="mt-1.5 text-[13px] font-light leading-relaxed text-text-65">
                {message}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-glass-border px-5 py-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
          {!hideCancel && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 rounded-full border border-glass-border bg-glass-bg px-4 py-2 text-[12px] font-semibold uppercase text-text-65 transition hover:border-text-45 hover:text-text-white disabled:opacity-50"
              style={{ letterSpacing: '0.6px' }}
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => (onConfirm ? onConfirm() : onClose())}
            disabled={loading}
            className={`flex-1 rounded-full px-4 py-2 text-[12px] font-semibold uppercase transition disabled:opacity-50 ${VARIANT_BTN[variant]}`}
            style={{ letterSpacing: '0.6px' }}
          >
            {loading ? '…' : finalConfirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
