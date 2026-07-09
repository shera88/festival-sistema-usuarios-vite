<?php
/**
 * DELETE /kardex-eliminar.php?id_kardex=xxxxxxxx
 *
 * Reglas:
 *  - Solo año 2026 (registro_kardex_2026).
 *  - Solo si la inscripción del 2026 de esa agrupación tiene
 *    estado_credenciales != 'completo'.
 *  - Solo si el usuario autenticado tiene contexto sobre esa agrupación
 *    (es decir, su filtro por context incluye ese id_agrupacion).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();

$body = jsonBody();
$id_kardex = trim((string)($body['id_kardex'] ?? ''));
if ($id_kardex === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_kardex)) {
    sendJson(['error' => 'id_kardex inválido'], 400);
    exit;
}

$sb = supabase();

// 1) Cargar el row de kardex 2026 para conocer su id_agrupacion + cargo
$row = $sb->selectOne(
    'registro_kardex_2026',
    'id_kardex,id_agrupacion,cargo,nombre_y_apellido',
    ['id_kardex' => "eq.$id_kardex"]
);
if (!$row) {
    sendJson(['error' => 'Registro no encontrado (solo se permite eliminar de 2026)'], 404);
    exit;
}

$id_agrupacion = (string)($row['id_agrupacion'] ?? '');
if ($id_agrupacion === '') {
    sendJson(['error' => 'Registro sin agrupación asociada'], 400);
    exit;
}

// 2) Verificar contexto del usuario: el id_agrupacion del row debe estar en
//    los ids del user.
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
// Admins / super-admin eliminan de CUALQUIER agrupación (igual que multimedia-*).
$esAdmin = sesionEsAdmin();
if (!$esAdmin && !in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado para esta agrupación'], 403);
    exit;
}

// 3) Estado de credenciales: debe ser != 'completo'
if (!$esAdmin && credCerrada($sb, $id_agrupacion, 2026)) {
    sendJson(['error' => 'Agrupación cerrada. Solicite al administrador habilitar para hacer cambios.'], 423);
    exit;
}

// 4) DELETE
try {
    $deleted = $sb->delete('registro_kardex_2026', 'id_kardex', $id_kardex);
} catch (RuntimeException $e) {
    sendJson(['error' => 'No se pudo eliminar: ' . $e->getMessage()], 500);
    exit;
}

sendJson([
    'ok' => true,
    'deleted' => $deleted,
    'id_kardex' => $id_kardex,
    'id_agrupacion' => $id_agrupacion,
    'nombre' => $row['nombre_y_apellido'] ?? null,
]);
