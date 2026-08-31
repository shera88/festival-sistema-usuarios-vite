import { useEffect, useRef } from 'react';
import logoUrl from '@/assets/logo-danzarte-2026.png';

/**
 * Header del sitio del festival, replicado para la página de venta.
 *
 * No se puede importar el Navbar del landing: es otra aplicación, con otro
 * router y otro build. Lo que se replica es su aspecto y su menú, con enlaces
 * absolutos a festivaldanzarte.com — desde aquí todo destino es externo, así que
 * son `<a>` y no `<Link>`.
 *
 * El logo es el MISMO archivo que usa el sitio (`logo-danzarte-2026.png`,
 * copiado a los assets del portal) y no el `logo-danzarte.png` del panel: aquel
 * tiene proporción 2.6 y este 1.71, así que a la misma altura `h-11` el del
 * panel se ve casi a la mitad de ancho y el encabezado no coincide con el del
 * sitio del que la persona acaba de venir.
 *
 * Sin carrito ni hamburguesa: aquí no hay carrito que mostrar, y las secciones
 * extra viven en el sitio. Un ícono que no hace nada es peor que no tenerlo.
 *
 * Si el menú del landing cambia, este hay que actualizarlo a mano. Es el precio
 * de que sean dos aplicaciones; la alternativa —un paquete compartido— cuesta
 * más de lo que ahorra para doce enlaces.
 */

const SITIO = 'https://www.festivaldanzarte.com';

type Item = { href: string; label: string; actual?: boolean };

const MENU: Item[] = [
  { href: `${SITIO}/`, label: 'Inicio' },
  { href: `${SITIO}/convocatoria`, label: 'Convocatoria' },
  { href: `${SITIO}/solicitud`, label: 'Solicitud' },
  { href: `${SITIO}/inscripcion`, label: 'Inscripción' },
  { href: `${SITIO}/kardex`, label: 'Kárdex' },
  { href: `${SITIO}/entradas`, label: 'Entradas' },
  { href: `${SITIO}/videos`, label: 'Videos' },
  // Ésta es la página en la que ya está parada la persona.
  { href: `${SITIO}/portal/clientes/registro`, label: 'Videos 2026', actual: true },
  { href: `${SITIO}/ranking`, label: 'Notas' },
  { href: `${SITIO}/programa`, label: 'Programa' },
  { href: `${SITIO}/nominados`, label: 'Nominados' },
  { href: `${SITIO}/portal`, label: 'Portal' },
];

const BASE_ITEM =
  'relative whitespace-nowrap rounded-full px-2.5 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors';

/** Subrayado del ítem en el que se está. */
function Marca({ ancho }: { ancho: string }) {
  return (
    <span
      aria-hidden
      className={`absolute bottom-0.5 left-1/2 h-[2px] ${ancho} -translate-x-1/2 rounded-full bg-[var(--venta-fuchsia)]`}
    />
  );
}

export function VentaHeader() {
  const tabActual = useRef<HTMLSpanElement | null>(null);

  // En un teléfono el menú entra por desplazamiento horizontal, y "Videos 2026"
  // es el octavo de doce: sin esto queda fuera de pantalla y la persona no ve en
  // qué sección está. Mismo recurso que usa el header del sitio.
  useEffect(() => {
    tabActual.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, []);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.07] bg-[rgba(8,5,30,0.85)] backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-[1280px] items-center justify-center gap-3 px-5 py-4 sm:gap-6 sm:px-8 md:justify-between md:px-12 md:py-5">
        {/* `shrink-0` no es decorativo: el ancla es un ítem flex y el menú de al
            lado es ancho, así que sin esto flexbox le come el espacio al logo y
            —con el `max-width: 100%` que llevan las imágenes— lo aplasta de
            114 px a 23 px. Se ve una tira, no el logotipo. */}
        <a
          href={`${SITIO}/`}
          className="inline-flex shrink-0 items-center"
          aria-label="Festival Danzarte 2026"
        >
          <img
            src={logoUrl}
            alt="Festival Danzarte 2026"
            width={954}
            height={367}
            className="h-11 w-auto max-w-none"
            decoding="async"
          />
        </a>

        {/* Menú de escritorio. Corta en `md`, igual que el del sitio: con `lg`
            quedaba una franja entre 768 y 1023 px con el logo suelto a la
            izquierda y ningún menú al lado. */}
        <div className="hidden items-center gap-0.5 md:flex">
          {MENU.map((m) =>
            m.actual ? (
              // La página actual NO es un enlace: pulsarla recargaría la página
              // y borraría el formulario a medio llenar.
              <span
                key={m.label}
                aria-current="page"
                className={`${BASE_ITEM} text-[var(--venta-fuchsia)]`}
              >
                {m.label}
                <Marca ancho="w-6" />
              </span>
            ) : (
              <a
                key={m.label}
                href={m.href}
                className={`${BASE_ITEM} text-white/65 hover:text-white`}
              >
                {m.label}
              </a>
            ),
          )}
        </div>
      </div>

      {/* Pestañas desplazables — mismo recurso que usa el sitio cuando el menú
          no entra a lo ancho. */}
      <div className="border-t border-white/[0.05] bg-[rgba(8,5,30,0.55)] md:hidden">
        <div className="flex gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {MENU.map((m) => {
            const cls =
              'relative shrink-0 whitespace-nowrap px-2.5 py-2 text-[10px] font-medium uppercase tracking-[0.16em] transition-colors';
            return m.actual ? (
              <span
                key={m.label}
                ref={tabActual}
                aria-current="page"
                className={`${cls} text-[var(--venta-fuchsia)]`}
              >
                {m.label}
                <Marca ancho="w-5" />
              </span>
            ) : (
              <a key={m.label} href={m.href} className={`${cls} text-white/70`}>
                {m.label}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
