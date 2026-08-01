<?php
/**
 * POST /agrupacion-cerrar.php  { id_agrupacion, year?, estado? }
 *
 * UPSERT en `agrupacion_credenciales`. estado ∈ {'completo','incompleto'}
 * (default 'completo' para compatibilidad).
 * Tabla normalizada: 1 row por (id_agrupacion, year). Reutilizable
 * para cualquier año sin DDL.
 *
 *  - estado='completo'  → cierra la agrupación. Exige que TODOS los
 *    integrantes estén verificados (409 si faltan). Una vez cerrada no se
 *    pueden añadir/eliminar personas ni modificar registros.
 *  - estado='incompleto' → REABRE la agrupación (cambio libre de estado,
 *    sin la validación de verificados: esa aplica solo al cierre).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();

$id_agrupacion = trim((string)($body['id_agrupacion'] ?? ''));
if ($id_agrupacion === '' || !preg_match('/^[a-f0-9]{4,16}$/i', $id_agrupacion)) {
    sendJson(['error' => 'id_agrupacion inválido'], 400);
    exit;
}

$year = (int)($body['year'] ?? 2026);
if ($year < 2023 || $year > 2099) {
    sendJson(['error' => 'year inválido'], 400);
    exit;
}

$estado = mb_strtolower(trim((string)($body['estado'] ?? 'completo')));
if (!in_array($estado, ['completo', 'incompleto'], true)) {
    sendJson(['error' => 'estado inválido'], 400);
    exit;
}

// Set REAL de agrupaciones (primaria + todas las de sus inscripciones), igual
// que los endpoints kardex-*. El CSV del contacto solo trae la primaria.
$userAgrups = resolveUserAgrupaciones($user);
if (!in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado para esta agrupación'], 403);
    exit;
}

$sb = supabase();

// ── REABRIR (estado='incompleto') ────────────────────────────────────────────
// Cambio libre de estado: sin validación de verificados (aplica solo al cierre).
if ($estado === 'incompleto') {
    // Si ya está incompleta (o sin fila), idempotente.
    if (!credCerrada($sb, $id_agrupacion, $year)) {
        sendJson([
            'ok' => true,
            'already' => true,
            'estado_credenciales' => 'incompleto',
            'id_agrupacion' => $id_agrupacion,
            'year' => $year,
        ]);
        exit;
    }
    try {
        $sb->upsert('agrupacion_credenciales', [
            'id_agrupacion' => $id_agrupacion,
            'year' => $year,
            'estado' => 'incompleto',
            'fecha_cierre' => null,
        ], 'id_agrupacion,year');
    } catch (RuntimeException $e) {
        sendJson(['error' => 'No se pudo reabrir: ' . $e->getMessage()], 500);
        exit;
    }
    sendJson([
        'ok' => true,
        'estado_credenciales' => 'incompleto',
        'id_agrupacion' => $id_agrupacion,
        'year' => $year,
    ]);
    exit;
}

// ── CERRAR (estado='completo') ───────────────────────────────────────────────
// Si ya está completa, idempotente
if (credCerrada($sb, $id_agrupacion, $year)) {
    sendJson(['ok' => true, 'already' => true, 'estado_credenciales' => 'completo']);
    exit;
}

// Pre-cierre: validar que TODOS los integrantes estén verificados
$kardexTable = "registro_kardex_$year";
$noVerif = $sb->selectRaw(
    $kardexTable,
    'select=id_kardex,nombre_y_apellido&id_agrupacion=eq.' . rawurlencode($id_agrupacion) . '&verificado=eq.false&limit=200'
);
if (count($noVerif) > 0) {
    sendJson([
        'error' => 'Faltan integrantes por verificar. Active el switch de cada integrante antes de cerrar la agrupación.',
        'pendientes' => count($noVerif),
    ], 409);
    exit;
}

try {
    $sb->upsert('agrupacion_credenciales', [
        'id_agrupacion' => $id_agrupacion,
        'year' => $year,
        'estado' => 'completo',
        'fecha_cierre' => gmdate('c'),
        'cerrado_por' => (string)($user['id_contacto'] ?? ''),
    ], 'id_agrupacion,year');
} catch (RuntimeException $e) {
    sendJson(['error' => 'No se pudo cerrar: ' . $e->getMessage()], 500);
    exit;
}

sendJson([
    'ok' => true,
    'estado_credenciales' => 'completo',
    'id_agrupacion' => $id_agrupacion,
    'year' => $year,
]);
