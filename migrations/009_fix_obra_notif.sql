-- 009_fix_obra_notif.sql
-- FIX: pago_detalle_para_notificacion no resolvía nombre_obra.
--   1) El join usaba el vocab viejo (p.concepto = 'inscripcion'); con el canónico
--      'por_participante' NUNCA matcheaba → obra "—" incluso en pagos por participante.
--   2) Los pagos 'pre_venta' / 'credencial' apuntan a convenio/agrupación (id_referencia
--      = id_convenio / id_compromiso), no a una inscripción → no había obra que mostrar.
--
-- Nueva resolución de obra (sin depender del concepto):
--   - por_participante  → obra específica de la inscripción (id_referencia = id_inscripcion).
--   - pre_venta / credencial / otros → fallback a la(s) obra(s) de la agrupación
--     (string_agg distinct), porque toda inscripción de la agrupación tiene obra.
--
-- Idempotente (CREATE OR REPLACE) — sin pérdida de datos. Correr en Supabase Studio → SQL Editor.

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
    COALESCE(
      -- 1) obra específica de la inscripción (pago por participante)
      NULLIF((
        SELECT ri.nombre_de_la_obra
        FROM public.registro_de_inscripcion_2026 ri
        WHERE ri.id_inscripcion = p.id_referencia
        LIMIT 1
      ), ''),
      -- 2) fallback: obra(s) de la agrupación (pre_venta / credencial no apuntan a una inscripción)
      (
        SELECT string_agg(DISTINCT ri.nombre_de_la_obra, ' · ')
        FROM public.registro_de_inscripcion_2026 ri
        WHERE ri.id_agrupacion = p.id_agrupacion
          AND COALESCE(ri.nombre_de_la_obra, '') <> ''
      ),
      ''
    ) AS nombre_obra,
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
  WHERE p.id_pago = p_id_pago;
$$;

GRANT EXECUTE ON FUNCTION public.pago_detalle_para_notificacion(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Test:
--   SELECT concepto, id_referencia, nombre_agrupacion, nombre_obra
--   FROM pago_detalle_para_notificacion('e0f488fbb650b791');   -- pre_venta DANZARTE → 'THE BLACK PANTER'
