<?php
/**
 * Cloudflare R2 (S3-compatible) — cliente mínimo con AWS Signature V4 a mano.
 * No requiere aws-sdk. Sube/borra objetos del bucket configurado en config.php['r2'].
 *
 * Usa x-amz-content-sha256: UNSIGNED-PAYLOAD + streaming del archivo (CURLOPT_UPLOAD)
 * para no cargar videos de 2 GB en memoria.
 *
 * Config esperada (config.php['r2']):
 *   endpoint         https://<account>.r2.cloudflarestorage.com   (sin bucket)
 *   bucket           festival-danzarte
 *   access_key_id    ...
 *   secret_access_key ...
 *   public_url_base  https://pub-xxxx.r2.dev   (acceso público r2.dev)
 *   region           auto   (R2 acepta cualquiera mientras firme y scope coincidan)
 */
declare(strict_types=1);

final class R2Client
{
    private string $host;        // <account>.r2.cloudflarestorage.com
    private string $scheme;      // https
    private string $bucket;
    private string $accessKey;
    private string $secretKey;
    private string $region;
    private string $publicBase;  // https://pub-xxxx.r2.dev (sin slash final)

    public function __construct(array $cfg)
    {
        $endpoint = rtrim((string)($cfg['endpoint'] ?? ''), '/');
        $parts = parse_url($endpoint);
        $this->scheme = $parts['scheme'] ?? 'https';
        $this->host   = $parts['host'] ?? '';
        $this->bucket = (string)($cfg['bucket'] ?? '');
        $this->accessKey = (string)($cfg['access_key_id'] ?? '');
        $this->secretKey = (string)($cfg['secret_access_key'] ?? '');
        $this->region    = (string)($cfg['region'] ?? 'auto');
        $this->publicBase = rtrim((string)($cfg['public_url_base'] ?? ''), '/');
        if ($this->host === '' || $this->bucket === '' || $this->accessKey === '' || $this->secretKey === '') {
            throw new RuntimeException('R2 mal configurado (endpoint/bucket/keys)');
        }
    }

    /** Codifica el key preservando los "/" entre segmentos (path-style S3). */
    private function encodeKey(string $key): string
    {
        $key = ltrim($key, '/');
        return implode('/', array_map('rawurlencode', explode('/', $key)));
    }

