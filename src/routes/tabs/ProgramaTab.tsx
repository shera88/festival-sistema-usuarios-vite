import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown, ChevronDown } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { DayGroup } from '@/components/shared/DayGroup';
import { supabase } from '@/lib/supabase/client';
import { useInscripciones } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { webpProxy } from '@/lib/utils/img';

// Membrete oficial del festival (header + footer, medio en blanco) para los PDFs de programa/ensayos.
const URL_MEMBRETE = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/membrete-programa.png';

// Días del sorteo + horario de inicio (según la convocatoria).
const DIAS = ['MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'] as const;
type Dia = (typeof DIAS)[number];
const DIA_LABEL: Record<Dia, string> = {
  MARTES: 'Martes', MIERCOLES: 'Miércoles', JUEVES: 'Jueves', VIERNES: 'Viernes',
};
const HORA_INICIO: Record<Dia, string> = {
  MARTES: '19:00', MIERCOLES: '19:00', JUEVES: '19:00', VIERNES: '15:00',
};
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
// Color de encabezado por día — cada programa se distingue por color.
const DIA_ACCENT: Record<Dia, string> = {
  MARTES: '#7C3AED', MIERCOLES: '#0891B2', JUEVES: '#CA8A04', VIERNES: '#DB2777',
};
const DIA_RGB: Record<Dia, [number, number, number]> = {
  MARTES: [124, 58, 237], MIERCOLES: [8, 145, 178], JUEVES: [202, 138, 4], VIERNES: [219, 39, 119],
};
// Colores de cabecera por bloque en el PDF (menor vs mayor bien diferenciados).
const BLOQUE_RGB: Record<'MENOR' | 'MAYOR', [number, number, number]> = {
  MENOR: [8, 145, 178],   // cian
  MAYOR: [124, 58, 237],  // violeta
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
const segHHMM = (x: number) => { const v = Math.round(x); return String(Math.floor(v / 3600)).padStart(2, '0') + ':' + String(Math.floor((v % 3600) / 60)).padStart(2, '0'); };

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
        <div className="w-11 shrink-0 text-center text-[12px] font-normal text-gold tabular-nums">{r.hora}</div>
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
              <img
                src={webpProxy(r.coreografo_foto, 96) ?? undefined}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-gold/30"
                loading="lazy"
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

export function ProgramaTab() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['programa', '2026'], queryFn: fetchPrograma, enabled: !!user, staleTime: 30_000 });
  const inscQ = useInscripciones('2026', !!user);
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

  // Por día: menor luego mayor, ordenados; hora acumulada (inicio + duración + buffer).
  const porDia = useMemo(() => {
    const out: Partial<Record<Dia, Fila[]>> = {};
    for (const dia of DIAS) {
      const delDia = actos.filter((a) => String(a.dia || '').toUpperCase() === dia);
      const ord = (blq: string) =>
        delDia.filter((a) => String(a.bloque || '').toUpperCase() === blq).sort((x, y) => (x.orden ?? 0) - (y.orden ?? 0));
      const seq = [...ord('MENOR'), ...ord('MAYOR')];
      if (!seq.length) continue;
      let cur = hhmmSeg(esEnsayo ? HORA_INICIO_ENSAYO : HORA_INICIO[dia]);
      out[dia] = seq.map((a, i) => {
        const hora = segHHMM(cur);
        const dur = esEnsayo ? '8:00' : a.duracion || DUR_SUBDIV[String(a.subdivision || '').toUpperCase().trim()] || '5:00';
        cur += esEnsayo ? ENSAYO_SEG + PUENTE_ENSAYO_SEG : durSeg(dur) + BUFFER_SEG;
        return { ...a, n: i + 1, hora, dur, mio: a.id_agrupacion ? misAgr.has(String(a.id_agrupacion)) : false };
      });
    }
    return out;
  }, [actos, misAgr, esEnsayo]);

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
    const rows = porDia[diaSel];
    if (!rows || pdfLoading) return;
    setPdfLoading(true);
    try {
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
            ? 'Inicio 08:00 - ' + rows.length + ' ensayos - 8 min c/u + 1 min de puente (horarios aproximados)'
            : 'Inicio ' + HORA_INICIO[diaSel] + ' - ' + rows.length + ' actos - ~1:30 entre bailes (horarios aproximados)',
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

      // Bloques MENOR y MAYOR en el MISMO PDF, cada uno con su cabecera de color.
      let y = padT + 11;
      for (const blq of ['MENOR', 'MAYOR'] as const) {
        const rb = rows.filter((r) => String(r.bloque || '').toUpperCase() === blq);
        if (!rb.length) continue;
        const color = BLOQUE_RGB[blq];
        auto.autoTable({
          startY: y,
          rowPageBreak: 'avoid',
          margin: { top: padT, bottom: padB, left: padL, right: padR },
          willDrawPage: onPage,
          head: [
            [{ content: 'BLOQUE ' + blq, colSpan: 6, styles: { fillColor: color, textColor: 255, fontStyle: 'bold', fontSize: 9.5, halign: 'left' } }],
            ['N', 'Agrupacion', 'Obra', 'Categoria', 'Genero', 'Hora'],
          ],
          body: rb.map((r) => [
            String(r.n).padStart(2, '0'),
            r.nombre_agrupacion || r.agrupacion || '',
            r.obra || '',
            capFirst(r.categoria),
            capFirst(r.genero),
            r.hora,
          ]),
          styles: { fontSize: 7.5, cellPadding: 1.4, overflow: 'linebreak', valign: 'middle', lineColor: [224, 221, 228], lineWidth: 0.2, textColor: [40, 38, 45] },
          headStyles: { fillColor: color, textColor: 255, fontSize: 7.5, halign: 'left', fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 244, 250] },
          columnStyles: { 0: { cellWidth: 9, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 48 }, 2: { cellWidth: 44 }, 3: { cellWidth: 28 }, 4: { cellWidth: 29 }, 5: { cellWidth: 16, halign: 'center', fontStyle: 'bold' } },
        });
        y = auto.lastAutoTable.finalY + 6;
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
            <FileDown className="h-4 w-4" /> {pdfLoading ? 'Generando…' : `Descargar ${DIA_LABEL[diaSel]}`}
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
              onClick={() => setMode(m)}
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

      {esEnsayo && (
        <p className="text-[11px] text-text-45">
          Ensayos desde las 08:00 · 8 min por agrupación · 1 min entre agrupaciones · mismo orden que la presentación.
        </p>
      )}

      <div className="flex flex-wrap gap-2 overflow-x-auto rounded-2xl border border-glass-border bg-glass-bg p-3 backdrop-blur-md no-scrollbar">
        {DIAS.map((d) => {
          const has = !!porDia[d];
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
              {has && !active && <span className="ml-1.5 text-[11px] text-text-45">{porDia[d]!.length}</span>}
            </button>
          );
        })}
      </div>

      <StatsCards stats={stats} />

      {q.isLoading && <LoadingSkeleton rows={3} />}

      {!q.isLoading && diasConProg.length === 0 && (
        <EmptyState>El orden de presentación todavía no está publicado.</EmptyState>
      )}

      {!q.isLoading && diasConProg.length > 0 && !porDia[diaSel] && (
        <EmptyState>El programa de {DIA_LABEL[diaSel]} todavía no está publicado.</EmptyState>
      )}

      <div className="space-y-4">
        {(porDia[diaSel] ? [diaSel] : []).map((dia) => {
          const rows = porDia[dia]!;
          return (
            <DayGroup key={dia} label={DIA_LABEL[dia]} count={`${rows.length} ${esEnsayo ? 'ensayos' : 'actos'} · inicio ${esEnsayo ? HORA_INICIO_ENSAYO : HORA_INICIO[dia]}`} accent={DIA_ACCENT[dia]} defaultOpen>
              <div className="space-y-2">
                {rows.map((r) => (
                  <ActoRow key={r.id_inscripcion} r={r} esEnsayo={esEnsayo} />
                ))}
              </div>
            </DayGroup>
          );
        })}
      </div>
    </div>
  );
}
