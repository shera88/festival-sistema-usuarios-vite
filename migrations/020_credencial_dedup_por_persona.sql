-- ============================================================================
-- 020 — Credenciales: 1 por PERSONA por AGRUPACIÓN (dedup por CI)
-- ============================================================================
-- Sustituye a la 019 y revierte la 018 (que contaba filas crudas sin dedup).
--
-- REGLA (definida por el usuario):
--   • Un bailarín que baila en 2 OBRAS DISTINTAS de la MISMA agrupación
--     paga 1 sola credencial.            → dedup DENTRO de la agrupación
--   • El mismo bailarín en un colegio Y en una universidad paga 2.
--                                        → NO se deduplica ENTRE agrupaciones
--   • Cuentan TODAS las personas del kárdex, sin filtrar por `cargo`:
--     bailarines, coreógrafos, director, staff, encargado, jurado.
--   • SIN PISO de inscripción: se cobra la cantidad REAL de credenciales
--     cargadas hoy. Si la agrupación todavía no registró kárdex, su línea
--     aparece igual pero en 0 — "aún sin credenciales para pagar" — y va
--     subiendo sola a medida que carga gente.
--
-- POR QUÉ NO SE USA LA INSCRIPCIÓN COMO PISO:
--   `cantidad` en inscripción es por OBRA. Sumar las obras cuenta 2 veces a
--   quien baila en varias — exactamente lo que el dedup elimina. Usarla como
--   piso reintroduciría los duplicados que esta regla busca sacar.
--
-- POR QUÉ NO SE USA compromisos_credenciales_2026.cantidad:
--   Esa tabla se escribió el 2026-05-15 y nunca se actualizó (la 019 le daba
--   precedencia con COALESCE, lo que congelaba el valor: DANZARTE quedaba en 9).
--   Aquí sólo se respeta su `precio_unitario` como override de precio.
--
-- Medido sobre datos reales al 2026-07-30 (3.614 filas de kárdex):
--   filas crudas ................ 3.614   (la 018 cobraba esto — sin dedup)
--   dedup por CI ................ 3.323   → Bs 49.845   ← LO QUE COBRA ESTA VISTA
--   (292 duplicados eliminados: gente en 2+ obras de la misma agrupación)
--   Variantes descartadas: piso = obra mayor → 4.198 (Bs 62.970);
--                          piso = suma de obras → 5.404 (Bs 81.060, rompe dedup)
--
-- Sólo DDL (CREATE OR REPLACE VIEW). No borra ni modifica datos.
-- Correr en Supabase Studio → SQL Editor.
-- ============================================================================

