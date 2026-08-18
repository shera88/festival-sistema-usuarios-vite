import { useEffect, useRef, useState } from 'react';

/**
 * Miniatura de un video servido desde R2.
 *
 * POR QUÉ EXISTE: la grilla monta todas las obras de una vez (más de 200). Si
 * cada tarjeta pinta un <video preload="metadata"> directamente, el navegador
 * abre una descarga por tarjeta contra R2 — y como los archivos pesan ~260 MB,
 * esas descargas se comen el ancho de banda. Al abrir un video para verlo,
 * competía con todas las miniaturas y tardaba en arrancar.
 *
 * QUÉ HACE: no carga nada hasta que la tarjeta está por entrar en pantalla, y
 * suelta la fuente cuando se aleja. Además se puede congelar por completo
 * (`pausado`) mientras hay un video reproduciéndose, para dejarle toda la banda.
 */
export function VideoThumb({ src, className, pausado = false }: {
  src: string;
  className?: string;
  pausado?: boolean;
}) {
  const cont = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const el = cont.current;
    if (!el) return;
    // 300px de margen: empieza a cargar justo antes de que se vea, no antes.
    const io = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => setCerca(e.isIntersecting)),
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Sólo pide el archivo si está cerca de la pantalla Y no hay nada reproduciéndose.
  const cargar = cerca && !pausado;

  return (
    <div ref={cont} className="h-full w-full">
      {cargar ? (
        <video
          // #t=3 → el navegador pinta el fotograma del segundo 3 como portada.
          src={`${src}#t=3`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          className={className}
        />
      ) : (
        // Marcador del mismo tamaño: la grilla no salta cuando entra la miniatura.
        <div className="h-full w-full animate-pulse" style={{ background: 'rgba(124,58,237,0.10)' }} />
      )}
    </div>
  );
}
