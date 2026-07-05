<?php
/**
 * GET /pagos-resumen.php
 *   ?id_agrupacion=<opt>   (si se pasa: SOLO esa agrupación; default: TODAS
 *                           las que la persona representa)
 *
 * Devuelve:
 *   {
 *     id_agrupacion,          // agrupación "primaria" (contacto o primera)
 *     nombre_agrupacion,
 *     enlace_del_logo,
 *     agrupaciones: [{ id_agrupacion, nombre_agrupacion, enlace_del_logo }],
 *     compromisos: [...],     // cada uno tagueado con su id_agrupacion/nombre/logo
 *     historial: [...],       // idem
 *     totales: { total_deuda, pagado_verificado, pagado_pendiente, saldo },
 *     metodos_pago: [...]
 *   }
 *
 * NOTA: una persona (representante) puede tener VARIAS agrupaciones. Antes esto
 * usaba solo `festival_contactos_global.id_agrupacion` (un único valor) → el tab
 * Pagos mostraba una sola agrupación aunque la persona firmara convenios para
 * varias. Ahora se resuelve el set REAL de agrupaciones con el MISMO scope que el
 * tab Inscripciones (buildContextFilter: sus inscripciones por id_contacto /
 * encargado / director / coreógrafo) y se agregan los compromisos de todas.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$sb = supabase();

// Set REAL de agrupaciones que la persona representa (helper compartido en
// context.php — mismo scope que Inscripciones). NO usar el id_agrupacion único.
$agrupSet = resolveUserAgrupaciones($user);

// La agrupación "primaria" para el header (la del contacto si está en el set).
$primaria = parseIdCsv($user['id_agrupacion'] ?? '')[0] ?? '';
if ($primaria === '' || !in_array($primaria, $agrupSet, true)) {
    $primaria = $agrupSet[0] ?? '';
}

// ?id_agrupacion=<x> → solo esa (debe pertenecer al set del usuario).
$reqAgrup = trim((string)($_GET['id_agrupacion'] ?? ''));
if ($reqAgrup !== '') {
    if (!in_array($reqAgrup, $agrupSet, true)) {
        sendJson(['error' => 'No autorizado para esta agrupación'], 403);
        exit;
    }
    $agrupIds = [$reqAgrup];
    $primaria = $reqAgrup;
} else {
    $agrupIds = $agrupSet;
}

if (count($agrupIds) === 0) {
    sendJson(['error' => 'Sin agrupación'], 400);
    exit;
}

// Datos (nombre + logo) de TODAS las agrupaciones en una sola query.
$instById = [];
$inFilter = buildInFilter('id_agrupacion', $agrupIds);
if ($inFilter !== null) {
    $instRows = $sb->selectRaw(
        'instituciones',
        'select=id_agrupacion,nombre_agrupacion,enlace_del_logo&' . $inFilter
    );
    foreach ($instRows as $r) {
        $instById[$r['id_agrupacion']] = $r;
    }
}

// Compromisos + historial agregados de todas las agrupaciones, cada item
// tagueado con su agrupación (nombre + logo) para que el frontend distinga.
$compromisos = [];
$historial = [];
foreach ($agrupIds as $aid) {
    $inst = $instById[$aid] ?? [];
    $nom  = $inst['nombre_agrupacion'] ?? '';
    $logo = $inst['enlace_del_logo'] ?? null;

    foreach ($sb->rpc('pagos_resumen_agrupacion', ['p_id_agrupacion' => $aid]) as $c) {
        $c['id_agrupacion']     = $aid;
        $c['nombre_agrupacion'] = $nom;
        $c['enlace_del_logo']   = $logo;
        $compromisos[] = $c;
    }
    foreach ($sb->rpc('pagos_historial_agrupacion', ['p_id_agrupacion' => $aid]) as $h) {
        $h['id_agrupacion']     = $aid;
        $h['nombre_agrupacion'] = $nom;
        $historial[] = $h;
    }
}

// Metodos pago activos (globales, una vez).
$metodos = $sb->selectRaw(
    'metodos_de_pago_2026',
    'select=id_metodo,metodo&activo=eq.true&order=metodo'
);

// Totales agregados sobre TODOS los compromisos.
$total_deuda = 0; $pagado_verif = 0; $pagado_pend = 0; $saldo = 0;
foreach ($compromisos as $c) {
    $total_deuda  += (float)($c['monto_total'] ?? 0);
    $pagado_verif += (float)($c['pagado_verificado'] ?? 0);
    $pagado_pend  += (float)($c['pagado_pendiente'] ?? 0);
    $saldo        += (float)($c['saldo'] ?? 0);
}

$primInst = $instById[$primaria] ?? [];

// Lista de agrupaciones (para header / posible selector futuro).
$agrupaciones = [];
foreach ($agrupIds as $aid) {
    $i = $instById[$aid] ?? [];
    $agrupaciones[] = [
        'id_agrupacion'     => $aid,
        'nombre_agrupacion' => $i['nombre_agrupacion'] ?? '',
        'enlace_del_logo'   => $i['enlace_del_logo'] ?? null,
    ];
}

sendJson([
    'id_agrupacion'    => $primaria,
    'nombre_agrupacion'=> $primInst['nombre_agrupacion'] ?? '',
    'enlace_del_logo'  => $primInst['enlace_del_logo'] ?? null,
    'agrupaciones'     => $agrupaciones,
    'compromisos'      => $compromisos,
    'historial'        => $historial,
    'totales'          => [
        'total_deuda'       => $total_deuda,
        'pagado_verificado' => $pagado_verif,
        'pagado_pendiente'  => $pagado_pend,
        'saldo'             => $saldo,
    ],
    'metodos_pago'     => $metodos,
]);