CREATE OR REPLACE VIEW public.deudas_2026 AS
WITH agr_con_convenio AS (
  SELECT DISTINCT id_agrupacion FROM recepcion_convenio_2026
),
bailarines_por_agr AS (
  -- Suma por obra. Se usa para la línea de INSCRIPCIONES (ahí sí corresponde
  -- sumar: se paga por obra), NO para el piso de credenciales.
  SELECT id_agrupacion, SUM(COALESCE(cantidad, 0))::int AS suma
  FROM registro_de_inscripcion_2026
  WHERE id_agrupacion IS NOT NULL
  GROUP BY id_agrupacion
),
personas_kardex AS (
  -- 1 fila de kárdex = 1 persona por agrupación (sus obras van en `bailes`).
  -- COUNT(DISTINCT ci) deduplica dentro de la agrupación y separa entre
  -- agrupaciones. Las filas sin CI se cuentan aparte para no perderlas.
  SELECT
    id_agrupacion,
    (COUNT(DISTINCT ci) FILTER (WHERE ci IS NOT NULL AND ci <> 0)
     + COUNT(*) FILTER (WHERE ci IS NULL OR ci = 0))::int AS personas
  FROM registro_kardex_2026
  WHERE id_agrupacion IS NOT NULL
  GROUP BY id_agrupacion
),
agr_con_pago_credencial AS (
  SELECT DISTINCT id_agrupacion
  FROM pagos_2026
  WHERE id_agrupacion IS NOT NULL
    AND concepto IN ('credencial', 'credencial_unit', 'credencial_unitaria')
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

  -- CREDENCIALES (por agrupación): 1 por persona registrada en el kárdex.
  -- Sin kárdex → 0, pero la línea aparece igual para que se vea el pendiente.
  SELECT
    agr.id_agrupacion,
    'credencial',
    'cred-' || agr.id_agrupacion AS id_referencia,
    agr.cantidad || ' credenciales' AS descripcion,
    NULL::text AS obra,
    NULL,
    agr.cantidad AS bailarines,
    (agr.cantidad * COALESCE(cc.precio_unitario, 15))::numeric AS monto_total
  FROM (
    SELECT
      u.id_agrupacion,
      COALESCE(pk.personas, 0) AS cantidad
    FROM (
      -- Universo: TODAS las inscritas (para que las que aún no cargaron kárdex
      -- aparezcan con 0 en vez de desaparecer), más las que tengan kárdex o
      -- algún pago previo de credencial.
      SELECT id_agrupacion FROM bailarines_por_agr WHERE suma > 0
      UNION
      SELECT id_agrupacion FROM personas_kardex    WHERE personas > 0
      UNION
      SELECT id_agrupacion FROM agr_con_pago_credencial
    ) u
    LEFT JOIN personas_kardex pk ON pk.id_agrupacion = u.id_agrupacion
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

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- Esperado: 160 agrupaciones · 3.323 credenciales · Bs 49.845
-- (de esas 160, ~20 aparecen con 0 porque todavía no cargaron kárdex)
--
--   SELECT COUNT(*) AS agrupaciones,
--          COUNT(*) FILTER (WHERE bailarines = 0) AS sin_kardex_aun,
--          SUM(bailarines) AS credenciales,
--          SUM(monto_total) AS bs
--   FROM deudas_2026 WHERE concepto = 'credencial';
--
-- Contraste de la regla — debe devolver 0 filas:
--
--   WITH pk AS (
--     SELECT id_agrupacion,
--            (COUNT(DISTINCT ci) FILTER (WHERE ci IS NOT NULL AND ci <> 0)
--             + COUNT(*) FILTER (WHERE ci IS NULL OR ci = 0))::int AS personas
--     FROM registro_kardex_2026 WHERE id_agrupacion IS NOT NULL GROUP BY 1)
--   SELECT d.id_agrupacion, d.bailarines, COALESCE(pk.personas,0) AS esperado
--   FROM deudas_2026 d
--   LEFT JOIN pk ON pk.id_agrupacion = d.id_agrupacion
--   WHERE d.concepto = 'credencial'
--     AND d.bailarines IS DISTINCT FROM COALESCE(pk.personas,0);
--
-- Duplicados que elimina el dedup (esperado ~292):
--
--   WITH pk AS (
--     SELECT id_agrupacion,
--            (COUNT(DISTINCT ci) FILTER (WHERE ci IS NOT NULL AND ci <> 0)
--             + COUNT(*) FILTER (WHERE ci IS NULL OR ci = 0))::int AS personas
--     FROM registro_kardex_2026 WHERE id_agrupacion IS NOT NULL GROUP BY 1)
--   SELECT (SELECT COUNT(*) FROM registro_kardex_2026 WHERE id_agrupacion IS NOT NULL)
--          - (SELECT SUM(personas) FROM pk) AS duplicados_eliminados;
--
-- Quiénes aparecen aún sin credenciales para pagar:
--
--   SELECT d.id_agrupacion, i.nombre_agrupacion, d.bailarines, d.monto_total
--   FROM deudas_2026 d
--   LEFT JOIN instituciones i ON i.id_agrupacion = d.id_agrupacion
--   WHERE d.concepto = 'credencial' AND d.bailarines = 0
--   ORDER BY 2;
-- ============================================================================
