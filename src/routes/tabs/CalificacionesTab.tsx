import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SearchInput } from '@/components/filters/SearchInput';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { DayGroup } from '@/components/shared/DayGroup';
import { CalificacionCard } from '@/components/cards/CalificacionCard';
import { useCalificaciones, useRankingPublico, useDetalleObra, type RankingObra, type NotaPublica } from '@/hooks/queries';
import { dayOrderIndex } from '@/lib/utils/days';
import { calcularPromedioFinal, fmtScore } from '@/lib/utils/scoring';
import { clasificacionDe, esDiaClasificatoria } from '@/lib/utils/finals';
import { webpProxy } from '@/lib/utils/img';
import { useAuth } from '@/hooks/useAuth';
import type { Nota } from '@/types/domain';

const ANO = '2026';

type SubTab = 'mis' | 'vivo' | 'ranking';
const TABS: { key: SubTab; label: string }[] = [
  { key: 'mis', label: 'Mis participaciones' },
  { key: 'vivo', label: 'Calificaciones' },
  { key: 'ranking', label: 'Ranking' },
];

export function CalificacionesTab() {
  const { user } = useAuth();
  const [tab, setTab] = useState<SubTab>('mis');

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-glass-border bg-glass-bg p-1.5 backdrop-blur-md">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={
                active
                  ? 'rounded-xl bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] px-2 py-2 text-[11px] font-semibold text-white shadow sm:text-[13px]'
                  : 'rounded-xl px-2 py-2 text-[11px] font-medium text-text-45 hover:text-text-90 sm:text-[13px]'
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'mis' && <MisParticipaciones enabled={!!user} />}
      {tab === 'vivo' && <CalificacionesVivo enabled={!!user} />}
      {tab === 'ranking' && <RankingVivo enabled={!!user} />}
    </div>
  );
}

/* ───────────────────────── Tab 1 · Mis participaciones ───────────────────────── */

