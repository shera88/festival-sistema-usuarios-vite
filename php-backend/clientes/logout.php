<?php
declare(strict_types=1);

/**
 * Cierra la sesión de CLIENTE. Idempotente y sin guard, igual que logout.php de
 * participantes: pedir sesión para poder cerrarla sólo estorba cuando ya venció.
 *
 * Toca únicamente el realm de clientes: si la misma persona además tiene sesión
 * de participante abierta, esa no se ve afectada.
 */

require __DIR__ . '/../_lib/auth-cliente.php';

handlePreflight();
requireMethod('POST');

destroySesionCliente();
sendJson(['ok' => true]);
