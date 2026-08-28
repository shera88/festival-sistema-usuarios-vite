/* ═══════════════════════════════════════════════════════════════════════════
   CERTIFICADO DE PARTICIPACIÓN — XVIII Festival Danzarte 2026

   Se dibuja en un canvas y se mete en un PDF de una sola hoja. Todo pasa en el
   navegador: no hay endpoint, no se guarda nada en Storage y no depende de que
   n8n esté levantado. La persona toca el botón y baja su PDF.

   La hoja mide 290 × 210 mm, que es el tamaño nativo del arte que pasó la
   organización (3425 × 2480 px a 300 dpi). No se fuerza a A4: estirar el arte
   7 mm deformaría el logo y las franjas.

   El arte original venía como UNA imagen de 4,4 MB con el centro transparente.
   Acá va partido en las dos franjas (`banda-superior` / `banda-inferior`), que
   es lo único que se dibuja — el centro es papel blanco. Eso bajó los assets de
   4,6 MB a 1,9 MB.
   ═══════════════════════════════════════════════════════════════════════════ */

const MM_PX = 300 / 25.4;          // 1 mm a 300 dpi
const PT_PX = 300 / 72;            // 1 pt a 300 dpi
const ANCHO_MM = 290;
const ALTO_MM = 210;
const ANCHO = Math.round(ANCHO_MM * MM_PX);   // 3425
const ALTO = Math.round(ALTO_MM * MM_PX);     // 2480

const BANDA_SUP_MM = 49.3;
const BANDA_INF_MM = 31.6;

const TINTA = '#565656';
const TINTA_FUERTE = '#4A4A4A';
const TINTA_TITULO = '#3F3F3F';
const TINTA_NOMBRE = '#2E2E2E';

const mm = (v: number) => v * MM_PX;
const pt = (v: number) => v * PT_PX;

const ASSETS = {
  bandaSup: 'certificado/banda-superior.png',
  bandaInf: 'certificado/banda-inferior.png',
  bordeArr: 'certificado/borde-arriba.png',
  bordeAba: 'certificado/borde-abajo.png',
  titulo: 'certificado/titulo.png',
  firma: 'certificado/firma.png',
  logo: 'certificado/logo.png',
} as const;

export type DatosCertificado = {
  nombre: string;
  agrupacion: string;
  /** Para el QR. Si falta, el certificado sale sin QR. */
  idKardex?: string | null;
};

function cargarImagen(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
}

/**
 * Montserrat es la tipografía del arte, pero el portal carga Inter. En vez de
 * sumarle una fuente a TODAS las visitas, se pide sólo acá — la primera vez que
 * alguien baja su certificado. Si la red falla, se dibuja igual con la fuente
 * de reserva en vez de romper la descarga.
 */
async function asegurarMontserrat(): Promise<void> {
  const ID = 'fuente-certificado-montserrat';
  if (!document.getElementById(ID)) {
    const link = document.createElement('link');
    link.id = ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
  }
  try {
    await Promise.all([
      document.fonts.load('400 40px Montserrat'),
      document.fonts.load('600 40px Montserrat'),
      document.fonts.load('700 40px Montserrat'),
    ]);
    await document.fonts.ready;
  } catch {
    /* sin Montserrat se usa la de reserva; no vale abortar la descarga por esto */
  }
}

const fuente = (tamPx: number, peso = 400) =>
  `${peso} ${tamPx}px Montserrat, Inter, "Segoe UI", Arial, sans-serif`;

type Ctx = CanvasRenderingContext2D;

/** Texto centrado en `cx`, con `y` como línea base. */
function centrado(ctx: Ctx, txt: string, y: number, tamPx: number, peso: number,
                  color: string, espaciado = 0) {
  ctx.font = fuente(tamPx, peso);
  ctx.fillStyle = color;
  ctx.letterSpacing = `${espaciado}px`;
  ctx.textAlign = 'center';
  ctx.fillText(txt, ANCHO / 2, y);
  ctx.letterSpacing = '0px';
}

type Trozo = { txt: string; fuerte: boolean };

