-- ============================================================================
-- MIGRACIÓN 013 — Super admins: Briza, Yacu, Sami (ADITIVA, no destructiva)
-- Ejecutar en Supabase Studio SQL Editor.
--
-- super_admin (admin_usuarios) habilita la SUPERVISIÓN en el portal (entrar al
-- panel de cualquier persona) + el bypass de permisos en los endpoints kardex.
-- El login del super admin en el portal es por su carnet (RPC validate_login),
-- NO por clave_hash (esa columna es el login legacy usuario/clave).
--
--  • Briza Terrazas  (ed975b5d-…) y Yacu Serrano (68a8fb8c-…) YA están en
--    admin_usuarios → sólo se eleva super_admin=true.
--  • Sami Serrano (coreógrafo, carnet 13711835, id_contacto a8b6e83e-…) NO
--    estaba → se inserta. clave_hash = bcrypt del carnet (login legacy opcional).
-- ============================================================================
BEGIN;

-- 1) Elevar a super admin a los admins existentes.
UPDATE public.admin_usuarios
   SET super_admin = true
 WHERE lower(usuario) IN ('briza', 'yacu');

-- 2) Sami Serrano — nuevo admin/super admin.
INSERT INTO public.admin_usuarios (usuario, clave_hash, nombre, activo, super_admin, id_contacto)
VALUES ('sami',
        '$2a$06$TO6L9I509Pub4bSDbcNFqulG3RH7nKdx9eSwU/djs2kbAGhFvCzKq',
        'Sami', true, true,
        'a8b6e83e-faf6-4d28-b0ac-af0574172cdb')
ON CONFLICT (id_contacto) WHERE id_contacto IS NOT NULL
DO UPDATE SET super_admin = true, activo = true;

COMMIT;

-- ============================================================================
-- VERIFICAR (correr suelto tras el COMMIT):
--   SELECT usuario, nombre, id_contacto, activo, super_admin
--   FROM admin_usuarios ORDER BY usuario;
--   -- briza, yacu, shera, sami  →  super_admin = true, activo = true
-- ============================================================================