function MisParticipaciones({ enabled }: { enabled: boolean }) {
  const [search, setSearch] = useState('');
  const q = useCalificaciones(ANO, enabled);
  const notas = (q.data?.[ANO] ?? []) as Nota[];

  const filtered = useMemo(() => {
    if (!search.trim()) return notas;
    const s = search.toLowerCase();
    return notas.filter(
      (n) =>
        (n.jurado_nombre || '').toLowerCase().includes(s) ||
        (n.agrupacion || '').toLowerCase().includes(s) ||
        (n.insc_obra || '').toLowerCase().includes(s),
    );
  }, [notas, search]);

  const byDay = useMemo(() => {
    const groups: Record<string, Record<string, Nota[]>> = {};
    for (const n of filtered) {
      const dia = (n.insc_dia || n.dia || 'SIN DÍA').toUpperCase();
      const key = n.id_inscripcion || `${n.agrupacion}-${n.dia}`;
      groups[dia] ||= {};
      groups[dia][key] ||= [];
      groups[dia][key].push(n);
    }
    return groups;
  }, [filtered]);

  const days = Object.keys(byDay).sort((a, b) => dayOrderIndex(a) - dayOrderIndex(b));

  const stats = useMemo(() => {
    const grouped: Record<string, Nota[]> = {};
    for (const n of notas) {
      const k = n.id_inscripcion || `${n.agrupacion}-${n.dia}`;
      (grouped[k] ||= []).push(n);
    }
    const obras = Object.values(grouped);
    const promedios = obras.map((arr) => calcularPromedioFinal(arr)).filter((v): v is number => v !== null);
    const promedioGlobal = promedios.length === 0 ? null : promedios.reduce((a, b) => a + b, 0) / promedios.length;
    const mejor = promedios.length === 0 ? null : Math.max(...promedios);
    return [
      { label: `Obras Calificadas ${ANO}`, value: obras.length, accent: 'gold' as const },
      { label: 'Promedio', value: fmtScore(promedioGlobal), accent: 'cyan' as const },
      { label: 'Mejor Puntaje', value: fmtScore(mejor), accent: 'fuchsia' as const },
    ];
  }, [notas]);

  return (
    <div className="space-y-4">
      <StatsCards stats={stats} />
      <div className="rounded-2xl border border-glass-border bg-glass-bg p-4 backdrop-blur-md">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar obra o jurado..." />
      </div>

      {q.isLoading && <LoadingSkeleton rows={3} />}
      {!q.isLoading && days.length === 0 && (
        <EmptyState>Todavía no tenés calificaciones en {ANO}.</EmptyState>
      )}

      <div className="space-y-4">
        {days.map((dia) => {
          const obras = Object.entries(byDay[dia]).sort(([, a], [, b]) => {
            const oa = Number(a[0].insc_orden ?? a[0].orden);
            const ob = Number(b[0].insc_orden ?? b[0].orden);
            if (isNaN(oa) && isNaN(ob)) return 0;
            if (isNaN(oa)) return 1;
            if (isNaN(ob)) return -1;
            return oa - ob;
          });
          return (
            <DayGroup key={dia} label={dia} count={`${obras.length} obra${obras.length > 1 ? 's' : ''}`}>
              {obras.map(([key, ns]) => (
                <CalificacionCard key={key} notas={ns} />
              ))}
            </DayGroup>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Tab 2 · Calificaciones en vivo ───────────────────────── */

function LiveBadge({ fetching }: { fetching: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-fuchsia" style={{ letterSpacing: '0.5px' }}>
      <span className={`h-2 w-2 rounded-full bg-fuchsia ${fetching ? 'animate-ping' : 'animate-pulse'}`} />
      En vivo
    </div>
  );
}

function CalificacionesVivo({ enabled }: { enabled: boolean }) {
  const q = useRankingPublico(enabled);
  // Solo Martes-Viernes; Sábado/Domingo (finales) no se muestran.
  const rows = useMemo(() => (q.data ?? []).filter((r) => esDiaClasificatoria(r.dia)), [q.data]);

  const days = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.dia || 'SIN DÍA').toUpperCase()))).sort(
        (a, b) => dayOrderIndex(a) - dayOrderIndex(b),
      ),
    [rows],
  );
  const [dia, setDia] = useState<string | null>(null);
  const diaSel = dia && days.includes(dia) ? dia : days[days.length - 1] ?? null; // por defecto la última noche con datos

  const delDia = useMemo(
    () =>
      rows
        .filter((r) => (r.dia || 'SIN DÍA').toUpperCase() === diaSel)
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)),
    [rows, diaSel],
  );

  if (q.isLoading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <LiveBadge fetching={q.isFetching} />
        <div className="text-[11px] text-text-45">{rows.length} obras calificándose</div>
      </div>

      {days.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {days.map((d) => {
            const active = d === diaSel;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDia(d)}
                className={
                  active
                    ? 'rounded-full bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] px-3 py-1.5 text-xs font-semibold text-white shadow'
                    : 'rounded-full border border-glass-border bg-glass-bg px-3 py-1.5 text-xs text-text-45 hover:border-cyan/40 hover:text-text-90'
                }
              >
                {d.charAt(0) + d.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      )}

      {delDia.length === 0 ? (
        <EmptyState>Todavía no se están tomando notas en este día.</EmptyState>
      ) : (
        <div className="space-y-2">
          {delDia.map((o) => (
            <ObraRow
              key={o.id_inscripcion}
              o={o}
              lead={o.orden != null ? String(o.orden).padStart(2, '0') : '—'}
              showChip
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Tab 3 · Ranking por noche ───────────────────────── */

function RankingVivo({ enabled }: { enabled: boolean }) {
  const q = useRankingPublico(enabled);
  // Solo Martes-Viernes; Sábado/Domingo (finales) son sorpresa para la premiación.
  const rows = useMemo(() => (q.data ?? []).filter((r) => esDiaClasificatoria(r.dia)), [q.data]);

  const days = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => (r.dia || '').toUpperCase()))).sort(
        (a, b) => dayOrderIndex(a) - dayOrderIndex(b),
      ),
    [rows],
  );

  const [dia, setDia] = useState<string | null>(null); // null = Global (todos los días)
  const diaSel = dia && days.includes(dia) ? dia : null;

  const ranked = useMemo(() => {
    const base = diaSel ? rows.filter((r) => (r.dia || '').toUpperCase() === diaSel) : rows;
    return [...base].sort(
      (a, b) => (b.nota_final ?? -1) - (a.nota_final ?? -1) || (a.orden ?? 0) - (b.orden ?? 0),
    );
  }, [rows, diaSel]);

  if (q.isLoading) return <LoadingSkeleton rows={4} />;

  const pill = (active: boolean) =>
    active
      ? 'rounded-full bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] px-3 py-1.5 text-xs font-semibold text-white shadow'
      : 'rounded-full border border-glass-border bg-glass-bg px-3 py-1.5 text-xs text-text-45 hover:border-cyan/40 hover:text-text-90';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setDia(null)} className={pill(!diaSel)}>
            Global
          </button>
          {days.map((d) => (
            <button key={d} type="button" onClick={() => setDia(d)} className={pill(d === diaSel)}>
              {d.charAt(0) + d.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <LiveBadge fetching={q.isFetching} />
      </div>

      {ranked.length === 0 ? (
        <EmptyState>El ranking todavía no tiene notas cargadas.</EmptyState>
      ) : (
        <div className="space-y-2">
          {ranked.map((o, i) => (
            <ObraRow key={o.id_inscripcion} o={o} lead={String(i + 1)} rank showChip />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Fila de obra (vivo/ranking) ───────────────────────── */

function FinalChip({ dia }: { dia: 'Sábado' | 'Domingo' }) {
  const sab = dia === 'Sábado';
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-[9px] font-bold uppercase ${
        sab ? 'border border-cyan/40 bg-cyan/10 text-cyan' : 'border border-fuchsia/40 bg-fuchsia/10 text-fuchsia'
      }`}
      style={{ letterSpacing: '0.4px' }}
    >
      Final {dia.toLowerCase()}
    </span>
  );
}

function ObraRow({ o, lead, rank, showChip }: { o: RankingObra; lead: string; rank?: boolean; showChip?: boolean }) {
  const [open, setOpen] = useState(false);
  const q = useDetalleObra(open ? o.id_inscripcion : null);
  const nombre = o.agrupacion || 'Agrupación';
  const obra = o.obra || 'Sin obra';
  const clasi = showChip ? clasificacionDe(o.nota_final, o.modalidad, o.genero, o.categoria) : null;
  const medal = rank ? (lead === '1' ? 'text-gold' : lead === '2' ? 'text-text-90' : lead === '3' ? 'text-[#c98a4a]' : 'text-text-45') : '';
  const notas = q.data?.notas ?? [];

  return (
    <article className={`overflow-hidden rounded-xl border bg-glass-bg transition ${open ? 'border-gold/30' : 'border-glass-border'}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-white/3"
      >
        <div
          className={`w-7 shrink-0 text-center tabular-nums ${
            rank ? `text-[15px] font-extrabold ${medal}` : 'text-[12px] font-normal text-gold'
          }`}
        >
          {lead}
        </div>
        {o.enlace_del_logo ? (
          <img
            src={webpProxy(o.enlace_del_logo, 80) ?? undefined}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-text-45 ring-1 ring-white/10">
            {nombre.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold uppercase text-text-white" style={{ letterSpacing: '0.3px' }}>
              {nombre}
            </span>
            {clasi && <FinalChip dia={clasi} />}
          </div>
          <div className="truncate text-[11px] text-text-45">
            "{obra}"{o.categoria ? ` · ${o.categoria}` : ''}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[16px] font-bold text-gold tabular-nums">{fmtScore(o.nota_final)}</div>
          <div className="text-[9px] text-text-45">{o.jurados} jurado{o.jurados === 1 ? '' : 's'}</div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-gold' : 'text-text-45'}`} />
      </button>

      {open && (
        <div className="space-y-2 border-t border-glass-border p-3 anim-fade-in">
          {q.isLoading && <div className="py-4 text-center text-[12px] text-text-45">Cargando notas…</div>}
          {!q.isLoading && notas.length === 0 && (
            <div className="py-4 text-center text-[12px] text-text-45">Todavía no hay notas para esta obra.</div>
          )}
          {notas.map((n, i) => (
            <JuradoPublicoCard key={i} nota={n} index={i + 1} />
          ))}
        </div>
      )}
    </article>
  );
}

/* ─────────────── Card de jurado PÚBLICO (nombre + foto + sub-puntajes) ─────────────── */

function JuradoPublicoCard({ nota, index }: { nota: NotaPublica; index: number }) {
  const [open, setOpen] = useState(index === 1); // el primero abierto por defecto
  const nombre = nota.jurado || `Jurado ${index}`;
  const fotoSrc = nota.jurado_foto ? webpProxy(nota.jurado_foto, 80) ?? nota.jurado_foto : null;

  return (
    <article className={`overflow-hidden rounded-lg border transition ${open ? 'border-gold/30' : 'border-glass-border'}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        {fotoSrc ? (
          <img src={fotoSrc} alt={nombre} loading="lazy" className="h-9 w-9 shrink-0 rounded-full border-2 border-gold object-cover" />
        ) : (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-gold text-[11px] font-bold text-gold"
            style={{ background: 'linear-gradient(135deg, rgba(232,208,152,0.18) 0%, rgba(0,229,255,0.12) 100%)' }}
          >
            {nombre.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text-white">{nombre}</div>
        <div className="shrink-0 font-display text-[15px] font-bold leading-none text-gold">{nota.total ?? '—'}</div>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-gold' : 'text-text-45'}`} />
      </button>

      {open && (
        <div className="border-t border-glass-border px-3 pb-3 pt-2.5 anim-fade-in">
          <div className="grid grid-cols-2 gap-1.5">
            <NotaItem label="Temática" value={nota.tematica} />
            <NotaItem label="Interpretación" value={nota.interpretacion} />
            <NotaItem label="Coreografía" value={nota.coreografia} />
            <NotaItem label="Dificultad" value={nota.dificultad_y_ejecucion} />
          </div>
          {nota.comentario && (
            <p
              className="mt-1.5 rounded-md border-l-2 border-cyan/30 px-3 py-2.5 text-[11px] italic text-text-65"
              style={{ background: 'rgba(0,229,255,0.03)', lineHeight: '1.6' }}
            >
              "{nota.comentario}"
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function NotaItem({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="flex items-center justify-between gap-1.5 rounded-md border border-glass-border bg-white/2 px-2 py-1.5">
      <span className="min-w-0 truncate text-[9px] font-medium uppercase text-text-65" style={{ letterSpacing: '0.3px' }}>
        {label}
      </span>
      <b className="font-display text-[12px] font-bold leading-none text-cyan">{value ?? '—'}</b>
    </div>
  );
}
