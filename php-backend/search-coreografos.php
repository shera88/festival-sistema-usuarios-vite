<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireAuth();
requireMethod('GET');

$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
if (strlen($q) < 2) {
    sendJson([]);
    exit;
}

$rows = supabase()->rpc('search_coreografos', ['q' => $q]);
sendJson($rows);
