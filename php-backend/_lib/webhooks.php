<?php
/**
 * Webhook dispatch fire-and-forget — pensado para n8n.
 *
 * El form ya grabó en Supabase. Si el webhook falla o tarda, el usuario
 * igual ve éxito; el error queda en error_log. Timeouts cortos para no
 * bloquear la respuesta HTTP que el navegador está esperando.
 */

declare(strict_types=1);

function dispatch_webhook(?string $url, array $payload, int $timeoutSec = 10): void {
    if (!$url) {
        error_log('[webhook] URL vacía — no se envía');
        return;
    }
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        error_log('[webhook] json_encode falló');
        return;
    }
    $logFile = __DIR__ . '/../webhook-log.txt';
    $host = parse_url($url, PHP_URL_HOST) ?: $url;
    file_put_contents($logFile, sprintf("[%s] >> POST %s (body %d bytes)\n", date('c'), $host, strlen($body)), FILE_APPEND);

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT        => $timeoutSec,
        CURLOPT_FAILONERROR    => false,
    ]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    $snippet = is_string($resp) ? mb_substr($resp, 0, 300) : '';
    $logLine = sprintf("[%s] << %s code=%s err=%s resp=%s\n", date('c'), $host, $code, $err, $snippet);
    file_put_contents($logFile, $logLine, FILE_APPEND);

    if ($resp === false || $code < 200 || $code >= 300) {
        error_log(sprintf('[webhook] %s code=%s err=%s resp=%s', $host, $code, $err, $snippet));
    }
}
