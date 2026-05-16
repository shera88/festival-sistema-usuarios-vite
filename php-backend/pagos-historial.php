<?php
/**
 * GET /pagos-historial.php?ano=2025
 *
 * Devuelve historial de pagos del usuario para un año específico (read-only).
 * Para año actual (2026) usar /pagos-resumen.php que incluye deudas/compromisos.
 *
 * Query params:
 *   - ano (int, opcional): si vacío devuelve todos los años
 *
 * Response:
 *   {
 *     ok: true,
 *     ano: 2025 | null,
 *     historial: PagoHistorialItem[],
 *     anos_disponibles: { ano, total_pagos, total_monto }[]
 *   }
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => 'PHP fatal: ' . $err['message']]);
    }
});

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
$userNombre = trim((string)($user['nombre_y_apellido'] ?? ''));
$userNombres = $userNombre !== '' ? [$userNombre] : [];

if (empty($userAgrups) && empty($userNombres)) {
    sendJson(['ok' => true, 'ano' => null, 'historial' => [], 'anos_disponibles' => []], 200);
    exit;
}

$ano = isset($_GET['ano']) && $_GET['ano'] !== '' ? (int)$_GET['ano'] : null;
if ($ano !== null && ($ano < 2000 || $ano > 2100)) {
    sendJson(['error' => 'año inválido'], 400);
    exit;
}

$cfg = require __DIR__ . '/config.php';
$key = $cfg['supabase_service_role_key'] ?? $cfg['supabase_service_key'];
$baseUrl = rtrim($cfg['supabase_url'], '/');

// Helper RPC call
function rpcCall(string $url, string $key, array $body): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($body),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $key,
            'apikey: ' . $key,
            'Content-Type: application/json',
        ],
    ]);
    $resp = curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($http < 200 || $http >= 300) {
        error_log("[pagos-historial] RPC HTTP $http: " . substr((string)$resp, 0, 500));
        return [];
    }
    $decoded = json_decode((string)$resp, true);
    return is_array($decoded) ? $decoded : [];
}

// 1) Historial filtrado por año (o todos)
$historial = rpcCall(
    $baseUrl . '/rest/v1/rpc/historial_pagos_persona',
    $key,
    [
        'p_id_agrupaciones' => $userAgrups,
        'p_nombres'         => $userNombres,
        'p_ano'             => $ano,
    ]
);

// 2) Años disponibles para el usuario (siempre se devuelve, para construir tabs)
$anos = rpcCall(
    $baseUrl . '/rest/v1/rpc/anos_con_pagos_persona',
    $key,
    [
        'p_id_agrupaciones' => $userAgrups,
        'p_nombres'         => $userNombres,
    ]
);

sendJson([
    'ok'              => true,
    'ano'             => $ano,
    'historial'       => $historial,
    'anos_disponibles' => $anos,
], 200);
