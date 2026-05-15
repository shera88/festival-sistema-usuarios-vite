-- Fix precio_subdivision: ignorar acentos al comparar
-- subdivisiones en convocatoria_secciones: "Solo", "Dúo", "Grupo Chico", "Grupo Grande"
-- registro_de_inscripcion_2026.subdivision: "SOLO", "DUO", "GRUPO CHICO", "GRUPO GRANDE"

-- Crear extension unaccent si no existe (común en Supabase)
CREATE EXTENSION IF NOT EXISTS unaccent;

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
      AND UPPER(unaccent(item->>'nombre')) = UPPER(unaccent(p_sub))
    LIMIT 1
  ), 0);
$$;

-- Verificar
-- SELECT precio_subdivision('SOLO');         -- 400
-- SELECT precio_subdivision('DUO');          -- 350
-- SELECT precio_subdivision('GRUPO CHICO');  -- 100
-- SELECT precio_subdivision('GRUPO GRANDE'); -- 80
