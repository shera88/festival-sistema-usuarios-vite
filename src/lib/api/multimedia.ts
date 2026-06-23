import { api } from './client';
import type { MultimediaListaRes } from '@/types/domain';

export interface MultimediaSubirRes {
  ok: true;
  id_multimedia: string;
  tipo: 'audio' | 'video_led';
  url_publica: string;
  storage_path: string;
  peso_bytes: number;
  extension: string;
}

export interface MultimediaConfirmarRes {
  ok: true;
  id_inscripcion: string;
  year: number;
  confirmado: boolean;
}

export const multimediaApi = {
  listar: (id_inscripcion: string) =>
    api.get<MultimediaListaRes>(`/multimedia-listar.php?id_inscripcion=${encodeURIComponent(id_inscripcion)}`),

  /**
   * Upload con progreso. Flujo en 3 pasos (R2 directo, no pasa por PHP):
   *   1) POST /multimedia-presign.php  → URL PUT firmada de R2
   *   2) PUT del archivo DIRECTO a R2 (con progreso real)
   *   3) POST /multimedia-registrar.php → guarda metadatos en BD
   *
   * onProgress recibe:
   *  - { phase: 'uploading', pct: 0-100 } durante el PUT a R2
   *  - { phase: 'processing' } cuando terminan los bytes, registrando en BD
   */
  subir: async (
    id_inscripcion: string,
    tipo: 'audio' | 'video_led',
    file: File,
    onProgress?: (status: { phase: 'uploading' | 'processing'; pct: number }) => void,
  ): Promise<MultimediaSubirRes> => {
    const mime = file.type || 'application/octet-stream';

    // 1) Pedir URL firmada (request chico, va por el backend con sesión).
    const pres = await api.post<{
      ok: true; url: string; key: string; storage_path: string;
      url_publica: string; mime: string; ext: string;
    }>('/multimedia-presign.php', { id_inscripcion, tipo, mime, size: file.size });

    // 2) PUT del archivo DIRECTO a R2 (sin cookies, CORS habilitado en el bucket).
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ phase: 'uploading', pct: Math.round((e.loaded / e.total) * 100) });
        }
      };
      xhr.upload.onload = () => {
        if (onProgress) onProgress({ phase: 'processing', pct: 100 });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`R2 PUT HTTP ${xhr.status}: ${(xhr.responseText || '').slice(0, 200)}`));
      };
      xhr.onerror = () => reject(new Error('Error de red subiendo a R2'));
      xhr.open('PUT', pres.url);
      xhr.setRequestHeader('Content-Type', pres.mime || mime);
      // NO withCredentials: R2 es cross-origin y no usa cookies.
      xhr.send(file);
    });

    // 3) Registrar metadatos en BD.
    return api.post<MultimediaSubirRes>('/multimedia-registrar.php', {
      id_inscripcion,
      tipo,
      key: pres.key,
      url_publica: pres.url_publica,
      nombre: file.name,
      mime: pres.mime || mime,
      peso_bytes: file.size,
      extension: pres.ext,
    });
  },

  eliminar: (id_multimedia: string) =>
    api.post<{ ok: true; id_multimedia: string }>('/multimedia-eliminar.php', { id_multimedia }),

  confirmar: (id_inscripcion: string, year = 2026) =>
    api.post<MultimediaConfirmarRes>('/inscripcion-confirmar-multimedia.php', { id_inscripcion, year }),
};
