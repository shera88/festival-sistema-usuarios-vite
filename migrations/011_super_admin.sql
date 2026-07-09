-- ============================================================================
-- 011 — Super Admin (supervisión / impersonación)
-- ----------------------------------------------------------------------------
-- Un super admin puede elegir a cualquier persona y "entrar" a su panel del
-- portal para ver todo lo de esa persona (solo supervisión; la sesión guarda
-- quién es el usuario real). Gatea el endpoint php-backend/impersonar.php.
-- ============================================================================

ALTER TABLE public.admin_usuarios
  ADD COLUMN IF NOT EXISTS super_admin boolean NOT NULL DEFAULT false;

-- Shera Serrano = super admin
UPDATE public.admin_usuarios SET super_admin = true WHERE usuario = 'shera';
