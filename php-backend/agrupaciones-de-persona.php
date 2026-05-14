<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');
$user = requireAuth();

$idContacto = isset($_GET['id_contacto']) ? trim((string)$_GET['id_contacto']) : '';
if ($idContacto === '') {
    sendJson([]);
    exit;
}

// Si es el mismo user logueado → delega a mis-agrupaciones (ya cacheado)
if ($idContacto === ($user['id_contacto'] ?? '')) {
    // Importa la lógica de mis-agrupaciones para reusar cache
    $cacheKey = 'mis_agrupaciones_v2_' . $idContacto;
    $cached = $_SESSION[$cacheKey] ?? null;
    if (is_array($cached)) {
        sendJson($cached['list'] ?? []);
        exit;
    }
}

// Cache por id_contacto
$cacheKey = 'agrups_de_persona_v1_' . md5($idContacto);
if (!isset($_GET['nocache'])) {
    $cached = $_SESSION[$cacheKey] ?? null;
    if (is_array($cached) && ($cached['ts'] ?? 0) > time() - 600) {
        sendJson($cached['list']);
        exit;
    }
}

// 1) Obtener CI de la persona
$persona = supabase()->rpc('obtener_contacto_por_id', ['p_id' => $idContacto]);
$personaRow = (is_array($persona) && isset($persona[0])) ? $persona[0] : null;
$ci = $personaRow ? trim((string)($personaRow['numero_de_carnet'] ?? '')) : '';

$years = ['2023', '2024', '2025', '2026'];
$agg = [];

$track = function (string $id, string $nombre, ?string $logo, string $y) use (&$agg) {
    if (!$id) return;
    if (!isset($agg[$id])) {
        $agg[$id] = [
            'id_agrupacion'     => $id,
            'nombre_agrupacion' => $nombre,
            'enlace_del_logo'   => $logo,
            'ciudad'            => null,
            'count'             => 0,
            'years'             => [],
            'last_year'         => null,
        ];
    }
    if (empty($agg[$id]['enlace_del_logo']) && !empty($logo)) {
        $agg[$id]['enlace_del_logo'] = $logo;
    }
    if (empty($agg[$id]['nombre_agrupacion']) && !empty($nombre)) {
        $agg[$id]['nombre_agrupacion'] = $nombre;
    }
    $agg[$id]['count']++;
    $agg[$id]['years'][$y] = true;
    if ($agg[$id]['last_year'] === null || $y > $agg[$id]['last_year']) {
        $agg[$id]['last_year'] = $y;
    }
};

// 2) Buscar agrupaciones de la persona en kardex (cualquier cargo) e inscripciones por nombre+id
if ($ci !== '') {
    $batch = [];
    foreach ($years as $y) {
        $batch[] = [
            'table' => "registro_kardex_$y",
            'qs'    => 'ci=eq.' . quoteIfNeeded($ci) . '&select=id_agrupacion,agrupacion&limit=2000',
            '_year' => $y,
        ];
    }
    $results = supabase()->selectRawBatch($batch);
    foreach ($batch as $i => $b) {
        foreach (($results[$i] ?? []) as $r) {
            $track(
                (string)($r['id_agrupacion'] ?? ''),
                (string)($r['agrupacion'] ?? ''),
                null,
                $b['_year']
            );
        }
    }
}

// 3) Hidratar nombre/ciudad/logo CANÓNICO desde instituciones
$allIds = array_keys($agg);
if (count($allIds) > 0) {
    $inFilter = buildInFilter('id_agrupacion', $allIds);
    if ($inFilter !== null) {
        $rows = supabase()->selectRaw(
            'instituciones',
            $inFilter . '&select=id_agrupacion,nombre_agrupacion,ciudad,enlace_del_logo&limit=2000'
        );
        foreach ($rows as $r) {
            $id = $r['id_agrupacion'] ?? null;
            if ($id && isset($agg[$id])) {
                if (!empty($r['nombre_agrupacion'])) {
                    $agg[$id]['nombre_agrupacion'] = $r['nombre_agrupacion'];
                }
                if (!empty($r['ciudad'])) {
                    $agg[$id]['ciudad'] = $r['ciudad'];
                }
                if (!empty($r['enlace_del_logo'])) {
                    $agg[$id]['enlace_del_logo'] = $r['enlace_del_logo'];
                }
            }
        }
    }
}

$list = array_values($agg);
usort($list, function ($a, $b) {
    if ($a['count'] !== $b['count']) return $b['count'] <=> $a['count'];
    if ($a['last_year'] !== $b['last_year']) return strcmp((string)$b['last_year'], (string)$a['last_year']);
    return strcmp((string)$a['nombre_agrupacion'], (string)$b['nombre_agrupacion']);
});

foreach ($list as &$x) {
    $x['years'] = array_keys($x['years']);
    sort($x['years']);
}

$_SESSION[$cacheKey] = ['ts' => time(), 'list' => $list];
sendJson($list);
