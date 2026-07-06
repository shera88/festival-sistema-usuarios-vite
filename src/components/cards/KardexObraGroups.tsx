import { useMemo, useState } from 'react';
import { ChevronDown, Music2, Users } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { KardexRow } from './KardexRow';

interface Props {
  rows: KRow[];
  canEdit?: boolean;
  isCurrentYear?: boolean;
  locked?: boolean;
}

/** Orden canónico de cargos dentro de cada obra (resto va al final, alfabético). */
const CARGO_ORDER = ['BAILARIN', 'COREOGRAFO', 'DIRECTOR', 'STAFF'];

const NONE = '__sin_baile__';

function normCargo(c: string | null | undefined): string {
  return (c ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

interface CargoGroup {
  key: string;
  label: string;
  rows: KRow[];
}

interface ObraBucket {
  id: string;
  label: string;
  rows: KRow[];
}

/** Agrupa las filas de una obra por cargo, en orden canónico y con nombres ordenados. */
function groupByCargo(rows: KRow[]): CargoGroup[] {
  const m = new Map<string, CargoGroup>();
  for (const r of rows) {
    const key = normCargo(r.cargo) || 'OTRO';
    if (!m.has(key)) m.set(key, { key, label: r.cargo || 'Sin cargo', rows: [] });
    m.get(key)!.rows.push(r);
  }
  const entries = [...m.values()].sort((a, b) => {
    const ia = CARGO_ORDER.indexOf(a.key);
    const ib = CARGO_ORDER.indexOf(b.key);
    const oa = ia === -1 ? 99 : ia;
    const ob = ib === -1 ? 99 : ib;
    if (oa !== ob) return oa - ob;
    return a.label.localeCompare(b.label);
  });
  for (const g of entries) {
    g.rows.sort((x, y) =>
      (x.nombre_y_apellido || '').localeCompare(y.nombre_y_apellido || ''),
    );
  }
  return entries;
}

/**
 * Lista de integrantes de una agrupación AGRUPADA POR OBRA/BAILE y, dentro de
 * cada obra, POR CARGO. Cada obra muestra su conteo de integrantes.
 *
 * Una persona puede bailar en varias obras → aparece en cada una (por eso la
 * suma de los conteos por obra puede superar el total de la agrupación).
 * Quienes no tienen bailes asignados (staff, dirección, etc.) caen en el grupo
 * "Sin baile asignado".
 */
export function KardexObraGroups({ rows, canEdit, isCurrentYear, locked }: Props) {
  const buckets = useMemo<ObraBucket[]>(() => {
    const m = new Map<string, ObraBucket>();
    for (const r of rows) {
      const bailes = Array.isArray(r.bailes) ? r.bailes : [];
      if (bailes.length === 0) {
        if (!m.has(NONE)) m.set(NONE, { id: NONE, label: 'Sin baile asignado', rows: [] });
        m.get(NONE)!.rows.push(r);
        continue;
      }
      for (const b of bailes) {
        const id = b?.id_inscripcion ? String(b.id_inscripcion) : '';
        if (!id) continue;
        if (!m.has(id)) {
          m.set(id, { id, label: b.nombre_de_la_obra || 'Obra sin nombre', rows: [] });
        }
        m.get(id)!.rows.push(r);
      }
    }
    // Obras con nombre primero (alfabético); "Sin baile asignado" al final.
    return [...m.values()].sort((a, b) => {
      if (a.id === NONE) return 1;
      if (b.id === NONE) return -1;
      return a.label.localeCompare(b.label);
    });
  }, [rows]);

  return (
    <div className="divide-y divide-glass-border">
      {buckets.map((obra, i) => (
        <ObraSection
          key={obra.id}
          obra={obra}
          defaultOpen={i === 0}
          canEdit={canEdit}
          isCurrentYear={isCurrentYear}
          locked={locked}
        />
      ))}
    </div>
  );
}

function ObraSection({
  obra,
  defaultOpen = false,
  canEdit,
  isCurrentYear,
  locked,
}: {
  obra: ObraBucket;
  defaultOpen?: boolean;
  canEdit?: boolean;
  isCurrentYear?: boolean;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isNone = obra.id === NONE;
  const cargoGroups = useMemo(() => groupByCargo(obra.rows), [obra.rows]);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition select-none hover:bg-fuchsia/3 sm:px-4"
        style={{ background: 'rgba(124,58,237,0.05)' }}
      >
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${
            isNone
              ? 'border-glass-border text-text-45'
              : 'border-fuchsia/40 bg-fuchsia/10 text-fuchsia'
          }`}
        >
          <Music2 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="truncate text-[12px] font-semibold uppercase text-text-white"
            style={{ letterSpacing: '0.4px' }}
          >
            {obra.label}
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan/40 bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold text-cyan"
          style={{ letterSpacing: '0.3px' }}
        >
          <Users className="h-3 w-3" />
          {obra.rows.length}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180 text-fuchsia' : 'text-text-45'
          }`}
        />
      </div>

      {open && (
        <div className="anim-fade-in">
          {cargoGroups.map((cg) => (
            <div key={cg.key}>
              <div
                className="flex items-center justify-between gap-2 border-y border-glass-border bg-black/20 px-4 py-1.5"
              >
                <span
                  className="text-[9px] font-semibold uppercase text-text-65"
                  style={{ letterSpacing: '0.8px' }}
                >
                  {cg.label}
                </span>
                <span className="text-[9px] font-medium text-text-45">
                  {cg.rows.length}
                </span>
              </div>
              {cg.rows.map((r, i) => (
                <KardexRow
                  key={`${obra.id}:${r.id_kardex ?? i}`}
                  row={r}
                  canDelete={canEdit}
                  canEdit={canEdit}
                  isCurrentYear={isCurrentYear}
                  locked={locked}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
