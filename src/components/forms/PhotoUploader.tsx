import { useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvatarFallback } from './AvatarFallback';

type Props = {
  label: string;
  currentUrl?: string | null;
  fallbackName?: string;
  /** Notifica al padre cuando la imagen actual (currentUrl) falla al cargar */
  onCurrentImageError?: () => void;
  accept?: string;
  onFileChange: (file: File | null) => void;
  hint?: string;
  error?: string;
  circle?: boolean;
};

export function PhotoUploader({
  label,
  currentUrl,
  fallbackName,
  onCurrentImageError,
  accept = 'image/png,image/jpeg,image/webp,image/gif',
  onFileChange,
  hint = 'PNG, JPG, WebP o GIF — máximo 10 MB',
  error,
  circle = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  // Reset preview/file cuando cambia currentUrl
  useEffect(() => {
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setImgFailed(false);
    if (inputRef.current) inputRef.current.value = '';
    onFileChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUrl]);

  const isReplace = !!preview;
  const keepsCurrent = !isReplace && !!currentUrl && !imgFailed;
  const showFallbackAvatar = !isReplace && !!currentUrl && imgFailed && !!fallbackName;
  const hasPreview = isReplace || keepsCurrent;
  const src = isReplace ? preview! : currentUrl ?? '';

  const title = isReplace
    ? 'Nueva imagen seleccionada'
    : keepsCurrent
      ? 'Imagen registrada'
      : showFallbackAvatar
        ? 'Logo no disponible'
        : `Subir ${label.toLowerCase()}`;

  const subtitle = isReplace
    ? `${(file!.size / 1024 / 1024).toFixed(2)} MB`
    : showFallbackAvatar
      ? 'Imagen registrada no se puede mostrar — suba una nueva.'
      : hint;

  const inputId = `photo-${label.replace(/\s+/g, '-')}`;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    onFileChange(f);
    const url = URL.createObjectURL(f);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  function handleRemove() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    onFileChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      <label className="mb-2 block text-[11px] font-medium uppercase text-text-65" style={{ letterSpacing: '0.5px' }}>
        {label}
      </label>
      <div className="rounded-xl border border-glass-border bg-glass-bg p-5">
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={handleChange}
        />
        <div className="flex flex-col items-center gap-3 text-center">
          {hasPreview ? (
            <div
              className={cn(
                'h-36 w-36 shrink-0 overflow-hidden border border-glass-border bg-card',
                circle ? 'rounded-full' : 'rounded-2xl',
              )}
            >
              <img
                src={src}
                alt={label}
                className="h-full w-full object-cover"
                onError={() => {
                  if (!isReplace) {
                    setImgFailed(true);
                    onCurrentImageError?.();
                  }
                }}
              />
            </div>
          ) : showFallbackAvatar ? (
            <AvatarFallback
              name={fallbackName!}
              size={144}
              rounded={circle ? 'full' : 'md'}
            />
          ) : (
            <label
              htmlFor={inputId}
              className={cn(
                'grid h-36 w-36 shrink-0 cursor-pointer place-items-center overflow-hidden border border-dashed border-glass-border bg-elev transition hover:border-cyan/50 hover:bg-cyan/[0.04]',
                circle ? 'rounded-full' : 'rounded-2xl',
              )}
            >
              <div className="flex flex-col items-center gap-1.5 text-text-45">
                <Upload className="h-6 w-6" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  Subir
                </span>
              </div>
            </label>
          )}

          <div className="w-full">
            <div className="text-[13px] font-semibold text-text-white">{title}</div>
            <div className="mt-1 text-[11px] text-text-45">{subtitle}</div>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <label
                htmlFor={inputId}
                className="cursor-pointer rounded-full border border-glass-border bg-elev px-4 py-1.5 text-[11px] font-semibold text-text-90 transition hover:border-cyan/45 hover:bg-cyan/[0.06]"
              >
                {hasPreview ? 'Cambiar imagen' : 'Elegir archivo'}
              </label>
              {isReplace && (
                <button
                  type="button"
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-elev px-4 py-1.5 text-[11px] font-semibold text-text-65 transition hover:text-red-400"
                >
                  <X className="h-3 w-3" /> Quitar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
