-- 005_historial_multi_year.sql
-- Historial de pagos multi-año, ampliable.
-- Patrón: una vista normalizada por año + RPC unificada.
-- Para agregar 2027/2028/etc:
--   1) Crear vista pagos_YYYY_normalized análoga
--   2) Agregar UNION ALL en pagos_historial_all
--   3) Re-aplicar GRANT y NOTIFY pgrst

-- ============================================================
-- 1) Vista normalizada de pagos_2025 (legacy schema → schema unificado)
-- ============================================================

CREATE OR REPLACE VIEW public.pagos_2025_normalized AS
SELECT
  2025                          AS ano,
  p.id_pagos                    AS id_pago,
  p.id_pagos                    AS numero_recibo,
  -- Fecha: parsear dd/mm/yyyy a DATE. Si falla, NULL.
  CASE
    WHEN p.fecha ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(p.fecha, 'DD/MM/YYYY')
    ELSE NULL
  END                           AS fecha,
  p.hora                        AS hora,
  -- Concepto: PRE VENTA → convenio_entradas, INSCRIPCION → inscripcion, KARDEX → kardex, otros → otro
  CASE upper(coalesce(p.metodo_de_inscripcion, ''))
    WHEN 'PRE VENTA'    THEN 'convenio_entradas'
    WHEN 'PREVENTA'     THEN 'convenio_entradas'
    WHEN 'INSCRIPCION'  THEN 'inscripcion'
    WHEN 'INSCRIPCIÓN'  THEN 'inscripcion'
    WHEN 'KARDEX'       THEN 'kardex'
    ELSE                     'otro'
  END                           AS concepto,
  p.id_inscripcion              AS id_referencia,
  p.metodo_de_pago              AS metodo_pago,
  p.id_metodo_de_pago           AS id_metodo_pago,
  COALESCE(NULLIF(p.monto, '')::numeric, 0) AS monto,
  'verificado'::text            AS estado,
  p.nombre_y_apellido           AS nombre_pagador,
  p.telefono_pago               AS telefono_pagador,
  p.nombre_de_la_obra           AS nombre_obra,
  r.id_agrupacion               AS id_agrupacion,
  r.agrupacion                  AS agrupacion,
  r.subdivision                 AS subdivision,
  NULLIF(r.cantidad::text, '')::integer AS bailarines,
  NULL::text                    AS comprobante_url,
  NULL::text                    AS recibo_pdf_url
FROM public.pagos_2025 p
LEFT JOIN public.registro_de_inscripcion_2025 r
  ON r.id_inscripcion = p.id_inscripcion;

-- ============================================================
-- 2) Vista normalizada de pagos_2026 (re-export de schema actual)
-- ============================================================

CREATE OR REPLACE VIEW public.pagos_2026_normalized AS
SELECT
  2026                          AS ano,
  p.id_pago                     AS id_pago,
  p.numero_recibo               AS numero_recibo,
  p.fecha                       AS fecha,
  p.hora::text                  AS hora,
  p.concepto                    AS concepto,
  p.id_referencia               AS id_referencia,
  p.metodo_pago                 AS metodo_pago,
  p.id_metodo_pago              AS id_metodo_pago,
  COALESCE(p.monto, 0)::numeric AS monto,
  p.estado                      AS estado,
  p.nombre_pagador              AS nombre_pagador,
  p.telefono_pagador::text      AS telefono_pagador,
  COALESCE(r.nombre_de_la_obra, '') AS nombre_obra,
  p.id_agrupacion               AS id_agrupacion,
  COALESCE(r.agrupacion, i.nombre_agrupacion, '') AS agrupacion,
  r.subdivision                 AS subdivision,
  r.cantidad                    AS bailarines,
  p.comprobante_url             AS comprobante_url,
  p.recibo_pdf_url              AS recibo_pdf_url
FROM public.pagos_2026 p
LEFT JOIN public.registro_de_inscripcion_2026 r
  ON r.id_inscripcion = p.id_referencia AND p.concepto = 'inscripcion'
LEFT JOIN public.instituciones i
  ON i.id_agrupacion = p.id_agrupacion;

-- ============================================================
-- 3) Vista unificada (UNION ALL de todos los años)
-- ============================================================

CREATE OR REPLACE VIEW public.pagos_historial_all AS
SELECT * FROM public.pagos_2025_normalized
UNION ALL
SELECT * FROM public.pagos_2026_normalized;

-- ============================================================
-- 4) RPC para frontend (filtra por agrupaciones del usuario + año opcional)
-- ============================================================

CREATE OR REPLACE FUNCTION public.historial_pagos_persona(
  p_id_agrupaciones text[],
  p_ano integer DEFAULT NULL
)
RETURNS TABLE (
  ano integer,
  id_pago text,
  numero_recibo text,
  fecha date,
  hora text,
  concepto text,
  id_referencia text,
  metodo_pago text,
  id_metodo_pago text,
  monto numeric,
  estado text,
  nombre_pagador text,
  telefono_pagador text,
  nombre_obra text,
  id_agrupacion text,
  agrupacion text,
  subdivision text,
  bailarines integer,
  comprobante_url text,
  recibo_pdf_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ano, id_pago, numero_recibo, fecha, hora, concepto, id_referencia,
    metodo_pago, id_metodo_pago, monto, estado, nombre_pagador, telefono_pagador,
    nombre_obra, id_agrupacion, agrupacion, subdivision, bailarines,
    comprobante_url, recibo_pdf_url
  FROM public.pagos_historial_all
  WHERE id_agrupacion = ANY(p_id_agrupaciones)
    AND (p_ano IS NULL OR ano = p_ano)
  ORDER BY fecha DESC NULLS LAST, hora DESC NULLS LAST;
$$;

-- ============================================================
-- 5) RPC para obtener años con pagos del usuario
-- ============================================================

CREATE OR REPLACE FUNCTION public.anos_con_pagos_persona(
  p_id_agrupaciones text[]
)
RETURNS TABLE (
  ano integer,
  total_pagos bigint,
  total_monto numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    ano,
    COUNT(*)::bigint AS total_pagos,
    COALESCE(SUM(monto), 0)::numeric AS total_monto
  FROM public.pagos_historial_all
  WHERE id_agrupacion = ANY(p_id_agrupaciones)
  GROUP BY ano
  ORDER BY ano DESC;
$$;

-- ============================================================
-- 6) Permisos
-- ============================================================

GRANT SELECT ON public.pagos_2025_normalized   TO anon, authenticated, service_role;
GRANT SELECT ON public.pagos_2026_normalized   TO anon, authenticated, service_role;
GRANT SELECT ON public.pagos_historial_all     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.historial_pagos_persona(text[], integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anos_con_pagos_persona(text[])           TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Test manual:
--   SELECT * FROM historial_pagos_persona(ARRAY['e9b8cbeb'], 2025);
--   SELECT * FROM anos_con_pagos_persona(ARRAY['e9b8cbeb']);
-- ============================================================
