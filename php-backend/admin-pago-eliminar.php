<?php
/**
 * POST /admin-pago-eliminar.php   (solo admin de pagos)
 * Body JSON: { id_pago }
 * Elimina el registro de pago de pagos_2026 (hard delete). Recalcula deuda al instante.
 * El comprobante en Storage NO se borra (queda huérfano, inocuo).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('POST');
requireAdmin();

$input  = json_decode(file_get_contents('php://input'), true) ?: [];
$id_pago = trim((string)($input['id_pago'] ?? ''));

if ($id_pago === '' || !preg_match('/^[A-Za-z0-9]{4,64}$/', $id_pago)) {
    sendJson(['error' => 'id_pago inválido'], 400);
    exit;
}

$sb   = supabase();
$pago = $sb->selectOne('pagos_2026', 'id_pago', ['id_pago' => "eq.$id_pago"]);
if (!$pago) {
    sendJson(['error' => 'Pago no encontrado'], 404);
    exit;
}

try {
    $n = $sb->delete('pagos_2026', 'id_pago', $id_pago);
} catch (RuntimeException $e) {
    sendJson(['error' => 'Error al eliminar: ' . $e->getMessage()], 500);
    exit;
}

sendJson(['ok' => true, 'id_pago' => $id_pago, 'eliminadas' => $n]);
