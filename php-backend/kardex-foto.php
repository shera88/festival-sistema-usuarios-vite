<?php
/**
 * POST multipart/form-data /kardex-foto.php
 *   fields: id_kardex, foto (file)
 *
 * Sube imagen al bucket Storage y actualiza columna `foto` de
 * registro_kardex_2026 con la URL pública resultante.
 *
 * Reglas:
 *  - Solo 2026.
 *  - Usuario tiene contexto sobre la agrupación del row.
 *  - Agrupación NO cerrada (423 si lo está).
 *  - Imagen ≤ 5 MB, MIME image/{jpeg,png,webp,gif}.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';

handlePreflight();
requireMethod('POST');

$user = requireAuth();

$id_kardex = trim((string)($_POST['id_kardex'] ?? ''));
if ($id_kardex === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_kardex)) {
    sendJson(['error' => 'id_kardex inválido'], 400);
    exit;
}

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
    sendJson(['error' => 'Formato no permitido (use JPG, PNG, WEBP o GIF)'], 415);
    exit;
}

$sb = supabase();
$row = $sb->selectOne(
    'registro_kardex_2026',
    'id_kardex,id_agrupacion',
    ['id_kardex' => "eq.$id_kardex"]
);
if (!$row) {
    sendJson(['error' => 'Registro no encontrado'], 404);
    exit;
}
$id_agrupacion = (string)($row['id_agrupacion'] ?? '');
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
// Admins / super-admin operan sobre CUALQUIER agrupación (igual que multimedia-*).
$esAdmin = sesionEsAdmin();
if (!$esAdmin && !in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}
if (!$esAdmin && credCerrada($sb, $id_agrupacion, 2026)) {
    sendJson(['error' => 'Agrupación cerrada. Solicite habilitar.'], 423);
    exit;
}

try {
    $url = $sb->uploadPublicFile($file['tmp_name'], $mime, 'kardex/2026');
} catch (RuntimeException $e) {
    sendJson(['error' => 'Upload falló: ' . $e->getMessage()], 500);
    exit;
}

$sb->update('registro_kardex_2026', 'id_kardex', $id_kardex, [
    'foto' => $url,
]);

sendJson([
    'ok' => true,
    'id_kardex' => $id_kardex,
    'foto' => $url,
]);
