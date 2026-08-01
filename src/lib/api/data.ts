import { api } from './client';
import type { Bootstrap, Inscripcion, KardexRow, Nota, Year, YearNotas, VideosResponse } from '@/types/domain';

export const dataApi = {
  bootstrap: () => api.get<Bootstrap>('/bootstrap.php'),

  inscripciones: (year: Year) =>
    api.get<Record<string, Inscripcion[]>>(`/inscripciones.php?year=${year}`),

  kardex: (year: Year) =>
    api.get<Record<string, KardexRow[]>>(`/kardex-listar.php?year=${year}`),

  calificaciones: (year: YearNotas) =>
    api.get<Record<string, Nota[]>>(`/calificaciones.php?year=${year}`),

  videos: () =>
    api.get<VideosResponse>('/videos.php'),

  /** Inicia el checkout de una membresía (videos | paquete) → URL de pago de WooCommerce. */
  membresiaCheckout: (tipo: 'videos' | 'paquete' = 'videos') =>
    api.post<{ pay_url: string; order_id: number; precio: number; tipo: string }>('/membresia-checkout.php', { tipo }),

  pagos: (year: Year) =>
    api.get<Record<string, unknown[]>>(`/pagos.php?year=${year}`),
};
