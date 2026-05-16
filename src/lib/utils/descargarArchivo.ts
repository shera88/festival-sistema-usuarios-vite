import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';

function getFilenameFromUrl(url: string, fallback = 'archivo.bin'): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? decodeURIComponent(last) : fallback;
  } catch {
    return fallback;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => {
      const result = String(r.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = () => reject(new Error('No se pudo leer el archivo'));
    r.readAsDataURL(blob);
  });
}

/**
 * Descarga URL como archivo binario.
 * - Capacitor (Android/iOS): Filesystem.writeFile a Directory.Documents (app-scoped) + toast.
 * - Web: blob + <a download> click.
 *
 * Filename: si se omite, se infiere del último segmento de la URL.
 */
export async function descargarArchivo(url: string, suggestedName?: string): Promise<void> {
  const filename = suggestedName || getFilenameFromUrl(url);

  if (Capacitor.isNativePlatform()) {
    const tid = toast.loading(`Descargando ${filename}…`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const data = await blobToBase64(blob);
      const result = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Documents,
        recursive: true,
      });
      toast.success(`Descargado: ${filename}`, {
        id: tid,
        description: 'Guardado en Documentos',
      });
      return void result;
    } catch (e) {
      toast.error('No se pudo descargar', {
        id: tid,
        description: (e as Error).message,
      });
      throw e;
    }
  }

  // Web: blob download
  const tid = toast.loading(`Descargando ${filename}…`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    toast.success(`Descargado: ${filename}`, { id: tid });
  } catch (e) {
    toast.error('No se pudo descargar', {
      id: tid,
      description: (e as Error).message,
    });
    throw e;
  }
}
