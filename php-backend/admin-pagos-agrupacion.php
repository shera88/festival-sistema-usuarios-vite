<?php
/**
 * GET /admin-pagos-agrupacion.php?id_agrupacion=<id>   (solo admin de pagos)
 * Detalle de UNA agrupación: sus inscripciones/deudas + historial de pagos
 * (con fecha y hora). Reusa las mismas RPCs que el resumen del participante,
 * pero un admin puede consultar CUALQUIER agrupación.
 * Devuelve: { agrupacion, compromisos: [...], historial: [...] }
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');
requireAdmin();

$id = trim((string)($_GET['id_agrupacion'] ?? ''));
if ($id === '') {
    sendJson(['error' => 'Falta id_agrupacion'], 400);
    exit;
}

$sb = supabase();
// 2 RPCs (~0.6s c/u). El front ya tiene nombre/logo de la fila clickeada, así que
// NO consultamos instituciones (un round-trip menos).
$compromisos = $sb->rpc('pagos_resumen_agrupacion', ['p_id_agrupacion' => $id]);
$historial   = $sb->rpc('pagos_historial_agrupacion', ['p_id_agrupacion' => $id]);

sendJson([
    'agrupacion'  => null,
    'compromisos' => $compromisos,
    'historial'   => $historial,
]);
