-- 057_membresia_origen_cliente.sql
--
-- Permite que una membresía venga de un CLIENTE de público general, además de
-- 'contacto' (participante) y 'kardex' (bailarín).
--
-- Por qué antes de vender nada: el CHECK vigente es origen IN ('contacto','kardex').
-- El webhook de WooCommerce ya manda p_origen parametrizado
-- (`p_origen: meta._origen || 'contacto'` en el nodo "Map Order -> RPC" del
-- workflow OA9SKhCmfiCbyMtd), así que en cuanto una orden traiga _origen='cliente'
-- el INSERT de marcar_membresia_paquete_2026 fallaría con 23514 DENTRO de n8n:
-- WooCommerce cobra igual y la membresía nunca se marca. El comprador paga y no
-- ve nada, y el error no aparece en ningún lado del portal.
--
-- Ensanchar un CHECK no invalida filas existentes: las 97 actuales son
-- 'kardex' (51) y 'contacto' (46), ambas siguen permitidas.
-- Respaldo previo: backups/2026-08-29-fase0b/membresias_videos_2026_ANTES.csv
--
-- La RPC no necesita cambios: id_kardex ya es opcional (NULLIF -> NULL) y el
-- UPDATE de registro_kardex_2026 sólo corre si ese id viene, así que una fila de
-- cliente entra sin tocar nada del mundo de participantes.

BEGIN;

ALTER TABLE public.membresias_videos_2026
  DROP CONSTRAINT membresias_videos_2026_origen_check;

ALTER TABLE public.membresias_videos_2026
  ADD CONSTRAINT membresias_videos_2026_origen_check
  CHECK (origen = ANY (ARRAY['contacto'::text, 'kardex'::text, 'cliente'::text]));

COMMIT;
