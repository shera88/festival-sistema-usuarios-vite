<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2025'));
if (!in_array($year, ['2023', '2024', '2025'], true)) {
    sendJson([$year => []]);
    exit;
}

$filter = buildContextFilter($user);
if (!$filter) { sendJson([$year => []]); exit; }

$insc = supabase()->selectRaw(
    "registro_de_inscripcion_$year",
    $filter . "&select=id_inscripcion,agrupacion,enlace_del_logo,id_agrupacion,dia,orden,nombre_de_la_obra&limit=200"
);

$idsInsc = array_values(array_filter(array_column($insc, 'id_inscripcion')));
if (count($idsInsc) === 0) { sendJson([$year => []]); exit; }

$inscMap = [];
foreach ($insc as $i) $inscMap[$i['id_inscripcion']] = $i;

$inFilter = buildInFilter('id_inscripcion', $idsInsc);
$notas = supabase()->selectRaw("recepcion_notas_$year", "$inFilter&select=*&limit=2000");
if (count($notas) === 0) { sendJson([$year => []]); exit; }

$idsJurado = array_values(array_unique(array_filter(array_column($notas, 'id_jurado'))));
$jurados = [];
if (count($idsJurado) > 0) {
    $jFilter = buildInFilter('id_jurado', $idsJurado);
    $jurados = supabase()->selectRaw(
        "jurados_consolidado",
        "$jFilter&select=id_jurado,nombre_y_apellido,foto,genero_a_calificar&limit=100"
    );
}
$juradosMap = [];
foreach ($jurados as $j) $juradosMap[$j['id_jurado']] = $j;

$enriched = array_map(function ($n) use ($inscMap, $juradosMap) {
    $i = $inscMap[$n['id_inscripcion']] ?? [];
    $j = $juradosMap[$n['id_jurado'] ?? ''] ?? [];
    return array_merge($n, [
        'jurado_foto'     => $j['foto'] ?? null,
        'jurado_nombre'   => $j['nombre_y_apellido'] ?? ($n['jurado'] ?? 'Jurado'),
        'jurado_generos'  => $j['genero_a_calificar'] ?? null,
        'inst_logo'       => $i['enlace_del_logo'] ?? null,
        'inst_nombre'     => $i['agrupacion'] ?? ($n['agrupacion'] ?? null),
        'insc_dia'        => $i['dia'] ?? ($n['dia'] ?? null),
        'insc_orden'      => $i['orden'] ?? null,
        'insc_obra'       => $i['nombre_de_la_obra'] ?? null,
    ]);
}, $notas);

sendJson([$year => $enriched]);
