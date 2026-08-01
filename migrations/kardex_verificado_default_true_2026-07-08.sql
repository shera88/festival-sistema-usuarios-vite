-- ============================================================================
-- Kardex: verificado (check) por DEFECTO = true
-- ----------------------------------------------------------------------------
-- Pedido: que todos los credenciales arranquen con el check activo; el coreógrafo
-- solo DESmarca las excepciones, elimina, y cierra la agrupación como completa.
--
--   • ALTER DEFAULT true  → los kardex NUEVOS entran verificados.
--   • UPDATE false→true   → los ~4803 existentes en false pasan a verificados.
--
-- No requiere cambios de código: el switch del portal lee `verificado` (ahora
-- true → ON), gestión muestra "✓ Aprobado", y agrupacion-cerrar.php valida
-- `verificado = false` (ahora ninguno) → cerrar pasa. Al DESmarcar uno se escribe
-- false y vuelve a bloquear el cierre hasta re-marcar o eliminar.
--
-- REVERT: los que estaban en true ANTES de esto están respaldados en
--   backups/verificado_TRUE_pre-backfill_2026-07-08.csv
--   Para revertir: UPDATE ... SET verificado=false;  luego marcar true solo esos.
-- ============================================================================

ALTER TABLE public.registro_kardex_2026 ALTER COLUMN verificado SET DEFAULT true;

UPDATE public.registro_kardex_2026
   SET verificado = true
 WHERE verificado IS DISTINCT FROM true;
