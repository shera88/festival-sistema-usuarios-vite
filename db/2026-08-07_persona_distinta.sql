-- Marca "persona distinta" en el kardex (2026-08-07)
--
-- Problema: el cobro de credenciales cuenta personas deduplicando por CI. Cuando un
-- profesor carga a sus alumnos con su propio carnet, esas personas cuentan como una
-- sola y se cobran de menos. Ej: BALLET DEL ADULTO MAYOR tiene 33 personas y se le
-- cobran 23, porque 11 comparten el CI 5007347 de la directora.
--
-- Solucion elegida: NO cambiar el criterio automaticamente (eso reabriria deuda ya
-- pagada a 21 agrupaciones de golpe). En su lugar, una marca explicita por registro:
-- el encargado confirma "esta si es otra persona" y recien ahi se contabiliza.
--
-- Con la columna en false (default, y estado de TODAS las filas al aplicar esto) el
-- conteo es EXACTAMENTE el de hoy: cero impacto hasta que alguien marque algo.

alter table public.registro_kardex_2026
  add column if not exists persona_distinta boolean not null default false;

comment on column public.registro_kardex_2026.persona_distinta is
  'true = confirmado manualmente que es otra persona pese a compartir el CI; se cuenta aparte para credenciales.';

-- La vista se reproduce carácter por carácter desde su definicion vigente, cambiando
-- unicamente el CTE personas_kardex (respaldo en _backups-bd/deudas-credenciales-20260807/).
create or replace view public.deudas_2026 as
 WITH agr_con_convenio AS (
         SELECT DISTINCT recepcion_convenio_2026.id_agrupacion
           FROM recepcion_convenio_2026
        ), bailarines_por_agr AS (
         SELECT registro_de_inscripcion_2026.id_agrupacion,
            sum(COALESCE(registro_de_inscripcion_2026.cantidad, 0))::integer AS suma
           FROM registro_de_inscripcion_2026
          WHERE registro_de_inscripcion_2026.id_agrupacion IS NOT NULL
          GROUP BY registro_de_inscripcion_2026.id_agrupacion
        ), personas_kardex AS (
         SELECT registro_kardex_2026.id_agrupacion,
            (count(DISTINCT registro_kardex_2026.ci) FILTER (WHERE registro_kardex_2026.ci IS NOT NULL AND registro_kardex_2026.ci <> 0 AND NOT COALESCE(registro_kardex_2026.persona_distinta, false)) + count(*) FILTER (WHERE registro_kardex_2026.ci IS NULL OR registro_kardex_2026.ci = 0 OR COALESCE(registro_kardex_2026.persona_distinta, false)))::integer AS personas
           FROM registro_kardex_2026
          WHERE registro_kardex_2026.id_agrupacion IS NOT NULL
          GROUP BY registro_kardex_2026.id_agrupacion
        ), agr_con_pago_credencial AS (
         SELECT DISTINCT pagos_2026.id_agrupacion
           FROM pagos_2026
          WHERE pagos_2026.id_agrupacion IS NOT NULL AND (pagos_2026.concepto = ANY (ARRAY['credencial'::text, 'credencial_unit'::text, 'credencial_unitaria'::text]))
        ), compromisos AS (
         SELECT ri.id_agrupacion,
            'por_participante'::text AS concepto,
            ri.id_inscripcion AS id_referencia,
            ri.nombre_de_la_obra AS descripcion,
            ri.nombre_de_la_obra AS obra,
            ri.subdivision,
            ri.cantidad AS bailarines,
            precio_subdivision(ri.subdivision) * COALESCE(ri.cantidad, 0)::numeric AS monto_total
           FROM registro_de_inscripcion_2026 ri
          WHERE ri.id_agrupacion IS NOT NULL AND NOT (ri.id_agrupacion IN ( SELECT agr_con_convenio.id_agrupacion
                   FROM agr_con_convenio))
        UNION ALL
         SELECT rc.id_agrupacion,
            'pre_venta'::text,
            rc.id_convenio,
            rc.cantidad_entradas || ' entradas pre-venta'::text,
            ins.nombre_de_la_obra AS obra,
            NULL::text,
            NULL::integer,
            rc.monto_total
           FROM recepcion_convenio_2026 rc
             LEFT JOIN registro_de_inscripcion_2026 ins ON ins.id_inscripcion = rc.id_inscripcion
        UNION ALL
         SELECT agr.id_agrupacion,
            'credencial'::text,
            'cred-'::text || agr.id_agrupacion AS id_referencia,
            agr.cantidad || ' credenciales'::text AS descripcion,
            NULL::text AS obra,
            NULL::text,
            agr.cantidad AS bailarines,
            agr.cantidad::numeric * COALESCE(cc.precio_unitario, 15::numeric) AS monto_total
           FROM ( SELECT u.id_agrupacion,
                    COALESCE(pk.personas, 0) AS cantidad
                   FROM ( SELECT bailarines_por_agr.id_agrupacion
                           FROM bailarines_por_agr
                          WHERE bailarines_por_agr.suma > 0
                        UNION
                         SELECT personas_kardex.id_agrupacion
                           FROM personas_kardex
                          WHERE personas_kardex.personas > 0
                        UNION
                         SELECT agr_con_pago_credencial.id_agrupacion
                           FROM agr_con_pago_credencial) u
                     LEFT JOIN personas_kardex pk ON pk.id_agrupacion = u.id_agrupacion) agr
             LEFT JOIN compromisos_credenciales_2026 cc ON cc.id_agrupacion = agr.id_agrupacion
        )
 SELECT c.id_agrupacion,
    c.concepto,
    c.id_referencia,
    c.descripcion,
    c.subdivision,
    c.bailarines,
    c.monto_total,
    COALESCE(sum(p.monto) FILTER (WHERE p.estado = 'verificado'::text), 0::numeric) AS pagado_verificado,
    COALESCE(sum(p.monto) FILTER (WHERE p.estado = 'enviado'::text), 0::numeric) AS pagado_pendiente,
    GREATEST(c.monto_total - COALESCE(sum(p.monto) FILTER (WHERE p.estado = 'verificado'::text), 0::numeric), 0::numeric) AS saldo,
    c.obra
   FROM compromisos c
     LEFT JOIN pagos_2026 p ON p.concepto = c.concepto AND (p.id_referencia = c.id_referencia OR c.concepto = 'pre_venta'::text AND p.id_convenio = c.id_referencia OR c.concepto = 'por_participante'::text AND p.id_inscripcion = c.id_referencia)
  GROUP BY c.id_agrupacion, c.concepto, c.id_referencia, c.descripcion, c.obra, c.subdivision, c.bailarines, c.monto_total;;
