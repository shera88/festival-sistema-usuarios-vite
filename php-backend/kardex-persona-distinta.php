<?php
/**
 * POST /kardex-persona-distinta.php  { id_kardex, persona_distinta: bool }
 *
 * Marca (o desmarca) un registro de kárdex como "es otra persona, pese a
 * compartir el número de carnet con otro registro".
 *
 * Para qué: el cobro de credenciales cuenta personas deduplicando por CI. Cuando
 * un profesor carga a sus alumnos con su propio carnet, todos cuentan como uno y
 * se cobra de menos. Con esta marca el encargado confirma que son personas
 * distintas y recién ahí se contabilizan (ver vista `deudas_2026`).
 *
 * Mismas reglas de acceso que kardex-editar.php:
 *  - Solo 2026.
 *  - El usuario debe tener contexto sobre la agrupación (o ser admin).
 *  - Agrupación cerrada ('completo') bloquea, salvo admin.
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

if (!array_key_exists('persona_distinta', $body)) {
    sendJson(['error' => 'Falta persona_distinta'], 400);
    exit;
}
$valor = filter_var($body['persona_distinta'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
if ($valor === null) {
    sendJson(['error' => 'persona_distinta debe ser true o false'], 400);
    exit;
}

$sb = supabase();
$row = $sb->selectOne('registro_kardex_2026', 'id_kardex,id_agrupacion', ['id_kardex' => "eq.$id_kardex"]);
if (!$row) {
    sendJson(['error' => 'Registro no encontrado'], 404);
    exit;
}
$id_agrupacion = (string)($row['id_agrupacion'] ?? '');

$userAgrups = resolveUserAgrupaciones($user);
$esAdmin = sesionEsAdmin();
if (!$esAdmin && !in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

if (!$esAdmin && credCerrada($sb, $id_agrupacion, 2026)) {
    sendJson(['error' => 'Agrupación cerrada. Solicite habilitar.'], 423);
    exit;
}

$sb->update('registro_kardex_2026', 'id_kardex', $id_kardex, ['persona_distinta' => $valor]);

sendJson(['ok' => true, 'id_kardex' => $id_kardex, 'persona_distinta' => $valor]);
