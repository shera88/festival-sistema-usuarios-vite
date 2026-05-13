<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$filter = buildContextFilter($user);
if (!$filter) { sendJson(new stdClass()); exit; }

$years = ['2023', '2024', '2025', '2026'];
$select = 'id_inscripcion,orden,dia,agrupacion,enlace_del_logo,nombre_de_la_obra,url_video,categoria,division,subdivision,modalidad,coreografo,director,bloque,genero';

$results = [];
foreach ($years as $year) {
    $qs = $filter . "&url_video=not.is.null&select=$select&limit=200";
    $rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);
    if (count($rows) > 0) $results[$year] = $rows;
}

sendJson($results ?: new stdClass());
