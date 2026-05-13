<?php
declare(strict_types=1);

require_once __DIR__ . '/session.php';

function sendJson($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $cfg = require __DIR__ . '/../config.php';
    $origin = $cfg['cors_origin'];
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
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
