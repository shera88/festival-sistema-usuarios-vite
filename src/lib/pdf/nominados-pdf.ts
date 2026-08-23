import type { NominadosBloque } from '@/types/domain';

/**
 * PDF de NOMINADOS — el mismo que baja la app de jurados desde «PDF público».
 *
 * Mismas medidas, mismas columnas y los mismos colores por género, para que sea
 * el mismo documento salga de donde salga.
 *
 * NO lleva lugar ni nota, y el orden dentro de cada bloque es el que ya vino
 * MEZCLADO del servidor: acá no se reordena nada. La numeración se imprime tal
 * como llegó, que es correlativa a lo mezclado, no al puesto.
 */

const MORADO: [number, number, number] = [103, 78, 167];   // #674EA7, cabecera

/** Color de la franja por género, igual que la planilla oficial. */
const COLOR_GENERO: Record<string, [number, number, number]> = {
  ACADEMICO: [142, 124, 195],  // morado
  URBANO: [60, 120, 216],      // azul
  FOLKLORE: [93, 157, 66],     // verde
};

const COLUMNAS = ['N°', 'AGRUPACION', 'NOMBRE DE LA OBRA', 'GENERO'];

/** A4 apaisado son 842 pt; con los márgenes de 40 quedan 762 útiles. Suman 762. */
const ANCHOS: Record<number, number> = { 0: 36, 1: 250, 2: 356, 3: 120 };

export async function descargarNominadosPdf(
  bloques: NominadosBloque[],
  opts: { ano: string; total: number },
) {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const auto = doc as unknown as { autoTable: (o: unknown) => void };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`NOMINADOS · FESTIVAL DANZARTE ${opts.ano}`, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `${opts.total} nominados · el orden es aleatorio y no indica ningún resultado`,
    40, 55,
  );
  doc.setTextColor(0);

  const body: unknown[] = [];
  for (const b of bloques) {
    body.push([{
      content: b.label,
      colSpan: COLUMNAS.length,
      styles: {
        fillColor: COLOR_GENERO[b.genero] ?? MORADO,
        textColor: 255, fontStyle: 'bold', fontSize: 8, halign: 'center',
      },
    }]);
    for (const o of b.items) {
      body.push([String(o.n), o.agrupacion, o.obra, o.genero]);
    }
  }

  auto.autoTable({
    startY: 68,
    showHead: 'firstPage',
    rowPageBreak: 'avoid',
    margin: { top: 40, bottom: 42, left: 40, right: 40 },
    head: [COLUMNAS],
    body,
    theme: 'grid',
    styles: {
      fontSize: 7.5, cellPadding: 3.5, overflow: 'linebreak', valign: 'middle',
      lineColor: [185, 180, 205], lineWidth: 0.5, textColor: [40, 40, 55],
    },
    alternateRowStyles: { fillColor: [243, 240, 250] },
    headStyles: {
      fillColor: MORADO, textColor: 255, fontSize: 7, halign: 'center', fontStyle: 'bold',
    },
    columnStyles: Object.fromEntries(
      Object.entries(ANCHOS).map(([i, w]) => [i, {
        cellWidth: w,
        halign: i === '0' ? 'center' : 'left',
      }]),
    ),
  });

  const url = URL.createObjectURL(doc.output('blob'));
  const a = document.createElement('a');
  a.href = url;
  a.download = `nominados-${opts.ano}.pdf`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
