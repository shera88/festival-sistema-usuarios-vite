-- ============================================================================
-- 012 — Check (verificado) atado al baile asignado
-- ----------------------------------------------------------------------------
-- Regla: un BAILARÍN sin baile asignado queda con el check DESACTIVADO hasta
-- que se lo asigne a un baile; al asignarlo, el check se activa solo. Así el
-- cierre de agrupación garantiza que todos los bailarines están en un baile.
-- (agrupacion-cerrar.php bloquea el cierre si hay verificado=false.)
--
-- Cargos que no bailan (director, staff, representante, etc.) NO se tocan:
-- siguen con el check por defecto y el des-check manual del coreógrafo.
--
--   • Trigger BEFORE INSERT: bailarín sin bailes → verificado=false;
--                            con bailes → true.
--   • Trigger BEFORE UPDATE OF bailes: pierde todos los bailes → false;
--                            pasa de sin-baile a con-baile → true (auto-check);
--                            si ya tenía y sigue teniendo → se respeta el manual.
--   • Backfill: bailarines 2026 sin baile → false.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.kardex_verificado_por_baile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  es_bailarin   boolean;
  new_con_baile boolean;
  old_con_baile boolean;
BEGIN
  es_bailarin := translate(upper(coalesce(NEW.cargo, '')), 'ÁÉÍÓÚ', 'AEIOU') LIKE 'BAILARIN%';
  IF NOT es_bailarin THEN
    RETURN NEW;
  END IF;

  new_con_baile := NEW.bailes IS NOT NULL
               AND jsonb_typeof(NEW.bailes::jsonb) = 'array'
               AND jsonb_array_length(NEW.bailes::jsonb) > 0;

  IF TG_OP = 'INSERT' THEN
    NEW.verificado := new_con_baile;
    RETURN NEW;
  END IF;

  -- UPDATE OF bailes
  old_con_baile := OLD.bailes IS NOT NULL
               AND jsonb_typeof(OLD.bailes::jsonb) = 'array'
               AND jsonb_array_length(OLD.bailes::jsonb) > 0;

  IF NOT new_con_baile THEN
    NEW.verificado := false;                    -- se quedó sin baile → sin check
  ELSIF NOT old_con_baile THEN
    NEW.verificado := true;                     -- recibió su primer baile → auto-check
  END IF;                                        -- (con baile antes y ahora → respeta el manual)
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kardex_verificado_baile ON public.registro_kardex_2026;
CREATE TRIGGER trg_kardex_verificado_baile
BEFORE INSERT OR UPDATE OF bailes ON public.registro_kardex_2026
FOR EACH ROW EXECUTE FUNCTION public.kardex_verificado_por_baile();

-- Backfill: bailarines del año vigente sin baile asignado → check desactivado.
UPDATE public.registro_kardex_2026
   SET verificado = false
 WHERE fecha ILIKE '%2026%'
   AND translate(upper(coalesce(cargo, '')), 'ÁÉÍÓÚ', 'AEIOU') LIKE 'BAILARIN%'
   AND (bailes IS NULL OR jsonb_typeof(bailes::jsonb) <> 'array' OR jsonb_array_length(bailes::jsonb) = 0)
   AND verificado IS DISTINCT FROM false;
