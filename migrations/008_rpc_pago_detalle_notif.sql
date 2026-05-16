-- 008_rpc_pago_detalle_notif.sql
-- RPC para obtener detalles enriquecidos de un pago para enviarlo por WhatsApp.
-- Devuelve agrupación, obra, pagador, concepto, método, número y URL del recibo.
-- Idempotente (CREATE OR REPLACE) — sin pérdida de datos.

CREATE OR REPLACE FUNCTION public.pago_detalle_para_notificacion(p_id_pago text)
RETURNS TABLE (
  id_pago             text,
  monto               numeric,
  concepto            text,
  id_referencia       text,
  nombre_pagador      text,
  telefono_pagador    text,
  metodo_pago         text,
  id_agrupacion       text,
  nombre_agrupacion   text,
  nombre_obra         text,
  numero_recibo       text,
  recibo_pdf_url      text,
  estado              text,
  fecha               date,
  hora                time,
  verificado_en       timestamptz,
  verificado_por      text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    p.id_pago,
    p.monto,
    p.concepto,
    p.id_referencia,
    p.nombre_pagador,
    p.telefono_pagador,
    COALESCE(m.metodo, p.metodo_pago) AS metodo_pago,
    p.id_agrupacion,
    COALESCE(i.nombre_agrupacion, '') AS nombre_agrupacion,
    COALESCE(r.nombre_de_la_obra, '') AS nombre_obra,
    p.numero_recibo,
    p.recibo_pdf_url,
    p.estado,
    p.fecha,
    p.hora,
    p.verificado_en,
    p.verificado_por
  FROM public.pagos_2026 p
  LEFT JOIN public.metodos_de_pago_2026 m ON m.id_metodo = p.id_metodo_pago
  LEFT JOIN public.instituciones i ON i.id_agrupacion = p.id_agrupacion
  LEFT JOIN public.registro_de_inscripcion_2026 r
    ON r.id_inscripcion = p.id_referencia AND p.concepto = 'inscripcion'
  WHERE p.id_pago = p_id_pago;
$$;

GRANT EXECUTE ON FUNCTION public.pago_detalle_para_notificacion(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Test:
--   SELECT * FROM pago_detalle_para_notificacion('411131752d8ad2c4');
