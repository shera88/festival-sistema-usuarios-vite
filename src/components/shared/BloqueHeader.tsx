/**
 * Cabecera de bloque — separa BLOQUE MENOR de BLOQUE MAYOR en las listas.
 *
 * Mismos colores que los PDF del programa (cian el menor, rosa de marca el
 * mayor), para que quien mira la pantalla y quien mira el papel vea lo mismo.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type Bloque = 'MENOR' | 'MAYOR';

/** Normaliza el bloque; si viene vacío lo deriva de la división.
 *  Las divisiones de menores (pre infantil → pre juvenil) son BLOQUE MENOR. */
export function normalizarBloque(bloque: string | null, division?: string | null): Bloque | null {
  const b = (bloque ?? '').toUpperCase().trim();
  if (b.includes('MENOR')) return 'MENOR';
  if (b.includes('MAYOR')) return 'MAYOR';
  const d = (division ?? '').toUpperCase().trim();
  if (!d) return null;
  return /PRE\s*INFANTIL|INFANTIL|PRE\s*JUVENIL/.test(d) ? 'MENOR' : 'MAYOR';
}

const TONO: Record<Bloque, { texto: string; borde: string; fondo: string; punto: string }> = {
  MENOR: { texto: 'text-cyan', borde: 'border-cyan/30', fondo: 'bg-cyan/8', punto: 'bg-cyan' },
  MAYOR: { texto: 'text-fuchsia', borde: 'border-fuchsia/30', fondo: 'bg-fuchsia/8', punto: 'bg-fuchsia' },
};

export function BloqueHeader({ bloque, cantidad }: { bloque: Bloque; cantidad?: number }) {
  const t = TONO[bloque];
  return (
    <div
      className={`mt-1 flex items-center gap-2.5 rounded-lg border ${t.borde} ${t.fondo} px-3 py-2`}
      role="separator"
      aria-label={`Bloque ${bloque.toLowerCase()}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.punto}`} aria-hidden />
      <span className={`text-[11px] font-bold uppercase ${t.texto}`} style={{ letterSpacing: '1.2px' }}>
        Bloque {bloque.toLowerCase()}
      </span>
      {cantidad != null && (
        <span className="ml-auto text-[11px] text-text-45 tabular-nums">
          {cantidad} {cantidad === 1 ? 'obra' : 'obras'}
        </span>
      )}
    </div>
  );
}

/**
 * Bloque plegable: la cabecera es el botón que abre y cierra su lista.
 * Arranca abierto — el programa se consulta para leerlo, no para esconderlo.
 */
export function BloqueGroup({
  bloque,
  cantidad,
  children,
}: {
  bloque: Bloque;
  cantidad?: number;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(true);
  const t = TONO[bloque];
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className={`mt-1 flex w-full items-center gap-2.5 rounded-lg border ${t.borde} ${t.fondo} px-3 py-2 text-left transition-colors hover:bg-white/5`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.punto}`} aria-hidden />
        <span className={`text-[11px] font-bold uppercase ${t.texto}`} style={{ letterSpacing: '1.2px' }}>
          Bloque {bloque.toLowerCase()}
        </span>
        {cantidad != null && (
          <span className="ml-auto text-[11px] text-text-45 tabular-nums">
            {cantidad} {cantidad === 1 ? 'obra' : 'obras'}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${abierto ? 'rotate-180' : ''} ${t.texto}`}
        />
      </button>
      {abierto && <div className="space-y-2">{children}</div>}
    </div>
  );
}

/** Parte una lista en sus dos bloques, conservando el orden de cada uno.
 *  Lo que no tenga bloque queda al final, para no esconderlo. */
export function agruparPorBloque<T>(
  items: T[],
  leer: (x: T) => { bloque: string | null; division?: string | null },
): Array<{ bloque: Bloque | null; items: T[] }> {
  const cubos: Record<string, T[]> = { MENOR: [], MAYOR: [], SIN: [] };
  for (const it of items) {
    const { bloque, division } = leer(it);
    cubos[normalizarBloque(bloque, division) ?? 'SIN'].push(it);
  }
  return [
    { bloque: 'MENOR' as const, items: cubos.MENOR },
    { bloque: 'MAYOR' as const, items: cubos.MAYOR },
    { bloque: null, items: cubos.SIN },
  ].filter((g) => g.items.length > 0);
}
