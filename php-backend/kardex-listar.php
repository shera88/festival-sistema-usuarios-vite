<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if (!in_array($year, ['2023', '2024', '2025', '2026'], true)) {
    sendJson(['error' => 'Año inválido'], 400);
    exit;
}

// id_contacto solo existe en registro_de_inscripcion_2026+ (mismo scope que inscripciones.php).
// Sin este flag, agrupaciones ligadas al representante solo por id_contacto (no por
// id_agrupacion/encargado/director/coreografo) quedaban fuera del seed y su kardex nunca se
// consultaba, aunque tuvieran integrantes cargados.
$filter = buildContextFilter($user, (int)$year >= 2026);
if (!$filter) { sendJson([$year => []]); exit; }

$insc = supabase()->selectRaw(
    "registro_de_inscripcion_$year",
    $filter . "&select=agrupacion,id_agrupacion,enlace_del_logo&limit=200"
);

$agrupNames = array_values(array_unique(array_filter(array_column($insc, 'agrupacion'))));
$agrupIds   = array_values(array_unique(array_filter(array_column($insc, 'id_agrupacion'))));

if (count($agrupNames) === 0 && count($agrupIds) === 0) {
    sendJson([$year => []]);
    exit;
}

$logoByName = [];
foreach ($insc as $i) {
    $key = mb_strtolower(trim($i['agrupacion'] ?? ''));
    if ($key !== '' && !empty($i['enlace_del_logo']) && empty($logoByName[$key])) {
        $logoByName[$key] = $i['enlace_del_logo'];
    }
}

$conditions = [];
foreach ($agrupNames as $n) $conditions[] = 'agrupacion.eq.' . quoteIfNeeded($n);
foreach ($agrupIds as $id)  $conditions[] = 'id_agrupacion.eq.' . quoteIfNeeded($id);
$kardexFilter = 'or=(' . implode(',', $conditions) . ')';

$kardex = supabase()->selectRaw(
    "registro_kardex_$year",
    "$kardexFilter&select=*&limit=1000"
);

$enriched = array_map(function ($k) use ($logoByName) {
    $key = mb_strtolower(trim($k['agrupacion'] ?? ''));
    $k['enlace_del_logo'] = $logoByName[$key] ?? null;
    return $k;
}, $kardex);

sendJson([$year => $enriched]);
