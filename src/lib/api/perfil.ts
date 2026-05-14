import { api } from './client';
import type { User } from '@/types/domain';

export type PerfilPatch = Partial<{
  nombre_y_apellido: string | null;
  telefono: string | null;
  correo_electronico: string | null;
  ciudad: string | null;
}>;

export interface PerfilEditarRes {
  ok: true;
  patch: PerfilPatch;
  user: User;
}

export interface UsuarioFotoRes {
  ok: true;
  imagen_contacto: string;
  user: User;
}

export const perfilApi = {
  editar: (patch: PerfilPatch) =>
    api.post<PerfilEditarRes>('/usuario-perfil-editar.php', { patch }),

  subirFoto: async (file: File): Promise<UsuarioFotoRes> => {
    const base = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
    const form = new FormData();
    form.append('foto', file);
    const res = await fetch(`${base}/usuario-foto.php`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.ok) {
      throw new Error(body?.error || `HTTP ${res.status}`);
    }
    return body as UsuarioFotoRes;
  },
};
