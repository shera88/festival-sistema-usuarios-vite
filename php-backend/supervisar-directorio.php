<?php
declare(strict_types=1);

/**
 * GET /supervisar-directorio.php — Directorio de personas con rol (solo SUPER admin).
 *
 * Devuelve la lista de personas de festival_contactos_global que tienen algún
 * rol (representante / director / coreógrafo), enriquecida con el día en que
 * se presenta su agrupación (primer `dia` no nulo en registro_de_inscripcion_2026).
 *
 * Se usa en el modal "Supervisar usuario": permite filtrar por cargo y por día
 * sin tener que tipear una búsqueda.
 *
 * El permiso se evalúa sobre el usuario REAL: si la sesión está supervisando a
 * alguien ($_SESSION['real_user']), manda el super admin original — igual que
 * impersonar.php.
 *
 * Respuesta: [{ id_contacto, nombre, telefono, foto, agrupacion, dia, cargos: [] }]
 */

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

requireAuth();

// Solo SUPER admin, evaluado sobre el usuario REAL (soporta supervisión activa).
$real = $_SESSION['real_user'] ?? $_SESSION['user_data'];
$idReal = parseIdCsv(is_array($real) ? ($real['id_contacto'] ?? '') : '')[0] ?? '';
if ($idReal === '' || !esSuperAdmin($idReal)) {
    sendJson(['error' => 'Requiere permisos de super administrador'], 403);
    exit;
}

$sb = supabase();

// Personas con algún rol (representante / director / coreógrafo).
$contactos = $sb->selectRaw(
    'festival_contactos_global',
    'select=id_contacto,nombre_y_apellido,telefono,imagen_contacto,id_agrupacion,nombre_agrupacion,es_representante,es_director,es_coreografo'
    . '&or=(es_representante.eq.true,es_director.eq.true,es_coreografo.eq.true)'
    . '&order=nombre_y_apellido.asc'
    . '&limit=2000'
);

// Mapa id_agrupacion → primer día no nulo (MARTES/MIERCOLES/JUEVES/VIERNES).
$diaByAgrup = [];
$insc = $sb->selectRaw(
    'registro_de_inscripcion_2026',
    'select=id_agrupacion,dia&dia=not.is.null&limit=5000'
);
foreach ($insc as $i) {
    $aid = trim((string)($i['id_agrupacion'] ?? ''));
    $dia = trim((string)($i['dia'] ?? ''));
    if ($aid === '' || $dia === '') continue;
    if (!isset($diaByAgrup[$aid])) $diaByAgrup[$aid] = $dia;
}

$out = [];
foreach ($contactos as $c) {
    $cargos = [];
    if (!empty($c['es_representante'])) $cargos[] = 'REPRESENTANTE';
    if (!empty($c['es_director']))      $cargos[] = 'DIRECTOR';
    if (!empty($c['es_coreografo']))    $cargos[] = 'COREOGRAFO';

    // id_agrupacion puede venir como CSV → primer id con día conocido.
    $dia = null;
    foreach (parseIdCsv($c['id_agrupacion'] ?? '') as $aid) {
        if (isset($diaByAgrup[$aid])) {
            $dia = $diaByAgrup[$aid];
            break;
        }
    }

    $out[] = [
        'id_contacto' => $c['id_contacto'] ?? null,
        'nombre'      => $c['nombre_y_apellido'] ?? null,
        'telefono'    => $c['telefono'] ?? null,
        'foto'        => $c['imagen_contacto'] ?? null,
        'agrupacion'  => $c['nombre_agrupacion'] ?? null,
        'dia'         => $dia,
        'cargos'      => $cargos,
    ];
}

sendJson($out);
