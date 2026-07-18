-- 055 — Propagación de renombre de agrupación (2026)
-- ---------------------------------------------------------------------------
-- Problema: al renombrar una agrupación se cambiaba SOLO el texto de la obra
-- (registro_de_inscripcion_2026.agrupacion). instituciones y registro_kardex_2026
-- quedaban con el nombre viejo → en Kardex aparecía una tarjeta duplicada (nombre
-- viejo, sin logo) y las credenciales/etiquetas mostraban el nombre anterior.
--
-- Solución: un trigger que, cuando cambia el nombre de la agrupación en una obra,
-- propaga el nuevo nombre (por id_agrupacion) a:
--   • instituciones.nombre_agrupacion        (el maestro)
--   • registro_kardex_2026.agrupacion        (los bailarines / integrantes)
--   • las DEMÁS obras del mismo id_agrupacion (para que todas queden iguales)
--
-- Seguro: no toca nada si no hay id_agrupacion o el nombre no cambió; pg_trigger_depth
-- evita recursión; SECURITY DEFINER + search_path fijo para que funcione desde
-- cualquier rol (service_role de gestión, endpoints del portal, etc.).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.propagar_rename_agrupacion_2026()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Solo la edición de nivel superior propaga (las actualizaciones que dispara
  -- el propio trigger entran en depth > 1 y se ignoran → sin recursión).
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.id_agrupacion IS NOT NULL
     AND NEW.agrupacion IS DISTINCT FROM OLD.agrupacion
     AND COALESCE(btrim(NEW.agrupacion), '') <> '' THEN

    UPDATE public.instituciones
       SET nombre_agrupacion = NEW.agrupacion
     WHERE id_agrupacion = NEW.id_agrupacion
       AND nombre_agrupacion IS DISTINCT FROM NEW.agrupacion;

    UPDATE public.registro_kardex_2026
       SET agrupacion = NEW.agrupacion
     WHERE id_agrupacion = NEW.id_agrupacion
       AND agrupacion IS DISTINCT FROM NEW.agrupacion;

    UPDATE public.registro_de_inscripcion_2026
       SET agrupacion = NEW.agrupacion
     WHERE id_agrupacion = NEW.id_agrupacion
       AND id_inscripcion <> NEW.id_inscripcion
       AND agrupacion IS DISTINCT FROM NEW.agrupacion;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagar_rename_agrupacion ON public.registro_de_inscripcion_2026;
CREATE TRIGGER trg_propagar_rename_agrupacion
AFTER UPDATE OF agrupacion ON public.registro_de_inscripcion_2026
FOR EACH ROW
EXECUTE FUNCTION public.propagar_rename_agrupacion_2026();

-- Verificación rápida (opcional):
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trg_propagar_rename_agrupacion';
