import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileDown } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton';
import { StatsCards } from '@/components/shared/StatsCards';
import { DayGroup } from '@/components/shared/DayGroup';
import { supabase } from '@/lib/supabase/client';
import { useInscripciones } from '@/hooks/queries';
import { useAuth } from '@/hooks/useAuth';
import { webpProxy } from '@/lib/utils/img';

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
// Color de encabezado por día — cada programa se distingue por color.
const DIA_ACCENT: Record<Dia, string> = {
  MARTES: '#7C3AED', MIERCOLES: '#0891B2', JUEVES: '#CA8A04', VIERNES: '#DB2777',
};
const DIA_RGB: Record<Dia, [number, number, number]> = {
  MARTES: [124, 58, 237], MIERCOLES: [8, 145, 178], JUEVES: [202, 138, 4], VIERNES: [219, 39, 119],
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
      let cur = hhmmSeg(HORA_INICIO[dia]);
      out[dia] = seq.map((a, i) => {
        const hora = segHHMM(cur);
        const dur = a.duracion || DUR_SUBDIV[String(a.subdivision || '').toUpperCase().trim()] || '5:00';
        cur += durSeg(dur) + BUFFER_SEG;
        return { ...a, n: i + 1, hora, dur, mio: a.id_agrupacion ? misAgr.has(String(a.id_agrupacion)) : false };
      });
    }
    return out;
  }, [actos, misAgr]);

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
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const auto = doc as unknown as { autoTable: (o: unknown) => void; lastAutoTable: { finalY: number } };
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(20, 18, 15);
      doc.text('Programa de presentacion - ' + DIA_LABEL[diaSel] + ' - XVIII Festival Danzarte 2026', 40, 42);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
      doc.text('Inicio ' + HORA_INICIO[diaSel] + ' - ' + rows.length + ' actos - ~1:30 entre bailes (horarios aproximados)', 40, 58);
      doc.setTextColor(0);
      auto.autoTable({
        startY: 74,
        rowPageBreak: 'avoid',
        margin: { top: 40, bottom: 34, left: 40, right: 40 },
        head: [['N', 'Agrupacion', 'Obra', 'Modalidad', 'Subdiv.', 'Hora', 'Dur.']],
        body: rows.map((r) => [
          String(r.n).padStart(2, '0'),
          r.nombre_agrupacion || r.agrupacion || '',
          r.obra || '',
          r.modalidad || '',
          (r.subdivision || '').replace('GRUPO ', 'G. '),
          r.hora,
          r.dur,
        ]),
        styles: { fontSize: 9, cellPadding: 5, overflow: 'linebreak', valign: 'middle', lineColor: [224, 221, 228], lineWidth: 0.5, textColor: [40, 38, 45] },
        headStyles: { fillColor: DIA_RGB[diaSel], textColor: 255, fontSize: 9, halign: 'left', fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [246, 244, 250] },
        columnStyles: { 0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }, 1: { cellWidth: 128 }, 2: { cellWidth: 108 }, 3: { cellWidth: 100 }, 4: { cellWidth: 58 }, 5: { cellWidth: 44, halign: 'center', fontStyle: 'bold' }, 6: { cellWidth: 40, halign: 'center' } },
      });
      const base = ('programa-' + DIA_LABEL[diaSel] + '-2026').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
        <h1 className="text-[15px] font-bold text-text-white">Programa de presentación</h1>
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

      <div className="rounded-2xl border border-glass-border bg-glass-bg p-4 text-[12px] leading-relaxed text-text-70 backdrop-blur-md">
        Orden de presentación estimado. Inicio: Martes/Miércoles/Jueves 19:00 · Viernes 15:00. Se considera ~1:30 min entre bailes por cambio de escenario, así que <b>los horarios son aproximados</b>.
      </div>

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
            <DayGroup key={dia} label={DIA_LABEL[dia]} count={`${rows.length} actos · inicio ${HORA_INICIO[dia]}`} accent={DIA_ACCENT[dia]} defaultOpen>
              <div className="space-y-2">
                {rows.map((r) => {
                  const nombre = r.nombre_agrupacion || r.agrupacion || 'Agrupación';
                  return (
                    <div
                      key={r.id_inscripcion}
                      className={`flex items-center gap-3 rounded-xl border p-2.5 transition-colors ${
                        r.mio ? 'border-fuchsia/60 bg-fuchsia/10' : 'border-glass-border bg-glass-bg'
                      }`}
                    >
                      <div className="w-8 shrink-0 text-center text-[15px] font-extrabold text-text-white tabular-nums">
                        {String(r.n).padStart(2, '0')}
                      </div>
                      <div className="w-13 shrink-0 text-center">
                        <div className="text-[14px] font-bold text-gold tabular-nums">{r.hora}</div>
                        <div className="text-[10px] text-text-45 tabular-nums">{r.dur}</div>
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
                            <span className="shrink-0 rounded-md border border-fuchsia/40 bg-fuchsia/10 px-1.5 py-px text-[9px] font-bold uppercase text-fuchsia" style={{ letterSpacing: '0.5px' }}>
                              Tu agrupación
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[11px] text-text-45">
                          {r.obra ? `"${r.obra}"` : 'Sin obra'}{r.subdivision ? ` · ${r.subdivision}` : ''}
                          {r.bloque ? ` · ${String(r.bloque).toUpperCase() === 'MAYOR' ? 'Mayor' : 'Menor'}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DayGroup>
          );
        })}
      </div>
    </div>
  );
}
