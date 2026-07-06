<?php
declare(strict_types=1);

// Inicia el checkout de la Membresía de Videos 2026.
// Crea una orden PENDIENTE en WooCommerce con el id_kardex de la persona como
// metadato (para que el webhook -> n8n pueda marcarla como pagada) y devuelve la
// URL de pago de WooCommerce. Precio según si reservó en el kárdex (20) o no (50).

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('POST');

$user = requireAuth();
$cfg  = require __DIR__ . '/config.php';
$wc   = $cfg['woocommerce'] ?? null;

if (!$wc || empty($wc['consumer_key']) || empty($wc['consumer_secret'])) {
    sendJson(['error' => 'El checkout de membresía no está configurado.'], 500);
    exit;
}

// Resolver las filas de kárdex de la persona por IDENTIDAD DE SESIÓN (NO por CI:
// el CI viene sucio/compartido entre personas distintas). Login de kárdex →
// id_contacto de la sesión ES el id_kardex exacto. Login de contacto → sus filas
// de kárdex están vinculadas por id_contacto (UUID).
$idContacto = trim((string)($user['id_contacto'] ?? ''));
if ($idContacto === '') { sendJson(['error' => 'Sesión inválida.'], 400); exit; }
$origen = $user['origen'] ?? 'contacto';
$idFilter = ($origen === 'kardex')
    ? 'id_kardex=eq.' . rawurlencode($idContacto)
    : 'id_contacto=eq.' . rawurlencode($idContacto);

$rows = supabase()->selectRaw(
    'registro_kardex_2026',
    'select=id_kardex,membresia,membresia_pagada&' . $idFilter . '&limit=50'
);
if (!is_array($rows) || count($rows) === 0) {
    sendJson(['error' => 'No encontramos tu registro de kárdex. Registrá tu kárdex primero.'], 409);
    exit;
}

// ¿Ya pagó? No hay nada que cobrar.
foreach ($rows as $r) {
    if (!empty($r['membresia_pagada'])) {
        sendJson(['error' => 'Tu membresía ya está pagada.'], 409);
        exit;
    }
}

// Reservó = cualquiera de SUS filas con membresia=true → precio promo. El id_kardex
// a marcar: preferí una fila reservada; si no, la primera.
$reservo = false; $idKardex = null;
foreach ($rows as $r) {
    if (!empty($r['membresia'])) { $reservo = true; if ($idKardex === null) $idKardex = (string)$r['id_kardex']; }
}
if ($idKardex === null) $idKardex = (string)$rows[0]['id_kardex'];

$productId = $reservo ? (int)$wc['producto_reserva_id'] : (int)$wc['producto_regular_id'];

// Crear la orden PENDIENTE en WooCommerce. billing = datos de la SESIÓN (la persona
// logueada que aprieta el botón); meta _id_kardex = a quién desbloquear al pagar.
$payload = [
    'set_paid'    => false,
    'status'      => 'pending',
    'billing'     => [
        'first_name' => (string)($user['nombre_y_apellido'] ?? ''),
        'email'      => (string)($user['correo_electronico'] ?? ''),
        'phone'      => (string)($user['telefono'] ?? ''),
    ],
    'line_items'  => [['product_id' => $productId, 'quantity' => 1]],
    'meta_data'   => [
        ['key' => '_id_kardex',        'value' => $idKardex],
        ['key' => '_id_contacto',      'value' => $idContacto],
        ['key' => '_membresia_videos', 'value' => '2026'],
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

// URL de pago de la orden (pay-for-order de WooCommerce).
$payUrl = rtrim($wc['site_url'], '/') . '/checkout/order-pay/' . (int)$order['id']
        . '/?pay_for_order=true&key=' . rawurlencode((string)($order['order_key'] ?? ''));

sendJson([
    'pay_url'  => $payUrl,
    'order_id' => (int)$order['id'],
    'precio'   => $reservo ? 20 : 50,
]);
