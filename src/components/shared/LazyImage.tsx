import { useEffect, useRef, useState } from 'react';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'loading' | 'src'> {
  src: string;
  rootMargin?: string;
  fallback?: React.ReactNode;
}

/**
 * Imagen lazy real via IntersectionObserver. WebView Android no
 * respeta `loading="lazy"` confiablemente — esto evita decodear
 * decenas de imágenes simultáneamente y crashear la app.
 */
export function LazyImage({ src, rootMargin = '200px', fallback, ...rest }: Props) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  if (!visible) {
    return (
      <span
        ref={ref as unknown as React.RefObject<HTMLSpanElement>}
        className={rest.className}
        style={{ display: 'inline-block', ...(rest.style || {}) }}
      >
        {fallback ?? null}
      </span>
    );
  }

  return <img ref={ref} src={src} decoding="async" {...rest} />;
}
