<?php
/**
 * POST /inscripcion-confirmar-multimedia.php  { id_inscripcion, year? }
 *
 * Marca multimedia como confirmada para esa inscripción. Requiere que el
 * audio esté presente (obligatorio). Video LED es opcional.
 *
 * Una vez confirmada: no se pueden subir/reemplazar/eliminar archivos
 * hasta que el admin revierta (DELETE row en inscripcion_multimedia_estado).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();

$id_inscripcion = trim((string)($body['id_inscripcion'] ?? ''));
if ($id_inscripcion === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_inscripcion)) {
    sendJson(['error' => 'id_inscripcion inválido'], 400);
    exit;
}
$year = (int)($body['year'] ?? 2026);
if ($year < 2023 || $year > 2099) {
    sendJson(['error' => 'year inválido'], 400);
    exit;
}

$sb = supabase();
$insc = $sb->selectOne(
    'registro_de_inscripcion_2026',
    'id_inscripcion,id_agrupacion',
    ['id_inscripcion' => "eq.$id_inscripcion"]
);
if (!$insc) {
    sendJson(['error' => 'Inscripción no encontrada'], 404);
    exit;
}

// Scope igual al listado: agrupación/encargado/director/coreógrafo (o admin).
if (!usuarioAutorizadoInscripcion($user, $id_inscripcion)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

// Verificar que tenga audio (obligatorio)
$audio = $sb->selectOne(
    'multimedia',
    'id_multimedia',
    [
        'id_inscripcion' => "eq.$id_inscripcion",
        'tipo' => "eq.audio",
    ]
);
if (!$audio) {
    sendJson([
        'error' => 'Falta subir el audio. El audio es obligatorio para confirmar.',
    ], 409);
    exit;
}

// UPSERT en estado
try {
    $sb->upsert('inscripcion_multimedia_estado', [
        'id_inscripcion'     => $id_inscripcion,
        'year'               => $year,
        'confirmado'         => true,
        'fecha_confirmacion' => gmdate('c'),
        'confirmado_por'     => (string)($user['id_contacto'] ?? ''),
    ], 'id_inscripcion,year');
} catch (RuntimeException $e) {
    sendJson(['error' => 'No se pudo confirmar: ' . $e->getMessage()], 500);
    exit;
}

sendJson([
    'ok' => true,
    'id_inscripcion' => $id_inscripcion,
    'year' => $year,
    'confirmado' => true,
]);
