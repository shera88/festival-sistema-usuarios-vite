<?php
declare(strict_types=1);

/**
 * Dispara (fire-and-forget) el webhook n8n que REGENERA la credencial PDF + el
 * perfil del participante a partir de la foto ACTUAL de registro_kardex_2026.
 *
 * Se llama después de rotar / cambiar la foto para que la credencial impresa y
 * el perfil web queden con la orientación nueva. El webhook contesta de
 * inmediato ("Workflow was started", ~<1s) y n8n genera el PDF en segundo
 * plano; sólo se espera ese ack. Timeout corto para no colgar la respuesta si
 * n8n está lento/caído. Cualquier fallo se registra pero NO afecta la operación
 * previa (la columna foto ya se actualizó antes de llamar acá).
 */
function regenCredencial(string $idKardex): void
{
    $idKardex = trim($idKardex);
    if ($idKardex === '') return;

    $cfg = require __DIR__ . '/../config.php';
    $url = $cfg['webhooks']['regen_credencial'] ?? '';
    $secret = $cfg['webhook_shared_secret'] ?? '';
    if ($url === '' || $secret === '') {
        error_log('[regen] webhook o secret sin configurar; se omite');
        return;
    }

    $payload = json_encode(['id_kardex' => $idKardex, 'secret' => $secret]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 4,   // el webhook responde en <1s; cap para no colgar
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_NOSIGNAL       => true,
    ]);
    $resp = curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($resp === false || $http < 200 || $http >= 300) {
        error_log("[regen] disparo credencial $idKardex falló HTTP $http: " . ($err ?: substr((string)$resp, 0, 200)));
    }
}
