<?php
/**
 * GET /pagos-resumen.php
 *   ?id_agrupacion=<opt>   (default: primera del user)
 *
 * Devuelve:
 *   {
 *     id_agrupacion,
 *     nombre_agrupacion,
 *     compromisos: [...],
 *     historial: [...],
 *     totales: { total_deuda, pagado_verificado, pagado_pendiente, saldo },
 *     metodos_pago: [...]
 *   }
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');

$id_agrupacion = trim((string)($_GET['id_agrupacion'] ?? ''));
if ($id_agrupacion === '') {
    $id_agrupacion = $userAgrups[0] ?? '';
}
if ($id_agrupacion === '') {
    sendJson(['error' => 'Sin agrupación'], 400);
    exit;
}
if (!in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado para esta agrupación'], 403);
    exit;
}

$sb = supabase();

// 1) Resumen compromisos via RPC
$compromisos = $sb->rpc('pagos_resumen_agrupacion', ['p_id_agrupacion' => $id_agrupacion]);

// 2) Historial pagos via RPC
$historial = $sb->rpc('pagos_historial_agrupacion', ['p_id_agrupacion' => $id_agrupacion]);

// 3) Datos agrupación
$inst = $sb->selectOne(
    'instituciones',
    'id_agrupacion,nombre_agrupacion,enlace_del_logo',
    ['id_agrupacion' => "eq.$id_agrupacion"]
);

// 4) Metodos pago activos
$metodos = $sb->selectRaw(
    'metodos_de_pago_2026',
    'select=id_metodo,metodo&activo=eq.true&order=metodo'
);

// 5) Totales agregados
$total_deuda = 0; $pagado_verif = 0; $pagado_pend = 0; $saldo = 0;
foreach ($compromisos as $c) {
    $total_deuda += (float)($c['monto_total'] ?? 0);
    $pagado_verif += (float)($c['pagado_verificado'] ?? 0);
    $pagado_pend += (float)($c['pagado_pendiente'] ?? 0);
    $saldo += (float)($c['saldo'] ?? 0);
}

sendJson([
    'id_agrupacion'    => $id_agrupacion,
    'nombre_agrupacion'=> $inst['nombre_agrupacion'] ?? '',
    'enlace_del_logo'  => $inst['enlace_del_logo'] ?? null,
    'compromisos'      => $compromisos,
    'historial'        => $historial,
    'totales'          => [
        'total_deuda'       => $total_deuda,
        'pagado_verificado' => $pagado_verif,
        'pagado_pendiente'  => $pagado_pend,
        'saldo'             => $saldo,
    ],
    'metodos_pago'     => $metodos,
]);
