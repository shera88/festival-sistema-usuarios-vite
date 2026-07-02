<?php
/**
 * GET /recibo-ver.php?id_pago=<id>
 *
 * Devuelve PDF del recibo inline (Content-Type: application/pdf).
 * Si aún no existe en Storage, lo genera y guarda.
 * Solo accesible para representantes dueños de la agrupación o admin.
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
requireMethod('GET');

$user = requireAuth();
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');

$idPago = trim((string)($_GET['id_pago'] ?? ''));
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

// Autorización: el representante dueño de la agrupación, o un admin de pagos
// (que puede ver el recibo de cualquier agrupación desde el dashboard).
$idAgrupPago = (string)($pago['id_agrupacion'] ?? '');
$esAdmin = ($user['rol'] ?? '') === 'admin'
    || esAdminPagos(parseIdCsv($user['id_contacto'] ?? '')[0] ?? '');
if (!in_array($idAgrupPago, $userAgrups, true) && !$esAdmin) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

// Solo recibo si pago verificado
if (($pago['estado'] ?? '') !== 'verificado') {
    sendJson(['error' => 'El recibo solo está disponible para pagos verificados'], 409);
    exit;
}

// Si ya existe URL, redirect a Storage. Si no, generar.
$url = (string)($pago['recibo_pdf_url'] ?? '');
if ($url === '') {
    try {
        $result = reciboGenerarYGuardar($idPago, $user['id_global'] ?? null);
        $url = $result['url'];
    } catch (\Throwable $e) {
        error_log('[recibo-ver] fallo gen: ' . $e->getMessage());
        sendJson(['error' => 'No se pudo generar el recibo: ' . $e->getMessage()], 500);
        exit;
    }
}

// Stream el PDF desde Storage (proxy) para forzar Content-Disposition correcto
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_FOLLOWLOCATION => true,
]);
$pdfBytes = curl_exec($ch);
$http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!is_string($pdfBytes) || $http < 200 || $http >= 300) {
    sendJson(['error' => 'No se pudo leer el PDF desde Storage'], 502);
    exit;
}

$numero = (string)($pago['numero_recibo'] ?? $idPago);
$disposition = isset($_GET['download']) ? 'attachment' : 'inline';
header('Content-Type: application/pdf');
header('Content-Length: ' . strlen($pdfBytes));
header('Content-Disposition: ' . $disposition . '; filename="recibo-' . $numero . '.pdf"');
header('Cache-Control: private, max-age=0, no-cache');
echo $pdfBytes;