/**
 * Párrafo centrado con tramos en negrita, cortado por palabras.
 *
 * Hace falta esto y no un fillText suelto porque el nombre de la agrupación va
 * en negrita EN MEDIO de la frase, y algunas miden 67 caracteres: el corte de
 * línea tiene que caer donde toca sin partir la negrita.
 */
function parrafo(ctx: Ctx, trozos: Trozo[], yInicio: number, tamPx: number,
                 anchoMax: number, interlinea: number): number {
  const palabras: Trozo[] = [];
  for (const t of trozos) {
    const partes = t.txt.split(/(\s+)/).filter((p) => p !== '');
    for (const p of partes) palabras.push({ txt: p, fuerte: t.fuerte });
  }

  const ancho = (p: Trozo) => {
    ctx.font = fuente(tamPx, p.fuerte ? 700 : 400);
    return ctx.measureText(p.txt).width;
  };

  const lineas: Trozo[][] = [];
  let linea: Trozo[] = [];
  let usado = 0;
  for (const p of palabras) {
    const w = ancho(p);
    if (usado + w > anchoMax && linea.length > 0 && p.txt.trim() !== '') {
      // se descarta el espacio que quedó colgando al final de la línea
      while (linea.length && linea[linea.length - 1].txt.trim() === '') linea.pop();
      lineas.push(linea);
      linea = [p];
      usado = w;
    } else {
      linea.push(p);
      usado += w;
    }
  }
  if (linea.length) lineas.push(linea);

  ctx.textAlign = 'left';
  let y = yInicio;
  for (const l of lineas) {
    const total = l.reduce((s, p) => s + ancho(p), 0);
    let x = (ANCHO - total) / 2;
    for (const p of l) {
      ctx.font = fuente(tamPx, p.fuerte ? 700 : 400);
      ctx.fillStyle = p.fuerte ? TINTA_FUERTE : TINTA;
      ctx.fillText(p.txt, x, y);
      x += ancho(p);
    }
    y += interlinea;
  }
  return y - interlinea;   // línea base de la última fila
}

/** Dibuja una imagen centrada, con alto fijo y proporción respetada. */
function imagenCentrada(ctx: Ctx, img: HTMLImageElement, yTop: number, altoPx: number) {
  const esc = altoPx / img.naturalHeight;
  const w = img.naturalWidth * esc;
  ctx.drawImage(img, (ANCHO - w) / 2, yTop, w, altoPx);
}

async function qrDataUrl(idKardex: string): Promise<string | null> {
  try {
    const QR = await import('qrcode');
    const url = `https://festivaldanzarte.com/perfiles_participantes/?id=${encodeURIComponent(idKardex)}`;
    return await QR.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: 'M' });
  } catch {
    return null;   // sin QR el certificado sigue siendo válido
  }
}

