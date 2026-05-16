-- 007_realtime_pagos.sql
-- Habilitar Supabase Realtime para pagos_2026
-- Para que la app reciba notificaciones automáticas cuando el admin verifica/rechaza un pago.

ALTER TABLE public.pagos_2026 REPLICA IDENTITY FULL;

-- Agregar a publication solo si no existe (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pagos_2026'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pagos_2026;
  END IF;
END$$;

NOTIFY pgrst, 'reload schema';
