<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');
$user = requireAuth();

$idAgrupacion = isset($_GET['id_agrupacion']) ? trim((string)$_GET['id_agrupacion']) : '';
$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';

if ($idAgrupacion === '' && $q === '') {
    sendJson([]);
    exit;
}

// Cache de sesión SOLO para queries de agrupación sin búsqueda global
$cacheKey = null;
if ($idAgrupacion !== '' && $q === '') {
    $cacheKey = 'coreos_v1_' . ($user['id_contacto'] ?? '') . '_' . md5($idAgrupacion);
    if (!isset($_GET['nocache'])) {
        $cached = $_SESSION[$cacheKey] ?? null;
        if (is_array($cached) && ($cached['ts'] ?? 0) > time() - 600) {
            sendJson($cached['list']);
            exit;
        }
    }
}

$years = ['2023', '2024', '2025', '2026'];

/** Acumulador por nombre normalizado */
$agg = [];

$normalize = function (string $s): string {
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = preg_replace('/\s+/u', ' ', $s);
    // Quitar diacríticos básicos
    $from = ['á','é','í','ó','ú','ü','à','è','ì','ò','ù','â','ê','î','ô','û','ã','õ','ä','ë','ï','ö'];
    $to   = ['a','e','i','o','u','u','a','e','i','o','u','a','e','i','o','u','a','o','a','e','i','o'];
    return str_replace($from, $to, $s);
};

$track = function (string $idC, string $nombre, ?string $idAg, string $year) use (&$agg, $normalize) {
    $key = $normalize($nombre);
    if ($key === '') return;
    if (!isset($agg[$key])) {
        $agg[$key] = [
            'id_coreografo'      => $idC,
            'nombre_y_apellido'  => $nombre,
            'id_agrupacion'      => $idAg,
            'count'              => 0,
            'last_year'          => null,
            'from_agrupacion'    => false,
        ];
    }
    if (empty($agg[$key]['id_coreografo']) && $idC !== '') {
        $agg[$key]['id_coreografo'] = $idC;
    }
    $agg[$key]['count']++;
    if ($agg[$key]['last_year'] === null || $year > $agg[$key]['last_year']) {
        $agg[$key]['last_year'] = $year;
    }
};

// 1) Coreógrafos de la agrupación seleccionada (prioridad) — paralelo
if ($idAgrupacion !== '') {
    $agFilter = 'id_agrupacion=eq.' . quoteIfNeeded($idAgrupacion);
    $batch = [];
    foreach ($years as $y) {
        $batch[] = [
            'table' => "registro_de_inscripcion_$y",
            'qs'    => $agFilter . '&select=coreografo,id_coreografo&limit=2000',
            '_kind' => 'insc',
            '_year' => $y,
        ];
        $batch[] = [
            'table' => "registro_kardex_$y",
            'qs'    => $agFilter . '&cargo=eq.COREOGRAFO&select=nombre_y_apellido,id_coreografo&limit=2000',
            '_kind' => 'kardex',
            '_year' => $y,
        ];
    }
    $results = supabase()->selectRawBatch($batch);
    foreach ($batch as $i => $b) {
        foreach (($results[$i] ?? []) as $r) {
            $nombre = (string)($r['coreografo'] ?? $r['nombre_y_apellido'] ?? '');
            if ($nombre === '') continue;
            $idC = (string)($r['id_coreografo'] ?? '');
            $track($idC, $nombre, $idAgrupacion, $b['_year']);
            $key = $normalize($nombre);
            if (isset($agg[$key])) $agg[$key]['from_agrupacion'] = true;
        }
    }
}

// 2) Búsqueda global por nombre (si hay q)
if ($q !== '' && strlen($q) >= 2) {
    $qNorm = $normalize($q);
    // Trae filas de tabla coreografos directamente por LIKE
    $rows = supabase()->selectRaw(
        'coreografos',
        'nombre_y_apellido=ilike.*' . rawurlencode($q) . '*&select=id_coreografo,nombre_y_apellido,id_agrupacion&limit=50'
    );
    foreach ($rows as $r) {
        $nombre = (string)($r['nombre_y_apellido'] ?? '');
        if ($nombre === '') continue;
        $key = $normalize($nombre);
        if (!isset($agg[$key])) {
            $agg[$key] = [
                'id_coreografo'      => (string)($r['id_coreografo'] ?? ''),
                'nombre_y_apellido'  => $nombre,
                'id_agrupacion'      => $r['id_agrupacion'] ?? null,
                'count'              => 0,
                'last_year'          => null,
                'from_agrupacion'    => false,
            ];
        }
    }
}

// Filtrar por q si presente (sobre la lista ya construida)
$list = array_values($agg);
if ($q !== '') {
    $qNorm = $normalize($q);
    $list = array_values(array_filter($list, fn($x) => str_contains($normalize($x['nombre_y_apellido']), $qNorm)));
}

// Orden: prioridad de la agrupación primero, luego count desc, luego nombre asc
usort($list, function ($a, $b) {
    if ($a['from_agrupacion'] !== $b['from_agrupacion']) {
        return $b['from_agrupacion'] <=> $a['from_agrupacion'];
    }
    if ($a['count'] !== $b['count']) return $b['count'] <=> $a['count'];
    return strcmp((string)$a['nombre_y_apellido'], (string)$b['nombre_y_apellido']);
});

$list = array_slice($list, 0, 100);
if ($cacheKey !== null) {
    $_SESSION[$cacheKey] = ['ts' => time(), 'list' => $list];
}
sendJson($list);
