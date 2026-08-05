import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, ChevronDown, Trophy } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { DayGroup } from '@/components/shared/DayGroup';
import { supabase } from '@/lib/supabase/client';
import { useInscripciones, useRankingPublico, type RankingObra } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { webpProxy } from '@/lib/utils/img';
import { ZoomableImage } from '@/components/ui/zoomable-image';
import { BloqueGroup, agruparPorBloque, normalizarBloque, type Bloque } from '@/components/shared/BloqueHeader';
import { textoFechaEnsayo } from '@/lib/fechas-festival';
import { finalistasPorDia, ordenarPrograma, CUPO_FINAL, type DiaFinal } from '@/lib/utils/finals';
import { fmtScore } from '@/lib/utils/scoring';

// Membrete oficial del festival (header + footer, medio en blanco) para los PDFs de programa/ensayos.
const URL_MEMBRETE = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/membrete-programa.png';

// Días del sorteo + horario de inicio (según la convocatoria). Sábado y domingo
// son las finales (inicio 10:00); su programa se publica aparte.
const DIAS = ['MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
type Dia = (typeof DIAS)[number];
const DIA_LABEL: Record<Dia, string> = {
  MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes', SABADO: 'Sábado', DOMINGO: 'Domingo',
};
const HORA_INICIO: Record<Dia, string> = {
  MARTES: '19:00', MIERCOLES: '19:00', JUEVES: '19:00', VIERNES: '15:00', SABADO: '10:00', DOMINGO: '10:00',
};

// Apertura oficial "Danzarte · Nuestra Esencia" (30 min) al inicio de estos días.
const APERTURA_DIAS = new Set<Dia>(['MARTES', 'MIERCOLES', 'SABADO']);
const APERTURA_DUR = '30:00';
// Logo de la agrupación/institución DANZARTE (instituciones.enlace_del_logo,
// id_agrupacion e9b8cbeb) para la tarjeta de apertura.
const APERTURA_LOGO = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/inscripciones/danzarte/1780750553226-cbc88b13-e3f8-4cf5-8fba-114a51cd2839.webp';
const APERTURA_COREOGRAFO = 'YACU SERRANO';
// Color navy de marca para la cabecera "APERTURA" en el PDF.
const APERTURA_RGB: [number, number, number] = [26, 16, 64];
const esApertura = (r: { id_inscripcion: string | number }) => String(r.id_inscripcion).startsWith('apertura-');
function aperturaActo(dia: Dia): ActoRPC {
  return {
    id_inscripcion: `apertura-${dia}`, id_agrupacion: null,
    nombre_agrupacion: 'APERTURA · DANZARTE', agrupacion: 'DANZARTE',
    obra: 'NUESTRA ESENCIA', ciudad: null, subdivision: null, modalidad: 'Apertura',
    dia, bloque: null, logo_url: APERTURA_LOGO, orden: 0, duracion: APERTURA_DUR,
    categoria: null, genero: null, coreografo: APERTURA_COREOGRAFO, coreografo_foto: null,
  };
}
// Duración por subdivisión (fallback si la fila no trae `duracion` de la DB).
const DUR_SUBDIV: Record<string, string> = {
  SOLO: '2:30', DUO: '3:30', 'DÚO': '3:30', 'GRUPO PEQUEÑO': '5:00', 'GRUPO CHICO': '5:00', 'GRUPO GRANDE': '6:30',
};
const BUFFER_SEG = 90; // colchón entre bailes (cambio de escenario)
// Ensayos: mismo orden que la presentación, pero inicio 08:00, 8 min por
// agrupación + 1 min de puente entre agrupaciones (slot de 9 min).
const HORA_INICIO_ENSAYO = '08:00';
const ENSAYO_SEG = 8 * 60;
const PUENTE_ENSAYO_SEG = 60;
// El ensayo del viernes (que ocurre el jueves) va POR ORDEN DE LLEGADA: no se
// muestra programa, solo un aviso.
const ENSAYO_ORDEN_LLEGADA = new Set<string>(['VIERNES']);
// Color de encabezado por día — cada programa se distingue por color.
const DIA_ACCENT: Record<Dia, string> = {
  MARTES: '#7C3AED', MIERCOLES: '#0891B2', JUEVES: '#CA8A04', VIERNES: '#DB2777', SABADO: '#059669', DOMINGO: '#EA580C',
};
const DIA_RGB: Record<Dia, [number, number, number]> = {
  MARTES: [124, 58, 237], MIERCOLES: [8, 145, 178], JUEVES: [202, 138, 4], VIERNES: [219, 39, 119], SABADO: [5, 150, 105], DOMINGO: [234, 88, 12],
};
// Colores de cabecera por bloque en el PDF (menor vs mayor bien diferenciados).
const BLOQUE_RGB: Record<'MENOR' | 'MAYOR', [number, number, number]> = {
  MENOR: [8, 145, 178],   // cian
  // Fucsia de marca (--fuchsia #FF1FA8) oscurecida para impresión, igual que el
  // cian del bloque menor: así el par queda cian + rosa como el logo.
  MAYOR: [180, 24, 124],  // rosa de marca
};

interface ActoRPC {
  id_inscripcion: string;
  id_agrupacion: string | null;
  nombre_agrupacion: string | null;
  agrupacion: string | null;
  obra: string | null;
  ciudad: string | null;
  subdivision: string | null;
  modalidad: string | null;
  dia: string | null;
  bloque: string | null;
  logo_url: string | null;
  orden: number | null;
  duracion: string | null;
  categoria: string | null;
  genero: string | null;
  // Agregados por la migración 056 (para el detalle desplegable del acto).
  coreografo: string | null;
  coreografo_foto: string | null;
}
interface Fila extends ActoRPC {
  n: number;
  hora: string;
  dur: string;
  mio: boolean;
}

const durSeg = (m: string) => { const p = String(m || '').split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); };
const hhmmSeg = (t: string) => { const p = String(t || '0:0').split(':'); return (Number(p[0]) || 0) * 3600 + (Number(p[1]) || 0) * 60; };
// Reloj de 12 horas con AM/PM. La hora va con dos dígitos para que la columna
// quede alineada. Único formateador: lo usan tanto la lista como el PDF.
const ampm = (h24: number, min: number) => {
  const suf = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return String(h12).padStart(2, '0') + ':' + String(min).padStart(2, '0') + ' ' + suf;
};
const segHHMM = (x: number) => { const v = Math.round(x); return ampm(Math.floor(v / 3600), Math.floor((v % 3600) / 60)); };
/** Convierte un 'HH:MM' de 24 h (los de HORA_INICIO) al formato con AM/PM. */
export const hhmmAmPm = (t: string) => { const p = String(t || '0:0').split(':'); return ampm(Number(p[0]) || 0, Number(p[1]) || 0); };

