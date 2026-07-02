<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();

// Flag admin on-demand. Se PERSISTE en la sesión para que requireAdmin() use su
// fast-path (sin re-consultar admin_usuarios en cada request → evita la latencia
// del round-trip extra). Corre en cada hidratación (montaje de la app).
$esAdmin = esAdminPagos(parseIdCsv($user['id_contacto'] ?? '')[0] ?? '');
$_SESSION['user_data']['es_admin'] = $esAdmin;
$user['es_admin'] = $esAdmin;

sendJson(['user' => $user]);
