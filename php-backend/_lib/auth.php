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
