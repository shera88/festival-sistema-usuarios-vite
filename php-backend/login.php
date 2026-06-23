<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('POST');

$body = jsonBody();
$id   = trim((string)($body['id_contacto'] ?? ''));
$pwd  = trim((string)($body['password']    ?? ''));

if ($id === '' || $pwd === '') {
    sendJson(['error' => 'Faltan campos'], 400);
    exit;
}

$rows = supabase()->rpc('validate_login', [
    'p_id_contacto' => $id,
    'p_password'    => $pwd,
]);

if (empty($rows[0])) {
    sendJson(['error' => 'Carnet o contraseña incorrectos'], 401);
    exit;
}

$user = $rows[0];

startSecureSession();
session_regenerate_id(true);
$_SESSION['user_id']   = $user['id_contacto'];
$_SESSION['user_data'] = [
    'id_contacto'                 => $user['id_contacto'] ?? null,
    'numero_de_carnet'            => $user['numero_de_carnet'] ?? null,
    'nombre_y_apellido'           => $user['nombre_y_apellido'] ?? null,
    'telefono'                    => $user['telefono'] ?? null,
    'correo_electronico'          => $user['correo_electronico'] ?? null,
    'ciudad'                      => $user['ciudad'] ?? null,
    'imagen_contacto'             => $user['imagen_contacto'] ?? null,
    'id_agrupacion'               => $user['id_agrupacion'] ?? null,
    'nombre_agrupacion'           => $user['nombre_agrupacion'] ?? null,
    'enlace_del_logo'             => $user['enlace_del_logo'] ?? null,
    'rol_primario'                => $user['rol_primario'] ?? null,
    'es_representante'            => $user['es_representante'] ?? false,
    'es_director'                 => $user['es_director'] ?? false,
    'es_coreografo'               => $user['es_coreografo'] ?? false,
    'id_original_representante'   => $user['id_original_representante'] ?? null,
    'id_original_director'        => $user['id_original_director'] ?? null,
    'id_original_coreografo'      => $user['id_original_coreografo'] ?? null,
    'origen'                      => $user['origen'] ?? 'contacto',
    'puede_editar'                => $user['puede_editar'] ?? true,
];

sendJson(['user' => $_SESSION['user_data']]);