    /** Firma SigV4 y devuelve los headers (incluye Authorization) para method+key. */
    private function signedHeaders(string $method, string $key, string $payloadHash, array $extra = []): array
    {
        $amzDate = gmdate('Ymd\THis\Z');
        $dateStamp = gmdate('Ymd');
        $canonicalUri = '/' . $this->bucket . '/' . $this->encodeKey($key);
        $canonicalQuery = '';

        // Headers a firmar: host, x-amz-content-sha256, x-amz-date (orden alfabético).
        $canonicalHeaders =
            "host:{$this->host}\n" .
            "x-amz-content-sha256:{$payloadHash}\n" .
            "x-amz-date:{$amzDate}\n";
        $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

        $canonicalRequest = implode("\n", [
            $method, $canonicalUri, $canonicalQuery, $canonicalHeaders, $signedHeaders, $payloadHash,
        ]);

        $scope = "{$dateStamp}/{$this->region}/s3/aws4_request";
        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256', $amzDate, $scope, hash('sha256', $canonicalRequest),
        ]);

        $kDate    = hash_hmac('sha256', $dateStamp, 'AWS4' . $this->secretKey, true);
        $kRegion  = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        $auth = "AWS4-HMAC-SHA256 Credential={$this->accessKey}/{$scope}, "
              . "SignedHeaders={$signedHeaders}, Signature={$signature}";

        $headers = [
            "Authorization: {$auth}",
            "x-amz-date: {$amzDate}",
            "x-amz-content-sha256: {$payloadHash}",
        ];
        foreach ($extra as $h) $headers[] = $h;
        return $headers;
    }

    private function url(string $key): string
    {
        return "{$this->scheme}://{$this->host}/{$this->bucket}/" . $this->encodeKey($key);
    }

    /**
     * Sube un archivo (desde path temporal) a R2 en el key dado. Stream, no memoria.
     * Devuelve la URL pública (public_url_base/<key>).
     */
    public function putObject(string $tmpPath, string $mime, string $key): string
    {
        $size = @filesize($tmpPath);
        if ($size === false) throw new RuntimeException('No se pudo leer el archivo a subir');
        $fh = @fopen($tmpPath, 'rb');
        if (!$fh) throw new RuntimeException('No se pudo abrir el archivo a subir');

        // Content-Type va como header NO firmado (R2 lo acepta).
        $headers = $this->signedHeaders('PUT', $key, 'UNSIGNED-PAYLOAD', [
            'Content-Type: ' . $mime,
        ]);

        $ch = curl_init($this->url($key));
        curl_setopt_array($ch, [
            CURLOPT_PUT            => true,
            CURLOPT_UPLOAD         => true,
            CURLOPT_INFILE         => $fh,
            CURLOPT_INFILESIZE     => $size,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 0,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);
        fclose($fh);

        if ($resp === false) {
            error_log("[r2] put cURL: $err");
            throw new RuntimeException('R2 conexión falló: ' . $err);
        }
        if ($http < 200 || $http >= 300) {
            $snippet = is_string($resp) ? substr($resp, 0, 500) : '';
            error_log("[r2] put HTTP $http key=$key: $snippet");
            throw new RuntimeException('R2 HTTP ' . $http . ': ' . $snippet);
        }
        return $this->publicBase . '/' . $this->encodeKey($key);
    }

    /** URL pública (r2.dev) de un key. */
    public function publicUrl(string $key): string
    {
        return $this->publicBase . '/' . $this->encodeKey($key);
    }

    /**
     * Genera una URL PUT firmada (SigV4 query-string) para que el navegador suba
     * el archivo DIRECTO a R2 (sin pasar por PHP). Solo firma el header host, así
     * el cliente puede mandar cualquier Content-Type. Válida $expires segundos.
     */
    public function presignPutUrl(string $key, int $expires = 3600): string
    {
        $amzDate = gmdate('Ymd\THis\Z');
        $dateStamp = gmdate('Ymd');
        $canonicalUri = '/' . $this->bucket . '/' . $this->encodeKey($key);
        $scope = "{$dateStamp}/{$this->region}/s3/aws4_request";

        $params = [
            'X-Amz-Algorithm'     => 'AWS4-HMAC-SHA256',
            'X-Amz-Credential'    => $this->accessKey . '/' . $scope,
            'X-Amz-Date'          => $amzDate,
            'X-Amz-Expires'       => (string)$expires,
            'X-Amz-SignedHeaders' => 'host',
        ];
        ksort($params);
        $canonicalQuery = implode('&', array_map(
            fn($k) => rawurlencode($k) . '=' . rawurlencode($params[$k]),
            array_keys($params)
        ));

        $canonicalHeaders = "host:{$this->host}\n";
        $canonicalRequest = implode("\n", [
            'PUT', $canonicalUri, $canonicalQuery, $canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD',
        ]);
        $stringToSign = implode("\n", [
            'AWS4-HMAC-SHA256', $amzDate, $scope, hash('sha256', $canonicalRequest),
        ]);
        $kDate    = hash_hmac('sha256', $dateStamp, 'AWS4' . $this->secretKey, true);
        $kRegion  = hash_hmac('sha256', $this->region, $kDate, true);
        $kService = hash_hmac('sha256', 's3', $kRegion, true);
        $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
        $signature = hash_hmac('sha256', $stringToSign, $kSigning);

        return "{$this->scheme}://{$this->host}{$canonicalUri}?{$canonicalQuery}&X-Amz-Signature={$signature}";
    }

    /** Borra un objeto del bucket. Best-effort (no lanza si 404). */
    public function deleteObject(string $key): void
    {
        // SHA256 de payload vacío.
        $emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        $headers = $this->signedHeaders('DELETE', $key, $emptyHash);
        $ch = curl_init($this->url($key));
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'DELETE',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($http >= 400 && $http !== 404) {
            error_log("[r2] delete HTTP $http key=$key: " . (is_string($resp) ? substr($resp, 0, 300) : ''));
        }
    }
}

/** Factory: lee config.php['r2']. */
function r2(): R2Client
{
    static $inst = null;
    if ($inst === null) {
        $cfg = require __DIR__ . '/../config.php';
        if (empty($cfg['r2'])) throw new RuntimeException('Falta config["r2"] en config.php');
        $inst = new R2Client($cfg['r2']);
    }
    return $inst;
}
