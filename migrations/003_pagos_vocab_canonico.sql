-- ============================================================================
-- 003 — Unificar el vocabulario de `concepto` al CANÓNICO
-- ============================================================================
-- La app usuarios usaba vocab viejo (inscripcion / convenio_entradas /
-- credencial_unit), pero la gestión + los pagos ya guardados + la constraint
-- chk_pagos_concepto_fk usan el canónico:
--     por_participante  (FK id_inscripcion)
--     pre_venta         (FK id_convenio)
--     credencial        (FK id_agrupacion)
--     credencial_unitaria (FK id_agrupacion)
--
-- La vista deudas_2026 cruza compromiso↔pago por (concepto, id_referencia).
-- Al emitir el compromiso en vocab canónico, el JOIN vuelve a matchear los
-- pagos pre_venta / por_participante (antes el saldo no bajaba) y el INSERT
-- de pago-crear.php (que ahora escribe canónico) deja de violar la constraint.
--
-- TODO sigue viviendo en pagos_2026 — no hay tablas de pago separadas.
-- Correr en Supabase Studio → SQL Editor.
-- ============================================================================

CREATE OR REPLACE VIEW public.deudas_2026 AS
WITH agr_con_convenio AS (
  SELECT DISTINCT id_agrupacion FROM recepcion_convenio_2026
),
compromisos AS (
  -- INSCRIPCIONES (pago por participante) — excluye agrupaciones con convenio
  SELECT
    ri.id_agrupacion,
    'por_participante'::text AS concepto,
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
    'pre_venta',
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
  -- SALDO solo descuenta pagos VERIFICADOS por un admin. Los 'enviado' (en
  -- revisión) quedan retenidos: se muestran aparte (pagado_pendiente) pero NO
  -- reducen el saldo hasta que un admin los aprueba.
  GREATEST(
    c.monto_total - COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'verificado'), 0),
    0
  )::numeric AS saldo
FROM compromisos c
LEFT JOIN pagos_2026 p
  ON p.concepto = c.concepto
  AND (
    -- pagos de la app usuarios setean id_referencia; los de gestión setean el FK
    -- específico (id_convenio / id_inscripcion). Matchear por cualquiera de los dos.
    p.id_referencia = c.id_referencia
    OR (c.concepto = 'pre_venta'        AND p.id_convenio    = c.id_referencia)
    OR (c.concepto = 'por_participante' AND p.id_inscripcion = c.id_referencia)
  )
GROUP BY c.id_agrupacion, c.concepto, c.id_referencia, c.descripcion,
         c.subdivision, c.bailarines, c.monto_total;

-- Orden del resumen con el vocab canónico
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
      WHEN 'por_participante' THEN 1
      WHEN 'pre_venta'        THEN 2
      WHEN 'credencial'       THEN 3
      ELSE 9
    END,
    descripcion;
$$;

GRANT EXECUTE ON FUNCTION pagos_resumen_agrupacion(text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
