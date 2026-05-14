<?php
/**
 * POST /kardex-editar.php  { id_kardex, patch: {...} }
 *
 * Whitelist de campos editables (registro_kardex_2026):
 *   - nombre_y_apellido
 *   - telefono
 *   - correo_electronico
 *   - ci
 *   - ciudad
 *   - edad
 *   - cargo
 *
 * Reglas:
 *  - Solo 2026.
 *  - Usuario tiene contexto sobre la agrupación.
 *  - estado_credenciales != 'completo'.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/normalize.php';
require __DIR__ . '/_lib/credenciales.php';

handlePreflight();
requireMethod('POST');

$user = requireAuth();
$body = jsonBody();

$id_kardex = trim((string)($body['id_kardex'] ?? ''));
if ($id_kardex === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_kardex)) {
    sendJson(['error' => 'id_kardex inválido'], 400);
    exit;
}
$patchIn = is_array($body['patch'] ?? null) ? $body['patch'] : [];

$ALLOWED = ['nombre_y_apellido', 'telefono', 'correo_electronico', 'ci', 'ciudad', 'edad', 'cargo'];
$patch = [];
foreach ($ALLOWED as $field) {
    if (!array_key_exists($field, $patchIn)) continue;
    $val = $patchIn[$field];
    if ($val === null) {
        $patch[$field] = null;
        continue;
    }
    $val = is_string($val) ? trim($val) : $val;
    if ($val === '') {
        $patch[$field] = null;
        continue;
    }
    if (in_array($field, ['nombre_y_apellido', 'ciudad', 'cargo'], true) && is_string($val)) {
        $patch[$field] = mb_strtoupper($val, 'UTF-8');
    } elseif ($field === 'correo_electronico' && is_string($val)) {
        $patch[$field] = mb_strtolower($val, 'UTF-8');
    } elseif ($field === 'edad') {
        $patch[$field] = is_numeric($val) ? (int)$val : null;
    } else {
        $patch[$field] = $val;
    }
}

if (count($patch) === 0) {
    sendJson(['error' => 'Nada para actualizar'], 400);
    exit;
}

$sb = supabase();
$row = $sb->selectOne('registro_kardex_2026', 'id_kardex,id_agrupacion', ['id_kardex' => "eq.$id_kardex"]);
if (!$row) {
    sendJson(['error' => 'Registro no encontrado'], 404);
    exit;
}
$id_agrupacion = (string)($row['id_agrupacion'] ?? '');
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
if (!in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

if (credCerrada($sb, $id_agrupacion, 2026)) {
    sendJson(['error' => 'Agrupación cerrada. Solicite habilitar.'], 423);
    exit;
}

$sb->update('registro_kardex_2026', 'id_kardex', $id_kardex, $patch);

sendJson(['ok' => true, 'id_kardex' => $id_kardex, 'patch' => $patch]);
