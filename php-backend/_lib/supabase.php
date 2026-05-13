<?php
declare(strict_types=1);

class SupabaseClient
{
    public function __construct(
        private string $url,
        private string $serviceKey
    ) {}

    private function headers(array $extra = []): array
    {
        return array_merge([
            'Authorization: Bearer ' . $this->serviceKey,
            'apikey: ' . $this->serviceKey,
            'Content-Type: application/json',
        ], $extra);
    }

    private function request(string $method, string $url, ?string $body, array $headers, int $timeout = 30): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            error_log("[supabase] cURL $method $url failed: $err");
            return [0, null];
        }
        $decoded = ($resp === '' || $resp === null) ? null : json_decode($resp, true);
        return [$http, $decoded ?? $resp];
    }

    public function select(string $table, array $query): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . http_build_query($query);
        [$status, $body] = $this->request('GET', $url, null, $this->headers());
        if ($status >= 200 && $status < 300 && is_array($body)) return $body;
        error_log("[supabase] select $table failed: HTTP $status — " . json_encode($body));
        return [];
    }

    public function selectRaw(string $table, string $rawQs): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . $rawQs;
        [$status, $body] = $this->request('GET', $url, null, $this->headers());
        if ($status >= 200 && $status < 300 && is_array($body)) return $body;
        error_log("[supabase] selectRaw $table failed: HTTP $status — " . json_encode($body));
        return [];
    }

    public function rpc(string $fn, array $args): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/rpc/$fn";
        [$status, $body] = $this->request(
            'POST',
            $url,
            json_encode($args, JSON_UNESCAPED_UNICODE),
            $this->headers()
        );
        if ($status >= 200 && $status < 300) return is_array($body) ? $body : [];
        error_log("[supabase] rpc $fn failed: HTTP $status — " . json_encode($body));
        return [];
    }
}

function supabase(): SupabaseClient
{
    static $client = null;
    if ($client === null) {
        $cfg = require __DIR__ . '/../config.php';
        $client = new SupabaseClient($cfg['supabase_url'], $cfg['supabase_service_role_key']);
    }
    return $client;
}
