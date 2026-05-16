-- 006_historial_match_por_nombre.sql
-- Fix: pagos 2025 PRE VENTA tienen id_inscripcion=NULL, deben matchear por nombre.
-- Solución: incluir nombre normalizado en la vista + permitir filtro adicional en RPC.

-- ============================================================
-- 1) Vista 2025 con nombre normalizado para matching
-- ============================================================

CREATE OR REPLACE VIEW public.pagos_2025_normalized AS
SELECT
  2025                          AS ano,
  p.id_pagos                    AS id_pago,
  p.id_pagos                    AS numero_recibo,
  CASE
    WHEN p.fecha ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(p.fecha, 'DD/MM/YYYY')
    ELSE NULL
  END                           AS fecha,
  p.hora::text                  AS hora,
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
  COALESCE(p.nombre_de_la_obra, '') AS nombre_obra,
  COALESCE(r.id_agrupacion, '')              AS id_agrupacion,
  COALESCE(r.agrupacion, p.encargado, '')    AS agrupacion,
  r.subdivision                              AS subdivision,
  NULLIF(r.cantidad::text, '')::integer      AS bailarines,
  NULL::text                    AS comprobante_url,
  NULL::text                    AS recibo_pdf_url,
  -- Nombres normalizados para matching robusto
  upper(unaccent(trim(coalesce(p.nombre_y_apellido, '')))) AS nombre_pagador_norm,
  upper(unaccent(trim(coalesce(p.encargado, ''))))         AS encargado_norm
FROM public.pagos_2025 p
LEFT JOIN public.registro_de_inscripcion_2025 r
  ON r.id_inscripcion = p.id_inscripcion;

-- ============================================================
-- 2) Vista 2026 con columnas nombre_norm/encargado_norm vacíos (compat UNION)
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
  p.recibo_pdf_url              AS recibo_pdf_url,
  upper(unaccent(trim(coalesce(p.nombre_pagador, '')))) AS nombre_pagador_norm,
  ''::text AS encargado_norm
FROM public.pagos_2026 p
LEFT JOIN public.registro_de_inscripcion_2026 r
  ON r.id_inscripcion = p.id_referencia AND p.concepto = 'inscripcion'
LEFT JOIN public.instituciones i
  ON i.id_agrupacion = p.id_agrupacion;

-- ============================================================
-- 3) Vista unificada
-- ============================================================

CREATE OR REPLACE VIEW public.pagos_historial_all AS
SELECT * FROM public.pagos_2025_normalized
UNION ALL
SELECT * FROM public.pagos_2026_normalized;

-- ============================================================
-- 4) RPC ampliada: acepta agrupaciones + nombres
--    Match si: id_agrupacion en lista  OR  nombre_pagador_norm en lista
-- ============================================================

DROP FUNCTION IF EXISTS public.historial_pagos_persona(text[], integer);
CREATE OR REPLACE FUNCTION public.historial_pagos_persona(
  p_id_agrupaciones text[] DEFAULT ARRAY[]::text[],
  p_nombres         text[] DEFAULT ARRAY[]::text[],
  p_ano             integer DEFAULT NULL
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
  WITH nombres_norm AS (
    SELECT upper(unaccent(trim(n))) AS n
    FROM unnest(coalesce(p_nombres, ARRAY[]::text[])) AS n
    WHERE n IS NOT NULL AND trim(n) <> ''
  )
  SELECT
    ano, id_pago, numero_recibo, fecha, hora, concepto, id_referencia,
    metodo_pago, id_metodo_pago, monto, estado, nombre_pagador, telefono_pagador,
    nombre_obra, id_agrupacion, agrupacion, subdivision, bailarines,
    comprobante_url, recibo_pdf_url
  FROM public.pagos_historial_all p
  WHERE (
      (id_agrupacion IS NOT NULL AND id_agrupacion <> '' AND id_agrupacion = ANY(p_id_agrupaciones))
      OR
      (nombre_pagador_norm IN (SELECT n FROM nombres_norm))
      OR
      (encargado_norm IN (SELECT n FROM nombres_norm))
    )
    AND (p_ano IS NULL OR ano = p_ano)
  ORDER BY fecha DESC NULLS LAST, hora DESC NULLS LAST;
$$;

DROP FUNCTION IF EXISTS public.anos_con_pagos_persona(text[]);
CREATE OR REPLACE FUNCTION public.anos_con_pagos_persona(
  p_id_agrupaciones text[] DEFAULT ARRAY[]::text[],
  p_nombres         text[] DEFAULT ARRAY[]::text[]
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
  WITH nombres_norm AS (
    SELECT upper(unaccent(trim(n))) AS n
    FROM unnest(coalesce(p_nombres, ARRAY[]::text[])) AS n
    WHERE n IS NOT NULL AND trim(n) <> ''
  )
  SELECT
    ano,
    COUNT(*)::bigint                AS total_pagos,
    COALESCE(SUM(monto), 0)::numeric AS total_monto
  FROM public.pagos_historial_all p
  WHERE (
      (id_agrupacion IS NOT NULL AND id_agrupacion <> '' AND id_agrupacion = ANY(p_id_agrupaciones))
      OR
      (nombre_pagador_norm IN (SELECT n FROM nombres_norm))
      OR
      (encargado_norm IN (SELECT n FROM nombres_norm))
    )
  GROUP BY ano
  ORDER BY ano DESC;
$$;

-- ============================================================
-- Permisos
-- ============================================================

GRANT SELECT ON public.pagos_2025_normalized   TO anon, authenticated, service_role;
GRANT SELECT ON public.pagos_2026_normalized   TO anon, authenticated, service_role;
GRANT SELECT ON public.pagos_historial_all     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.historial_pagos_persona(text[], text[], integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anos_con_pagos_persona(text[], text[])           TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- Test:
-- SELECT * FROM anos_con_pagos_persona(ARRAY['4d4caa1b'], ARRAY['PEDRO FLORES BANEGAS']);
-- SELECT * FROM historial_pagos_persona(ARRAY['4d4caa1b'], ARRAY['PEDRO FLORES BANEGAS'], 2025);
