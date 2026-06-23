<?php
/**
 * POST /usuario-perfil-editar.php  { patch: {...} }
 *
 * Edita el perfil del usuario autenticado. Whitelist de campos editables
 * (CI/numero_de_carnet NO editable - es el identificador):
 *   - nombre_y_apellido
 *   - telefono
 *   - correo_electronico
 *   - ciudad
 *
 * Tabla destino: representantes (source of truth para foto persona, según
 * memoria del proyecto). Filtra por id_representante = user.id_original_representante.
 * Si el usuario no es representante, intenta también otras tablas relacionadas.
 *
 * Devuelve el user data actualizado y refresca la session.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();
$patchIn = is_array($body['patch'] ?? null) ? $body['patch'] : [];

$ALLOWED = ['nombre_y_apellido', 'telefono', 'correo_electronico', 'ciudad'];
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
    if ($field === 'correo_electronico' && is_string($val)) {
        $patch[$field] = mb_strtolower($val, 'UTF-8');
    } elseif (in_array($field, ['nombre_y_apellido', 'ciudad'], true) && is_string($val)) {
        $patch[$field] = mb_strtoupper($val, 'UTF-8');
    } else {
        $patch[$field] = $val;
    }
}

if (count($patch) === 0) {
    sendJson(['error' => 'Nada para actualizar'], 400);
    exit;
}

$sb = supabase();

// Tablas a actualizar según rol del usuario
$updated = false;
$id_representante = trim((string)($user['id_original_representante'] ?? ''));
$id_contacto      = trim((string)($user['id_contacto'] ?? ''));

if ($id_representante !== '') {
    try {
        $sb->update('representantes', 'id_representante', $id_representante, $patch);
        $updated = true;
    } catch (RuntimeException $e) {
        error_log('[perfil-editar] update representantes: ' . $e->getMessage());
    }
}

// Reflejar también en festival_contactos_global si existe (denormalizado)
if ($id_contacto !== '') {
    $cgPatch = $patch;
    try {
        $sb->update('festival_contactos_global', 'id_contacto', $id_contacto, $cgPatch);
    } catch (RuntimeException $e) {
        // Tabla puede no existir o estar restringida — no critico
        error_log('[perfil-editar] update festival_contactos_global: ' . $e->getMessage());
    }
}

if (!$updated && $id_contacto === '') {
    sendJson(['error' => 'No se encontró registro asociado al usuario'], 404);
    exit;
}

// Refrescar session con valores nuevos
foreach ($patch as $k => $v) {
    $_SESSION['user_data'][$k] = $v;
}

sendJson([
    'ok' => true,
    'patch' => $patch,
    'user' => $_SESSION['user_data'],
]);
