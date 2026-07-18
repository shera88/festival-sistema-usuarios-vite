-- 019_membresias_videos_2026.sql
-- Membresía de videos desacoplada del kardex: se ancla a la IDENTIDAD DE SESIÓN
-- (owner_id = id_contacto en login contacto, id_kardex en login kardex).
-- Así un representante puede comprar SIN kardex, y si después mete kardex la
-- membresía sigue sirviendo (owner_id = id_contacto es estable).
-- Solo service_role (PHP backend) accede; anon NO (RLS on, sin políticas).

CREATE TABLE IF NOT EXISTS public.membresias_videos_2026 (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         text NOT NULL UNIQUE,   -- id_contacto (login contacto) o id_kardex (login kardex)
  origen           text NOT NULL DEFAULT 'contacto' CHECK (origen IN ('contacto','kardex')),
  reservo          boolean NOT NULL DEFAULT false,
  pagada           boolean NOT NULL DEFAULT false,
  paquete_reservo  boolean NOT NULL DEFAULT false,
  paquete_pagada   boolean NOT NULL DEFAULT false,
  id_kardex        text,
  id_contacto      text,
  order_id         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.membresias_videos_2026 ENABLE ROW LEVEL SECURITY;
-- Sin GRANT ni policies para anon/authenticated → queda cerrado; el PHP entra
-- con service_role (bypassa RLS).

CREATE INDEX IF NOT EXISTS idx_membresias_videos_2026_owner
  ON public.membresias_videos_2026 (owner_id);
CREATE INDEX IF NOT EXISTS idx_membresias_videos_2026_kardex
  ON public.membresias_videos_2026 (id_kardex);
CREATE INDEX IF NOT EXISTS idx_membresias_videos_2026_contacto
  ON public.membresias_videos_2026 (id_contacto);

-- Mantener updated_at
CREATE OR REPLACE FUNCTION public.touch_membresias_videos_2026()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_membresias_videos_2026 ON public.membresias_videos_2026;
CREATE TRIGGER trg_touch_membresias_videos_2026
  BEFORE UPDATE ON public.membresias_videos_2026
  FOR EACH ROW EXECUTE FUNCTION public.touch_membresias_videos_2026();

-- Refrescar cache de PostgREST
NOTIFY pgrst, 'reload schema';
