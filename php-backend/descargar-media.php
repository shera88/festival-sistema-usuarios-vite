<?php
declare(strict_types=1);

/**
 * Proxy de descarga same-origin para audio/video de las obras.
 *
 * Motivo: los archivos viven en supabase.imaginarte.cloud / R2 (pub-*.r2.dev),
 * hosts que NO envían Access-Control-Allow-Origin. En el navegador un
 * fetch()+blob para renombrar la descarga queda bloqueado por CORS, así que la
 * descarga sale con el nombre crudo (UUID). Este endpoint hace de intermediario
 * DESDE EL MISMO ORIGEN y fuerza el nombre dinámico vía Content-Disposition.
 *
 * GET /descargar-media.php?u=<url pública>&n=<nombre con extensión>
 * Sólo hosts en la lista blanca (evita proxy abierto / SSRF). No requiere sesión:
 * los archivos ya son públicos (bucket público), y así funciona igual en móvil
 * (Capacitor) donde la cookie sería cross-origin.
 */
require __DIR__ . '/_lib/auth.php';

// CRÍTICO: ningún warning/notice puede filtrarse al stream binario (corrompería
// el MP4 — un byte extra al inicio y no reproduce). Van al log, nunca al output.
ini_set('display_errors', '0');

handlePreflight();
requireMethod('GET');

$u = (string)($_GET['u'] ?? '');
$n = (string)($_GET['n'] ?? '');

$p = parse_url($u);
$ALLOWED_HOSTS = [
    'supabase.imaginarte.cloud',
    'pub-65c93de352104b16bc9d770bde42f93d.r2.dev',
];
if (($p['scheme'] ?? '') !== 'https' || !in_array($p['host'] ?? '', $ALLOWED_HOSTS, true)) {
    sendJson(['error' => 'URL no permitida'], 400);
    exit;
}

// Nombre de descarga: el dinámico si viene; si no, el basename del archivo.
$name = $n !== '' ? $n : basename((string)($p['path'] ?? 'archivo'));
$name = preg_replace('/[\r\n"\\\\]+/', '', $name); // header-safe (sin CR/LF/comillas)
if ($name === '' || $name === null) {
    $name = 'archivo';
}

// Content-Type por extensión real del archivo.
$ext = strtolower(pathinfo((string)($p['path'] ?? ''), PATHINFO_EXTENSION));
$CTYPES = [
    'mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'm4a' => 'audio/mp4', 'aac' => 'audio/aac',
    'ogg' => 'audio/ogg', 'flac' => 'audio/flac',
    'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'webm' => 'video/webm',
    'mkv' => 'video/x-matroska', 'avi' => 'video/x-msvideo',
];
$ct = $CTYPES[$ext] ?? 'application/octet-stream';

// Limpiar cualquier buffer previo para poder hacer streaming crudo.
while (ob_get_level() > 0) {
    ob_end_clean();
}

header('Content-Type: ' . $ct);
header('Content-Disposition: attachment; filename="' . $name . '"; filename*=UTF-8\'\'' . rawurlencode($name));
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, max-age=0, no-cache');

// Stream directo con WRITEFUNCTION (NO CURLOPT_FILE con php://output: PHP no lo
// acepta como STDIO y emite un warning que se cuela en el binario y lo corrompe).
$ch = curl_init($u);
curl_setopt_array($ch, [
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT        => 300,
    CURLOPT_FAILONERROR    => true,
    CURLOPT_WRITEFUNCTION  => function ($ch, $data) {
        echo $data;
        return strlen($data);
    },
]);
$ok  = curl_exec($ch);
$err = curl_error($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($ok === false) {
    error_log("[descargar-media] fallo curl code=$code err=$err u=$u");
}
