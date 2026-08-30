<?php
declare(strict_types=1);

/**
 * Rehidrata la sesión del cliente al cargar la app.
 *
 * La membresía se relee de la base en CADA llamada en vez de guardarse en la
 * sesión: el pago lo acredita n8n por fuera, así que un valor cacheado dejaría
 * al comprador viendo "no pagado" hasta que cerrara sesión. Es una consulta
 * barata por owner_id.
 */

require __DIR__ . '/../_lib/auth-cliente.php';

handlePreflight();
requireMethod('GET');

$cliente = requireCliente();

sendJson([
    'cliente'   => $cliente,
    'membresia' => ['paquete_pagada' => clientePagoPaquete((string)($cliente['cliente_id'] ?? ''))],
]);
