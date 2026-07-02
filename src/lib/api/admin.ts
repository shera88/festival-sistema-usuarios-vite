import { api } from './client';
import type {
  AdminResumenRes,
  AdminPagosRecientesRes,
  AdminAgrupacionesRes,
  AdminAgrupacionDetalleRes,
  PagoEstado,
  PagoConcepto,
} from '@/types/domain';

/**
 * API del dashboard ADMIN de pagos. Solo accesible para admins (gateado por
 * requireAdmin() en el backend → es_admin_pagos). Reusa `api` (cookies + base
 * URL + ApiError). El link al recibo PDF reusa pagosApi.reciboUrl().
 */
export const adminApi = {
  resumen: () => api.get<AdminResumenRes>('/admin-pagos-resumen.php'),

  recientes: (opts?: { limit?: number; estado?: PagoEstado; concepto?: PagoConcepto }) => {
    const qs = new URLSearchParams();
    if (opts?.limit) qs.set('limit', String(opts.limit));
    if (opts?.estado) qs.set('estado', opts.estado);
    if (opts?.concepto) qs.set('concepto', opts.concepto);
    const q = qs.toString();
    return api.get<AdminPagosRecientesRes>(`/admin-pagos-recientes.php${q ? `?${q}` : ''}`);
  },

  porAgrupacion: () => api.get<AdminAgrupacionesRes>('/admin-pagos-por-agrupacion.php'),

  agrupacionDetalle: (id_agrupacion: string) =>
    api.get<AdminAgrupacionDetalleRes>(
      `/admin-pagos-agrupacion.php?id_agrupacion=${encodeURIComponent(id_agrupacion)}`,
    ),

  eliminarPago: (id_pago: string) =>
    api.post<{ ok: boolean; id_pago: string; eliminadas: number }>(
      '/admin-pago-eliminar.php',
      { id_pago },
    ),
};
