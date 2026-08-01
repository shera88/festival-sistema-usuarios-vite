-- ============================================================================
-- 018 — Membresía "Paquete Completo" (todos los videos del festival) +
--        columna bailes_ids (lista de id_inscripcion de los bailes del kárdex)
-- ============================================================================
-- Segunda membresía, en paralelo a la de Videos (015/016/017):
--   Videos           = acceso a los videos de SUS bailes (precio 20 reserva / 50 después)
--   Paquete Completo = acceso a TODOS los videos del festival 2026 (precio 40 reserva / 80 después)
--
-- Mismo modelo que la de Videos:
--   membresia_paquete         = "reservó la promo" (marcó el check en el kárdex) → precio 40
--   membresia_paquete_pagada  = "ya pagó" → videos.php le libera TODOS los videos 2026
--
-- Además: columna bailes_ids (jsonb array de id_inscripcion) — la lista de ids de
-- las inscripciones/bailes en los que baila el participante (además del jsonb
-- `bailes` que guarda {id_inscripcion, nombre_de_la_obra}).
--
-- Sólo DDL (ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE) + un backfill idempotente
-- de bailes_ids. No borra datos. Correr en Supabase Studio → SQL Editor.
-- ============================================================================

-- 1) Columnas del Paquete Completo (mirror de 015/017 para la de Videos) --------
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_paquete boolean NOT NULL DEFAULT false;
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_paquete_pagada boolean NOT NULL DEFAULT false;
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_paquete_pagada_en timestamptz;
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_paquete_order_id bigint;   -- id de la orden WooCommerce
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_paquete_precio numeric;    -- monto pagado (40 ó 80)

-- 2) Columna bailes_ids (lista de id_inscripcion) ------------------------------
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS bailes_ids jsonb;

-- Backfill: derivar bailes_ids del jsonb `bailes` existente (solo filas con bailes
-- y sin bailes_ids aún). Idempotente.
UPDATE public.registro_kardex_2026
SET bailes_ids = (
  SELECT jsonb_agg(elem->>'id_inscripcion')
  FROM jsonb_array_elements(bailes) AS elem
  WHERE elem->>'id_inscripcion' IS NOT NULL
)
WHERE bailes IS NOT NULL
  AND jsonb_typeof(bailes) = 'array'
  AND jsonb_array_length(bailes) > 0
  AND bailes_ids IS NULL;

-- 3) RPC que llama n8n al confirmarse el pago del Paquete en WooCommerce --------
--    Marca el Paquete de la persona (por id_kardex) como pagado. Idempotente.
CREATE OR REPLACE FUNCTION public.marcar_membresia_paquete_pagada(
  p_id_kardex text,
  p_order_id  bigint  DEFAULT NULL,
  p_monto     numeric DEFAULT NULL
)
RETURNS TABLE (id_kardex text, membresia_paquete_pagada boolean, membresia_paquete_pagada_en timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE registro_kardex_2026
  SET membresia_paquete            = true,
      membresia_paquete_pagada     = true,
      membresia_paquete_pagada_en  = COALESCE(membresia_paquete_pagada_en, now()),
      membresia_paquete_order_id   = COALESCE(p_order_id, membresia_paquete_order_id),
      membresia_paquete_precio     = COALESCE(p_monto, membresia_paquete_precio)
  WHERE id_kardex = p_id_kardex
  RETURNING id_kardex, membresia_paquete_pagada, membresia_paquete_pagada_en;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_membresia_paquete_pagada(text, bigint, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
