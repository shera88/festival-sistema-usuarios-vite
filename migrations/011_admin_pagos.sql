-- ============================================================================
-- MIGRACIÓN 011 — Dashboard ADMIN de pagos (ADITIVA)
-- Ejecutar en Supabase Studio SQL Editor.
-- Reusa la tabla de admins EXISTENTE: agrega columna id_contacto a
-- admin_usuarios (vínculo al login por carnet de esta app) + RPCs de
-- agregación admin. Aditiva (ADD COLUMN, no destruye datos).
-- ⚠ La sección 2 hace un UPDATE para poblar id_contacto de los 3 admins;
--   revisá los carnets antes de correr.
-- (Si tu tabla de admins fuese admin_profiles en vez de admin_usuarios,
--  cambiá el nombre de tabla en las secciones 1-3.)
-- ============================================================================
BEGIN;

-- ----------------------------------------------------------------------------
-- 1) Extender la tabla de admins EXISTENTE (admin_usuarios) con el vínculo al
--    login de esta app. El login de participantes es por id_contacto (RPC
--    validate_login); admin_usuarios sólo tenía id/usuario/clave_hash/nombre/
--    activo, sin forma de mapear al id_contacto del que inicia sesión.
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_usuarios
  ADD COLUMN IF NOT EXISTS id_contacto uuid;

COMMENT ON COLUMN public.admin_usuarios.id_contacto IS
  'Vínculo al festival_contactos_global del admin. Permite gatear el dashboard '
  'de pagos por el login de participante (carnet) de esta app.';

-- FK opcional (ON DELETE SET NULL: no se borra el admin si se va el contacto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'admin_usuarios_id_contacto_fkey') THEN
    ALTER TABLE public.admin_usuarios
      ADD CONSTRAINT admin_usuarios_id_contacto_fkey
      FOREIGN KEY (id_contacto)
      REFERENCES festival_contactos_global(id_contacto) ON DELETE SET NULL;
  END IF;
END$$;

-- Un id_contacto no puede mapear a dos admins
CREATE UNIQUE INDEX IF NOT EXISTS admin_usuarios_id_contacto_key
  ON public.admin_usuarios(id_contacto) WHERE id_contacto IS NOT NULL;

-- 2) Poblar id_contacto de Yacu/Shera/Briza por carnet conocido (STAFF_USERS).
--    ⚠ UPDATE sobre datos existentes: sólo llena los id_contacto que estén
--    NULL (no pisa valores). VERIFICAR que queden los 3 mapeados tras correr.
UPDATE public.admin_usuarios au
SET id_contacto = fcg.id_contacto
FROM festival_contactos_global fcg
WHERE au.id_contacto IS NULL
  AND regexp_replace(COALESCE(fcg.numero_de_carnet,''), '\D', '', 'g') = (
        CASE lower(au.usuario)
          WHEN 'yacu'  THEN '6208436'
          WHEN 'shera' THEN '13711838'  -- SHERA SERRANO (75571497 era su teléfono, no carnet)
          WHEN 'briza' THEN '8214423'   -- BRIZA TERRAZAS
          ELSE NULL
        END);

-- 3) Helper: ¿es admin de pagos?  (lo usa el backend PHP tras requireAuth)
CREATE OR REPLACE FUNCTION public.es_admin_pagos(p_id_contacto uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_usuarios
    WHERE id_contacto = p_id_contacto AND activo
  );
$$;
GRANT EXECUTE ON FUNCTION public.es_admin_pagos(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 4) Recaudado por concepto (inscripción / convenio_entradas / credencial)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_recaudado_resumen()
RETURNS TABLE (
  concepto          text,
  n_pagos           bigint,
  total_verificado  numeric,
  total_pendiente   numeric,
  total_rechazado   numeric
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.concepto,
         COUNT(*)::bigint,
         COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'verificado'), 0)::numeric,
         COALESCE(SUM(p.monto) FILTER (WHERE p.estado IN ('enviado','pendiente')), 0)::numeric,
         COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'rechazado'), 0)::numeric
  FROM pagos_2026 p
  GROUP BY p.concepto;
