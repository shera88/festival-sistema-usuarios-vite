-- migrations/010_login_kardex_multi_agrupacion.sql
-- Refina el branch kárdex de search_login_users + validate_login:
--   * id_agrupacion = CSV (string_agg distinct) de TODAS las agrupaciones donde
--     la persona (mismo CI) aparece en registro_kardex_2026. Así un bailarín en
--     2+ agrupaciones ve notas/participaciones/roster de TODAS (buildContextFilter
--     ya parte el CSV por comas).
--   * puede_editar = EXISTS de alguna fila suya con cargo STAFF/DIRECTOR/COREOGRAFO.
-- Idempotente. No toca data. Reemplaza las definiciones de 009.

DROP FUNCTION IF EXISTS public.search_login_users(text);
DROP FUNCTION IF EXISTS public.validate_login(text, text);

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

  SELECT
    k.id_kardex, k.ci::text, k.nombre_y_apellido, k.telefono::text,
    k.correo_electronico, k.ciudad, k.foto,
    (SELECT string_agg(DISTINCT ka.id_agrupacion, ',') FROM registro_kardex_2026 ka WHERE ka.ci = k.ci AND ka.id_agrupacion IS NOT NULL),
    k.agrupacion, i.enlace_del_logo, 'PARTICIPANTE'::text,
    false, false, false, NULL::text, NULL::text, NULL::text,
    'kardex'::text,
    EXISTS (SELECT 1 FROM registro_kardex_2026 ke WHERE ke.ci = k.ci AND upper(coalesce(ke.cargo,'')) IN ('STAFF','DIRECTOR','COREOGRAFO'))
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

  SELECT
    k.id_kardex, k.ci::text, k.nombre_y_apellido, k.telefono::text,
    k.correo_electronico, k.ciudad, k.foto,
    (SELECT string_agg(DISTINCT ka.id_agrupacion, ',') FROM registro_kardex_2026 ka WHERE ka.ci = k.ci AND ka.id_agrupacion IS NOT NULL),
    k.agrupacion, i.enlace_del_logo, 'PARTICIPANTE'::text,
    false, false, false, NULL::text, NULL::text, NULL::text,
    'kardex'::text,
    EXISTS (SELECT 1 FROM registro_kardex_2026 ke WHERE ke.ci = k.ci AND upper(coalesce(ke.cargo,'')) IN ('STAFF','DIRECTOR','COREOGRAFO'))
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

NOTIFY pgrst, 'reload schema';
