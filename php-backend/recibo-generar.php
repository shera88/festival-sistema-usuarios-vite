<?php
/**
 * POST /recibo-generar.php
 *   body: { "id_pago": "<id>" }
 *
 * Genera (o regenera) el PDF del recibo y devuelve { url, numero, bytes }.
 * Solo accesible al representante dueño o admin.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/recibo.php';

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => 'PHP fatal: ' . $err['message']]);
    }
});

handlePreflight();
requireMethod('POST');

// Auth dual: shared secret (server-to-server desde n8n) o sesión (frontend)
$cfg = require __DIR__ . '/config.php';
$sharedSecret = (string)($cfg['webhook_shared_secret'] ?? '');
$reqSecret = (string)($_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '');
$isServerToServer = $sharedSecret !== '' && hash_equals($sharedSecret, $reqSecret);

if ($isServerToServer) {
    $user = ['id_global' => 'n8n', 'rol' => 'admin', 'id_agrupacion' => ''];
    $userAgrups = [];
} else {
    $user = requireAuth();
    $userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
}

$rawBody = file_get_contents('php://input') ?: '';
$body = json_decode($rawBody, true) ?: [];
$idPago = trim((string)($body['id_pago'] ?? ''));

if ($idPago === '' || !preg_match('/^[A-Za-z0-9_\-]{8,64}$/', $idPago)) {
    sendJson(['error' => 'id_pago inválido'], 400);
    exit;
}

$s = supabase();
$pago = $s->selectOne('pagos_2026', '*', ['id_pago' => 'eq.' . $idPago]);
if (!$pago) {
    sendJson(['error' => 'Pago no encontrado'], 404);
    exit;
}

if (!$isServerToServer) {
    $idAgrupPago = (string)($pago['id_agrupacion'] ?? '');
    if (!in_array($idAgrupPago, $userAgrups, true) && ($user['rol'] ?? '') !== 'admin') {
        sendJson(['error' => 'No autorizado'], 403);
        exit;
    }
}

if (($pago['estado'] ?? '') !== 'verificado') {
    sendJson(['error' => 'El recibo solo se genera para pagos verificados'], 409);
    exit;
}

try {
    $result = reciboGenerarYGuardar($idPago, $user['id_global'] ?? null);
    sendJson($result, 200);
} catch (\Throwable $e) {
    error_log('[recibo-generar] ' . $e->getMessage());
    sendJson(['error' => 'No se pudo generar el recibo: ' . $e->getMessage()], 500);
}
