import { api } from './client';
import { apiUrl } from './url';
import type { PagosResumen, PagoCrearReq, PagoCrearRes, PagosHistorialRes } from '@/types/domain';

export const pagosApi = {
  resumen: (id_agrupacion?: string) =>
    api.get<PagosResumen>(
      `/pagos-resumen.php${id_agrupacion ? `?id_agrupacion=${encodeURIComponent(id_agrupacion)}` : ''}`,
    ),

  /** Historial multi-año (read-only). Pasa ano=2025 para histórico, omitir para todos. */
  historial: (ano?: number) =>
    api.get<PagosHistorialRes>(
      `/pagos-historial.php${ano ? `?ano=${ano}` : ''}`,
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

  /** URL inline PDF (abrir en pestaña nueva). */
  reciboUrl: (id_pago: string, download = false): string => {
    const base = apiUrl('recibo-ver.php');
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}id_pago=${encodeURIComponent(id_pago)}${download ? '&download=1' : ''}`;
  },

  /** Fuerza descarga del recibo (Blob). */
  descargarRecibo: async (id_pago: string): Promise<Blob> => {
    const res = await fetch(pagosApi.reciboUrl(id_pago, true), {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      let msg = `HTTP ${res.status}`;
      try { msg = (JSON.parse(txt).error as string) || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.blob();
  },

  /** Regenera el PDF (en caso de cambios). */
  regenerarRecibo: async (id_pago: string): Promise<{ url: string; numero: string; bytes: number }> => {
    const res = await fetch(apiUrl('recibo-generar.php'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_pago }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  },
};
