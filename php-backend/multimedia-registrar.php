<?php
/**
 * POST JSON /multimedia-registrar.php
 *   { id_inscripcion, tipo, key, url_publica, nombre, mime, peso_bytes, extension }
 *
 * Se llama DESPUÉS de que el navegador subió el archivo directo a R2 (presigned).
 * Registra/actualiza la fila en `multimedia` y borra el objeto anterior si cambió.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/multimedia.php';
require __DIR__ . '/_lib/r2.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();

$id_inscripcion = trim((string)($body['id_inscripcion'] ?? ''));
$tipo = trim((string)($body['tipo'] ?? ''));
$key  = trim((string)($body['key'] ?? ''));
$url_publica = trim((string)($body['url_publica'] ?? ''));
$nombre = (string)($body['nombre'] ?? '');
$mime = trim((string)($body['mime'] ?? ''));
$peso = (int)($body['peso_bytes'] ?? 0);
$ext  = trim((string)($body['extension'] ?? ''));

if ($id_inscripcion === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_inscripcion)) {
    sendJson(['error' => 'id_inscripcion inválido'], 400);
    exit;
}
if (!in_array($tipo, ['audio', 'video_led'], true)) {
    sendJson(['error' => 'tipo inválido'], 400);
    exit;
}
if ($key === '' || $url_publica === '') {
    sendJson(['error' => 'Faltan key/url_publica'], 400);
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
$id_agrupacion = (string)($insc['id_agrupacion'] ?? '');
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
if (!in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado para esta inscripción'], 403);
    exit;
}

// Bloquear si confirmada.
$estado = $sb->selectOne(
    'inscripcion_multimedia_estado',
    'confirmado',
    ['id_inscripcion' => "eq.$id_inscripcion", 'year' => 'eq.2026']
);
if ($estado && !empty($estado['confirmado'])) {
    sendJson(['error' => 'Multimedia confirmada. Solicite habilitar para hacer cambios.'], 423);
    exit;
}

// Fila existente para reemplazar + borrar objeto viejo en R2 (si cambió el path).
$existing = $sb->selectOne(
    'multimedia',
    'id_multimedia,storage_path',
    ['id_inscripcion' => "eq.$id_inscripcion", 'tipo' => "eq.$tipo"]
);
if ($existing && !empty($existing['storage_path']) && (string)$existing['storage_path'] !== $key) {
    r2()->deleteObject((string)$existing['storage_path']);
}

$id_multimedia = $existing['id_multimedia'] ?? mmNewId();
$row = [
    'id_multimedia'  => $id_multimedia,
    'id_institucion' => $id_agrupacion,
    'id_inscripcion' => $id_inscripcion,
    'year'           => 2026,
    'tipo'           => $tipo,
    'nombre_archivo' => $nombre,
    'extension'      => $ext,
    'mime_type'      => $mime,
    'peso_bytes'     => $peso,
    'storage_path'   => $key,
    'url_publica'    => $url_publica,
    'uploaded_by'    => (string)($user['id_contacto'] ?? ''),
];

if ($existing) {
    $sb->update('multimedia', 'id_multimedia', $id_multimedia, $row);
} else {
    $sb->insert('multimedia', $row);
}

sendJson([
    'ok' => true,
    'id_multimedia' => $id_multimedia,
    'tipo' => $tipo,
    'url_publica' => $url_publica,
    'storage_path' => $key,
    'peso_bytes' => $peso,
    'extension' => $ext,
]);
