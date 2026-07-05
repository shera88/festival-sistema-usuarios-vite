-- ============================================================================
-- 015 — Kárdex: Membresía de Videos + bailes seleccionados
-- ============================================================================
-- Cambios pedidos por el usuario:
--   1. Casilla "Añadir Membresía de Videos" (+15 Bs al credencial) → columna
--      `membresia` boolean en registro_kardex_2026.
--   2. Selector de "en qué bailes del grupo baila" → columna `bailes` jsonb
--      (lista de {id_inscripcion, nombre_de_la_obra}).
--   3. El +15 de la membresía se SUMA al total de Credenciales de la agrupación
--      (decisión del usuario): credencial = (bailarines × 15) + (Nº personas con
--      membresía de esa agrupación × 15), en una sola línea de Pagos.
--
-- Sólo DDL (ALTER ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE). NO borra ni
-- modifica datos existentes. Correr en Supabase Studio → SQL Editor.
-- ============================================================================

-- 1) Columnas nuevas -----------------------------------------------------------
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia boolean NOT NULL DEFAULT false;
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS bailes jsonb;

-- 2) RPC: obras (inscripciones 2026) de una agrupación -------------------------
--    Alimenta el multiselect "en qué bailes baila". anon puede llamarlo
--    (SECURITY DEFINER), igual que las otras RPC públicas del festival.
CREATE OR REPLACE FUNCTION public.listar_obras_agrupacion(p_id_agrupacion text)
RETURNS TABLE (id_inscripcion text, nombre_de_la_obra text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id_inscripcion, nombre_de_la_obra
  FROM registro_de_inscripcion_2026
  WHERE id_agrupacion = p_id_agrupacion
    AND nombre_de_la_obra IS NOT NULL
  ORDER BY nombre_de_la_obra;
$$;
GRANT EXECUTE ON FUNCTION public.listar_obras_agrupacion(text) TO anon, authenticated, service_role;

-- 3) deudas_2026 — credencial += membresías × 15 -------------------------------
--    Idéntica a la 004 salvo: CTE membresia_por_agr + el monto/descripcion del
--    bloque CREDENCIALES. Orden de columnas final SIN cambios (obra al final).
CREATE OR REPLACE VIEW public.deudas_2026 AS
WITH agr_con_convenio AS (
  SELECT DISTINCT id_agrupacion FROM recepcion_convenio_2026
),
bailarines_por_agr AS (
  SELECT id_agrupacion, SUM(COALESCE(cantidad, 0))::int AS suma
  FROM registro_de_inscripcion_2026
  WHERE id_agrupacion IS NOT NULL
  GROUP BY id_agrupacion
),
-- Nº de personas con Membresía de Videos por agrupación (kárdex).
membresia_por_agr AS (
  SELECT id_agrupacion, COUNT(*)::int AS cnt
  FROM registro_kardex_2026
  WHERE id_agrupacion IS NOT NULL AND membresia = true
  GROUP BY id_agrupacion
),
compromisos AS (
  -- INSCRIPCIONES (pago por participante) — excluye agrupaciones con convenio
  SELECT
    ri.id_agrupacion,
    'por_participante'::text AS concepto,
    ri.id_inscripcion AS id_referencia,
    ri.nombre_de_la_obra AS descripcion,
    ri.nombre_de_la_obra AS obra,
    ri.subdivision,
    ri.cantidad AS bailarines,
    (precio_subdivision(ri.subdivision) * COALESCE(ri.cantidad, 0))::numeric AS monto_total
  FROM registro_de_inscripcion_2026 ri
  WHERE ri.id_agrupacion IS NOT NULL
    AND ri.id_agrupacion NOT IN (SELECT id_agrupacion FROM agr_con_convenio)

  UNION ALL

  -- CONVENIO PRE-VENTA (monto_total ya viene con cupón aplicado).
  SELECT
    rc.id_agrupacion,
    'pre_venta',
    rc.id_convenio,
    rc.cantidad_entradas || ' entradas pre-venta',
    ins.nombre_de_la_obra AS obra,
    NULL,
    NULL,
    rc.monto_total
  FROM recepcion_convenio_2026 rc
  LEFT JOIN registro_de_inscripcion_2026 ins
    ON ins.id_inscripcion = rc.id_inscripcion

  UNION ALL

  -- CREDENCIALES (por agrupación) + MEMBRESÍAS DE VIDEOS.
  -- monto = (credenciales × precio) + (membresías × 15). descripcion nota las
  -- membresías si hay. La cantidad `bailarines` sigue siendo la de credenciales
  -- (la membresía es un add-on, no una credencial extra).
  SELECT
    agr.id_agrupacion,
    'credencial',
    'cred-' || agr.id_agrupacion AS id_referencia,
    COALESCE(cc.cantidad, agr.suma) || ' credenciales'
      || CASE WHEN COALESCE(mem.cnt, 0) > 0
              THEN ' + ' || mem.cnt || ' membresía' || CASE WHEN mem.cnt > 1 THEN 's' ELSE '' END || ' de videos'
              ELSE '' END AS descripcion,
    NULL::text AS obra,
    NULL,
    COALESCE(cc.cantidad, agr.suma) AS bailarines,
    (
      (COALESCE(cc.cantidad, agr.suma) * COALESCE(cc.precio_unitario, 15))
      + (COALESCE(mem.cnt, 0) * 15)
    )::numeric AS monto_total
  FROM (
    -- Universo: agrupaciones con inscripciones, con override, o con membresías.
    SELECT b.id_agrupacion, b.suma
    FROM bailarines_por_agr b
    WHERE b.suma > 0
    UNION
    SELECT cc0.id_agrupacion, COALESCE(b2.suma, cc0.cantidad) AS suma
    FROM compromisos_credenciales_2026 cc0
    LEFT JOIN bailarines_por_agr b2 ON b2.id_agrupacion = cc0.id_agrupacion
    UNION
    SELECT m0.id_agrupacion, COALESCE(b3.suma, 0) AS suma
    FROM membresia_por_agr m0
    LEFT JOIN bailarines_por_agr b3 ON b3.id_agrupacion = m0.id_agrupacion
  ) agr
  LEFT JOIN compromisos_credenciales_2026 cc ON cc.id_agrupacion = agr.id_agrupacion
  LEFT JOIN membresia_por_agr mem ON mem.id_agrupacion = agr.id_agrupacion
)
SELECT
  c.id_agrupacion,
  c.concepto,
  c.id_referencia,
  c.descripcion,
  c.subdivision,
  c.bailarines,
  c.monto_total,
  COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'verificado'), 0)::numeric AS pagado_verificado,
  COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'enviado'), 0)::numeric AS pagado_pendiente,
  GREATEST(
    c.monto_total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'verificado'), 0),
    0
  )::numeric AS saldo,
  c.obra
