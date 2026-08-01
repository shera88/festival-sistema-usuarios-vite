/**
 * Límite de duración del audio por subdivisión y medición del audio real.
 *
 * El tiempo máximo de cada baile lo fija la convocatoria según el tamaño del
 * grupo. Se toma de la SUBDIVISIÓN y no del campo `duracion` de la inscripción:
 * ese campo lo declara el participante, es editable y hoy no es fiable — en 2026
 * hay obras de grupo grande con "5:00", de grupo pequeño con "6:30" y 77 sin
 * ningún valor. La subdivisión, en cambio, es la que determina en qué categoría
 * compite.
 */

/** Segundos permitidos por subdivisión (convocatoria 2026). */
export const LIMITE_SUBDIVISION_SEG: Record<string, number> = {
  SOLO: 150, // 2:30
  DUO: 210, // 3:30
  'DÚO': 210,
  'GRUPO PEQUEÑO': 300, // 5:00
  'GRUPO CHICO': 300,
  'GRUPO GRANDE': 390, // 6:30
};

/** Nombre legible de la subdivisión para los mensajes. */
export const NOMBRE_SUBDIVISION: Record<string, string> = {
  SOLO: 'solo',
  DUO: 'dúo',
  'DÚO': 'dúo',
  'GRUPO PEQUEÑO': 'grupo pequeño',
  'GRUPO CHICO': 'grupo pequeño',
  'GRUPO GRANDE': 'grupo grande',
};

const normalizar = (s: string | null | undefined) => String(s ?? '').toUpperCase().trim();

/** Segundos permitidos para esa subdivisión, o null si no se reconoce. */
export function limiteSegDe(subdivision: string | null | undefined): number | null {
  return LIMITE_SUBDIVISION_SEG[normalizar(subdivision)] ?? null;
}

export function nombreSubdivision(subdivision: string | null | undefined): string {
  return NOMBRE_SUBDIVISION[normalizar(subdivision)] ?? 'su categoría';
}

/** Segundos → "M:SS". Trunca, igual que el reproductor, para que ambos coincidan. */
export function mmss(segundos: number): string {
  if (!isFinite(segundos) || segundos < 0) return '0:00';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface ExcesoAudio {
  /** Duración medida del archivo, en segundos. */
  duracionSeg: number;
  /** Máximo permitido para la subdivisión, en segundos. */
  limiteSeg: number;
  /** Cuánto se pasa, en segundos (siempre > 0). */
  excesoSeg: number;
  duracionTexto: string;
  limiteTexto: string;
  excesoTexto: string;
  subdivisionTexto: string;
}

/**
 * ¿El audio se pasa del límite? Devuelve null cuando no hay nada que avisar:
 * sin duración medida, sin subdivisión reconocida, o dentro del tiempo.
 *
 * Se comparan segundos ENTEROS (se truncan las fracciones) por dos motivos: es
 * lo que muestra el reproductor —así el aviso concuerda con lo que la persona
 * ve— y evita marcar por milésimas un audio de 5:00,4 que en la práctica dura
 * cinco minutos.
 */
export function evaluarExcesoAudio(
  duracionSeg: number | null | undefined,
  subdivision: string | null | undefined,
): ExcesoAudio | null {
  if (duracionSeg == null || !isFinite(duracionSeg) || duracionSeg <= 0) return null;
  const limiteSeg = limiteSegDe(subdivision);
  if (limiteSeg == null) return null;

  const medida = Math.floor(duracionSeg);
  if (medida <= limiteSeg) return null;

  const excesoSeg = medida - limiteSeg;
  return {
    duracionSeg: medida,
    limiteSeg,
    excesoSeg,
    duracionTexto: mmss(medida),
    limiteTexto: mmss(limiteSeg),
    excesoTexto: excesoSeg >= 60 ? mmss(excesoSeg) : `${excesoSeg} s`,
    subdivisionTexto: nombreSubdivision(subdivision),
  };
}

/**
 * Duración real del archivo, leída de los metadatos con un <audio> suelto.
 * `preload="metadata"` hace que el navegador baje solo la cabecera, no el mp3
 * entero. Nunca lanza: si el archivo no carga devuelve null y no se avisa nada.
 */
export function medirDuracionAudio(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    let audio: HTMLAudioElement | null = new Audio();
    let terminado = false;

    const terminar = (valor: number | null) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(temporizador);
      if (audio) {
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.src = '';
        audio = null;
      }
      resolve(valor);
    };

    // Red lenta o archivo inalcanzable: se abandona en silencio.
    const temporizador = setTimeout(() => terminar(null), 20_000);

    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const d = audio?.duration ?? NaN;
      terminar(isFinite(d) && d > 0 ? d : null);
    };
    audio.onerror = () => terminar(null);
    audio.src = url;
  });
}
