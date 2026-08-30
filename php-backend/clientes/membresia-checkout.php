<?php
declare(strict_types=1);

/**
 * Arranca la compra del Paquete Completo para un CLIENTE de membresía.
 *
 * Crea una orden PENDIENTE en WooCommerce y devuelve la URL de pago. Al cobrarse,
 * el webhook de Woo despierta al workflow de n8n (OA9SKhCmfiCbyMtd), que lee los
 * metadatos y llama a marcar_membresia_paquete_2026.
 *
 * Los tres metadatos que importan, y por qué:
 *   _owner_id           = cliente_id. Es el ancla: la RPC marca la membresía por
 *                         owner_id, y clientePagoPaquete() la busca por ahí.
 *   _origen             = 'cliente'. Sin esto n8n manda 'contacto' (su default) y
 *                         la fila quedaría mintiendo sobre de dónde vino.
 *   _membresia_paquete  = '2026'. Es lo que hace que n8n reconozca la orden como
 *                         de membresía en vez de descartarla.
 *
 * NO se mandan _id_kardex ni _id_contacto: un cliente no tiene ni una cosa ni la
 * otra, y la RPC ya los acepta nulos.
 *
 * Precio: siempre el REGULAR (Bs 80). El precio de reserva es para quien marcó la
 * membresía en su kárdex antes del festival, que es algo de participantes.
 */

require __DIR__ . '/../_lib/auth-cliente.php';   // ya trae supabase.php

handlePreflight();
requireMethod('POST');

$cliente   = requireCliente();
$clienteId = trim((string)($cliente['cliente_id'] ?? ''));
if ($clienteId === '') {
    sendJson(['error' => 'Sesión inválida.'], 400);
    exit;
}

$cfg = require __DIR__ . '/../config.php';
$wc  = $cfg['woocommerce'] ?? null;
if (!$wc || empty($wc['consumer_key']) || empty($wc['consumer_secret'])) {
    sendJson(['error' => 'El checkout de membresía no está configurado.'], 500);
    exit;
}

$productId = (int)($wc['producto_paquete_regular_id'] ?? 0);
if ($productId <= 0) {
    sendJson(['error' => 'El producto de la membresía no está configurado.'], 500);
    exit;
}

$sb = supabase();

// Si ya pagó, no se le crea otra orden: cobrarle dos veces lo mismo es el peor
// error posible aquí.
$memExist = $sb->selectOne(
    'membresias_videos_2026',
    'id,paquete_pagada',
    ['owner_id' => 'eq.' . $clienteId]
);
if ($memExist && !empty($memExist['paquete_pagada'])) {
    sendJson(['error' => 'Su membresía ya está pagada.'], 409);
    exit;
}

$payload = [
    'set_paid'   => false,
    'status'     => 'pending',
    'billing'    => [
        'first_name' => (string)($cliente['nombre'] ?? ''),
        'email'      => (string)($cliente['email'] ?? ''),
        'phone'      => (string)($cliente['telefono'] ?? ''),
    ],
    'line_items' => [['product_id' => $productId, 'quantity' => 1]],
    'meta_data'  => [
        ['key' => '_owner_id',          'value' => $clienteId],
        ['key' => '_origen',            'value' => 'cliente'],
        ['key' => '_membresia_paquete', 'value' => '2026'],
    ],
];

$ch = curl_init(rtrim($wc['rest_api_base'], '/') . '/orders');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_USERPWD        => $wc['consumer_key'] . ':' . $wc['consumer_secret'],
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_TIMEOUT        => 25,
]);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

$order = json_decode((string)$resp, true);
if ($code < 200 || $code >= 300 || empty($order['id'])) {
    sendJson([
        'error'   => 'No se pudo crear la orden de pago.',
        'detalle' => $order['message'] ?? $err ?? "HTTP $code",
    ], 502);
    exit;
}

// Se deja la membresía PENDIENTE con el order_id. Si esto fallara, el pago igual
// se acredita: n8n marca por owner_id, que va en los metadatos de la orden. Por
// eso no bloquea el checkout.
try {
    $fila = [
        'owner_id' => $clienteId,
        'origen'   => 'cliente',
        'order_id' => (string)$order['id'],
    ];
    if ($memExist && !empty($memExist['id'])) {
        $sb->update('membresias_videos_2026', 'owner_id', $clienteId, $fila);
    } else {
        $sb->insert('membresias_videos_2026', $fila);
    }
} catch (\Throwable $e) {
    error_log('[cliente checkout] no se pudo dejar la membresia pendiente: ' . $e->getMessage());
}

$payUrl = rtrim($wc['site_url'], '/') . '/checkout/order-pay/' . (int)$order['id']
        . '/?pay_for_order=true&key=' . rawurlencode((string)($order['order_key'] ?? ''));

sendJson([
    'pay_url'  => $payUrl,
    'order_id' => (int)$order['id'],
    'precio'   => 80,
]);
