-- migrations/001_login_rpcs.sql
-- ADITIVO: crea 2 funciones SECURITY DEFINER para login del portal de usuarios.
-- No toca data existente. Idempotente (CREATE OR REPLACE).

-- 1) Búsqueda de usuarios para autocomplete de login
--    Filtra por nombre/carnet/telefono/email
--    Excluye contactos con antecedentes='prospecto_no_participo'
CREATE OR REPLACE FUNCTION public.search_login_users(p_query text)
RETURNS TABLE (
  id_contacto text,
  numero_de_carnet text,
  nombre_y_apellido text,
  telefono text,
  correo_electronico text,
  ciudad text,
  imagen_contacto text,
  id_agrupacion text,
  nombre_agrupacion text,
  enlace_del_logo text,
  rol_primario text,
  es_representante boolean,
  es_director boolean,
  es_coreografo boolean,
  id_original_representante text,
  id_original_director text,
  id_original_coreografo text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id_contacto,
    numero_de_carnet,
    nombre_y_apellido,
    telefono,
    correo_electronico,
    ciudad,
    imagen_contacto,
    id_agrupacion,
    nombre_agrupacion,
    enlace_del_logo,
    rol_primario,
    es_representante,
    es_director,
    es_coreografo,
    id_original_representante,
    id_original_director,
    id_original_coreografo
  FROM festival_contactos_global
  WHERE (antecedentes IS NULL OR antecedentes <> 'prospecto_no_participo')
    AND length(coalesce(p_query, '')) >= 1
    AND (
      nombre_y_apellido ILIKE '%' || p_query || '%' OR
      numero_de_carnet ILIKE '%' || p_query || '%' OR
      telefono ILIKE '%' || p_query || '%' OR
      coalesce(correo_electronico, '') ILIKE '%' || p_query || '%'
    )
  ORDER BY nombre_y_apellido
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_login_users(text) TO anon, authenticated, service_role;

-- 2) Validación de login (carnet o telefono como password)
CREATE OR REPLACE FUNCTION public.validate_login(p_id_contacto text, p_password text)
RETURNS TABLE (
  id_contacto text,
  numero_de_carnet text,
  nombre_y_apellido text,
  telefono text,
  correo_electronico text,
  ciudad text,
  imagen_contacto text,
  id_agrupacion text,
  nombre_agrupacion text,
  enlace_del_logo text,
  rol_primario text,
  es_representante boolean,
  es_director boolean,
  es_coreografo boolean,
  id_original_representante text,
  id_original_director text,
  id_original_coreografo text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id_contacto,
    numero_de_carnet,
    nombre_y_apellido,
    telefono,
    correo_electronico,
    ciudad,
    imagen_contacto,
    id_agrupacion,
    nombre_agrupacion,
    enlace_del_logo,
    rol_primario,
    es_representante,
    es_director,
    es_coreografo,
    id_original_representante,
    id_original_director,
    id_original_coreografo
  FROM festival_contactos_global
  WHERE id_contacto = p_id_contacto
    AND (antecedentes IS NULL OR antecedentes <> 'prospecto_no_participo')
    AND (
      regexp_replace(coalesce(numero_de_carnet, ''), '\s', '', 'g') = regexp_replace(coalesce(p_password, ''), '\s', '', 'g')
      OR
      regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = regexp_replace(coalesce(p_password, ''), '\D', '', 'g')
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_login(text, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_login_users(text) IS
  'Autocomplete de usuarios para la pantalla de login del portal. Excluye prospectos. Pública (anon).';
COMMENT ON FUNCTION public.validate_login(text, text) IS
  'Valida login del portal usando id_contacto + (numero_de_carnet o telefono). Pública (anon). Devuelve fila completa o 0 filas.';
