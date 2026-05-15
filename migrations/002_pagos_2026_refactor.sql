-- ============================================================================
-- MIGRACIÓN PAGOS 2026 — v2 (final)
-- Backups CSV en: backups/2026-05-15-pagos/
-- Ejecutar en Supabase Studio SQL Editor
-- ============================================================================
--
-- Decisiones aplicadas:
-- 1. Tabla física compromisos_credenciales_2026 (cantidad editable)
-- 2. Pre-venta cubre inscripción (inscripciones de agrupaciones con convenio NO entran como deuda)
-- 3. Pagos parciales: múltiples filas en pagos_2026 por (concepto, id_referencia)
-- 4. Precios consultados desde convocatoria_secciones (auto)
-- 5. NO se borran pagos_credenciales_2026 ni _unitarios_2026 (quedan como histórico)
-- 6. Métodos: EFECTIVO + TRANSFERENCIA_QR
-- 7. Operador_id NULL hasta webhook banco
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) Compromisos de credenciales (tabla nueva)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.compromisos_credenciales_2026 (
  id_compromiso       text PRIMARY KEY,
  id_agrupacion       text NOT NULL,
  cantidad            integer NOT NULL CHECK (cantidad > 0),
  precio_unitario     numeric(10,2) NOT NULL DEFAULT 15 CHECK (precio_unitario > 0),
  monto_total         numeric(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  origen              text NOT NULL DEFAULT 'auto_inscripciones'
                        CHECK (origen IN ('auto_inscripciones','manual')),
  observacion         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compromisos_cred_agr
  ON compromisos_credenciales_2026(id_agrupacion);

COMMENT ON TABLE compromisos_credenciales_2026 IS
  'Compromisos de pago de credenciales por agrupación. Cantidad default = SUM bailarines de inscripciones, ajustable manualmente si hay overlap.';

-- ============================================================================
-- 2) Función precio_subdivision (consulta convocatoria_secciones)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.precio_subdivision(p_sub text, p_ano integer DEFAULT 2026)
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT regexp_replace((item->>'arancel'), '[^0-9.]', '', 'g')::numeric
    FROM convocatoria_secciones,
         jsonb_array_elements(payload->'subdivisiones') AS item
    WHERE slug = 'categorias'
      AND ano = p_ano
      AND (item->>'nombre') ILIKE p_sub
    LIMIT 1
  ), 0);
$$;

GRANT EXECUTE ON FUNCTION precio_subdivision(text, integer) TO anon, authenticated, service_role;

-- ============================================================================
-- 3) Refactor pagos_2026
-- ============================================================================
ALTER TABLE public.pagos_2026
  ADD COLUMN IF NOT EXISTS id_agrupacion       text,
  ADD COLUMN IF NOT EXISTS id_referencia       text,
  ADD COLUMN IF NOT EXISTS operador_id         uuid REFERENCES festival_contactos_global(id_contacto);

-- Backfill id_referencia desde FKs polimórficas existentes
UPDATE pagos_2026
SET id_referencia = COALESCE(id_inscripcion, id_convenio, id_recepcion, id_pago_credencial)
WHERE id_referencia IS NULL;

-- Backfill id_agrupacion según concepto
UPDATE pagos_2026 p
SET id_agrupacion = ri.id_agrupacion
FROM registro_de_inscripcion_2026 ri
WHERE p.concepto = 'inscripcion'
  AND p.id_inscripcion = ri.id_inscripcion
  AND p.id_agrupacion IS NULL;

UPDATE pagos_2026 p
SET id_agrupacion = rc.id_agrupacion
FROM recepcion_convenio_2026 rc
WHERE p.concepto = 'convenio_entradas'
  AND p.id_convenio = rc.id_convenio
  AND p.id_agrupacion IS NULL;

-- Para concepto='convenio_entradas' con datos test que no matchean: skip o asignar default
-- (las 5 filas actuales son test data)

-- Agregar columna id_metodo_pago FK a metodos_de_pago_2026 (source of truth)
ALTER TABLE pagos_2026
  ADD COLUMN IF NOT EXISTS id_metodo_pago text REFERENCES metodos_de_pago_2026(id_metodo);

-- Backfill id_metodo_pago desde string metodo_pago (match case-insensitive)
UPDATE pagos_2026 p
SET id_metodo_pago = m.id_metodo
FROM metodos_de_pago_2026 m
WHERE p.id_metodo_pago IS NULL
  AND UPPER(TRIM(p.metodo_pago)) = UPPER(TRIM(m.metodo));

