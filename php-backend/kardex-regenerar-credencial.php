<?php
/**
 * POST application/json /kardex-regenerar-credencial.php
 *   { id_kardex }
 *
 * Dispara la REGENERACIÓN de la credencial PDF + perfil del integrante vía el
 * webhook n8n (mismo flujo que usa la rotación de foto). Se usa cuando la
 * credencial no está generada todavía (el PDF determinístico en Storage da 400).
 * n8n genera el PDF en segundo plano y lo vincula al kardex.
 *
 * Gating IGUAL que kardex-rotar-foto.php: auth + propiedad de la agrupación
 * (o admin) + el registro debe tener foto (la credencial se arma con la foto).
 * NO modifica datos server-side; sólo dispara el webhook (fire-and-forget).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';
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
// Set REAL de agrupaciones del usuario (primaria + las de sus inscripciones).
$userAgrups = resolveUserAgrupaciones($user);
$esAdmin = sesionEsAdmin();
if (!$esAdmin && !in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

// La credencial se arma con la foto del integrante: sin foto, n8n no puede generar.
$fotoUrl = trim((string)($row['foto'] ?? ''));
if ($fotoUrl === '' || !preg_match('#^https?://#i', $fotoUrl)) {
    sendJson(['error' => 'Este integrante no tiene foto — subí una foto antes de regenerar la credencial.'], 400);
    exit;
}

// Dispara el webhook n8n (fire-and-forget). n8n genera el PDF + perfil y lo
// vincula al kardex en segundo plano.
regenCredencial($id_kardex);

sendJson([
    'ok'        => true,
    'id_kardex' => $id_kardex,
    'mensaje'   => 'Regeneración iniciada. La credencial estará lista en unos segundos.',
]);