/* ─────────────── Horarios definidos por el administrador ───────────────
   La hora de inicio del programa y la de ensayos se fijan en la app de jurados
   (tabla `dias_horarios`) y se leen acá por la RPC pública `obtener_horarios`.
   Un día sin fila —o con la hora en null— conserva el default de la convocatoria,
   de modo que el cálculo no cambia mientras el administrador no lo defina. */
type Horarios = Record<string, { inicio: string | null; ensayo: string | null }>;

const esHHMM = (t: unknown) => (/^\d{1,2}:\d{2}$/.test(String(t ?? '').trim()) ? String(t).trim() : null);

async function fetchHorarios(): Promise<Horarios> {
  const r = await supabase.rpc('obtener_horarios', { p_ano: '2026' });
  const filas = (r.data as Array<{ dia?: string; hora_inicio?: string; hora_ensayo?: string }> | null) ?? [];
  const out: Horarios = {};
  for (const h of filas) {
    const dia = String(h.dia ?? '').toUpperCase().trim();
    if (dia) out[dia] = { inicio: esHHMM(h.hora_inicio), ensayo: esHHMM(h.hora_ensayo) };
  }
  return out;
}

/** Hora de inicio efectiva del día: la del administrador si la definió, si no el default. */
const inicioDe = (h: Horarios, dia: Dia) => h[dia]?.inicio || HORA_INICIO[dia];
const ensayoDe = (h: Horarios, dia: Dia) => h[dia]?.ensayo || HORA_INICIO_ENSAYO;

async function fetchPrograma(): Promise<ActoRPC[]> {
  const calls: Promise<ActoRPC[]>[] = [];
  for (const dia of DIAS) {
    for (const bloque of ['MENOR', 'MAYOR']) {
      calls.push((async () => {
        const r = await supabase.rpc('sorteo_agrupaciones', { p_dia: dia, p_bloque: bloque });
        return (r.data as ActoRPC[] | null) ?? [];
      })());
    }
  }
  const all = (await Promise.all(calls)).flat();
  return all.filter((a) => a.orden != null); // solo actos con orden sorteado
}

/* ─────────────── Fila de acto: se despliega al tocarla ───────────────
   Cabecera igual que antes (hora · orden · logo · agrupación · obra) y, al
   abrir, la ficha esencial de la obra + el coreógrafo con su foto. */
