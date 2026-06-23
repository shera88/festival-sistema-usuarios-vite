-- migrations/009_login_kardex.sql
-- ADITIVO: permite que registrantes del KÁRDEX (BAILARIN, STAFF, etc. que no
-- tienen fila en festival_contactos_global) inicien sesión en el portal.
--
-- Estrategia: search_login_users y validate_login hacen UNION de:
--   1) festival_contactos_global (cuentas "ricas": representante/director/coreógrafo).
--   2) registro_kardex_2026 de personas que NO existen como contacto (dedup por
--      carnet/teléfono). Estas son cuentas de PARTICIPANTE = solo lectura
--      (es_representante/es_director/es_coreografo = false → la UI deriva read-only).
--
-- Login sigue siendo: id (uuid de contacto ó id_kardex) + password (carnet ó teléfono).
-- Firma de las funciones NO cambia → login.php y el frontend quedan igual.
-- Idempotente (CREATE OR REPLACE). No toca data.
--
-- NOTA: antes se hacía id_contacto = p_id::uuid. Ahora se compara
-- id_contacto::text = p_id para no romper cuando el id es un id_kardex (hex8).

DROP FUNCTION IF EXISTS public.search_login_users(text);
DROP FUNCTION IF EXISTS public.validate_login(text, text);

-- Normaliza dígitos (carnet/teléfono) para comparar password.
-- (inline en cada función para no depender de helpers externos)

-- 1) Búsqueda para autocomplete de login (contactos + participantes kárdex)
CREATE OR REPLACE FUNCTION public.search_login_users(p_query text)
RETURNS TABLE (
  id_contacto text, numero_de_carnet text, nombre_y_apellido text, telefono text,
  correo_electronico text, ciudad text, imagen_contacto text, id_agrupacion text,
  nombre_agrupacion text, enlace_del_logo text, rol_primario text,
  es_representante boolean, es_director boolean, es_coreografo boolean,
  id_original_representante text, id_original_director text, id_original_coreografo text,
  origen text, puede_editar boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  -- Contactos
  SELECT
    c.id_contacto::text, c.numero_de_carnet, c.nombre_y_apellido, c.telefono,
    c.correo_electronico, c.ciudad, c.imagen_contacto, c.id_agrupacion,
    c.nombre_agrupacion, c.enlace_del_logo, c.rol_primario,
    c.es_representante, c.es_director, c.es_coreografo,
    c.id_original_representante, c.id_original_director, c.id_original_coreografo,
    'contacto'::text, true
  FROM festival_contactos_global c
  WHERE (c.antecedentes IS NULL OR c.antecedentes <> 'prospecto_no_participo')
    AND length(coalesce(p_query, '')) >= 1
    AND (
      c.nombre_y_apellido ILIKE '%'||p_query||'%' OR
      c.numero_de_carnet ILIKE '%'||p_query||'%' OR
      c.telefono ILIKE '%'||p_query||'%' OR
      coalesce(c.correo_electronico,'') ILIKE '%'||p_query||'%'
    )

  UNION ALL

  -- Participantes del kárdex que NO son contactos (dedup por carnet/teléfono)
  SELECT
    k.id_kardex AS id_contacto, k.ci::text, k.nombre_y_apellido, k.telefono::text,
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
  WHERE length(coalesce(p_query,'')) >= 1
    AND (
      k.nombre_y_apellido ILIKE '%'||p_query||'%' OR
      k.ci::text ILIKE '%'||p_query||'%' OR
      k.telefono::text ILIKE '%'||p_query||'%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM festival_contactos_global c2
      WHERE regexp_replace(coalesce(c2.numero_de_carnet,''),'\D','','g') = k.ci::text
         OR regexp_replace(coalesce(c2.telefono,''),'\D','','g') = k.telefono::text
    )
  ORDER BY 3
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION public.search_login_users(text) TO anon, authenticated, service_role;

-- 2) Validación de login (carnet o teléfono como password). Contactos + kárdex.
CREATE OR REPLACE FUNCTION public.validate_login(p_id_contacto text, p_password text)
RETURNS TABLE (
  id_contacto text, numero_de_carnet text, nombre_y_apellido text, telefono text,
  correo_electronico text, ciudad text, imagen_contacto text, id_agrupacion text,
  nombre_agrupacion text, enlace_del_logo text, rol_primario text,
  es_representante boolean, es_director boolean, es_coreografo boolean,
  id_original_representante text, id_original_director text, id_original_coreografo text,
  origen text, puede_editar boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
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
    AND (
      regexp_replace(coalesce(c.numero_de_carnet,''),'\s','','g') = regexp_replace(coalesce(p_password,''),'\s','','g')
      OR regexp_replace(coalesce(c.telefono,''),'\D','','g') = regexp_replace(coalesce(p_password,''),'\D','','g')
    )

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
    AND (
      k.ci::text = regexp_replace(coalesce(p_password,''),'\D','','g')
      OR k.telefono::text = regexp_replace(coalesce(p_password,''),'\D','','g')
    )
    AND NOT EXISTS (
      SELECT 1 FROM festival_contactos_global c2
      WHERE regexp_replace(coalesce(c2.numero_de_carnet,''),'\D','','g') = k.ci::text
         OR regexp_replace(coalesce(c2.telefono,''),'\D','','g') = k.telefono::text
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_login(text, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.validate_login(text, text) IS
  'Valida login del portal: festival_contactos_global (uuid) + registro_kardex_2026 (id_kardex, participantes read-only). Password = carnet ó teléfono.';
