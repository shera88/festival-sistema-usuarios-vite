import { useEffect, useState } from 'react';
import { AvatarFallback } from './AvatarFallback';
import { webpProxy } from '@/lib/utils/img';

interface Props {
  src?: string | null;
  name: string;
  size?: number;
  rounded?: 'full' | 'md';
  className?: string;
}

/**
 * Imagen con fallback automático a gradient + iniciales si la URL es null o falla al cargar.
 */
export function SmartImage({ src, name, size = 36, rounded = 'md', className }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return <AvatarFallback name={name} size={size} rounded={rounded} className={className} />;
  }

  const radius = rounded === 'full' ? '9999px' : '0.5rem';
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        flexShrink: 0,
        background: 'var(--bg-elev, #0E0928)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
      }}
    >
      <img
        src={webpProxy(src, Math.max(size * 2, 96)) ?? src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </span>
  );
}
