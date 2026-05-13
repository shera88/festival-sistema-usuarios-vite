<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';

handlePreflight();
requireMethod('GET');

requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));

// Tabla de pagos aún no existe en el schema. Devolver placeholder.
sendJson([$year => []]);
