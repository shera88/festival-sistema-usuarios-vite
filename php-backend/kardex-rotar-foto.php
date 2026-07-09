<?php
/**
 * POST application/json /kardex-rotar-foto.php
 *   { id_kardex, grados }   grados ∈ {90,180,270} = giro HORARIO a aplicar
 *
 * Rota FÍSICAMENTE la foto de un integrante de kardex:
 *   1. Descarga la foto actual (registro_kardex_2026.foto) server-side (sin CORS;
 *      sirve tanto para Supabase Storage como para fotos legacy en WordPress).
 *   2. La rota con GD (imagerotate).
 *   3. La re-sube como objeto NUEVO vía uploadPublicFile (WebP, nombre único →
 *      rompe el Cache-Control immutable del CDN y deja el original en /originals).
 *   4. Actualiza la columna `foto`.
 *
 * Reusa EXACTAMENTE el mismo gating que kardex-foto.php (auth + propiedad de la
 * agrupación + agrupación no cerrada). No modifica ningún endpoint existente.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';
require_once __DIR__ . '/_lib/helpers.php'; // uuidv4() usado por uploadPublicFile()
require_once __DIR__ . '/_lib/regen.php';   // regenCredencial() (webhook n8n)

handlePreflight();
requireMethod('POST');

$user = requireAuth();

$body = json_decode((string)file_get_contents('php://input'), true);
if (!is_array($body)) $body = [];

$id_kardex = trim((string)($body['id_kardex'] ?? ''));
if ($id_kardex === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_kardex)) {
    sendJson(['error' => 'id_kardex inválido'], 400);
    exit;
}

$grados = (int)($body['grados'] ?? 0);
if (!in_array($grados, [90, 180, 270], true)) {
    sendJson(['error' => 'grados debe ser 90, 180 o 270'], 400);
    exit;
}

if (!function_exists('imagerotate') || !function_exists('imagecreatefromstring')) {
    sendJson(['error' => 'GD sin soporte de rotación en el servidor'], 500);
    exit;
}

$sb = supabase();
$row = $sb->selectOne(
    'registro_kardex_2026',
    'id_kardex,id_agrupacion,foto',
    ['id_kardex' => "eq.$id_kardex"]
);
if (!$row) {
    sendJson(['error' => 'Registro no encontrado'], 404);
    exit;
}

$id_agrupacion = (string)($row['id_agrupacion'] ?? '');
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
// Admins / super-admin operan sobre CUALQUIER agrupación (mismo criterio que
// multimedia-*). El resto (coreógrafo/director/representante) sólo las suyas.
$esAdmin = sesionEsAdmin();
if (!$esAdmin && !in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}
if (!$esAdmin && credCerrada($sb, $id_agrupacion, 2026)) {
    sendJson(['error' => 'Agrupación cerrada. Solicite habilitar.'], 423);
    exit;
}

$fotoUrl = trim((string)($row['foto'] ?? ''));
if ($fotoUrl === '' || !preg_match('#^https?://#i', $fotoUrl)) {
    sendJson(['error' => 'Este registro no tiene foto para rotar'], 400);
    exit;
}

// 1. Descargar la foto actual (server-side).
$ch = curl_init($fotoUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 5,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_USERAGENT      => 'Festival-Danzarte-Rotate/1.0',
]);
$bytes = curl_exec($ch);
$http  = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
if ($bytes === false || $http < 200 || $http >= 300 || $bytes === '') {
    sendJson(['error' => 'No se pudo descargar la foto actual (HTTP ' . $http . ')'], 502);
    exit;
}

// 2. Rotar con GD. imagerotate gira ANTIHORARIO con ángulo positivo, así que
//    para un giro HORARIO de $grados se pasa el ángulo negativo.
$src = @imagecreatefromstring($bytes);
if ($src === false) {
    sendJson(['error' => 'La foto no es una imagen válida'], 415);
    exit;
}
imagealphablending($src, false);
imagesavealpha($src, true);
$transparent = imagecolorallocatealpha($src, 0, 0, 0, 127);
$rot = imagerotate($src, -$grados, $transparent);
imagedestroy($src);
if ($rot === false) {
    sendJson(['error' => 'Falló la rotación'], 500);
    exit;
}
imagealphablending($rot, false);
imagesavealpha($rot, true);

// 3. Escribir a PNG temporal (intermedio sin pérdida) y re-subir por el flujo
//    estándar (uploadPublicFile → WebP 512px, nombre único, original en /originals).
$tmp = tempnam(sys_get_temp_dir(), 'rot_');
$okPng = imagepng($rot, $tmp);
imagedestroy($rot);
if (!$okPng) {
    @unlink($tmp);
    sendJson(['error' => 'No se pudo guardar la imagen rotada'], 500);
    exit;
}

try {
    $newUrl = $sb->uploadPublicFile($tmp, 'image/png', 'kardex/2026');
} catch (Throwable $e) {
    @unlink($tmp);
    sendJson(['error' => 'Upload falló: ' . $e->getMessage()], 500);
    exit;
}
@unlink($tmp);

// 4. Actualizar la columna foto con la nueva URL (objeto nuevo → cache-bust).
$sb->update('registro_kardex_2026', 'id_kardex', $id_kardex, [
    'foto' => $newUrl,
]);

// 5. Regenerar credencial PDF + perfil con la foto rotada (async, no bloquea).
regenCredencial($id_kardex);

sendJson([
    'ok'        => true,
    'id_kardex' => $id_kardex,
    'foto'      => $newUrl,
    'grados'    => $grados,
]);
