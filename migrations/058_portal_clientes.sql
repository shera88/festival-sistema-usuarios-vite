-- 058_portal_clientes.sql
--
-- Cuentas del PÚBLICO GENERAL que compra la membresía de videos. Gente que no
-- baila en el festival: no tiene carnet en el sistema, ni agrupación, ni kardex.
--
-- Por qué una tabla propia y no una fila más en festival_contactos_global:
--   1. `validate_login` devuelve una tabla fija de 19 columnas armada desde esa
--      tabla (id_agrupacion, rol_primario, es_representante…). Un cliente no
--      tiene nada de eso: habría que inventar NULLs y meter una tercera rama.
--   2. `buildContextFilter()` devuelve null para quien no tiene agrupación, así
--      que cada endpoint con scope (inscripciones, kardex, pagos, calificaciones)
--      quedaría en comportamiento indefinido para esa sesión.
--   3. En festival_contactos_global la contraseña ES el número de carnet. Aquí la
--      contraseña es un hash bcrypt de verdad, elegido por la persona. Son dos
--      modelos de credencial distintos y mezclarlos degrada el bueno.
--
-- La membresía se sigue registrando en membresias_videos_2026 con
-- owner_id = cliente_id::text y origen = 'cliente' (habilitado en la 057).
-- El webhook de WooCommerce ya manda p_origen parametrizado, así que no hay que
-- tocar n8n: alcanza con que la orden traiga el meta _origen='cliente'.

CREATE TABLE IF NOT EXISTS public.portal_clientes (
  cliente_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidad: el correo es el usuario. Se guarda tal como lo escribió la
  -- persona (para mostrarlo y para escribirle), pero la unicidad va sobre la
  -- versión en minúsculas: nadie debería poder registrar Ana@x.com y ana@x.com
  -- como dos cuentas.
  email               text NOT NULL,
  password_hash       text NOT NULL,

  nombre              text NOT NULL,
  telefono            text,

  -- Verificación de correo: se deja lista pero apagada. Si más adelante se
  -- exige, no hace falta migrar nada.
  email_verificado    boolean NOT NULL DEFAULT false,

  -- Recuperación de contraseña. Se guarda el HASH del token, no el token: si
  -- alguien llegara a leer la tabla, no puede usar los enlaces pendientes.
  reset_token_hash    text,
  reset_token_expira  timestamptz,

  ultimo_login_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT portal_clientes_email_formato CHECK (position('@' in email) > 1),
  CONSTRAINT portal_clientes_nombre_no_vacio CHECK (length(btrim(nombre)) > 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS portal_clientes_email_lower_key
  ON public.portal_clientes (lower(btrim(email)));

-- Para buscar la cuenta desde el enlace de recuperación sin recorrer la tabla.
CREATE INDEX IF NOT EXISTS portal_clientes_reset_token_idx
  ON public.portal_clientes (reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;

-- Nadie entra por PostgREST: el login de clientes es PHP con service_role, igual
-- que el de participantes. Con RLS encendida y CERO policies, ni anon ni
-- authenticated pueden leer ni escribir aunque algún día alguien les devuelva el
-- GRANT por error. Es la segunda cerradura, no la única.
ALTER TABLE public.portal_clientes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.portal_clientes FROM anon, authenticated;
GRANT ALL ON public.portal_clientes TO service_role;

COMMENT ON TABLE public.portal_clientes IS
  'Cuentas del público general que compra la membresía de videos (no participan del festival). '
  'Credencial propia: correo + bcrypt. La membresía va en membresias_videos_2026 con origen=cliente.';