export async function generarCertificadoPdf(d: DatosCertificado): Promise<Blob> {
  await asegurarMontserrat();

  const base = import.meta.env.BASE_URL;
  const [bandaSup, bandaInf, bordeArr, bordeAba, titulo, firma, logo] = await Promise.all(
    [ASSETS.bandaSup, ASSETS.bandaInf, ASSETS.bordeArr, ASSETS.bordeAba,
     ASSETS.titulo, ASSETS.firma, ASSETS.logo].map((p) => cargarImagen(base + p)),
  );

  const lienzo = document.createElement('canvas');
  lienzo.width = ANCHO;
  lienzo.height = ALTO;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no permitió abrir el lienzo.');

  // Papel
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, ANCHO, ALTO);
  ctx.textBaseline = 'alphabetic';

  // Franjas
  ctx.drawImage(bandaSup, 0, 0, ANCHO, mm(BANDA_SUP_MM));
  ctx.drawImage(bandaInf, 0, ALTO - mm(BANDA_INF_MM), ANCHO, mm(BANDA_INF_MM));

  // Filetes al ras de cada borde
  ctx.drawImage(bordeArr, 0, 0, ANCHO, mm(3));
  ctx.drawImage(bordeAba, 0, ALTO - mm(4), ANCHO, mm(4));

  // Título dentro de la franja superior
  imagenCentrada(ctx, titulo, mm(BANDA_SUP_MM / 2 - 8.5), mm(17));

  // ── Cuerpo ───────────────────────────────────────────────────────────────
  let y = mm(BANDA_SUP_MM + 12.5);
  centrado(ctx, 'PROYECTO CULTURAL DANZARTE', y, pt(10), 600, TINTA_FUERTE, mm(0.9));
  y += mm(6.5);
  centrado(ctx, 'Otorga el presente', y, pt(10.5), 400, TINTA);
  y += mm(7.5);
  centrado(ctx, 'CERTIFICADO DE PARTICIPACIÓN', y, pt(15), 700, TINTA_TITULO, mm(0.3));

  // Renglón del nombre: «A:» a la izquierda, línea hasta el margen derecho y el
  // nombre apoyado encima, centrado sobre esa línea.
  y += mm(15);
  const margen = mm(30);
  const xA = margen;
  ctx.textAlign = 'left';
  ctx.font = fuente(pt(11), 500);
  ctx.fillStyle = TINTA;
  ctx.fillText('A:', xA, y);
  const anchoA = ctx.measureText('A:').width;
  const xLinea = xA + anchoA + mm(3);
  const anchoLinea = ANCHO - margen - xLinea;

  // El nombre NUNCA se corta: se achica hasta entrar. El más largo del padrón
  // 2026 tiene 39 caracteres y a 17 pt no entra.
  let tamNombre = pt(17);
  ctx.letterSpacing = `${mm(0.2)}px`;
  while (tamNombre > pt(11)) {
    ctx.font = fuente(tamNombre, 600);
    if (ctx.measureText(d.nombre).width <= anchoLinea - mm(6)) break;
    tamNombre -= pt(0.3);
  }
  ctx.font = fuente(tamNombre, 600);
  ctx.fillStyle = TINTA_NOMBRE;
  ctx.textAlign = 'center';
  ctx.fillText(d.nombre, xLinea + anchoLinea / 2, y);
  ctx.letterSpacing = '0px';

  // La línea, justo debajo de la base del texto
  ctx.strokeStyle = '#6E6E6E';
  ctx.lineWidth = Math.max(1, mm(0.35));
  ctx.beginPath();
  ctx.moveTo(xLinea, y + mm(3.2));
  ctx.lineTo(xLinea + anchoLinea, y + mm(3.2));
  ctx.stroke();

  // Párrafo
  y += mm(14);
  parrafo(ctx, [
    { txt: 'En justo reconocimiento a su destacada participación en el ', fuerte: false },
    { txt: 'XVIII FESTIVAL DANZARTE 2026', fuerte: true },
    { txt: ', llevando en alto el nombre de ', fuerte: false },
    { txt: d.agrupacion, fuerte: true },
    { txt: ' y contribuyendo al mismo tiempo con la difusión del arte y la cultura.', fuerte: false },
  ], y, pt(11), ANCHO - mm(46) * 2, mm(9));

  // ── Firma + QR, apoyados sobre la franja inferior ────────────────────────
  const yFirmaTop = ALTO - mm(BANDA_INF_MM) - mm(42);
  imagenCentrada(ctx, firma, yFirmaTop, mm(17));

  if (d.idKardex) {
    const qr = await qrDataUrl(d.idKardex);
    if (qr) {
      const img = await cargarImagen(qr);
      const lado = mm(16);
      ctx.drawImage(img, (ANCHO - lado) / 2, yFirmaTop + mm(21.5), lado, lado);
    }
  }

  // Logo dentro de la franja inferior
  imagenCentrada(ctx, logo, ALTO - mm(BANDA_INF_MM) + mm(4.5), mm(19));

  // ── A PDF ────────────────────────────────────────────────────────────────
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [ANCHO_MM, ALTO_MM] });
  doc.addImage(lienzo.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, ANCHO_MM, ALTO_MM);
  return doc.output('blob');
}

/** Genera y dispara la descarga. Devuelve el nombre del archivo. */
export async function descargarCertificado(d: DatosCertificado): Promise<string> {
  const blob = await generarCertificadoPdf(d);
  const limpio = d.nombre.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const archivo = `Certificado - ${limpio || 'participante'}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return archivo;
}
