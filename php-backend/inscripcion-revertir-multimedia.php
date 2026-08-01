<?php
/**
 * POST /inscripcion-revertir-multimedia.php  { id_inscripcion, year? }
 *
 * Deshace la confirmación de multimedia: vuelve a habilitar la subida, el
 * reemplazo y el borrado de audio/video de esa inscripción. Es la contraparte de
 * inscripcion-confirmar-multimedia.php.
 *
 * SOLO super admin. También vale mientras supervisa a otra persona: ahí la
 * sesión activa es la del supervisado, pero quien opera sigue siendo él (ver
 * sesionEsSuperAdmin() en _lib/auth.php).
 *
 * No borra la fila de inscripcion_multimedia_estado: deja `confirmado = false` y
 * conserva fecha_confirmacion / confirmado_por como traza de quién la había
 * confirmado. Los endpoints de subida solo miran `confirmado`, así que con eso
 * queda desbloqueada.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('POST');

// Sesión válida; el permiso fino lo decide sesionEsSuperAdmin() más abajo.
requireAuth();

if (!sesionEsSuperAdmin()) {
    sendJson(['error' => 'Solo un super administrador puede habilitar de nuevo la carga.'], 403);
    exit;
}

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
    'id_inscripcion',
    ['id_inscripcion' => "eq.$id_inscripcion"]
);
if (!$insc) {
    sendJson(['error' => 'Inscripción no encontrada'], 404);
    exit;
}

// Solo se toca `confirmado`: al no mandar las otras columnas, el upsert las deja
// como estaban y se conserva el registro de la confirmación anterior.
try {
    $sb->upsert('inscripcion_multimedia_estado', [
        'id_inscripcion' => $id_inscripcion,
        'year'           => $year,
        'confirmado'     => false,
    ], 'id_inscripcion,year');
} catch (RuntimeException $e) {
    sendJson(['error' => 'No se pudo habilitar la carga: ' . $e->getMessage()], 500);
    exit;
}

sendJson([
    'ok' => true,
    'id_inscripcion' => $id_inscripcion,
    'year' => $year,
    'confirmado' => false,
]);
