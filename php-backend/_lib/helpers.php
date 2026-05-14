<?php
/**
 * Helpers genéricos para los 3 endpoints (inscripcion, kardex, solicitud):
 *   - jerror / jok / jvalidation_error: respuestas JSON estandarizadas.
 *   - get_client_ip: IP real teniendo en cuenta proxies de SiteGround/CF.
 *   - clean_str: trim + remueve caracteres de control + corta a max length.
 *   - rate_limit_check / rate_limit_record: ventana de N requests por IP.
 *   - apply_cors: setea headers CORS + maneja preflight OPTIONS.
 *   - new_id8 / uuidv4: generadores de id (8 hex / UUID v4).
 */

declare(strict_types=1);

function jerror(int $status, string $msg, array $extra = []): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $msg] + $extra, JSON_UNESCAPED_UNICODE);
    exit;
}

function jok(array $payload = []): never {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true] + $payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function jvalidation_error(array $issues): never {
    jerror(400, 'Datos inválidos', ['issues' => $issues]);
}

function get_client_ip(): string {
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $h) {
        if (!empty($_SERVER[$h])) {
            $ip = trim(explode(',', $_SERVER[$h])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '0.0.0.0';
}

function clean_str(?string $s, int $max = 500): string {
    $s = trim((string)($s ?? ''));
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s) ?? '';
    if (mb_strlen($s) > $max) $s = mb_substr($s, 0, $max);
    return $s;
}

function uuidv4(): string {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

/** 8 caracteres hex — convención del proyecto para id_global, id_inscripcion, etc. */
function new_id8(): string {
    return bin2hex(random_bytes(4));
}

function apply_cors(?string $allowedOrigin): void {
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if ($allowedOrigin) {
        header('Access-Control-Allow-Origin: ' . $allowedOrigin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, apikey');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

/** Ventana deslizante por IP basada en archivo. Devuelve true si se excedió. */
function rate_limit_check(string $rlDir, string $ip, int $max, int $windowSec): bool {
    if (!is_dir($rlDir)) @mkdir($rlDir, 0755, true);
    $file = $rlDir . '/' . hash('sha256', $ip) . '.json';
    $now = time();
    $attempts = [];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $data = $raw ? json_decode($raw, true) : [];
        if (is_array($data)) {
            $attempts = array_values(array_filter(
                $data,
                fn($t) => is_int($t) && $t > $now - $windowSec
            ));
        }
    }
    return count($attempts) >= $max;
}

function rate_limit_record(string $rlDir, string $ip): void {
    $file = $rlDir . '/' . hash('sha256', $ip) . '.json';
    $now = time();
    $attempts = [];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $data = $raw ? json_decode($raw, true) : [];
        if (is_array($data)) $attempts = array_filter($data, 'is_int');
    }
    $attempts[] = $now;
    @file_put_contents($file, json_encode(array_values($attempts)), LOCK_EX);
}
