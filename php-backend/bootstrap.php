<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();

$logos = supabase()->selectRaw(
    'instituciones',
    'enlace_del_logo=not.is.null&select=nombre_agrupacion,enlace_del_logo&limit=1000'
);
$logosMap = [];
foreach ($logos as $i) {
    $key = mb_strtolower(trim($i['nombre_agrupacion'] ?? ''));
    if ($key !== '' && !empty($i['enlace_del_logo']) && empty($logosMap[$key])) {
        $logosMap[$key] = $i['enlace_del_logo'];
    }
}

$institucion = null;
$ids = parseIdCsv($user['id_agrupacion'] ?? '');
if (count($ids) > 0) {
    $row = supabase()->select('instituciones', [
        'id_agrupacion' => 'eq.' . $ids[0],
        'select'        => '*',
        'limit'         => 1,
    ]);
    $institucion = $row[0] ?? null;
}

sendJson([
    'user'        => $user,
    'institucion' => $institucion,
    'logosMap'    => $logosMap,
]);
