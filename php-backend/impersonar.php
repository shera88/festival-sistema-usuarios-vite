<?php
declare(strict_types=1);

/**
 * POST /impersonar.php — Supervisión (solo SUPER admin, admin_usuarios.super_admin).
 *
 *   { "id_contacto": "<uuid>" }  → entra al panel de esa persona: la sesión pasa
 *                                  a ser la del target (ve TODO lo que esa persona
 *                                  ve), guardando al usuario real en real_user.
 *   { "stop": true }             → vuelve a la sesión del usuario real.
 *
 * El target se resuelve con el MISMO RPC del login (validate_login): el backend
 * (service_role) lee su carnet/teléfono de festival_contactos_global y lo pasa
 * como "password", así el user_data queda idéntico al de un login real de esa
 * persona (roles, agrupaciones, puede_editar, etc.).
 */

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('POST');

$user = requireAuth();
$body = jsonBody();

// ── Volver a mi cuenta ───────────────────────────────────────────────────────
if (!empty($body['stop'])) {
    if (empty($_SESSION['real_user'])) {
        sendJson(['error' => 'No está supervisando a nadie'], 400);
        exit;
    }
    $_SESSION['user_data'] = $_SESSION['real_user'];
    $_SESSION['user_id']   = $_SESSION['real_user']['id_contacto'] ?? null;
    unset($_SESSION['real_user']);
    session_regenerate_id(true);
    sendJson(['ok' => true, 'user' => $_SESSION['user_data']]);
    exit;
}

// ── Entrar al panel de una persona ──────────────────────────────────────────
$target = trim((string)($body['id_contacto'] ?? ''));
if ($target === '') {
    sendJson(['error' => 'Falta id_contacto'], 400);
    exit;
}

// El SUPER admin se evalúa sobre el usuario REAL: si ya está supervisando a
// alguien, usa el guardado (permite cambiar de persona sin volver primero).
$real = $_SESSION['real_user'] ?? $_SESSION['user_data'];
$idReal = parseIdCsv($real['id_contacto'] ?? '')[0] ?? '';
if ($idReal === '' || !esSuperAdmin($idReal)) {
    sendJson(['error' => 'Requiere permisos de super administrador'], 403);
    exit;
}

// Credencial del target (carnet o teléfono) para reusar validate_login.
$c = supabase()->selectOne(
    'festival_contactos_global',
    'id_contacto,numero_de_carnet,telefono',
    ['id_contacto' => "eq.$target"]
);
if (!$c) {
    sendJson(['error' => 'Persona no encontrada'], 404);
    exit;
}
$cred = trim((string)($c['numero_de_carnet'] ?? ''));
if ($cred === '') $cred = trim((string)($c['telefono'] ?? ''));
if ($cred === '') {
    sendJson(['error' => 'La persona no tiene carnet ni teléfono registrados'], 422);
    exit;
}

$rows = supabase()->rpc('validate_login', [
    'p_id_contacto' => $target,
    'p_password'    => $cred,
]);
if (empty($rows[0])) {
    sendJson(['error' => 'No se pudo abrir la sesión de esa persona'], 500);
    exit;
}
$t = $rows[0];

// Guardar al usuario real UNA sola vez (cambiar de persona no lo pisa).
if (empty($_SESSION['real_user'])) {
    $_SESSION['real_user'] = $_SESSION['user_data'];
}

// Mismo mapeo que login.php → la sesión ES la del target.
$_SESSION['user_id']   = $t['id_contacto'];
$_SESSION['user_data'] = [
    'id_contacto'                 => $t['id_contacto'] ?? null,
    'numero_de_carnet'            => $t['numero_de_carnet'] ?? null,
    'nombre_y_apellido'           => $t['nombre_y_apellido'] ?? null,
    'telefono'                    => $t['telefono'] ?? null,
    'correo_electronico'          => $t['correo_electronico'] ?? null,
    'ciudad'                      => $t['ciudad'] ?? null,
    'imagen_contacto'             => $t['imagen_contacto'] ?? null,
    'id_agrupacion'               => $t['id_agrupacion'] ?? null,
    'nombre_agrupacion'           => $t['nombre_agrupacion'] ?? null,
    'enlace_del_logo'             => $t['enlace_del_logo'] ?? null,
    'rol_primario'                => $t['rol_primario'] ?? null,
    'es_representante'            => $t['es_representante'] ?? false,
    'es_director'                 => $t['es_director'] ?? false,
    'es_coreografo'               => $t['es_coreografo'] ?? false,
    'id_original_representante'   => $t['id_original_representante'] ?? null,
    'id_original_director'        => $t['id_original_director'] ?? null,
    'id_original_coreografo'      => $t['id_original_coreografo'] ?? null,
    'origen'                      => $t['origen'] ?? 'contacto',
    'puede_editar'                => $t['puede_editar'] ?? true,
    // es_admin del TARGET (ve exactamente lo que esa persona ve).
    'es_admin'                    => esAdminPagos((string)($t['id_contacto'] ?? '')),
];
session_regenerate_id(true);

sendJson(['ok' => true, 'user' => $_SESSION['user_data']]);
