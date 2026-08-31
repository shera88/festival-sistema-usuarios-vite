import type { VideoItem } from '@/types/domain';

/**
 * Publicación de los videos de las NOCHES FINALES (sábado y domingo).
 *
 * Una obra que llegó a la final tiene DOS videos y son presentaciones distintas:
 * el de la noche clasificatoria en que bailó (`url_video`, martes a viernes) y el
 * de la final (`url_video_final`, sábado o domingo). En la base viven en columnas
 * separadas, con su propio día y su propio orden.
 *
 * Este módulo existe para que la decisión de publicarlos esté en UN solo lugar:
 * lo usan el portal de participantes y el área de clientes. Antes la lógica vivía
 * dentro de VideosTab, así que el área de clientes se habría quedado sin las
 * finales sin que nadie lo notara hasta que alguien pagara y no las viera.
 *
 * Para ocultarlas de nuevo: poner MOSTRAR_NOCHES_FINALES en false. No hay que
 * tocar nada más, ni el backend —que siempre manda las tres columnas— ni las
 * vistas.
 */
export const MOSTRAR_NOCHES_FINALES = true;

export const DIAS_CLASIFICATORIOS = ['MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'] as const;
export const DIAS_FINALES = ['SABADO', 'DOMINGO'] as const;

export const DIAS_VISIBLES: readonly string[] = MOSTRAR_NOCHES_FINALES
  ? [...DIAS_CLASIFICATORIOS, ...DIAS_FINALES]
  : DIAS_CLASIFICATORIOS;

/**
 * Agrega los videos de la final como entradas propias, además de los que ya
 * están. No reemplaza al de la clasificatoria: una obra finalista aparece dos
 * veces, cada una en su noche, porque son dos presentaciones distintas.
 *
 * El id lleva el sufijo `-final` porque es la clave de React de cada tarjeta:
 * repetir el id_inscripcion haría que las dos entradas se pisaran en la lista.
 */
export function conFinales(items: VideoItem[]): VideoItem[] {
  // Aunque las finales estén ocultas hay que descartar las filas sin video: el
  // servidor manda la obra si tiene CUALQUIERA de los dos, así que puede llegar
  // una cuyo único video sea el de la final.
  const reproducibles = (lista: VideoItem[]) =>
    lista.filter((v) => (v.url_video ?? '').trim() !== '');

  if (!MOSTRAR_NOCHES_FINALES) return reproducibles(items);

  const finales = items
    .filter((v) => (v.url_video_final ?? '').trim() !== '' && (v.dia_final ?? '').trim() !== '')
    .map((v) => ({
      ...v,
      id_inscripcion: `${v.id_inscripcion}-final`,
      url_video: v.url_video_final as string,
      dia: v.dia_final as string,
      orden: v.orden_final ?? v.orden,
    }));

  return [...reproducibles(items), ...finales];
}
