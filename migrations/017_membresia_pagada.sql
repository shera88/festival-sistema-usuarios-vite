-- ============================================================================
-- 017 — Membresía de Videos: estado de pago (desbloqueo de videos 2026)
-- ============================================================================
-- Parte del nuevo modelo (ver 016): la Membresía de Videos ya no se cobra con la
-- credencial; se paga aparte por el checkout de WooCommerce. Esta migración agrega
-- el estado de PAGO de la membresía por persona (kárdex) y la RPC que n8n llama
-- cuando WooCommerce confirma el pago, para desbloquear los videos 2026.
--
--   membresia            (015) = "reservó la promo" (marcó el check en el kárdex) → precio 20
--   membresia_pagada     (017) = "ya pagó" → videos.php le libera los videos 2026
--
-- Sólo DDL (ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE FUNCTION). No borra datos.
-- Correr en Supabase Studio → SQL Editor.
-- ============================================================================

-- 1) Columnas de estado de pago de la membresía --------------------------------
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_pagada boolean NOT NULL DEFAULT false;
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_pagada_en timestamptz;
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_order_id bigint;   -- id de la orden WooCommerce
ALTER TABLE public.registro_kardex_2026
  ADD COLUMN IF NOT EXISTS membresia_precio numeric;    -- monto pagado (20 ó 50)

-- 2) RPC que llama n8n al confirmarse el pago en WooCommerce --------------------
--    Marca la membresía de la persona (por id_kardex) como pagada. Idempotente:
--    si ya estaba pagada, conserva la fecha original. Si pagó sin haber reservado,
--    también deja membresia=true (para consistencia del flag "tiene membresía").
CREATE OR REPLACE FUNCTION public.marcar_membresia_pagada(
  p_id_kardex text,
  p_order_id  bigint  DEFAULT NULL,
  p_monto     numeric DEFAULT NULL
)
RETURNS TABLE (id_kardex text, membresia_pagada boolean, membresia_pagada_en timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE registro_kardex_2026
  SET membresia            = true,
      membresia_pagada     = true,
      membresia_pagada_en  = COALESCE(membresia_pagada_en, now()),
      membresia_order_id   = COALESCE(p_order_id, membresia_order_id),
      membresia_precio     = COALESCE(p_monto, membresia_precio)
  WHERE id_kardex = p_id_kardex
  RETURNING id_kardex, membresia_pagada, membresia_pagada_en;
$$;

GRANT EXECUTE ON FUNCTION public.marcar_membresia_pagada(text, bigint, numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
