-- ============================================================================
-- 016 — Desacoplar Membresía de Videos del pago de la Credencial
-- ============================================================================
-- Cambio de modelo pedido por el usuario:
--   Hasta la 015, el flag registro_kardex_2026.membresia sumaba +15 Bs por
--   persona a la línea 'credencial' de la agrupación en deudas_2026.
--   Ahora la membresía NO se cobra junto a la credencial: se paga aparte por el
--   checkout de WooCommerce al desbloquear los videos (20 Bs si reservó en el
--   kárdex, 50 Bs si la compra después).
--
-- Qué hace esta migración:
--   • Redefine deudas_2026 quitando el término de membresía de la línea
--     'credencial' (vuelve a: credenciales × precio_unitario, sin membresías).
--   • Elimina el CTE membresia_por_agr y la rama de universo que incorporaba
--     agrupaciones sólo por tener membresías.
--   • NO toca la columna registro_kardex_2026.membresia (ahora significa
--     "reservó la promo" → determina el precio del checkout) ni la RPC
--     listar_obras_agrupacion (siguen igual que en la 015).
--
-- Sólo DDL (CREATE OR REPLACE VIEW / FUNCTION). No borra ni modifica datos.
-- Correr en Supabase Studio → SQL Editor.
-- ============================================================================

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

  -- CREDENCIALES (por agrupación). SIN membresías: la Membresía de Videos ya no
  -- se cobra aquí (pasa al checkout de WooCommerce). monto = credenciales × precio.
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
    -- Universo: agrupaciones con inscripciones o con override de credenciales.
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
NOTIFY pgrst, 'reload schema';
