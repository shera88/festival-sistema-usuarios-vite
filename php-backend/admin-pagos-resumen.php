<?php
/**
 * GET /admin-pagos-resumen.php   (solo admin de pagos)
 * Recaudado por concepto. Devuelve:
 *   { resumen: [{ concepto, n_pagos, total_verificado, total_pendiente, total_rechazado }] }
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');
requireAdmin();

// RETURNS TABLE -> PostgREST devuelve array de filas, rpc() funciona OK aquí.
$filas = supabase()->rpc('admin_recaudado_resumen', []);
sendJson(['resumen' => $filas]);
