import { useRef, useCallback, useState, useEffect, type CSSProperties } from "react";

type ZoomableImageProps = {
  src: string;
  srcSetWebp?: string;
  alt: string;
  className?: string;
  /** Clase aplicada al `<button>` trigger. Útil cuando el contenedor padre
   * usa aspect-ratio + absolute children (ej. Hero poster). */
  triggerClassName?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const WHEEL_STEP = 0.0015;
const BTN_STEP = 0.4;

/**
 * Image that opens a full-screen lightbox on click. Lightbox supports:
 * - Wheel zoom (centered at cursor)
 * - Click+drag pan when zoomed
 * - +/-/reset buttons
 * - Pinch zoom on touch devices
 * - ESC, backdrop click, X button to close
 */
export function ZoomableImage({
  src,
  srcSetWebp,
  alt,
  className,
  triggerClassName,
  style,
  loading = "lazy",
}: ZoomableImageProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setTx(0);
    setTy(0);
  }, []);

  const openLightbox = useCallback(() => {
    reset();
    dialogRef.current?.showModal();
    setOpen(true);
  }, [reset]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
  }, []);

  // Native dialog close (ESC) → sync state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  // Wheel zoom centered at cursor
  useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      setScale((prev) => {
        const next = clamp(prev * (1 - e.deltaY * WHEEL_STEP), MIN_SCALE, MAX_SCALE);
        // Adjust translation so the cursor point stays put under the new scale.
        const ratio = next / prev;
        setTx((t) => cx - (cx - t) * ratio);
        setTy((t) => cy - (cy - t) * ratio);
        return next;
      });
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [open]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    setTx(d.tx + (e.clientX - d.x));
    setTy(d.ty + (e.clientY - d.y));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  // Touch pinch zoom
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { dist: Math.hypot(dx, dy), scale };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const next = clamp(pinchRef.current.scale * (dist / pinchRef.current.dist), MIN_SCALE, MAX_SCALE);
      setScale(next);
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  const onBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) close();
  };

  return (
    <>
      <button
        type="button"
        onClick={openLightbox}
        aria-label={`Ampliar imagen: ${alt}`}
        className={`group relative block cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left ${triggerClassName ?? "w-full"}`}
      >
        <picture>
          {srcSetWebp && <source srcSet={srcSetWebp} type="image/webp" />}
          <img
            src={src}
            alt={alt}
            className={className}
            style={style}
            loading={loading}
            decoding="async"
          />
        </picture>
      </button>

      <dialog
        ref={dialogRef}
        onClick={onBackdropClick}
        className="m-0 max-h-none max-w-none border-0 bg-transparent p-0 backdrop:bg-[rgba(4,2,15,0.92)] backdrop:backdrop-blur-sm"
        style={{ inset: 0, width: "100vw", height: "100vh" }}
      >
        <div
          ref={stageRef}
          className="relative flex h-full w-full select-none items-center justify-center overflow-hidden"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={(e) => {
            // Click directo en el stage (fuera de imagen y controles) → cerrar.
            if (e.target === e.currentTarget) close();
          }}
          style={{ cursor: dragRef.current ? "grabbing" : scale > 1 ? "grab" : "default" }}
        >
          <picture
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
              transition: dragRef.current ? "none" : "transform 180ms cubic-bezier(0.25, 1, 0.5, 1)",
              willChange: "transform",
            }}
          >
            {srcSetWebp && <source srcSet={srcSetWebp} type="image/webp" />}
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="max-h-[92vh] max-w-[96vw] rounded-2xl object-contain shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]"
            />
          </picture>

          {/* Controls */}
          <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center sm:bottom-8">
            <div
              className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/15 bg-black/55 p-1 backdrop-blur-md"
              onClick={(e) => e.stopPropagation()}
            >
              <CtrlButton
                aria-label="Alejar"
                onClick={() => setScale((s) => clamp(s - BTN_STEP, MIN_SCALE, MAX_SCALE))}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </CtrlButton>
              <span className="px-2 font-mono text-[11px] text-white/70 tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <CtrlButton
                aria-label="Acercar"
                onClick={() => setScale((s) => clamp(s + BTN_STEP, MIN_SCALE, MAX_SCALE))}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </CtrlButton>
              <span className="mx-1 h-5 w-px bg-white/15" aria-hidden />
              <CtrlButton aria-label="Restablecer" onClick={reset}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <polyline points="3 4 3 10 9 10" />
                </svg>
              </CtrlButton>
            </div>
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="absolute right-4 top-4 grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur-md transition-colors hover:border-[var(--brand-cyan)] hover:text-[var(--brand-cyan)] sm:right-6 sm:top-6"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </dialog>
    </>
  );
}

function CtrlButton({
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      {...rest}
    >
      {children}
    </button>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
