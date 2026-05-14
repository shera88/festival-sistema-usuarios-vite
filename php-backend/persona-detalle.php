<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireAuth();
requireMethod('GET');

$id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
if ($id === '') {
    sendJson(null);
    exit;
}

$rows = supabase()->rpc('obtener_contacto_por_id', ['p_id' => $id]);
sendJson(is_array($rows) && count($rows) > 0 ? $rows[0] : null);
