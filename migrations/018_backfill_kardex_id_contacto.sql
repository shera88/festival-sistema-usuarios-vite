-- 018_backfill_kardex_id_contacto.sql
-- Linkea id_contacto en kardex 2026 que quedaron NULL (persona escrita a mano
-- en el form). Solo para gente que ESTA en contactos global (reps/dir/coreo/
-- solicitantes) y cuyo carnet da UN unico contacto. Bailarines/staff NO estan
-- en contactos global -> no matchean -> quedan NULL (correcto: usan login kardex).
-- Complementa el fix en kardex.php (resuelve id_contacto por CI al insertar).
-- Ejecutado 2026-07-10. Afecto ~10 filas.
UPDATE registro_kardex_2026 k
SET id_contacto = c.id_contacto
FROM festival_contactos_global c
WHERE k.id_contacto IS NULL
  AND k.fecha ILIKE '%2026%'
  AND trim(c.numero_de_carnet) = k.ci::text
  AND (
    SELECT count(*) FROM festival_contactos_global c2
    WHERE trim(c2.numero_de_carnet) = k.ci::text
  ) = 1;
