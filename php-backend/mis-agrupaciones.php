<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');
$user = requireAuth();

// Cache de sesión (TTL 10 min) — el historial cambia poco
const CACHE_TTL = 600;
$cacheKey = 'mis_agrupaciones_v2_' . ($user['id_contacto'] ?? '');
if (!isset($_GET['nocache'])) {
    $cached = $_SESSION[$cacheKey] ?? null;
    if (is_array($cached) && ($cached['ts'] ?? 0) > time() - CACHE_TTL) {
        sendJson($cached['list']);
        exit;
    }
}

// Las tablas ≤2025 no tienen id_contacto; 2026 sí. Filtro por año para no perder
// agrupaciones ligadas al representante solo por id_contacto (mismo criterio que kardex/inscripciones).
$filterBase = buildContextFilter($user);         // históricas (sin id_contacto)
$filter2026 = buildContextFilter($user, true);   // 2026 (con id_contacto)
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

// 1) Inscripciones donde el user es encargado/director/coreógrafo/contacto — paralelo
$batch = [];
foreach ($years as $y) {
    $fy = ((int)$y >= 2026) ? $filter2026 : $filterBase;
    if ($fy === null) continue;
    $batch[] = [
        'table' => "registro_de_inscripcion_$y",
        'qs'    => $fy . '&select=id_agrupacion,agrupacion,enlace_del_logo&limit=2000',
        '_year' => $y,
    ];
}
if ($batch) {
    $results = supabase()->selectRawBatch($batch);
    foreach ($batch as $i => $b) {
        foreach (($results[$i] ?? []) as $r) {
            $track(
                (string)($r['id_agrupacion'] ?? ''),
                (string)($r['agrupacion'] ?? ''),
                $r['enlace_del_logo'] ?? null,
                $b['_year']
            );
        }
    }
}

// Aseguro agrupación primary del user
foreach (parseIdCsv($user['id_agrupacion'] ?? '') as $id) {
    if (!isset($agg[$id])) {
        $agg[$id] = [
            'id_agrupacion'     => $id,
            'nombre_agrupacion' => '',
            'enlace_del_logo'   => null,
            'ciudad'            => null,
            'count'             => 0,
            'years'             => [],
            'last_year'         => null,
        ];
    }
}

// Hidrato ciudad + logo CANÓNICO desde instituciones (siempre, override).
// Esto soluciona casos donde inscripciones tienen URL muerta de Elementor.
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
                // Logo canónico de instituciones siempre prima
                if (!empty($r['enlace_del_logo'])) {
                    $agg[$id]['enlace_del_logo'] = $r['enlace_del_logo'];
                }
            }
        }
    }
}

// Orden: count desc, luego last_year desc, luego nombre asc
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
