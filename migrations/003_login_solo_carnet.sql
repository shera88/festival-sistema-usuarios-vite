-- ============================================================================
-- 003 · LOGIN DEL PORTAL: SOLO CON EL C.I.
--
-- Hasta acá se podía entrar con el carnet O con el teléfono. Ahora sólo con el
-- carnet, que es lo que pidió la organización.
--
-- Además cierra un AGUJERO DE AUTENTICACIÓN que tenía la rama del teléfono:
-- comparaba `regexp_replace(password,'\D','','g')` contra el teléfono, o sea
-- borrando todo lo que no fuera dígito. Una contraseña sin números —«abc»,
-- «x»— quedaba en cadena vacía y coincidía con cualquier contacto que tuviera
-- el teléfono vacío. Eran 411 cuentas a las que se entraba con cualquier
-- palabra, sabiendo sólo el id_contacto. Verificado en vivo antes del cambio.
--
-- Por eso, además de sacar el teléfono, se exige que el dato guardado NO esté
-- vacío: sin ese guard, un contacto sin carnet cargado quedaría expuesto al
-- mismo truco por el otro lado.
--
-- CONSECUENCIA ACEPTADA (decidida por la organización el 2026-08-23):
-- de 1977 contactos, 1180 no tienen carnet cargado, y 775 de ellos venían
-- entrando con el teléfono. Esas 775 personas NO van a poder entrar hasta que
-- se les cargue el C.I. La lista está en
-- backups/contactos_sin_carnet_2026-08-23.csv
-- El kárdex no se ve afectado: sus 4229 filas tienen CI.
--
-- Para volver atrás: correr backups/validate_login_ANTES_2026-08-23.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_login(p_id_contacto text, p_password text)
 RETURNS TABLE(id_contacto text, numero_de_carnet text, nombre_y_apellido text, telefono text, correo_electronico text, ciudad text, imagen_contacto text, id_agrupacion text, nombre_agrupacion text, enlace_del_logo text, rol_primario text, es_representante boolean, es_director boolean, es_coreografo boolean, id_original_representante text, id_original_director text, id_original_coreografo text, origen text, puede_editar boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- Contacto
  SELECT
    c.id_contacto::text, c.numero_de_carnet, c.nombre_y_apellido, c.telefono,
    c.correo_electronico, c.ciudad, c.imagen_contacto, c.id_agrupacion,
    c.nombre_agrupacion, c.enlace_del_logo, c.rol_primario,
    c.es_representante, c.es_director, c.es_coreografo,
    c.id_original_representante, c.id_original_director, c.id_original_coreografo,
    'contacto'::text, true
  FROM festival_contactos_global c
  WHERE c.id_contacto::text = p_id_contacto
    AND (c.antecedentes IS NULL OR c.antecedentes <> 'prospecto_no_participo')
    -- Sin carnet cargado no se entra: si no, la cadena vacía haría de comodín.
    AND regexp_replace(coalesce(c.numero_de_carnet,''),'\s','','g') <> ''
    AND regexp_replace(coalesce(c.numero_de_carnet,''),'\s','','g')
        = regexp_replace(coalesce(p_password,''),'\s','','g')

  UNION ALL

  -- Participante kárdex (solo si no es contacto)
  SELECT
    k.id_kardex, k.ci::text, k.nombre_y_apellido, k.telefono::text,
    k.correo_electronico, k.ciudad, k.foto, k.id_agrupacion,
    k.agrupacion, i.enlace_del_logo, 'PARTICIPANTE'::text,
    false, false, false, NULL::text, NULL::text, NULL::text,
    'kardex'::text, (upper(coalesce(k.cargo,'')) IN ('STAFF','DIRECTOR','COREOGRAFO'))
  FROM (
    SELECT DISTINCT ON (k0.ci) k0.*
    FROM registro_kardex_2026 k0
    WHERE k0.ci IS NOT NULL
    ORDER BY k0.ci, k0.fecha DESC NULLS LAST, k0.id_kardex
  ) k
  LEFT JOIN instituciones i ON i.id_agrupacion = k.id_agrupacion
  WHERE k.id_kardex = p_id_contacto
    -- Mismo criterio: sólo el CI, y nunca vacío.
    AND coalesce(k.ci::text,'') <> ''
    AND k.ci::text = regexp_replace(coalesce(p_password,''),'\D','','g')
    -- (Este bloque NO es credencial: decide si la persona ya figura como
    --  contacto, para no duplicarla. Se deja tal cual estaba.)
    AND NOT EXISTS (
      SELECT 1 FROM festival_contactos_global c2
      WHERE regexp_replace(coalesce(c2.numero_de_carnet,''),'\D','','g') = k.ci::text
         OR regexp_replace(coalesce(c2.telefono,''),'\D','','g') = k.telefono::text
    )
  LIMIT 1;
$function$;

-- Verificación (en Studio), con un contacto que tenga carnet:
--   select count(*) from validate_login('<id_contacto>', '<su carnet>');    -- 1
--   select count(*) from validate_login('<id_contacto>', '<su telefono>');  -- 0
--   select count(*) from validate_login('<id_contacto>', 'abc');            -- 0
-- ============================================================================
