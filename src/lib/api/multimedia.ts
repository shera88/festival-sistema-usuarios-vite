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
   * Upload con progreso. onProgress recibe estado:
   *  - { phase: 'uploading', pct: 0-100 } durante envío de bytes
   *  - { phase: 'processing' } cuando bytes completos, esperando respuesta server
   */
  subir: async (
    id_inscripcion: string,
    tipo: 'audio' | 'video_led',
    file: File,
    onProgress?: (status: { phase: 'uploading' | 'processing'; pct: number }) => void,
  ): Promise<MultimediaSubirRes> => {
    const base = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('id_inscripcion', id_inscripcion);
      form.append('tipo', tipo);
      form.append('file', file);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({ phase: 'uploading', pct: Math.round((e.loaded / e.total) * 100) });
        }
      };
      xhr.upload.onload = () => {
        // Bytes terminados de enviar. Server ahora procesa (storage + INSERT).
        if (onProgress) onProgress({ phase: 'processing', pct: 100 });
      };
      xhr.onload = () => {
        const raw = xhr.responseText || '';
        let body: Partial<MultimediaSubirRes> & { error?: string; ok?: boolean };
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          // Response no es JSON (HTML error page de PHP, etc.)
          reject(new Error(`Respuesta inválida (HTTP ${xhr.status}): ${raw.slice(0, 200)}`));
          return;
        }
        if (xhr.status >= 200 && xhr.status < 300 && body && body.ok === true) {
          resolve(body as MultimediaSubirRes);
        } else {
          reject(new Error(body?.error || `HTTP ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Error de red durante la subida'));
      xhr.open('POST', `${base}/multimedia-subir.php`);
      xhr.withCredentials = true;
      xhr.send(form);
    });
  },

  eliminar: (id_multimedia: string) =>
    api.post<{ ok: true; id_multimedia: string }>('/multimedia-eliminar.php', { id_multimedia }),

  confirmar: (id_inscripcion: string, year = 2026) =>
    api.post<MultimediaConfirmarRes>('/inscripcion-confirmar-multimedia.php', { id_inscripcion, year }),
};
