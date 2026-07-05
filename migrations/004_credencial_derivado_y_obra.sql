-- ============================================================================
-- 004 — Credencial derivado de bailarines (aparece para TODAS las agrupaciones)
--        + columna `obra` en los compromisos (para el header del modal de pago)
-- ============================================================================
-- PROBLEMA 1 (credencial no aparecía): la vista tomaba credenciales SOLO de
-- compromisos_credenciales_2026, tabla que casi nunca se pobló (3 filas en toda
-- la BD) → los representantes no veían nada para pagar credenciales.
--
-- REGLA (confirmada por el usuario): la credencial es POR AGRUPACIÓN. Un bailarín
-- que baila en varias obras de la MISMA agrupación paga UNA credencial en esa
-- agrupación; si además baila en otra agrupación, paga la credencial de esa otra.
-- Cantidad inicial = SUM(bailarines) de las inscripciones de la agrupación (valor
-- de arranque, editable). Precio unitario = 15 Bs. La credencial es independiente
-- de pre-venta / por-participante: aparece aunque la agrupación tenga convenio.
--
-- compromisos_credenciales_2026 pasa a ser tabla de OVERRIDE: si existe una fila
-- para la agrupación, su `cantidad`/`precio_unitario` PISAN el valor derivado
-- (lo usa la edición manual). id_referencia = 'cred-<id_agrupacion>' (mismo
-- formato que id_compromiso) → los pagos de credencial ya registrados siguen
-- matcheando.
--
-- PROBLEMA 2 (header del modal de pago): faltaba la obra. Se agrega columna
-- `obra` a la vista: por_participante = nombre_de_la_obra; pre_venta = obra de la
-- inscripción del convenio; credencial = NULL (es a nivel agrupación).
--
-- Correr en Supabase Studio → SQL Editor. Sólo DDL (CREATE OR REPLACE) — no borra
-- ni modifica datos.
-- ============================================================================

CREATE OR REPLACE VIEW public.deudas_2026 AS
WITH agr_con_convenio AS (
  SELECT DISTINCT id_agrupacion FROM recepcion_convenio_2026
),
-- SUM de bailarines por agrupación (base de la cantidad inicial de credenciales)
bailarines_por_agr AS (
  SELECT id_agrupacion, SUM(COALESCE(cantidad, 0))::int AS suma
  FROM registro_de_inscripcion_2026
  WHERE id_agrupacion IS NOT NULL
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

  -- CONVENIO PRE-VENTA. El precio individual del convenio (`monto_total`) YA viene
  -- con el cupón aplicado: 100 entradas con cupón de 5 Bs → monto_total = 3500 (no
  -- 4000). Por eso se usa monto_total tal cual. obra = de la inscripción del convenio.
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

  -- CREDENCIALES — POR AGRUPACIÓN, derivadas de bailarines. Aparece para TODA
  -- agrupación con inscripciones o con override. cantidad/precio = override si
  -- existe, si no el derivado (SUM bailarines) / 15 Bs.
  SELECT
    agr.id_agrupacion,
    'credencial',
    'cred-' || agr.id_agrupacion AS id_referencia,
    COALESCE(cc.cantidad, agr.suma) || ' credenciales' AS descripcion,
    NULL::text AS obra,
    NULL,
    COALESCE(cc.cantidad, agr.suma) AS bailarines,
    (COALESCE(cc.cantidad, agr.suma) * COALESCE(cc.precio_unitario, 15))::numeric AS monto_total
  FROM (
    -- Universo de agrupaciones: las que tienen inscripciones (suma>0) UNION las
    -- que ya tienen un override (por si el override no tuviera inscripciones).
    SELECT b.id_agrupacion, b.suma
    FROM bailarines_por_agr b
    WHERE b.suma > 0
    UNION
    SELECT cc0.id_agrupacion, COALESCE(b2.suma, cc0.cantidad) AS suma
    FROM compromisos_credenciales_2026 cc0
    LEFT JOIN bailarines_por_agr b2 ON b2.id_agrupacion = cc0.id_agrupacion
  ) agr
  LEFT JOIN compromisos_credenciales_2026 cc ON cc.id_agrupacion = agr.id_agrupacion
)
-- OJO orden de columnas: `obra` va AL FINAL. CREATE OR REPLACE VIEW no permite
-- insertar/renombrar columnas existentes (error 42P16) — solo agregar al final.
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

-- RPC con la columna `obra` agregada.
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
