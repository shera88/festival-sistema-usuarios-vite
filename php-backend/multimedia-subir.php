<?php
/**
 * POST multipart /multimedia-subir.php
 *   fields: id_inscripcion, tipo (audio|video_led), file
 *
 * Sube archivo a Storage en path semántico y UPSERT en tabla `multimedia`.
 * Si ya existe un row con mismo (id_inscripcion, tipo): elimina el objeto
 * anterior antes de subir el nuevo (limpia archivos huérfanos).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/multimedia.php';
require __DIR__ . '/_lib/r2.php';

// Capturar fatal errors y devolverlos como JSON (no HTML page).
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode([
            'error' => 'PHP fatal: ' . $err['message'] . ' en ' . basename($err['file']) . ':' . $err['line'],
        ]);
    }
});

// Capturar excepciones no atrapadas.
set_exception_handler(function (Throwable $e) {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode(['error' => $e->getMessage()]);
});

handlePreflight();
requireMethod('POST');

// Detectar si POST llegó vacío (excedido post_max_size silencioso)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($_POST) && empty($_FILES)) {
    $contentLen = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    $postMax = ini_get('post_max_size');
    sendJson([
        'error' => "POST vacío. Probable excedió post_max_size ($postMax). Tamaño enviado: " . round($contentLen / 1024 / 1024, 1) . " MB",
    ], 413);
    exit;
}

$user = requireEditor();

$id_inscripcion = trim((string)($_POST['id_inscripcion'] ?? ''));
$tipo = trim((string)($_POST['tipo'] ?? ''));

if ($id_inscripcion === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_inscripcion)) {
    sendJson(['error' => 'id_inscripcion inválido'], 400);
    exit;
}
if (!in_array($tipo, ['audio', 'video_led'], true)) {
    sendJson(['error' => 'tipo inválido (use audio o video_led)'], 400);
    exit;
}

if (!isset($_FILES['file']) || !is_uploaded_file($_FILES['file']['tmp_name'])) {
    sendJson(['error' => 'Falta archivo "file"'], 400);
    exit;
}

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    sendJson(['error' => 'Error de upload: ' . $file['error']], 400);
    exit;
}

// Validar tamaño según tipo
if ($tipo === 'audio' && $file['size'] > MULTIMEDIA_AUDIO_MAX_BYTES) {
    sendJson(['error' => 'Audio muy grande (máx 100 MB)'], 413);
    exit;
}
if ($tipo === 'video_led' && $file['size'] > MULTIMEDIA_VIDEO_MAX_BYTES) {
    sendJson(['error' => 'Video muy grande (máx 2 GB)'], 413);
    exit;
}

// Validar MIME
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
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

// Cargar inscripción para validar contexto + obtener metadatos
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
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
if (!in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado para esta inscripción'], 403);
    exit;
}

// Bloquear si multimedia confirmada
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

// Buscar row existente para reemplazar
$existing = $sb->selectOne(
    'multimedia',
    'id_multimedia,storage_path',
    [
        'id_inscripcion' => "eq.$id_inscripcion",
        'tipo' => "eq.$tipo",
    ]
);

// Si existe, borrar objeto anterior (si tiene path distinto al nuevo)
$newStoragePath = mmStoragePath($tipo, $orden, $agrupacion, $obra, $ext);
// Borrar objeto anterior en R2 (si cambió el path) para no dejar huérfanos.
if ($existing && !empty($existing['storage_path'])) {
    $oldPath = (string)$existing['storage_path'];
    if ($oldPath !== $newStoragePath) {
        r2()->deleteObject($oldPath);
    }
}

// Subir nuevo objeto a Cloudflare R2 (antes Supabase Storage). Devuelve URL pública r2.dev.
try {
    $publicUrl = r2()->putObject($file['tmp_name'], $mime, $newStoragePath);
} catch (RuntimeException $e) {
    sendJson(['error' => $e->getMessage()], 500);
    exit;
}

// UPSERT en tabla multimedia
$id_multimedia = $existing['id_multimedia'] ?? mmNewId();
$row = [
    'id_multimedia'  => $id_multimedia,
    'id_institucion' => $id_agrupacion,
    'id_inscripcion' => $id_inscripcion,
    'year'           => 2026,
    'tipo'           => $tipo,
    'nombre_archivo' => (string)$file['name'],
    'extension'      => $ext,
    'mime_type'      => $mime,
    'peso_bytes'     => (int)$file['size'],
    'storage_path'   => $newStoragePath,
    'url_publica'    => $publicUrl,
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
    'url_publica' => $publicUrl,
    'storage_path' => $newStoragePath,
    'peso_bytes' => (int)$file['size'],
    'extension' => $ext,
]);