$$;
GRANT EXECUTE ON FUNCTION public.admin_recaudado_resumen() TO service_role;

-- ----------------------------------------------------------------------------
-- 5) Pagos recientes (todas las agrupaciones) + datos de facturación + recibo
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pagos_recientes(
  p_limit    integer DEFAULT 100,
  p_estado   text DEFAULT NULL,
  p_concepto text DEFAULT NULL
)
RETURNS TABLE (
  id_pago           text,
  numero_recibo     text,
  concepto          text,
  id_referencia     text,
  id_agrupacion     text,
  nombre_agrupacion text,
  enlace_del_logo   text,
  fecha             date,
  hora              time,
  monto             numeric,
  estado            text,
  metodo_pago       text,
  nombre_pagador    text,
  telefono_pagador  text,
  comprobante_url   text,
  recibo_pdf_url    text,
  created_at        timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.id_pago, p.numero_recibo, p.concepto, p.id_referencia,
         p.id_agrupacion, i.nombre_agrupacion, i.enlace_del_logo,
         p.fecha, p.hora, p.monto, p.estado,
         COALESCE(m.metodo, p.metodo_pago) AS metodo_pago,
         p.nombre_pagador, p.telefono_pagador,
         p.comprobante_url, p.recibo_pdf_url, p.created_at
  FROM pagos_2026 p
  LEFT JOIN instituciones i        ON i.id_agrupacion = p.id_agrupacion
  LEFT JOIN metodos_de_pago_2026 m ON m.id_metodo = p.id_metodo_pago
  WHERE (p_estado   IS NULL OR p.estado   = p_estado)
    AND (p_concepto IS NULL OR p.concepto = p_concepto)
  ORDER BY p.created_at DESC NULLS LAST, p.fecha DESC NULLS LAST, p.hora DESC NULLS LAST
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;
GRANT EXECUTE ON FUNCTION public.admin_pagos_recientes(integer, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 6) Pagos agrupados por agrupación (deuda + recaudado + saldo + #pagos)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_pagos_por_agrupacion()
RETURNS TABLE (
  id_agrupacion     text,
  nombre_agrupacion text,
  enlace_del_logo   text,
  total_deuda       numeric,
  pagado_verificado numeric,
  pagado_pendiente  numeric,
  saldo             numeric,
  n_pagos           bigint
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH d AS (
    SELECT id_agrupacion,
           SUM(monto_total)       AS total_deuda,
           SUM(pagado_verificado) AS pagado_verificado,
           SUM(pagado_pendiente)  AS pagado_pendiente,
           SUM(saldo)             AS saldo
    FROM deudas_2026
    GROUP BY id_agrupacion
  ),
  pc AS (
    SELECT id_agrupacion, COUNT(*)::bigint AS n_pagos
    FROM pagos_2026 GROUP BY id_agrupacion
  )
  SELECT d.id_agrupacion, i.nombre_agrupacion, i.enlace_del_logo,
         d.total_deuda, d.pagado_verificado, d.pagado_pendiente, d.saldo,
         COALESCE(pc.n_pagos, 0)
  FROM d
  LEFT JOIN instituciones i ON i.id_agrupacion = d.id_agrupacion
  LEFT JOIN pc              ON pc.id_agrupacion = d.id_agrupacion
  ORDER BY d.pagado_verificado DESC NULLS LAST, d.saldo DESC NULLS LAST;
$$;
GRANT EXECUTE ON FUNCTION public.admin_pagos_por_agrupacion() TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICAR (correr suelto tras el COMMIT):
--   SELECT id, usuario, nombre, id_contacto, activo FROM admin_usuarios;
--     -- los 3 (yacu/shera/briza) deben tener id_contacto NO NULL
--   SELECT es_admin_pagos(id_contacto) FROM admin_usuarios WHERE id_contacto IS NOT NULL;
--   SELECT * FROM admin_recaudado_resumen();
--   SELECT * FROM admin_pagos_recientes(20);
--   SELECT * FROM admin_pagos_por_agrupacion() LIMIT 10;
-- ============================================================================
