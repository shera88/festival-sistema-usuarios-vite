-- 020_membresia_pagada_por_owner.sql
-- RPCs que marca n8n al confirmarse el pago en WooCommerce, ancladas a owner_id
-- (identidad de sesión) en vez de exigir id_kardex. Upsertean membresias_videos_2026
-- (fuente de verdad) y ADEMÁS marcan el kárdex legacy si vino id_kardex (compat).
-- RETURNS void para evitar colisión de nombres OUT con columnas. Requiere 019.
-- Solo DDL. Correr en Studio.

-- DROP previo: la 1ª versión se creó con RETURNS TABLE; no se puede cambiar el
-- tipo de retorno con CREATE OR REPLACE.
DROP FUNCTION IF EXISTS public.marcar_membresia_videos_2026(text,text,text,text,bigint,numeric);
DROP FUNCTION IF EXISTS public.marcar_membresia_paquete_2026(text,text,text,text,bigint,numeric);

-- Membresía de Videos --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_membresia_videos_2026(
  p_owner_id    text,
  p_origen      text    DEFAULT 'contacto',
  p_id_kardex   text    DEFAULT NULL,
  p_id_contacto text    DEFAULT NULL,
  p_order_id    bigint  DEFAULT NULL,
  p_monto       numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO membresias_videos_2026 (owner_id, origen, reservo, pagada, id_kardex, id_contacto, order_id)
  VALUES (p_owner_id, COALESCE(NULLIF(p_origen,''),'contacto'), true, true,
          NULLIF(p_id_kardex,''), NULLIF(p_id_contacto,''), NULLIF(p_order_id::text,''))
  ON CONFLICT (owner_id) DO UPDATE
    SET pagada      = true,
        reservo     = true,
        id_kardex   = COALESCE(EXCLUDED.id_kardex,   membresias_videos_2026.id_kardex),
        id_contacto = COALESCE(EXCLUDED.id_contacto, membresias_videos_2026.id_contacto),
        order_id    = COALESCE(EXCLUDED.order_id,    membresias_videos_2026.order_id);

  IF NULLIF(p_id_kardex,'') IS NOT NULL THEN
    UPDATE registro_kardex_2026
    SET membresia = true, membresia_pagada = true,
        membresia_pagada_en = COALESCE(membresia_pagada_en, now()),
        membresia_order_id  = COALESCE(p_order_id, membresia_order_id),
        membresia_precio    = COALESCE(p_monto, membresia_precio)
    WHERE id_kardex = p_id_kardex;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.marcar_membresia_videos_2026(text,text,text,text,bigint,numeric) TO service_role;

-- Paquete Completo -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.marcar_membresia_paquete_2026(
  p_owner_id    text,
  p_origen      text    DEFAULT 'contacto',
  p_id_kardex   text    DEFAULT NULL,
  p_id_contacto text    DEFAULT NULL,
  p_order_id    bigint  DEFAULT NULL,
  p_monto       numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO membresias_videos_2026 (owner_id, origen, paquete_reservo, paquete_pagada, id_kardex, id_contacto, order_id)
  VALUES (p_owner_id, COALESCE(NULLIF(p_origen,''),'contacto'), true, true,
          NULLIF(p_id_kardex,''), NULLIF(p_id_contacto,''), NULLIF(p_order_id::text,''))
  ON CONFLICT (owner_id) DO UPDATE
    SET paquete_pagada  = true,
        paquete_reservo = true,
        id_kardex   = COALESCE(EXCLUDED.id_kardex,   membresias_videos_2026.id_kardex),
        id_contacto = COALESCE(EXCLUDED.id_contacto, membresias_videos_2026.id_contacto),
        order_id    = COALESCE(EXCLUDED.order_id,    membresias_videos_2026.order_id);

  IF NULLIF(p_id_kardex,'') IS NOT NULL THEN
    UPDATE registro_kardex_2026
    SET membresia_paquete = true, membresia_paquete_pagada = true,
        membresia_paquete_pagada_en = COALESCE(membresia_paquete_pagada_en, now()),
        membresia_paquete_order_id  = COALESCE(p_order_id, membresia_paquete_order_id),
        membresia_paquete_precio    = COALESCE(p_monto, membresia_paquete_precio)
    WHERE id_kardex = p_id_kardex;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.marcar_membresia_paquete_2026(text,text,text,text,bigint,numeric) TO service_role;

NOTIFY pgrst, 'reload schema';
