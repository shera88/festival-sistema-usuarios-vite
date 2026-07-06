<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();

$select = 'id_inscripcion,orden,dia,agrupacion,enlace_del_logo,nombre_de_la_obra,url_video,categoria,division,subdivision,modalidad,coreografo,director,bloque,genero';

$videos = [];

// Historial ≤2025: scope de agrupación (sin id_contacto; las tablas viejas no lo tienen).
$filter = buildContextFilter($user);
if ($filter) {
    foreach (['2023', '2024', '2025'] as $year) {
        $qs = $filter . "&url_video=not.is.null&select=$select&limit=200";
        $rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);
        if (count($rows) > 0) $videos[$year] = $rows;
    }
}

// Estado de la Membresía de Videos de la persona logueada (resuelto por su carnet).
$membresia = estadoMembresia($user);

// Videos 2026: se listan (scope de agrupación, incluye id_contacto en 2026+) pero
// quedan BLOQUEADOS hasta que la membresía esté pagada. La membresía desbloquea
// TODOS los videos 2026 de su agrupación.
$filter2026 = buildContextFilter($user, true);
if ($filter2026) {
    $qs = $filter2026 . "&url_video=not.is.null&select=$select&limit=300";
    $rows = supabase()->selectRaw('registro_de_inscripcion_2026', $qs);
    if (count($rows) > 0) {
        $bloqueado = !$membresia['pagada'];
        foreach ($rows as &$r) { $r['bloqueado'] = $bloqueado; }
        unset($r);
        $videos['2026'] = $rows;
    }
}

sendJson(['videos' => $videos ?: new stdClass(), 'membresia' => $membresia]);


/**
 * Estado de la membresía de la persona logueada, resuelto por su carnet (ci) sobre
 * registro_kardex_2026. Una persona puede tener más de una fila de kárdex: se
 * considera "pagada"/"reservó" si CUALQUIERA lo está. Degrada a vacío ante cualquier
 * error (p.ej. si aún no se corrió la migración 017 y falta la columna).
 */
function estadoMembresia(array $user): array
{
    // Resolver por IDENTIDAD DE SESIÓN, no por CI (el CI viene sucio/compartido).
    // Login de kárdex → id_contacto de sesión ES el id_kardex. Login de contacto →
    // sus filas de kárdex están vinculadas por id_contacto (UUID).
    $idContacto = trim((string)($user['id_contacto'] ?? ''));
    if ($idContacto === '') return membresiaVacia();
    $origen = $user['origen'] ?? 'contacto';
    $idFilter = ($origen === 'kardex')
        ? 'id_kardex=eq.' . rawurlencode($idContacto)
        : 'id_contacto=eq.' . rawurlencode($idContacto);

    try {
        $rows = supabase()->selectRaw(
            'registro_kardex_2026',
            'select=id_kardex,membresia,membresia_pagada&' . $idFilter . '&limit=50'
        );
    } catch (\Throwable $e) {
        return membresiaVacia();
    }
    if (!is_array($rows) || count($rows) === 0) return membresiaVacia();

    $pagada = false; $reservo = false; $idKardex = null;
    foreach ($rows as $r) {
        if (!empty($r['membresia_pagada'])) $pagada = true;
        if (!empty($r['membresia']))        $reservo = true;
        if ($idKardex === null && !empty($r['id_kardex'])) $idKardex = (string)$r['id_kardex'];
    }
    return [
        'id_kardex'    => $idKardex,
        'reservo'      => $reservo,
        'pagada'       => $pagada,
        'tiene_kardex' => true,
    ];
}

function membresiaVacia(): array
{
    return ['id_kardex' => null, 'reservo' => false, 'pagada' => false, 'tiene_kardex' => false];
}
