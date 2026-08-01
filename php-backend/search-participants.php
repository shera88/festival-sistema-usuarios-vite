<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');

$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
if (strlen($q) < 1) {
    sendJson([]);
    exit;
}

$rows = supabase()->rpc('search_login_users', ['p_query' => $q]);

// Además del RPC (nombre/carnet/teléfono), búsqueda por AGRUPACIÓN: contactos
// cuya agrupación matchee el texto. Merge + dedupe por id_contacto.
$porAgrupacion = supabase()->selectRaw(
    'festival_contactos_global',
    'select=id_contacto,numero_de_carnet,nombre_y_apellido,telefono,correo_electronico,ciudad,imagen_contacto,id_agrupacion,nombre_agrupacion,enlace_del_logo,rol_primario,es_representante,es_director,es_coreografo,id_original_representante,id_original_director,id_original_coreografo'
    . '&nombre_agrupacion=ilike.' . rawurlencode('*' . $q . '*')
    . '&limit=15'
);

$vistos = [];
foreach ($rows as $r) {
    $id = (string)($r['id_contacto'] ?? '');
    if ($id !== '') $vistos[$id] = true;
}
foreach ($porAgrupacion as $r) {
    $id = (string)($r['id_contacto'] ?? '');
    if ($id === '' || isset($vistos[$id])) continue;
    $vistos[$id] = true;
    $rows[] = $r;
}

$normalized = array_map(function ($c) {
    return [
        'id'                          => $c['id_contacto'] ?? null,
        'id_contacto'                 => $c['id_contacto'] ?? null,
        'nombre'                      => $c['nombre_y_apellido'] ?? null,
        'carnet'                      => $c['numero_de_carnet'] ?? null,
        'telefono'                    => $c['telefono'] ?? null,
        'email'                       => $c['correo_electronico'] ?? null,
        'ciudad'                      => $c['ciudad'] ?? null,
        'rol'                         => $c['rol_primario'] ?? null,
        'foto'                        => $c['imagen_contacto'] ?? null,
        'id_agrupacion'               => $c['id_agrupacion'] ?? null,
        'nombre_agrupacion'           => $c['nombre_agrupacion'] ?? null,
        'enlace_del_logo'             => $c['enlace_del_logo'] ?? null,
        'es_representante'            => $c['es_representante'] ?? false,
        'es_director'                 => $c['es_director'] ?? false,
        'es_coreografo'               => $c['es_coreografo'] ?? false,
        'id_original_representante'   => $c['id_original_representante'] ?? null,
        'id_original_director'        => $c['id_original_director'] ?? null,
        'id_original_coreografo'      => $c['id_original_coreografo'] ?? null,
    ];
}, $rows);

sendJson($normalized);
