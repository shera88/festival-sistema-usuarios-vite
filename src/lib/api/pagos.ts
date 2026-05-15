import { api } from './client';
import { apiUrl } from './url';
import type { PagosResumen, PagoCrearReq, PagoCrearRes } from '@/types/domain';

export const pagosApi = {
  resumen: (id_agrupacion?: string) =>
    api.get<PagosResumen>(
      `/pagos-resumen.php${id_agrupacion ? `?id_agrupacion=${encodeURIComponent(id_agrupacion)}` : ''}`,
    ),

  crear: async (req: PagoCrearReq): Promise<PagoCrearRes> => {
    const fd = new FormData();
    fd.append('concepto', req.concepto);
    fd.append('id_referencia', req.id_referencia);
    fd.append('monto', String(req.monto));
    fd.append('id_metodo_pago', req.id_metodo_pago);
    if (req.observacion) fd.append('observacion', req.observacion);
    if (req.comprobante) fd.append('comprobante', req.comprobante);

    const res = await fetch(apiUrl('pago-crear.php'), {
      method: 'POST',
      credentials: 'include',
      body: fd,
    });
    const body = (await res.json().catch(() => ({}))) as PagoCrearRes & { error?: string };
    if (!res.ok || !body.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return body;
  },
};
