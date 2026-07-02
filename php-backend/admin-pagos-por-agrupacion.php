<?php
/**
 * GET /admin-pagos-por-agrupacion.php   (solo admin de pagos)
 * Registros agrupados por agrupación: deuda + recaudado + saldo + #pagos.
 * Devuelve: { agrupaciones: [ {id_agrupacion, nombre_agrupacion, enlace_del_logo,
 *            total_deuda, pagado_verificado, pagado_pendiente, saldo, n_pagos} ] }
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');
requireAdmin();

$filas = supabase()->rpc('admin_pagos_por_agrupacion', []);
sendJson(['agrupaciones' => $filas]);
