import { api } from './client';
import { apiUrl } from './url';

export interface KardexEliminarRes {
  ok: true;
  deleted: number;
  id_kardex: string;
  id_agrupacion: string;
  nombre: string | null;
}

export interface AgrupacionCerrarRes {
  ok: true;
  estado_credenciales: 'completo';
  id_agrupacion: string;
  already?: boolean;
}

export interface KardexVerificarRes {
  ok: true;
  id_kardex: string;
  verificado: boolean;
  ci?: string;
  rows_updated?: number;
  ids_actualizados?: string[];
}

export type KardexEditablePatch = Partial<{
  nombre_y_apellido: string | null;
  telefono: string | null;
  correo_electronico: string | null;
  ci: string | null;
  ciudad: string | null;
  edad: number | string | null;
  cargo: string | null;
}>;

export interface KardexEditarRes {
  ok: true;
  id_kardex: string;
  patch: KardexEditablePatch;
}

export interface KardexFotoRes {
  ok: true;
  id_kardex: string;
  foto: string;
}

export const kardexApi = {
  eliminar: (id_kardex: string) =>
    api.post<KardexEliminarRes>('/kardex-eliminar.php', { id_kardex }),

  cerrarAgrupacion: (id_agrupacion: string) =>
    api.post<AgrupacionCerrarRes>('/agrupacion-cerrar.php', { id_agrupacion }),

  verificar: (id_kardex: string, verificado: boolean) =>
    api.post<KardexVerificarRes>('/kardex-verificar.php', { id_kardex, verificado }),

  editar: (id_kardex: string, patch: KardexEditablePatch) =>
    api.post<KardexEditarRes>('/kardex-editar.php', { id_kardex, patch }),

  subirFoto: async (id_kardex: string, file: File): Promise<KardexFotoRes> => {
    const form = new FormData();
    form.append('id_kardex', id_kardex);
    form.append('foto', file);
    const res = await fetch(apiUrl('kardex-foto.php'), {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    return body as KardexFotoRes;
  },
};