-- Constraints (skip si ya existen)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_2026_concepto_check') THEN
    ALTER TABLE pagos_2026 ADD CONSTRAINT pagos_2026_concepto_check
      CHECK (concepto IN ('inscripcion','convenio_entradas','credencial','credencial_unit'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_2026_estado_check') THEN
    ALTER TABLE pagos_2026 ADD CONSTRAINT pagos_2026_estado_check
      CHECK (estado IN ('pendiente','enviado','verificado','rechazado','anulado'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pagos_2026_monto_positivo') THEN
    ALTER TABLE pagos_2026 ADD CONSTRAINT pagos_2026_monto_positivo CHECK (monto > 0);
  END IF;

  -- numero_recibo unique solo si no NULL
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pagos_2026_numero_recibo_unique') THEN
    CREATE UNIQUE INDEX pagos_2026_numero_recibo_unique
      ON pagos_2026(numero_recibo) WHERE numero_recibo IS NOT NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_pagos_2026_agr_concepto
  ON pagos_2026(id_agrupacion, concepto);
CREATE INDEX IF NOT EXISTS idx_pagos_2026_ref
  ON pagos_2026(concepto, id_referencia);

-- ============================================================================
-- 4) Vista deudas_2026 — saldo calculado en tiempo real
-- ============================================================================
CREATE OR REPLACE VIEW public.deudas_2026 AS
WITH agr_con_convenio AS (
  SELECT DISTINCT id_agrupacion FROM recepcion_convenio_2026
),
compromisos AS (
  -- INSCRIPCIONES (excluye agrupaciones con convenio pre-venta firmado)
  SELECT
    ri.id_agrupacion,
    'inscripcion'::text AS concepto,
    ri.id_inscripcion AS id_referencia,
    ri.nombre_de_la_obra AS descripcion,
    ri.subdivision,
    ri.cantidad AS bailarines,
    (precio_subdivision(ri.subdivision) * COALESCE(ri.cantidad,0))::numeric AS monto_total
  FROM registro_de_inscripcion_2026 ri
  WHERE ri.id_agrupacion IS NOT NULL
    AND ri.id_agrupacion NOT IN (SELECT id_agrupacion FROM agr_con_convenio)

  UNION ALL

  -- CONVENIO PRE-VENTA
  SELECT
    rc.id_agrupacion,
    'convenio_entradas',
    rc.id_convenio,
    rc.cantidad_entradas || ' entradas pre-venta',
    NULL, NULL,
    rc.monto_total
  FROM recepcion_convenio_2026 rc

  UNION ALL

  -- CREDENCIALES
  SELECT
    cc.id_agrupacion,
    'credencial',
    cc.id_compromiso,
    cc.cantidad || ' credenciales',
    NULL,
    cc.cantidad,
    cc.monto_total
  FROM compromisos_credenciales_2026 cc
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
    c.monto_total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado IN ('enviado','verificado')), 0),
    0
  )::numeric AS saldo
FROM compromisos c
LEFT JOIN pagos_2026 p
  ON p.concepto = c.concepto AND p.id_referencia = c.id_referencia
GROUP BY c.id_agrupacion, c.concepto, c.id_referencia, c.descripcion,
         c.subdivision, c.bailarines, c.monto_total;

-- ============================================================================
-- 5) RPC pagos_resumen_agrupacion — endpoint principal del tab Pagos
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pagos_resumen_agrupacion(p_id_agrupacion text)
RETURNS TABLE (
  concepto         text,
  id_referencia    text,
  descripcion      text,
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
  SELECT concepto, id_referencia, descripcion, subdivision, bailarines,
         monto_total, pagado_verificado, pagado_pendiente, saldo
  FROM deudas_2026
  WHERE id_agrupacion = p_id_agrupacion
  ORDER BY
    CASE concepto
      WHEN 'inscripcion' THEN 1
      WHEN 'convenio_entradas' THEN 2
      WHEN 'credencial' THEN 3
      ELSE 9
    END,
    descripcion;
$$;

GRANT EXECUTE ON FUNCTION pagos_resumen_agrupacion(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 6) RPC pagos_historial_agrupacion — para sección "Historial pagos"
-- ============================================================================
CREATE OR REPLACE FUNCTION public.pagos_historial_agrupacion(p_id_agrupacion text)
RETURNS TABLE (
  id_pago             text,
  numero_recibo       text,
  concepto            text,
  id_referencia       text,
  fecha               date,
  hora                time,
  id_metodo_pago      text,
  metodo_pago         text,
  monto               numeric,
  estado              text,
  nombre_pagador      text,
  comprobante_url     text,
  recibo_pdf_url      text,
  observacion         text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id_pago, p.numero_recibo, p.concepto, p.id_referencia, p.fecha, p.hora,
         p.id_metodo_pago,
         COALESCE(m.metodo, p.metodo_pago) AS metodo_pago,
         p.monto, p.estado, p.nombre_pagador,
         p.comprobante_url, p.recibo_pdf_url, p.observacion
  FROM pagos_2026 p
  LEFT JOIN metodos_de_pago_2026 m ON m.id_metodo = p.id_metodo_pago
  WHERE p.id_agrupacion = p_id_agrupacion
  ORDER BY p.fecha DESC NULLS LAST, p.hora DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION pagos_historial_agrupacion(text) TO anon, authenticated, service_role;

-- ============================================================================
-- 7) Seed compromisos_credenciales_2026 desde inscripciones existentes (sugerencia)
-- ============================================================================
INSERT INTO compromisos_credenciales_2026 (id_compromiso, id_agrupacion, cantidad, origen)
SELECT
  'cred-' || id_agrupacion AS id_compromiso,
  id_agrupacion,
  COALESCE(SUM(cantidad), 0)::integer AS cantidad,
  'auto_inscripciones'
FROM registro_de_inscripcion_2026
WHERE id_agrupacion IS NOT NULL
GROUP BY id_agrupacion
HAVING COALESCE(SUM(cantidad), 0) > 0
ON CONFLICT (id_compromiso) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICAR:
-- ============================================================================
-- SELECT precio_subdivision('Solo');                          -- 400
-- SELECT precio_subdivision('Grupo Grande');                  -- 80
-- SELECT * FROM compromisos_credenciales_2026 LIMIT 5;
-- SELECT * FROM deudas_2026 LIMIT 10;
-- SELECT * FROM pagos_resumen_agrupacion('e9b8cbeb');         -- Danzarte
-- SELECT * FROM pagos_historial_agrupacion('e9b8cbeb');
