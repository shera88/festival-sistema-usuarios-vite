<?php
/**
 * GET /admin-pagos-recientes.php?limit=&estado=&concepto=   (solo admin de pagos)
 * Pagos recientes de TODAS las agrupaciones + datos de facturación + recibo.
 * Devuelve: { pagos: [ {17 columnas de admin_pagos_recientes} ] }
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');
requireAdmin();

$limit    = (int)($_GET['limit'] ?? 100);
$estado   = trim((string)($_GET['estado'] ?? ''));
$concepto = trim((string)($_GET['concepto'] ?? ''));

$ESTADOS   = ['pendiente', 'enviado', 'verificado', 'rechazado', 'anulado'];
$CONCEPTOS = ['inscripcion', 'convenio_entradas', 'credencial', 'credencial_unit'];

$args = [
    'p_limit'    => $limit > 0 ? $limit : 100,
    'p_estado'   => in_array($estado, $ESTADOS, true) ? $estado : null,
    'p_concepto' => in_array($concepto, $CONCEPTOS, true) ? $concepto : null,
];

$filas = supabase()->rpc('admin_pagos_recientes', $args);
sendJson(['pagos' => $filas]);
