import { memo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Link as LinkIcon } from 'lucide-react';

const FacebookIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.99 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.99 22 12z" />
  </svg>
);
const InstagramIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const YoutubeIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.546 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);
const WhatsAppIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
  </svg>
);
const TikTokIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.78a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.21Z" />
  </svg>
);
import { toast } from 'sonner';
import { vimeoEmbedUrl } from '@/lib/utils/vimeo';
import type { Inscripcion } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  vimeoId: string;
  insc: Inscripcion;
}

function VideoModalImpl({ open, onClose, vimeoId, insc }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  // URL pública directa al video en Vimeo — se comparte ESTO, no la página actual.
  const shareUrl = `https://vimeo.com/${vimeoId}`;
  const shareText = `${insc.nombre_de_la_obra ?? ''} — ${insc.agrupacion ?? ''} · Festival Danzarte`;

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(
      () => toast.success('Enlace copiado'),
      () => toast.error('No se pudo copiar'),
    );
  }

  function copyAndOpen(url: string, app: string) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      toast.success(`Enlace copiado — péguelo en ${app}`);
      window.open(url, '_blank', 'noopener');
    });
  }

  const SOCIAL = [
    {
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      color: '#25D366',
      onClick: () =>
        window.open(
          `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
          '_blank',
          'noopener',
        ),
    },
    {
      name: 'Facebook',
      icon: FacebookIcon,
      color: '#1877F2',
      onClick: () =>
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          '_blank',
          'noopener',
        ),
    },
    {
      name: 'Instagram',
      icon: InstagramIcon,
      color: '#E4405F',
      onClick: () => copyAndOpen('https://www.instagram.com/', 'Instagram'),
    },
    {
      name: 'TikTok',
      icon: TikTokIcon,
      color: '#00F2EA',
      onClick: () => copyAndOpen('https://www.tiktok.com/', 'TikTok'),
    },
    {
      name: 'YouTube',
      icon: YoutubeIcon,
      color: '#FF0000',
      onClick: () => copyAndOpen('https://youtube.com/', 'YouTube'),
    },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === containerRef.current) onClose();
      }}
      ref={containerRef}
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-glass-border bg-card shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative overflow-hidden rounded-t-2xl bg-black">
          <iframe
            src={vimeoEmbedUrl(vimeoId)}
            className="aspect-video w-full"
            allow="fullscreen; picture-in-picture; autoplay"
            allowFullScreen
            title={insc.nombre_de_la_obra || 'Video'}
          />
        </div>

        <div className="p-5 sm:p-6">
          <p
            className="text-[10px] font-medium uppercase text-cyan"
            style={{ letterSpacing: '1.2px' }}
          >
            {insc.agrupacion}
          </p>
          <h2 className="mt-1 text-xl font-light text-text-white sm:text-2xl" style={{ letterSpacing: '-0.02em' }}>
            {insc.nombre_de_la_obra || 'Sin título'}
          </h2>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-[12px] sm:grid-cols-3">
            <Detail label="Categoría" value={insc.categoria} />
            <Detail label="División" value={insc.division} />
            <Detail label="Subdivisión" value={insc.subdivision} />
            <Detail label="Modalidad" value={insc.modalidad} />
            <Detail label="Coreógrafo" value={insc.coreografo} />
            <Detail label="Día" value={insc.dia} />
            <Detail label="Bloque" value={insc.bloque} />
            <Detail label="Orden" value={insc.orden} />
            <Detail label="Cantidad" value={insc.cantidad} />
          </dl>

          <div className="mt-5 border-t border-glass-border pt-4">
            <p
              className="mb-3 text-[10px] font-medium uppercase text-cyan"
              style={{ letterSpacing: '1px' }}
            >
              Compartir
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {SOCIAL.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.name}
                    type="button"
                    onClick={s.onClick}
                    aria-label={s.name}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-glass-border bg-elev text-text-65 transition-all hover:scale-110 hover:border-transparent hover:text-white"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = s.color;
                      e.currentTarget.style.borderColor = s.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '';
                      e.currentTarget.style.borderColor = '';
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copiar enlace"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-glass-border bg-elev text-text-65 transition-all hover:scale-110 hover:border-cyan/50 hover:bg-cyan/10 hover:text-cyan"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export const VideoModal = memo(VideoModalImpl, (prev, next) => {
  // Re-render solo cuando cambia open o vimeoId. Detalles del insc se ignoran
  // mientras modal abierto — evita reset del iframe Vimeo por Realtime invalidations.
  return prev.open === next.open && prev.vimeoId === next.vimeoId;
});

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div>
      <dt
        className="mb-0.5 text-[9px] font-medium uppercase text-cyan"
        style={{ letterSpacing: '0.8px' }}
      >
        {label}
      </dt>
      <dd className="text-[11px] font-light text-text-90">{value}</dd>
    </div>
  );
}
