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

// Super admin (supervisión): puede impersonar. Si YA está impersonando, el flag
// se evalúa sobre el usuario REAL (guardado al iniciar la supervisión), y se
// expone quién es el real para el banner "Viendo como…" del frontend.
$impersonando = !empty($_SESSION['real_user']);
$idReal = $impersonando
    ? (parseIdCsv($_SESSION['real_user']['id_contacto'] ?? '')[0] ?? '')
    : (parseIdCsv($user['id_contacto'] ?? '')[0] ?? '');
$user['es_super_admin'] = esSuperAdmin($idReal);
$user['impersonando'] = $impersonando;
$user['real_user_nombre'] = $impersonando ? ($_SESSION['real_user']['nombre_y_apellido'] ?? null) : null;

sendJson(['user' => $user]);
