/**
 * Descarga un archivo remoto de verdad, con progreso.
 *
 * POR QUÉ NO BASTA <a download>: el atributo `download` sólo funciona en archivos
 * del mismo origen. Los videos viven en Cloudflare R2 (otro dominio), así que el
 * navegador ignoraba el atributo y abría el video en una pestaña en vez de
 * guardarlo. R2 sí manda `Access-Control-Allow-Origin: *`, así que podemos
 * traerlo con fetch y entregarlo como blob — eso el navegador sí lo guarda.
 *
 * `onProgreso` recibe 0..1, o null mientras no se sepa el tamaño total.
 */
export async function descargarArchivo(
  url: string,
  nombreArchivo: string,
  onProgreso?: (avance: number | null) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`No se pudo descargar (HTTP ${res.status})`);

  const total = Number(res.headers.get('content-length') || 0);
  let recibido = 0;
  const partes: BlobPart[] = [];

  // Sin body legible (navegador viejo): se cae al blob directo, sin progreso.
  if (!res.body) {
    guardar(await res.blob(), nombreArchivo);
    return;
  }

  const lector = res.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    if (value) {
      partes.push(value);
      recibido += value.length;
      onProgreso?.(total ? recibido / total : null);
    }
  }

  guardar(new Blob(partes, { type: res.headers.get('content-type') || 'video/mp4' }), nombreArchivo);
}

function guardar(blob: Blob, nombreArchivo: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberar la memoria del blob: un video son cientos de MB.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

/** Nombre de archivo seguro: sin acentos ni caracteres que Windows rechaza. */
export function nombreSeguro(...partes: (string | null | undefined)[]): string {
  return partes
    .filter(Boolean)
    .join(' - ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
