<?php
/**
 * POST JSON /multimedia-presign.php
 *   { id_inscripcion, tipo (audio|video_led), mime, size }
 *
 * Valida auth + propiedad + tipo/mime/size y devuelve una URL PUT FIRMADA de R2
 * para que el navegador suba el archivo DIRECTO a R2 (sin pasar por PHP).
 * Luego el front llama a /multimedia-registrar.php para guardar metadatos.
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
$mime = trim((string)($body['mime'] ?? ''));
$size = (int)($body['size'] ?? 0);

if ($id_inscripcion === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_inscripcion)) {
    sendJson(['error' => 'id_inscripcion inválido'], 400);
    exit;
}
if (!in_array($tipo, ['audio', 'video_led'], true)) {
    sendJson(['error' => 'tipo inválido (use audio o video_led)'], 400);
    exit;
}

// Validar MIME declarado contra la lista permitida + derivar extensión.
$allowed = $tipo === 'audio' ? MULTIMEDIA_AUDIO_MIMES : MULTIMEDIA_VIDEO_MIMES;
if (!in_array($mime, $allowed, true)) {
    sendJson(['error' => "Formato no permitido para $tipo (recibido: $mime)"], 415);
    exit;
}
$ext = mmExtFromMime($mime);
if (!$ext) {
    sendJson(['error' => 'Extensión no determinable del MIME'], 415);
    exit;
}

// Validar tamaño declarado.
$max = $tipo === 'audio' ? MULTIMEDIA_AUDIO_MAX_BYTES : MULTIMEDIA_VIDEO_MAX_BYTES;
if ($size > 0 && $size > $max) {
    $mb = $tipo === 'audio' ? '100 MB' : '2 GB';
    sendJson(['error' => "Archivo muy grande (máx $mb)"], 413);
    exit;
}

// Cargar inscripción para validar propiedad + armar el path semántico.
$sb = supabase();
$insc = $sb->selectOne(
    'registro_de_inscripcion_2026',
    'id_inscripcion,id_agrupacion,agrupacion,nombre_de_la_obra,orden',
    ['id_inscripcion' => "eq.$id_inscripcion"]
);
if (!$insc) {
    sendJson(['error' => 'Inscripción no encontrada'], 404);
    exit;
}
$id_agrupacion = (string)($insc['id_agrupacion'] ?? '');
// Autoriza con el MISMO scope que el listado: agrupación propia, encargado,
// director o coreógrafo de la obra (o admin). [[usuarioAutorizadoInscripcion]]
if (!usuarioAutorizadoInscripcion($user, $id_inscripcion)) {
    sendJson(['error' => 'No autorizado para esta inscripción'], 403);
    exit;
}

// Bloquear si multimedia confirmada.
$estado = $sb->selectOne(
    'inscripcion_multimedia_estado',
    'confirmado',
    ['id_inscripcion' => "eq.$id_inscripcion", 'year' => 'eq.2026']
);
if ($estado && !empty($estado['confirmado'])) {
    sendJson(['error' => 'Multimedia confirmada. Solicite habilitar para hacer cambios.'], 423);
    exit;
}

$orden = (int)($insc['orden'] ?? 0);
$agrupacion = (string)($insc['agrupacion'] ?? 'sin-agrupacion');
$obra = (string)($insc['nombre_de_la_obra'] ?? 'sin-obra');

$key = mmStoragePath($tipo, $orden, $agrupacion, $obra, $ext);
$r2 = r2();
$presignedUrl = $r2->presignPutUrl($key, 3600);

sendJson([
    'ok' => true,
    'url' => $presignedUrl,        // PUT directo aquí desde el navegador
    'key' => $key,
    'storage_path' => $key,
    'url_publica' => $r2->publicUrl($key),
    'mime' => $mime,
    'ext' => $ext,
]);
