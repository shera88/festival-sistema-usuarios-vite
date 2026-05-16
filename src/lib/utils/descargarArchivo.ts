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

/**
 * Descarga archivo. En Capacitor: Filesystem.writeFile -> Directory.External
 * (app-scoped, sin permisos). Toast con botón "Abrir" que dispara Share sheet.
 * En web: blob + <a download>.
 *
 * Filename: si se omite, se infiere de la URL.
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
      const write = await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.External,
        recursive: true,
      });
      toast.success(`Descargado: ${filename}`, {
        id: tid,
        description: 'Toque "Abrir" para visualizar',
        action: {
          label: 'Abrir',
          onClick: () => {
            void abrirArchivo(write.uri, filename, blob.type);
          },
        },
        duration: 8000,
      });
      return;
    } catch (e) {
      toast.error('No se pudo descargar', {
        id: tid,
        description: (e as Error).message,
      });
      throw e;
    }
  }

  // Web
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

async function abrirArchivo(fileUri: string, filename: string, mimeType?: string): Promise<void> {
  try {
    await Share.share({
      url: fileUri,
      title: filename,
      dialogTitle: 'Abrir con',
      ...(mimeType ? { text: mimeType } : {}),
    });
  } catch (e) {
    const msg = (e as Error).message || '';
    // Usuario canceló el share sheet — no es error
    if (msg.toLowerCase().includes('cancel')) return;
    toast.error('No se pudo abrir el archivo', { description: msg });
  }
}
