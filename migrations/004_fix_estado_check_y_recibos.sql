-- 004_fix_estado_check_y_recibos.sql
-- Ejecutar en Supabase SQL Editor

-- 1) Drop check constraint viejo y recrear con los 5 estados que usa la app
ALTER TABLE public.pagos_2026 DROP CONSTRAINT IF EXISTS pagos_2026_estado_check;
ALTER TABLE public.pagos_2026 ADD CONSTRAINT pagos_2026_estado_check
  CHECK (estado IN ('pendiente','enviado','verificado','rechazado','anulado'));

-- 2) Columna recibo_pdf_url + verificado_en + verificado_por (para tracking)
ALTER TABLE public.pagos_2026 ADD COLUMN IF NOT EXISTS recibo_pdf_url text;
ALTER TABLE public.pagos_2026 ADD COLUMN IF NOT EXISTS verificado_en  timestamptz;
ALTER TABLE public.pagos_2026 ADD COLUMN IF NOT EXISTS verificado_por text;

-- 3) Tabla recibos_emitidos (audit log)
CREATE TABLE IF NOT EXISTS public.recibos_emitidos (
  id_recibo            text PRIMARY KEY,
  id_pago              text NOT NULL REFERENCES public.pagos_2026(id_pago) ON DELETE CASCADE,
  numero_recibo        text NOT NULL,
  concepto             text NOT NULL,
  id_referencia        text NOT NULL,
  id_agrupacion        text,
  agrupacion           text,
  nombre_pagador       text,
  ci_pagador           text,
  telefono_pagador     text,
  nombre_obra          text,
  monto                numeric NOT NULL,
  monto_total          numeric,
  saldo_anterior       numeric,
  saldo_nuevo          numeric,
  metodo_pago          text,
  pdf_url              text,
  pdf_bytes            integer,
  generado_en          timestamptz NOT NULL DEFAULT now(),
  generado_por         text
);
CREATE INDEX IF NOT EXISTS idx_recibos_id_pago      ON public.recibos_emitidos(id_pago);
CREATE INDEX IF NOT EXISTS idx_recibos_agrupacion   ON public.recibos_emitidos(id_agrupacion);
CREATE INDEX IF NOT EXISTS idx_recibos_concepto_ref ON public.recibos_emitidos(concepto, id_referencia);

-- 4) Grants
GRANT SELECT ON public.recibos_emitidos TO anon, authenticated;

-- 5) Marcar los 3 pagos de SHERA PRUEBA como verificado (test)
UPDATE public.pagos_2026
   SET estado = 'verificado',
       verificado_en = now(),
       verificado_por = 'TEST_MANUAL'
 WHERE id_referencia = 'f1df6e0b'
   AND concepto = 'inscripcion'
   AND estado = 'enviado';

-- Verificación
SELECT id_pago, monto, estado, verificado_en
  FROM public.pagos_2026
 WHERE id_referencia = 'f1df6e0b';
