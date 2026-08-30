<?php
declare(strict_types=1);

/**
 * Login de CLIENTE: correo + contraseña propia.
 *
 * Nada que ver con login.php de participantes, que valida el número de carnet
 * contra festival_contactos_global. Aquí la contraseña es un hash bcrypt de
 * verdad y se compara con password_verify().
 */

require __DIR__ . '/../_lib/auth-cliente.php';

handlePreflight();
requireMethod('POST');

$in = json_decode(file_get_contents('php://input') ?: '[]', true);
if (!is_array($in)) $in = [];

$email    = emailCliente((string)($in['email'] ?? ''));
$password = (string)($in['password'] ?? '');

if ($email === '' || $password === '') {
    sendJson(['error' => 'Ingrese su correo y su contraseña.'], 422);
    exit;
}

$sb = supabase();
$rows = $sb->selectRaw(
    'portal_clientes',
    'select=cliente_id,email,nombre,telefono,password_hash&email=eq.' . rawurlencode($email) . '&limit=1'
);
$row = (is_array($rows) && count($rows) > 0) ? $rows[0] : null;

// Un solo mensaje para "no existe" y "contraseña equivocada": distinguirlos
// convierte el login en un detector de qué correos están registrados.
// Y se corre password_verify contra un hash de descarte aunque no exista la
// cuenta, para que responder "no existe" no sea perceptiblemente más rápido.
$hash = $row['password_hash'] ?? '$2y$10$usuarioinexistenteusuarioinexistenteusuarioinexistenteusuarioi';
$ok = password_verify($password, (string)$hash) && $row !== null;

if (!$ok) {
    sendJson(['error' => 'Correo o contraseña incorrectos.'], 401);
    exit;
}

// Si el algoritmo o el costo cambiaron desde que se creó la cuenta, se
// aprovecha que aquí tenemos la contraseña en claro para reescribir el hash.
if (password_needs_rehash((string)$hash, PASSWORD_DEFAULT)) {
    try {
        $sb->update('portal_clientes', 'cliente_id', $row['cliente_id'], [
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);
    } catch (\Throwable $e) {
        error_log('[cliente login] no se pudo rehashear: ' . $e->getMessage());  // no bloquea
    }
}

try {
    $sb->update('portal_clientes', 'cliente_id', $row['cliente_id'], [
        'ultimo_login_at' => gmdate('c'),
    ]);
} catch (\Throwable $e) {
    error_log('[cliente login] no se pudo marcar ultimo_login_at: ' . $e->getMessage());
}

startSesionCliente();
session_regenerate_id(true);
$_SESSION['cliente_id']   = $row['cliente_id'];
$_SESSION['cliente_data'] = clientePublico($row);

sendJson([
    'cliente'   => clientePublico($row),
    'membresia' => ['paquete_pagada' => clientePagoPaquete((string)$row['cliente_id'])],
]);