FROM compromisos c
LEFT JOIN pagos_2026 p
  ON p.concepto = c.concepto
  AND (
    p.id_referencia = c.id_referencia
    OR (c.concepto = 'pre_venta'        AND p.id_convenio    = c.id_referencia)
    OR (c.concepto = 'por_participante' AND p.id_inscripcion = c.id_referencia)
  )
GROUP BY c.id_agrupacion, c.concepto, c.id_referencia, c.descripcion, c.obra,
         c.subdivision, c.bailarines, c.monto_total;

-- RPC sin cambios de firma (relee la vista modificada).
DROP FUNCTION IF EXISTS public.pagos_resumen_agrupacion(text);
CREATE OR REPLACE FUNCTION public.pagos_resumen_agrupacion(p_id_agrupacion text)
RETURNS TABLE (
  concepto         text,
  id_referencia    text,
  descripcion      text,
  obra             text,
  subdivision      text,
  bailarines       integer,
  monto_total      numeric,
  pagado_verificado numeric,
  pagado_pendiente numeric,
  saldo            numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT concepto, id_referencia, descripcion, obra, subdivision, bailarines,
         monto_total, pagado_verificado, pagado_pendiente, saldo
  FROM deudas_2026
  WHERE id_agrupacion = p_id_agrupacion
  ORDER BY
    CASE concepto
      WHEN 'por_participante' THEN 1
      WHEN 'pre_venta'        THEN 2
      WHEN 'credencial'       THEN 3
      ELSE 9
    END,
    descripcion;
$$;
GRANT EXECUTE ON FUNCTION pagos_resumen_agrupacion(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
