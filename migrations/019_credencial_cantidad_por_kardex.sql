-- ============================================================================
-- 019 — Cantidad de credenciales = bailarines ÚNICOS por agrupación (kardex)
-- ============================================================================
-- Cambio pedido por el usuario:
--   La "cantidad inicial para pagar" credenciales de una agrupación debe ser la
--   cantidad de BAILARINES ÚNICOS de esa agrupación, con la regla:
--     • Un bailarín que baila en 2 OBRAS DISTINTAS de la MISMA agrupación
--       cuenta como 1 sola credencial (dedup dentro de la agrupación).
--     • El mismo bailarín en la agrupación de un colegio Y en la de una
--       universidad cuenta como 2 (NO se deduplica entre agrupaciones).
--
-- Por qué kardex: registro_kardex_2026 = UNA fila por persona POR agrupación
--   (sus varias obras van en el campo `bailes`). Entonces
--   COUNT(DISTINCT ci) GROUP BY id_agrupacion da EXACTAMENTE esa regla:
--     - 2 obras misma agrupación  → 1 fila kardex → cuenta 1.  (dedup)
--     - colegio + universidad     → 2 filas (distinto id_agrupacion) → cuenta 2.
--   Verificado contra datos reales 2026 (2.738 kardex, 2.455 CI únicos).
--
-- Antes (015/016): bailarines = SUM(cantidad) de las inscripciones (obras) →
--   duplicaba a quien baila en varias obras de la misma agrupación.
--
-- Prioridad del valor mostrado (COALESCE):
--   1) cc.cantidad  → override manual guardado (compromisos_credenciales_2026).
--   2) bk.suma      → conteo por kardex (bailarines únicos por agrupación).
--   3) 0            → si la agrupación TODAVÍA no tiene participantes en el
--                    kardex, la credencial arranca en 0 (pedido del usuario).
--                    Sigue siendo editable en el modal de pago.
--
-- Sólo DDL (CREATE OR REPLACE VIEW). No borra ni modifica datos. La cantidad
-- sigue siendo editable por el usuario en el modal (es un default).
-- Correr en Supabase Studio → SQL Editor.
-- ============================================================================

CREATE OR REPLACE VIEW public.deudas_2026 AS
WITH agr_con_convenio AS (
  SELECT DISTINCT id_agrupacion FROM recepcion_convenio_2026
),
bailarines_por_agr AS (
  -- FALLBACK: bailarines declarados en las inscripciones (suma por obra).
  SELECT id_agrupacion, SUM(COALESCE(cantidad, 0))::int AS suma
  FROM registro_de_inscripcion_2026
  WHERE id_agrupacion IS NOT NULL
  GROUP BY id_agrupacion
),
bailarines_kardex AS (
  -- NUEVO: bailarines ÚNICOS por agrupación desde el kardex (1 fila = 1 persona
  -- por agrupación). COUNT(DISTINCT ci) dedup dentro de la agrupación y separa
  -- entre agrupaciones. ci es bigint → se descartan NULL y 0 (placeholder).
  SELECT id_agrupacion, COUNT(DISTINCT ci)::int AS suma
  FROM registro_kardex_2026
  WHERE id_agrupacion IS NOT NULL
    AND ci IS NOT NULL
    AND ci <> 0
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

  -- CREDENCIALES (por agrupación). Cantidad = bailarines únicos por kardex
  -- (con override y fallback). monto = credenciales × precio_unitario.
  SELECT
    agr.id_agrupacion,
    'credencial',
    'cred-' || agr.id_agrupacion AS id_referencia,
    COALESCE(cc.cantidad, bk.suma, 0) || ' credenciales' AS descripcion,
    NULL::text AS obra,
    NULL,
    COALESCE(cc.cantidad, bk.suma, 0) AS bailarines,
    (COALESCE(cc.cantidad, bk.suma, 0) * COALESCE(cc.precio_unitario, 15))::numeric AS monto_total
  FROM (
    -- Universo: agrupaciones con inscripciones o con override de credenciales.
    -- (Toda agrupación con kardex tiene inscripciones, así que quedan cubiertas.)
    SELECT b.id_agrupacion, b.suma
    FROM bailarines_por_agr b
    WHERE b.suma > 0
    UNION
    SELECT cc0.id_agrupacion, COALESCE(b2.suma, cc0.cantidad) AS suma
    FROM compromisos_credenciales_2026 cc0
    LEFT JOIN bailarines_por_agr b2 ON b2.id_agrupacion = cc0.id_agrupacion
  ) agr
  LEFT JOIN compromisos_credenciales_2026 cc ON cc.id_agrupacion = agr.id_agrupacion
  LEFT JOIN bailarines_kardex bk            ON bk.id_agrupacion = agr.id_agrupacion
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

-- Recargar el cache de PostgREST para que la RPC relea la vista.
NOTIFY pgrst, 'reload schema';
