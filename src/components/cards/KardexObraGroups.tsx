import { useMemo, useState } from 'react';
import { ChevronDown, Music2, Users, AlertCircle } from 'lucide-react';
import type { KardexRow as KRow } from '@/types/domain';
import { KardexRow } from './KardexRow';

interface Props {
  rows: KRow[];
  canEdit?: boolean;
  /** Rol de gestión (puede_editar / super admin) — gatea verificar/editar/eliminar. */
  canManage?: boolean;
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
export function KardexObraGroups({ rows, canEdit, canManage, isCurrentYear, locked }: Props) {
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
    <div className="space-y-2.5 p-2 sm:p-3">
      {buckets.map((obra, i) => (
        <ObraSection
          key={obra.id}
          obra={obra}
          defaultOpen={i === 0}
          canEdit={canEdit}
          canManage={canManage}
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
  canManage,
  isCurrentYear,
  locked,
}: {
  obra: ObraBucket;
  defaultOpen?: boolean;
  canEdit?: boolean;
  canManage?: boolean;
  isCurrentYear?: boolean;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isNone = obra.id === NONE;
  const cargoGroups = useMemo(() => groupByCargo(obra.rows), [obra.rows]);

  const n = obra.rows.length;
  return (
    <div
      className="overflow-hidden rounded-lg border border-white/10 border-l-2"
      style={{
        // Borde izquierdo de acento (fucsia = obra, dorado = sin baile) + fondo
        // propio elevado para que la sección no se camufle con el card.
        borderLeftColor: isNone ? 'rgba(232,208,152,0.75)' : 'rgba(217,70,239,0.75)',
        background: 'rgba(255,255,255,0.03)',
      }}
    >
      {/* ── NIVEL 2 · OBRA ── header con fondo propio + ícono lleno + label fuerte.
          "Sin baile asignado" en ámbar (bucket que requiere acción). */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="group flex w-full cursor-pointer items-stretch text-left transition select-none"
      >
        <div
          className={`flex flex-1 items-center gap-3 px-3 py-3 transition group-hover:brightness-125 sm:px-4 ${
            open ? 'border-b border-white/10' : ''
          }`}
          style={{ background: isNone ? 'rgba(232,208,152,0.12)' : 'rgba(217,70,239,0.12)' }}
        >
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              isNone ? 'bg-gold/15 text-gold' : 'bg-fuchsia/15 text-fuchsia'
            }`}
          >
            {isNone ? <AlertCircle className="h-[18px] w-[18px]" /> : <Music2 className="h-[18px] w-[18px]" />}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[13px] font-bold uppercase text-text-white"
              style={{ letterSpacing: '0.5px' }}
            >
              {obra.label}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-text-45">
              {isNone ? 'Falta asignar baile' : 'Obra'} · {n} {n === 1 ? 'integrante' : 'integrantes'}
            </div>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              isNone ? 'bg-gold/15 text-gold' : 'bg-cyan/12 text-cyan'
            }`}
          >
            <Users className="h-3 w-3" />
            {n}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''} ${
              isNone ? 'text-gold/80' : 'text-fuchsia/80'
            }`}
          />
        </div>
      </div>

      {open && (
        <div className="anim-fade-in">
          {cargoGroups.map((cg) => (
            <div key={cg.key}>
              {/* ── NIVEL 3 · CARGO ── pill chico indentado + línea divisoria (subordinado). */}
              <div className="flex items-center gap-2.5 py-2 pl-7 pr-4 sm:pl-8">
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.10] px-2 py-0.5 text-[9px] font-semibold uppercase text-text-65"
                  style={{ letterSpacing: '0.7px' }}
                >
                  {cg.label}
                  <span className="text-text-45">{cg.rows.length}</span>
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              {/* ── NIVEL 4 · PERSONAS ── rail izquierdo + indentación (hijos del cargo). */}
              <div className="ml-7 border-l border-white/10 sm:ml-8">
                {cg.rows.map((r, i) => (
                  <KardexRow
                    key={`${obra.id}:${r.id_kardex ?? i}`}
                    row={r}
                    canDelete={canEdit}
                    canEdit={canEdit}
                    canManage={canManage}
                    isCurrentYear={isCurrentYear}
                    locked={locked}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
