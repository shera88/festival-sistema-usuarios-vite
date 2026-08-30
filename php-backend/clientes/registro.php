<?php
declare(strict_types=1);

/**
 * Alta de una cuenta de CLIENTE (público general que compra la membresía).
 *
 * POST { email, password, nombre, telefono? } → { cliente: {...} } y deja la
 * sesión abierta, para que después del registro la persona siga derecho al
 * checkout sin volver a escribir la contraseña.
 */

require __DIR__ . '/../_lib/auth-cliente.php';

handlePreflight();
requireMethod('POST');

$in = json_decode(file_get_contents('php://input') ?: '[]', true);
if (!is_array($in)) $in = [];

$email    = emailCliente((string)($in['email'] ?? ''));
$password = (string)($in['password'] ?? '');
$nombre   = trim((string)($in['nombre'] ?? ''));
$telefono = trim((string)($in['telefono'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sendJson(['error' => 'Ingrese un correo electrónico válido.'], 422);
    exit;
}
if (mb_strlen($nombre) < 2) {
    sendJson(['error' => 'Ingrese su nombre completo.'], 422);
    exit;
}
// 8 caracteres es el mínimo que pide cualquier guía seria y no molesta a nadie.
// El tope de 72 es de bcrypt: a partir de ahí trunca en silencio, y una
// contraseña silenciosamente truncada es peor que una corta.
if (strlen($password) < 8) {
    sendJson(['error' => 'La contraseña debe tener al menos 8 caracteres.'], 422);
    exit;
}
if (strlen($password) > 72) {
    sendJson(['error' => 'La contraseña no puede superar los 72 caracteres.'], 422);
    exit;
}

$sb = supabase();

// Se consulta antes para poder dar un mensaje claro, pero el que manda es el
// índice único de la tabla: entre esta lectura y el insert puede entrar otro
// registro con el mismo correo, y esa carrera la corta la base, no este if.
$existe = $sb->selectRaw(
    'portal_clientes',
    'select=cliente_id&email=eq.' . rawurlencode($email) . '&limit=1'
);
if (is_array($existe) && count($existe) > 0) {
    sendJson(['error' => 'Ya existe una cuenta con ese correo. Inicie sesión.'], 409);
    exit;
}

try {
    $sb->insert('portal_clientes', [
        'email'         => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'nombre'        => $nombre,
        'telefono'      => $telefono !== '' ? $telefono : null,
    ]);
} catch (\Throwable $e) {
    // 23505 = choque con el índice único: alguien se registró con ese correo
    // entre la comprobación de arriba y este insert.
    if (str_contains($e->getMessage(), '23505')) {
        sendJson(['error' => 'Ya existe una cuenta con ese correo. Inicie sesión.'], 409);
        exit;
    }
    error_log('[cliente registro] ' . $e->getMessage());
    sendJson(['error' => 'No se pudo crear la cuenta. Intente de nuevo.'], 500);
    exit;
}

$row = $sb->selectOne(
    'portal_clientes',
    'cliente_id,email,nombre,telefono',
    ['email' => 'eq.' . $email]
);
if (!$row) {
    // La cuenta quedó creada; sólo falló releerla. Que inicie sesión a mano.
    sendJson(['error' => 'Cuenta creada. Inicie sesión para continuar.'], 500);
    exit;
}

startSesionCliente();
session_regenerate_id(true);   // corta cualquier id de sesión previo
$_SESSION['cliente_id']   = $row['cliente_id'];
$_SESSION['cliente_data'] = clientePublico($row);

sendJson([
    'cliente'  => clientePublico($row),
    'membresia' => ['paquete_pagada' => false],
], 201);
