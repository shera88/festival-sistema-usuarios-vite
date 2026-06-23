<?php
/**
 * POST multipart /usuario-foto.php  field: foto
 *
 * Sube nueva foto del usuario autenticado y actualiza `representantes.imagen`
 * + `festival_contactos_global.imagen_contacto` (fallback). Refresca session.
 *
 * Path en Storage:
 *   uploads-2026/perfiles/<id_contacto>-<timestamp>.<ext>
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();

if (!isset($_FILES['foto']) || !is_uploaded_file($_FILES['foto']['tmp_name'])) {
    sendJson(['error' => 'Falta archivo "foto"'], 400);
    exit;
}

$file = $_FILES['foto'];
if ($file['error'] !== UPLOAD_ERR_OK) {
    sendJson(['error' => 'Error de upload: ' . $file['error']], 400);
    exit;
}
if ($file['size'] > 5 * 1024 * 1024) {
    sendJson(['error' => 'Archivo muy grande (máx 5 MB)'], 413);
    exit;
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($file['tmp_name']);
$allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
if (!in_array($mime, $allowed, true)) {
    sendJson(['error' => 'Formato no permitido (JPG, PNG, WEBP o GIF)'], 415);
    exit;
}

$id_contacto = trim((string)($user['id_contacto'] ?? ''));
if ($id_contacto === '') {
    sendJson(['error' => 'Usuario sin id_contacto'], 400);
    exit;
}

$ext = match ($mime) {
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
    default => 'bin',
};

$filename = $id_contacto . '-' . (int)(microtime(true) * 1000) . '.' . $ext;
$storagePath = 'perfiles/' . $filename;

$sb = supabase();
try {
    $url = $sb->uploadPublicFileAt($file['tmp_name'], $mime, $storagePath, true);
} catch (RuntimeException $e) {
    sendJson(['error' => 'Upload falló: ' . $e->getMessage()], 500);
    exit;
}

// Update representantes.imagen (source of truth)
$id_representante = trim((string)($user['id_original_representante'] ?? ''));
if ($id_representante !== '') {
    try {
        $sb->update('representantes', 'id_representante', $id_representante, ['imagen' => $url]);
    } catch (RuntimeException $e) {
        error_log('[usuario-foto] update representantes.imagen: ' . $e->getMessage());
    }
}

// Reflejar en festival_contactos_global.imagen_contacto si existe
try {
    $sb->update('festival_contactos_global', 'id_contacto', $id_contacto, ['imagen_contacto' => $url]);
} catch (RuntimeException $e) {
    error_log('[usuario-foto] update festival_contactos_global: ' . $e->getMessage());
}

// Refrescar session
$_SESSION['user_data']['imagen_contacto'] = $url;

sendJson([
    'ok' => true,
    'imagen_contacto' => $url,
    'user' => $_SESSION['user_data'],
]);