export function ActoRow({ r, esEnsayo }: { r: Fila; esEnsayo: boolean }) {
  const [open, setOpen] = useState(false);
  const nombre = r.nombre_agrupacion || r.agrupacion || 'Agrupación';
  const bloqueTxt = r.bloque ? (String(r.bloque).toUpperCase() === 'MAYOR' ? 'Mayor' : 'Menor') : '';
  const datos: Array<[string, string | null]> = [
    ['Modalidad', r.modalidad],
    ['Género', r.genero],
    ['Categoría', r.categoria],
    ['Tamaño', r.subdivision],
    [esEnsayo ? 'Ensayo' : 'Duración', r.dur],
    ['Ciudad', r.ciudad],
  ];
  const visibles = datos.filter(([, v]) => v && String(v).trim());

  return (
    <article
      className={`overflow-hidden rounded-xl border transition ${
        open ? 'border-gold/30 bg-glass-bg' : r.mio ? 'border-fuchsia/60 bg-fuchsia/10' : 'border-glass-border bg-glass-bg'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-white/3"
      >
        <div className="w-16 shrink-0 text-center text-[12px] font-normal text-gold tabular-nums">{r.hora}</div>
        <div className="w-7 shrink-0 text-center text-[15px] font-extrabold text-text-white tabular-nums">
          {String(r.n).padStart(2, '0')}
        </div>
        {r.logo_url ? (
          <img
            src={webpProxy(r.logo_url, 80) ?? undefined}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
            loading="lazy"
          />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-text-45 ring-1 ring-white/10">
            {initials(nombre)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold uppercase text-text-white" style={{ letterSpacing: '0.3px' }}>
              {nombre}
            </span>
            {r.mio && (
              <span
                className="shrink-0 rounded-md border border-fuchsia/40 bg-fuchsia/10 px-1.5 py-px text-[9px] font-bold uppercase text-fuchsia"
                style={{ letterSpacing: '0.5px' }}
              >
                {esEnsayo ? 'Tu ensayo' : 'Tu participación'}
              </span>
            )}
          </div>
          <div className="truncate text-[11px] text-text-45">
            {r.obra ? `"${r.obra}"` : 'Sin obra'}
            {r.subdivision ? ` · ${r.subdivision}` : ''}
            {bloqueTxt ? ` · ${bloqueTxt}` : ''}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-gold' : 'text-text-45'}`}
        />
      </button>

      {open && (
        <div className="border-t border-glass-border p-3 anim-fade-in">
          {r.obra && (
            <div className="mb-3">
              <div className="text-[9px] font-bold uppercase tracking-wide text-text-45">Obra</div>
              <div className="text-[13px] font-semibold text-text-white">"{r.obra}"</div>
            </div>
          )}

          {visibles.length > 0 && (
            <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
              {visibles.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[9px] font-bold uppercase tracking-wide text-text-45">{k}</dt>
                  <dd className="truncate text-[12px] text-text-white" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {/* Coreógrafo: foto (con respaldo a iniciales) + nombre */}
          <div className="flex items-center gap-3 rounded-lg border border-glass-border bg-white/3 p-2.5">
            {r.coreografo_foto ? (
              // Tocar la foto la amplía a pantalla completa (rueda/pinch para acercar, ESC para salir).
              <ZoomableImage
                src={webpProxy(r.coreografo_foto, 96) ?? r.coreografo_foto}
                zoomSrc={webpProxy(r.coreografo_foto, 1400, 88) ?? r.coreografo_foto}
                alt={r.coreografo ? `Coreógrafo ${r.coreografo}` : 'Foto del coreógrafo'}
                triggerClassName="h-11 w-11 shrink-0 rounded-full ring-1 ring-gold/30 transition hover:ring-2 hover:ring-gold"
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-[12px] font-bold text-text-45 ring-1 ring-white/10">
                {initials(r.coreografo || '—')}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wide text-text-45">Coreógrafo</div>
              <div className="truncate text-[13px] font-semibold text-text-white">
                {r.coreografo || 'Sin coreógrafo registrado'}
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '·';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

/* Filas de un día: menor y luego mayor, en el orden sorteado, con la hora
   acumulada (inicio + duración + colchón). Es una función pura y a propósito:
   así el PDF puede rearmarlas con los horarios recién consultados, sin depender
   de que la pantalla ya se haya vuelto a dibujar. */
function armarDia(
  actos: ActoRPC[], dia: Dia, esEnsayo: boolean, misAgr: Set<string>, horarios: Horarios,
): Fila[] {
  const delDia = actos.filter((a) => String(a.dia || '').toUpperCase() === dia);
  const ord = (blq: string) =>
    delDia.filter((a) => String(a.bloque || '').toUpperCase() === blq).sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0));
  // Ensayo por orden de llegada (viernes): sin programa (se muestra un aviso).
  if (esEnsayo && ENSAYO_ORDEN_LLEGADA.has(dia)) return [];
  const base = [...ord('MENOR'), ...ord('MAYOR')];
  // Apertura oficial (30 min) al inicio, solo en la presentación de los días definidos.
  const seq = (!esEnsayo && APERTURA_DIAS.has(dia)) ? [aperturaActo(dia), ...base] : base;
  if (!seq.length) return [];
  let cur = hhmmSeg(esEnsayo ? ensayoDe(horarios, dia) : inicioDe(horarios, dia));
  let realN = 0;
  return seq.map((a) => {
    const n = esApertura(a) ? 0 : ++realN; // la apertura va como 00, el resto 01, 02…
    const hora = segHHMM(cur);
    const dur = esEnsayo ? '8:00' : a.duracion || DUR_SUBDIV[String(a.subdivision || '').toUpperCase().trim()] || '5:00';
    cur += esEnsayo ? ENSAYO_SEG + PUENTE_ENSAYO_SEG : durSeg(dur) + BUFFER_SEG;
    return { ...a, n, hora, dur, mio: a.id_agrupacion ? misAgr.has(String(a.id_agrupacion)) : false };
  });
}

/* ─────────────────────── Programa de las FINALES (Sáb/Dom) ───────────────────────
   A diferencia de las clasificatorias (Martes–Viernes, con orden sorteado), la
   final NO tiene un orden fijo todavía: se ARMA SOLA con las mejores notas. Cada
   día toma sus 100 mejores (CUPO_FINAL) que pasan el corte y las organiza por
   bloque → división · modalidad · subdivisión. Es EN VIVO: mientras el jurado
   califica, la lista se recalcula y una obra puede entrar o quedar afuera si el
   cupo se llena con notas más altas. */
/** Una tarjeta por grupo: (bloque + división · modalidad · subdivisión), igual que
 *  la app de jurados. El bloque NO separa en secciones grandes; es sólo el badge de
 *  cada tarjeta. La lista YA viene ordenada con el preset del programa (gemelo de
 *  jurados), así que acá sólo se agrupan los consecutivos que comparten grupo — el
 *  orden de las tarjetas queda EXACTAMENTE igual que en jurados. */
function agruparConsecutivo(items: RankingObra[]): Array<{ bloque: Bloque | null; label: string; items: RankingObra[] }> {
  const grupos: Array<{ bloque: Bloque | null; label: string; items: RankingObra[] }> = [];
  let cur: { bloque: Bloque | null; label: string; items: RankingObra[]; key: string } | null = null;
  for (const o of items) {
    const bloque = normalizarBloque(o.bloque, o.division);
    const label = [o.division, o.modalidad, o.subdivision].filter(Boolean).map((s) => String(s)).join(' · ') || 'General';
    const key = `${bloque ?? 'SIN'}|${label}`;
    if (!cur || cur.key !== key) {
      cur = { bloque, label, items: [], key };
      grupos.push({ bloque, label, items: cur.items });
    }
    cur.items.push(o);
  }
  return grupos;
}

function GrupoFinalCard({ bloque, label, count, children }: { bloque: Bloque | null; label: string; count: number; children: React.ReactNode }) {
  const mayor = bloque === 'MAYOR';
  return (
    <div
      className={`overflow-hidden rounded-xl border ${mayor ? 'border-fuchsia/25' : bloque ? 'border-cyan/25' : 'border-glass-border'} bg-glass-bg`}
      style={{ borderLeftWidth: 3, borderLeftColor: mayor ? 'var(--fuchsia)' : bloque ? 'var(--cyan)' : undefined }}
    >
      <div className={`flex items-center gap-2 border-b border-glass-border px-3 py-2 ${mayor ? 'bg-fuchsia/8' : bloque ? 'bg-cyan/8' : ''}`}>
        {bloque && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${mayor ? 'bg-fuchsia/20 text-fuchsia' : 'bg-cyan/20 text-cyan'}`} style={{ letterSpacing: '0.5px' }}>
            {bloque.toLowerCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold uppercase tracking-wide text-text-90">{label}</span>
        <span className="shrink-0 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] tabular-nums text-text-45">{count}</span>
      </div>
      <div className="divide-y divide-glass-border">{children}</div>
    </div>
  );
}

function FinalObraRow({ o, pos, mio }: { o: RankingObra; pos: number; mio: boolean }) {
  const nombre = o.agrupacion || 'Agrupación';
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 ${mio ? 'bg-fuchsia/10' : ''}`}>
      <div className="w-6 shrink-0 text-center text-[13px] font-bold text-gold tabular-nums">{pos}</div>
      {o.enlace_del_logo ? (
        <img src={webpProxy(o.enlace_del_logo, 80) ?? undefined} alt="" loading="lazy"
          className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/10" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 text-[11px] font-bold text-text-45 ring-1 ring-white/10">
          {initials(nombre)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-semibold uppercase text-text-white" style={{ letterSpacing: '0.3px' }}>
            {nombre}
          </span>
          {mio && (
            <span className="shrink-0 rounded-md border border-fuchsia/40 bg-fuchsia/10 px-1.5 py-px text-[9px] font-bold uppercase text-fuchsia" style={{ letterSpacing: '0.5px' }}>
              Tu participación
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-text-45">{o.obra ? `"${o.obra}"` : 'Sin obra'}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[16px] font-bold text-gold tabular-nums">{fmtScore(o.nota_final)}</div>
        <div className="text-[9px] text-text-45">{o.jurados} jurado{o.jurados === 1 ? '' : 's'}</div>
      </div>
    </div>
  );
}

function FinalDia({ dia, enabled, misNombres }: { dia: DiaFinal; enabled: boolean; misNombres: Set<string> }) {
  const q = useRankingPublico(enabled);
  // 1) Quiénes entran: las 100 mejores notas del día (cupo). 2) En qué orden se
  // muestran: el preset del programa (bloque → división → modalidad → subdivisión),
  // EXACTAMENTE como la app de jurados — no por nota.
  const finalistas = useMemo(() => ordenarPrograma(finalistasPorDia(q.data ?? [])[dia]), [q.data, dia]);
  const grupos = useMemo(() => agruparConsecutivo(finalistas), [finalistas]);
  // Posición secuencial en el orden en que se despliega (1, 2, 3…), como el admin.
  const posDe = useMemo(() => {
    const m = new Map<string, number>();
    finalistas.forEach((o, i) => m.set(o.id_inscripcion, i + 1));
    return m;
  }, [finalistas]);

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (finalistas.length === 0) {
    return (
      <EmptyState>
        Todavía no hay clasificados para la final del {dia.toLowerCase()}. Aparecerán aquí las obras que pasan el corte,
        a medida que el jurado califica.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-gold/25 bg-gold/5 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Trophy className="h-5 w-5 shrink-0 text-gold" />
          <div>
            <div className="text-[13px] font-bold text-text-white">Final · {dia}</div>
            <div className="text-[11px] text-text-45">Se arma en vivo con las mejores notas · se actualiza al calificar</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[15px] font-bold text-gold tabular-nums">{finalistas.length}<span className="text-[11px] text-text-45">/{CUPO_FINAL}</span></div>
          <div className="text-[9px] uppercase text-text-45" style={{ letterSpacing: '0.5px' }}>Cupos</div>
        </div>
      </div>

      {grupos.map((g) => (
        <GrupoFinalCard key={`${g.bloque}|${g.label}`} bloque={g.bloque} label={g.label} count={g.items.length}>
          {g.items.map((o) => (
            <FinalObraRow key={o.id_inscripcion} o={o} pos={posDe.get(o.id_inscripcion) ?? 0}
              mio={misNombres.has((o.agrupacion || '').toUpperCase().trim())} />
          ))}
        </GrupoFinalCard>
      ))}
    </div>
  );
}

export function ProgramaTab() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['programa', '2026'], queryFn: fetchPrograma, enabled: !!user, staleTime: 30_000 });
  const inscQ = useInscripciones('2026', !!user);
  // Horarios fijados por el administrador. Se vuelven a consultar al momento de
  // generar el PDF, de manera que un cambio hecho en la app de jurados aparezca
  // sin necesidad de recargar la página.
  const horariosQ = useQuery({ queryKey: ['horarios', '2026'], queryFn: fetchHorarios, enabled: !!user, staleTime: 30_000 });
  const horarios = useMemo<Horarios>(() => horariosQ.data ?? {}, [horariosQ.data]);
  const actos = useMemo(() => (q.data ?? []) as ActoRPC[], [q.data]);
  const [mode, setMode] = useState<'presentacion' | 'ensayo'>('presentacion');
  const esEnsayo = mode === 'ensayo';

  // Set de id_agrupacion propios (del usuario logueado) para resaltar "tus turnos".
  const misAgr = useMemo(() => {
    const s = new Set<string>();
    for (const i of inscQ.data?.['2026'] ?? []) if (i.id_agrupacion) s.add(String(i.id_agrupacion));
    if (user?.id_agrupacion) s.add(String(user.id_agrupacion));
    return s;
  }, [inscQ.data, user]);

  // El ranking público (INNER join con notas → solo obras ya calificadas) alimenta
  // el programa de las FINALES (Sábado/Domingo), que se arma solo con las mejores
  // notas. Es en vivo (polling ~8 s), así que la final se recompone al calificar.
  const rankingQ = useRankingPublico(!!user);
  const finalPorDia = useMemo(() => finalistasPorDia(rankingQ.data ?? []), [rankingQ.data]);
  const finalCount: Record<Dia, number> = {
    MARTES: 0, MIERCOLES: 0, JUEVES: 0, VIERNES: 0,
    SABADO: finalPorDia['Sábado'].length, DOMINGO: finalPorDia['Domingo'].length,
  };
  // Nombres de agrupación propios (el ranking no trae id_agrupacion, se matchea por nombre).
  const misNombres = useMemo(() => {
    const s = new Set<string>();
    for (const i of inscQ.data?.['2026'] ?? []) if (i.agrupacion) s.add(String(i.agrupacion).toUpperCase().trim());
    return s;
  }, [inscQ.data]);

  // Por día: menor luego mayor, ordenados; hora acumulada (inicio + duración + buffer).
  const porDia = useMemo(() => {
    const out: Partial<Record<Dia, Fila[]>> = {};
    for (const dia of DIAS) {
      const filas = armarDia(actos, dia, esEnsayo, misAgr, horarios);
      if (filas.length) out[dia] = filas;
    }
    return out;
  }, [actos, misAgr, esEnsayo, horarios]);

  const diasConProg = DIAS.filter((d) => porDia[d]);
  const totalActos = actos.length;
  const misTurnos = Object.values(porDia).flat().filter((r) => r.mio).length;

  const stats = [
    { label: 'Actos programados', value: totalActos, accent: 'purple' as const },
    { label: 'Días con programa', value: diasConProg.length, accent: 'cyan' as const },
    { label: 'Tus turnos', value: misTurnos, accent: 'fuchsia' as const },
  ];

  // Día seleccionado (botones rápidos). Arranca en el primer día que tenga programa.
  const [diaSel, setDiaSel] = useState<Dia>('MARTES');
  const ordenLlegada = esEnsayo && ENSAYO_ORDEN_LLEGADA.has(diaSel);
  // Sábado/Domingo en presentación = programa de la FINAL (se arma solo con las notas).
  const esFinalDia = !esEnsayo && (diaSel === 'SABADO' || diaSel === 'DOMINGO');
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current && diasConProg.length) {
      initRef.current = true;
      if (!porDia[diaSel]) setDiaSel(diasConProg[0]);
    }
  }, [diasConProg, porDia, diaSel]);

  const [pdfLoading, setPdfLoading] = useState(false);
  // Descarga el programa del DÍA seleccionado (no todos). El archivo lleva el nombre del día.
  const descargarPdf = async () => {
    if (!porDia[diaSel] || pdfLoading) return;
    setPdfLoading(true);
    try {
      // Se releen los horarios antes de armar el documento: si el administrador
      // cambió la hora de inicio en la app de jurados, el PDF ya sale con la nueva
      // aunque esta página lleve rato abierta.
      const frescos = (await horariosQ.refetch()).data ?? horarios;
      const rows = armarDia(actos, diaSel, esEnsayo, misAgr, frescos);
      if (!rows.length) return;
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const auto = doc as unknown as { autoTable: (o: unknown) => void; lastAutoTable: { finalY: number } };
      const W = 210, H = 297;
      const padL = 18, padR = 18, padT = 46, padB = 34; // header termina ~30.5mm, footer empieza ~30mm del fondo

      // Membrete oficial (header + footer) como fondo full-page, en cada página.
      const fetchImg = async (u: string): Promise<string | null> => {
        try {
          const r = await fetch(u); if (!r.ok) return null;
          const b = await r.blob();
          return await new Promise<string | null>((res) => {
            const fr = new FileReader();
            fr.onload = () => res(typeof fr.result === 'string' ? fr.result : null);
            fr.onerror = () => res(null);
            fr.readAsDataURL(b);
          });
        } catch { return null; }
      };
      const membrete = await fetchImg(URL_MEMBRETE);
      const drawMembrete = () => { if (membrete) { try { doc.addImage(membrete, 'PNG', 0, 0, W, H, 'mb', 'FAST'); } catch { /* noop */ } } };

      const capFirst = (s: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '—');

      const drawTitulo = () => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20, 18, 15);
        doc.text((esEnsayo ? 'Programa de ensayos' : 'Programa de presentacion') + ' - ' + DIA_LABEL[diaSel] + ' - XVIII Festival Danzarte 2026', padL, padT);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120);
        doc.text(
          esEnsayo
            ? 'Inicio ' + hhmmAmPm(ensayoDe(frescos, diaSel)) + ' - ' + rows.length + ' ensayos - 8 min c/u + 1 min de puente (horarios aproximados)'
            : 'Inicio ' + hhmmAmPm(inicioDe(frescos, diaSel)) + ' - ' + rows.length + ' actos - ~1:30 entre bailes (horarios aproximados)',
          padL, padT + 5,
        );
        doc.setDrawColor(...DIA_RGB[diaSel]); doc.setLineWidth(0.6); doc.line(padL, padT + 7, W - padR, padT + 7);
        doc.setTextColor(0);
      };

      // Membrete (fondo) UNA vez por página, ANTES de la tabla; título solo en la pág. 1.
      const paginado = new Set<number>();
      const onPage = (data: { pageNumber: number }) => {
        if (paginado.has(data.pageNumber)) return;
        drawMembrete();
        if (data.pageNumber === 1) drawTitulo();
        paginado.add(data.pageNumber);
      };

      // Duración de cada baile, al lado de la hora. En el de ensayos no se pone:
      // ahí el turno es de 8 min para todos y la cifra se repetiría en cada fila
      // (ya está dicha en el subtítulo).
      const conDur = !esEnsayo;
      const CABECERA = conDur
        ? ['Hora', 'Dur.', 'N', 'Agrupacion', 'Obra', 'Categoria', 'Genero']
        : ['Hora', 'N', 'Agrupacion', 'Obra', 'Categoria', 'Genero'];
      // Los 174 mm útiles se reparten distinto según lleve o no la columna Dur.:
      // el ancho sale de Hora, N, Categoria y Genero, que iban sobradas.
      // Agrupacion (46) y Obra (42) conservan el suyo para no forzar más saltos
      // de línea en los nombres largos.
      const COLS = conDur
        ? { 0: { cellWidth: 17, halign: 'center' }, 1: { cellWidth: 12, halign: 'center' }, 2: { cellWidth: 7, halign: 'center' }, 3: { cellWidth: 46 }, 4: { cellWidth: 42 }, 5: { cellWidth: 25 }, 6: { cellWidth: 25 } }
        : { 0: { cellWidth: 20, halign: 'center' }, 1: { cellWidth: 9, halign: 'center' }, 2: { cellWidth: 46 }, 3: { cellWidth: 42 }, 4: { cellWidth: 28 }, 5: { cellWidth: 29 } };

      const filaDe = (r: Fila) => {
        const fila = [
          r.hora,
          String(r.n).padStart(2, '0'),
          r.nombre_agrupacion || r.agrupacion || '',
          r.obra || '',
          capFirst(r.categoria),
          capFirst(r.genero),
        ];
        if (conDur) fila.splice(1, 0, r.dur);
        return fila;
      };
      // Una sección de tabla con su cabecera de color (apertura / bloque menor / bloque mayor).
      let y = padT + 11;
      const seccion = (titulo: string, color: [number, number, number], rb: Fila[]) => {
        if (!rb.length) return;
        auto.autoTable({
          startY: y,
          rowPageBreak: 'avoid',
          margin: { top: padT, bottom: padB, left: padL, right: padR },
          willDrawPage: onPage,
          head: [
            [{ content: titulo, colSpan: CABECERA.length, styles: { fillColor: color, textColor: 255, fontStyle: 'bold', fontSize: 9.5, halign: 'left' } }],
            CABECERA,
          ],
          body: rb.map(filaDe),
          styles: { fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle', lineColor: [224, 221, 228], lineWidth: 0.2, textColor: [40, 38, 45] },
          headStyles: { fillColor: color, textColor: 255, fontSize: 7.5, halign: 'left', fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 244, 250] },
          columnStyles: COLS,
        });
        y = auto.lastAutoTable.finalY + 6;
      };
      // Apertura oficial (orden 00) primero, luego bloques MENOR y MAYOR.
      seccion('APERTURA', APERTURA_RGB, rows.filter(esApertura));
      for (const blq of ['MENOR', 'MAYOR'] as const) {
        seccion('BLOQUE ' + blq, BLOQUE_RGB[blq], rows.filter((r) => !esApertura(r) && String(r.bloque || '').toUpperCase() === blq));
      }

      const base = ((esEnsayo ? 'ensayos-' : 'programa-') + DIA_LABEL[diaSel] + '-2026').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const url = URL.createObjectURL(doc.output('blob'));
      const a = document.createElement('a'); a.href = url; a.download = base + '.pdf'; a.rel = 'noopener';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[15px] font-bold text-text-white">
          {esEnsayo ? 'Programa de ensayos' : 'Programa de presentación'}
        </h1>
        {porDia[diaSel] && (
          <button
            type="button"
            onClick={descargarPdf}
            disabled={pdfLoading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold text-text-white ring-1 ring-glass-border transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />{' '}
            {pdfLoading ? 'Generando…' : `Descargar ${esEnsayo ? 'ensayos' : 'programa'} ${DIA_LABEL[diaSel]}`}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-glass-border bg-glass-bg p-1.5 backdrop-blur-md">
        {([['presentacion', 'Presentación'], ['ensayo', 'Ensayos']] as const).map(([m, label]) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); if (m === 'ensayo' && (diaSel === 'SABADO' || diaSel === 'DOMINGO')) setDiaSel('MARTES'); }}
              className={
                active
                  ? 'rounded-xl bg-[linear-gradient(135deg,var(--cyan),var(--fuchsia))] px-2 py-2 text-[13px] font-semibold text-white shadow'
                  : 'rounded-xl px-2 py-2 text-[13px] font-medium text-text-45 hover:text-text-90'
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {esEnsayo && !ordenLlegada && (
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <p className="text-[11px] text-text-45">
            Ensayos desde las {hhmmAmPm(ensayoDe(horarios, diaSel))} · 8 min por agrupación · 1 min entre agrupaciones · mismo orden que la presentación.
          </p>
          {/* Cada agrupación ensaya el día ANTERIOR al que se presenta, así que la
              fecha del ensayo no coincide con la del día elegido y conviene decirla. */}
          {textoFechaEnsayo(diaSel) && (
            <p className="shrink-0 text-[13px] font-bold text-text-white sm:text-[14px]">
              {textoFechaEnsayo(diaSel)}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 overflow-x-auto rounded-2xl border border-glass-border bg-glass-bg p-3 backdrop-blur-md no-scrollbar">
        {(esEnsayo ? DIAS.filter((d) => d !== 'SABADO' && d !== 'DOMINGO') : DIAS).map((d) => {
          // Sáb/Dom (presentación) cuentan por finalistas; el resto por actos con orden.
          const cnt = !esEnsayo && (d === 'SABADO' || d === 'DOMINGO') ? finalCount[d] : (porDia[d]?.length ?? 0);
          const has = cnt > 0;
          const active = d === diaSel;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDiaSel(d)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                active ? 'text-white' : `ring-1 ring-glass-border hover:bg-white/5 ${has ? 'text-text-white' : 'text-text-45'}`
              }`}
              style={active ? { background: DIA_ACCENT[d] } : undefined}
            >
              {DIA_LABEL[d]}
              {has && !active && <span className="ml-1.5 text-[11px] text-text-45">{cnt}</span>}
            </button>
          );
        })}
      </div>

      <StatsCards stats={stats} />

      {ordenLlegada && (
        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-6 text-center backdrop-blur-md">
          <p className="text-[15px] font-bold text-text-white">Ensayos por orden de llegada</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] text-text-45">
            Los ensayos del viernes se realizan el jueves y son <b className="text-text-90">por orden de llegada</b> de
            las agrupaciones — no hay un programa ni un horario fijo.
          </p>
        </div>
      )}

      {esFinalDia && (
        <FinalDia dia={diaSel === 'SABADO' ? 'Sábado' : 'Domingo'} enabled={!!user} misNombres={misNombres} />
      )}

      {!esFinalDia && q.isLoading && <LoadingSkeleton rows={3} />}

      {!esFinalDia && !q.isLoading && !ordenLlegada && diasConProg.length === 0 && (
        <EmptyState>El orden de presentación todavía no está publicado.</EmptyState>
      )}

      {!esFinalDia && !q.isLoading && !ordenLlegada && diasConProg.length > 0 && !porDia[diaSel] && (
        <EmptyState>El programa de {DIA_LABEL[diaSel]} todavía no está publicado.</EmptyState>
      )}

      {!esFinalDia && (
      <div className="space-y-4">
        {(porDia[diaSel] ? [diaSel] : []).map((dia) => {
          const rows = porDia[dia]!;
          // La apertura (orden 00) va SIEMPRE al inicio, sobre los bloques.
          // `agruparPorBloque` manda lo sin-bloque al final, así que la sacamos aparte.
          const aperturas = rows.filter(esApertura);
          const resto = rows.filter((r) => !esApertura(r));
          return (
            <DayGroup key={dia} label={DIA_LABEL[dia]} count={`${rows.length} ${esEnsayo ? 'ensayos' : 'actos'} · inicio ${hhmmAmPm(esEnsayo ? ensayoDe(horarios, dia) : inicioDe(horarios, dia))}`} accent={DIA_ACCENT[dia]} defaultOpen>
              <div className="space-y-2">
                {aperturas.map((r) => (
                  <ActoRow key={r.id_inscripcion} r={r} esEnsayo={esEnsayo} />
                ))}
                {/* Separado en BLOQUE MENOR / BLOQUE MAYOR, igual que el PDF.
                    Las filas ya vienen ordenadas menor→mayor y por orden de
                    sorteo, así que agrupar no altera la secuencia. */}
                {agruparPorBloque(resto, (r) => ({ bloque: r.bloque, division: null })).map((g) =>
                  g.bloque ? (
                    <BloqueGroup key={g.bloque} bloque={g.bloque} cantidad={g.items.length}>
                      {g.items.map((r) => (
                        <ActoRow key={r.id_inscripcion} r={r} esEnsayo={esEnsayo} />
                      ))}
                    </BloqueGroup>
                  ) : (
                    <div key="sin" className="space-y-2">
                      {g.items.map((r) => (
                        <ActoRow key={r.id_inscripcion} r={r} esEnsayo={esEnsayo} />
                      ))}
                    </div>
                  ),
                )}
              </div>
            </DayGroup>
          );
        })}
      </div>
      )}
    </div>
  );
}
