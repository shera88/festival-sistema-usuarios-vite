import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
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
 * Sanitiza nombre de archivo para filesystem Android/iOS/web.
 * Quita caracteres ilegales y colapsa espacios.
 */
export function sanitizeFilename(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\/\\<>:"|?*\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim();
}

export function extFromUrl(url: string, fallback = ''): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').pop() || '';
    const dot = seg.lastIndexOf('.');
    if (dot < 0) return fallback;
    const ext = seg.slice(dot + 1).toLowerCase();
    return ext && ext.length <= 5 ? '.' + ext : fallback;
  } catch {
    return fallback;
  }
}

export interface DescargaResult {
  /** URI local (Capacitor) o objectURL (web). Disponible para reabrir desde toast/botón. */
  uri: string | null;
  filename: string;
  mime: string | null;
}

/**
 * Descarga archivo. Capacitor: Filesystem.writeFile -> Directory.External (sin permisos).
 * Web: blob + <a download>. Retorna URI para reabrir más tarde (Share / blob).
 *
 * @param url URL pública del archivo
 * @param filename Nombre con que se guarda en disco
 * @param label Etiqueta corta para el toast (ej: "Recibo", "Comprobante")
 */
export async function descargarArchivo(
  url: string,
  filename?: string,
  label: string = 'Archivo',
): Promise<DescargaResult> {
  const finalName = filename || getFilenameFromUrl(url);

  if (Capacitor.isNativePlatform()) {
    const tid = toast.loading(`Descargando ${label.toLowerCase()}…`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const data = await blobToBase64(blob);
      const write = await Filesystem.writeFile({
        path: finalName,
        data,
        directory: Directory.External,
        recursive: true,
      });
      toast.success(`${label} descargado`, { id: tid, duration: 2500 });
      return { uri: write.uri, filename: finalName, mime: blob.type || null };
    } catch (e) {
      toast.error(`No se pudo descargar ${label.toLowerCase()}`, {
        id: tid,
        description: (e as Error).message,
      });
      throw e;
    }
  }

  // Web
  const tid = toast.loading(`Descargando ${label.toLowerCase()}…`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`${label} descargado`, { id: tid, duration: 2500 });
    return { uri: objectUrl, filename: finalName, mime: blob.type || null };
  } catch (e) {
    toast.error(`No se pudo descargar ${label.toLowerCase()}`, {
      id: tid,
      description: (e as Error).message,
    });
    throw e;
  }
}

/**
 * Abre archivo localmente. Capacitor -> Share sheet (visor PDF/imagen).
 * Web -> nueva pestaña con objectURL.
 */
export async function abrirArchivoLocal(uri: string, filename: string, mime?: string | null): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await Share.share({
        url: uri,
        title: filename,
        dialogTitle: 'Abrir con',
        ...(mime ? { text: mime } : {}),
      });
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.toLowerCase().includes('cancel')) return;
      toast.error('No se pudo abrir el archivo', { description: msg });
    }
    return;
  }
  window.open(uri, '_blank', 'noopener,noreferrer');
}
