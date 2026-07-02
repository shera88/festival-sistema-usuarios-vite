<?php
declare(strict_types=1);

require_once __DIR__ . '/session.php';

function sendJson($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    applyCorsHeaders();
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

/** Whitelist de origenes permitidos. Refleja el Origin del request si esta en la lista. */
function applyCorsHeaders(): void
{
    $cfg = require __DIR__ . '/../config.php';
    $reqOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $whitelist = [
        $cfg['cors_origin'] ?? '',
        'http://127.0.0.1:5173',
        'http://localhost:5173',
        'https://localhost',          // Capacitor Android
        'capacitor://localhost',      // Capacitor iOS
        'https://festival-sistema-usuarios-vite.vercel.app',
        'https://festivaldanzarte.com',
    ];
    $allow = in_array($reqOrigin, $whitelist, true) ? $reqOrigin : ($cfg['cors_origin'] ?? '*');
    header("Access-Control-Allow-Origin: $allow");
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Requested-With');
}

function handlePreflight(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        sendJson(null, 204);
        exit;
    }
}

function requireAuth(): array
{
    startSecureSession();
    if (empty($_SESSION['user_id']) || empty($_SESSION['user_data'])) {
        sendJson(['error' => 'No autenticado'], 401);
        exit;
    }
    return $_SESSION['user_data'];
}

/**
 * Como requireAuth() pero además exige rol con permiso de edición
 * (representante/director/coreógrafo). Los participantes de kárdex son
 * solo-lectura → 403. Defensa en profundidad (la UI también lo oculta).
 */
function requireEditor(): array
{
    $user = requireAuth();
    // Editan: contactos de festival_contactos_global (puede_editar=true) y
    // participantes de kárdex con cargo STAFF/DIRECTOR/COREOGRAFO. El RPC
    // validate_login ya resolvió ese booleano. Default true para sesiones
    // legacy (contactos) creadas antes de la migración 009.
    if (array_key_exists('puede_editar', $user) && !$user['puede_editar']) {
        sendJson(['error' => 'Su cuenta es de solo lectura'], 403);
        exit;
    }
    return $user;
}

/**
 * Como requireAuth() pero además exige que el id_contacto de la sesión sea un
 * administrador de pagos activo (tabla admin_usuarios). Gatea el dashboard admin.
 *
 * NO usa rpc('es_admin_pagos') a propósito: SupabaseClient::rpc() aplasta las
 * respuestas escalares a [] y esa función SQL devuelve un boolean escalar
 * (siempre daría falso). Se consulta admin_usuarios por SELECT (devuelve filas).
 */
function requireAdmin(): array
{
    $user = requireAuth();
    // Fast path: el flag ya viene en la sesión (lo setean login.php / me.php),
    // evitando una consulta extra a admin_usuarios en cada request admin.
    if (!empty($user['es_admin'])) {
        return $user;
    }
    // Fallback: sesiones creadas antes de que existiera el flag.
    require_once __DIR__ . '/context.php'; // parseIdCsv (idempotente)
    $idContacto = parseIdCsv($user['id_contacto'] ?? '')[0] ?? '';
    if ($idContacto === '' || !esAdminPagos($idContacto)) {
        sendJson(['error' => 'Requiere permisos de administrador'], 403);
        exit;
    }
    return $user;
}

/** ¿El id_contacto está en admin_usuarios y activo? Lo usan requireAdmin() y me.php. */
function esAdminPagos(string $idContacto): bool
{
    if ($idContacto === '') return false;
    require_once __DIR__ . '/supabase.php'; // supabase() (idempotente)
    $rows = supabase()->selectRaw(
        'admin_usuarios',
        'select=id_contacto&activo=eq.true&id_contacto=eq.' . rawurlencode($idContacto) . '&limit=1'
    );
    return is_array($rows) && count($rows) > 0;
}

/**
 * ¿El usuario de sesión es administrador? Fast path por el flag de sesión
 * (lo setean login.php / me.php), con fallback a admin_usuarios para sesiones
 * legacy. Los admins pueden gestionar multimedia/pagos de CUALQUIER agrupación.
 */
function usuarioEsAdmin(array $user): bool
{
    if (!empty($user['es_admin'])) return true;
    require_once __DIR__ . '/context.php'; // parseIdCsv (idempotente)
    $idContacto = parseIdCsv($user['id_contacto'] ?? '')[0] ?? '';
    return $idContacto !== '' && esAdminPagos($idContacto);
}

function requireMethod(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
        sendJson(['error' => 'Método no permitido'], 405);
        exit;
    }
}

function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
