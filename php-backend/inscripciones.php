<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if (!in_array($year, ['2023', '2024', '2025', '2026'], true)) {
    sendJson(['error' => 'Año inválido'], 400);
    exit;
}

$filter = buildContextFilter($user);
if (!$filter) {
    sendJson([$year => []]);
    exit;
}

$qs = $filter . "&select=*&limit=200";
$rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);

sendJson([$year => $rows]);
