<?php
declare(strict_types=1);

class SupabaseClient
{
    public function __construct(
        private string $url,
        private string $serviceKey,
        private string $bucket = ''
    ) {}

    private function pgHeaders(array $extra = []): array
    {
        return array_merge([
            'Authorization: Bearer ' . $this->serviceKey,
            'apikey: ' . $this->serviceKey,
            'Content-Type: application/json',
        ], $extra);
    }

    /** Alias para retrocompatibilidad */
    private function headers(array $extra = []): array
    {
        return $this->pgHeaders($extra);
    }

    private function request(string $method, string $url, $body, array $headers, int $timeout = 30): array
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
        $err = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            error_log("[supabase] cURL $method $url failed: $err");
            return [0, null];
        }
        $decoded = ($resp === '' || $resp === null) ? null : json_decode($resp, true);
        return [$http, $decoded ?? $resp];
    }

    /**
     * SELECT con dos firmas soportadas:
     *  - select(table, ['select' => '*', 'col' => 'eq.x'])           ← mi estilo legacy
     *  - select(table, 'col1,col2', ['col.eq' => 'x'], limit)        ← estilo festival
     */
    public function select(string $table, $arg2 = '*', array $filters = [], ?int $limit = null): array
    {
        if (is_array($arg2)) {
            // Estilo legacy mío: arg2 es el array hash completo
            $qs = $arg2;
        } else {
            $qs = ['select' => $arg2];
            foreach ($filters as $k => $v) $qs[$k] = $v;
            if ($limit !== null) $qs['limit'] = (string)$limit;
        }
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . http_build_query($qs);
        [$status, $body] = $this->request('GET', $url, null, $this->pgHeaders());
        if ($status >= 200 && $status < 300 && is_array($body)) return $body;
        error_log("[supabase] select $table failed: HTTP $status — " . json_encode($body));
        return [];
    }

    public function selectOne(string $table, string $columns, array $filters): ?array
    {
        $rows = $this->select($table, $columns, $filters, 1);
        return $rows[0] ?? null;
    }

    public function selectRaw(string $table, string $rawQs): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . $rawQs;
        [$status, $body] = $this->request('GET', $url, null, $this->pgHeaders());
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
            $this->pgHeaders()
        );
        if ($status >= 200 && $status < 300) return is_array($body) ? $body : [];
        error_log("[supabase] rpc $fn failed: HTTP $status — " . json_encode($body));
        return [];
    }

    public function insert(string $table, array $row): void
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table";
        [$status, $body] = $this->request(
            'POST',
            $url,
            json_encode($row, JSON_UNESCAPED_UNICODE),
            $this->pgHeaders(['Prefer: return=minimal']),
        );
        if ($status < 200 || $status >= 300) {
            $msg = is_array($body) ? ($body['message'] ?? json_encode($body)) : (string)$body;
            throw new RuntimeException("INSERT $table HTTP $status: $msg");
        }
    }

    /**
     * UPSERT via PostgREST. Si el row con la(s) PK choca, hace UPDATE en su lugar.
     * $onConflict: nombre(s) de columna(s) de la PK separadas por coma (ej. "id_agrupacion,year").
     */
    public function upsert(string $table, array $row, string $onConflict): void
    {
        $qs = http_build_query(['on_conflict' => $onConflict]);
        $url = rtrim($this->url, '/') . "/rest/v1/$table?$qs";
        [$status, $body] = $this->request(
            'POST',
            $url,
            json_encode($row, JSON_UNESCAPED_UNICODE),
            $this->pgHeaders([
                'Prefer: return=minimal,resolution=merge-duplicates',
            ]),
        );
        if ($status < 200 || $status >= 300) {
            $msg = is_array($body) ? ($body['message'] ?? json_encode($body)) : (string)$body;
            throw new RuntimeException("UPSERT $table HTTP $status: $msg");
        }
    }

    public function update(string $table, string $whereCol, $whereVal, array $patch): void
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . http_build_query(["$whereCol" => "eq.$whereVal"]);
        [$status, $body] = $this->request(
            'PATCH',
            $url,
            json_encode($patch, JSON_UNESCAPED_UNICODE),
            $this->pgHeaders(['Prefer: return=minimal']),
        );
        if ($status < 200 || $status >= 300) {
            $msg = is_array($body) ? ($body['message'] ?? json_encode($body)) : (string)$body;
            error_log("[supabase] UPDATE $table HTTP $status: $msg");
        }
    }

    /** DELETE row(s) where col = val. Devuelve cantidad de filas eliminadas (header Content-Range). */
    public function delete(string $table, string $whereCol, $whereVal): int
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . http_build_query(["$whereCol" => "eq.$whereVal"]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'DELETE',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER         => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => $this->pgHeaders(['Prefer: return=representation,count=exact']),
        ]);
        $resp = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($status < 200 || $status >= 300) {
            $body = is_string($resp) ? substr($resp, $headerSize) : '';
            error_log("[supabase] DELETE $table HTTP $status: $body");
            throw new RuntimeException("DELETE $table HTTP $status");
        }

        // Si return=representation, body es array JSON de filas eliminadas
        $bodyStr = is_string($resp) ? substr($resp, $headerSize) : '';
        $decoded = json_decode($bodyStr, true);
        if (is_array($decoded)) return count($decoded);
        return 0;
    }

    /** Ejecuta múltiples GET en paralelo usando curl_multi. */
    public function selectRawBatch(array $queries): array
    {
        if (count($queries) === 0) return [];
        $mh = curl_multi_init();
        $handles = [];
        foreach ($queries as $i => $q) {
            $url = rtrim($this->url, '/') . "/rest/v1/" . $q['table'] . '?' . $q['qs'];
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 30,
                CURLOPT_HTTPHEADER     => $this->pgHeaders(),
            ]);
            curl_multi_add_handle($mh, $ch);
            $handles[$i] = $ch;
        }
        $running = null;
        do {
            curl_multi_exec($mh, $running);
            if ($running > 0) curl_multi_select($mh, 0.5);
        } while ($running > 0);

        $results = [];
        foreach ($handles as $i => $ch) {
            $resp = curl_multi_getcontent($ch);
            $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
            if ($status >= 200 && $status < 300) {
                $decoded = json_decode($resp, true);
                $results[$i] = is_array($decoded) ? $decoded : [];
            } else {
                error_log("[supabase] batch[$i] failed: HTTP $status");
                $results[$i] = [];
            }
        }
        curl_multi_close($mh);
        return $results;
    }

    /**
     * Sube archivo a un path EXACTO dentro del bucket (sin autogenerar nombre).
     * Útil cuando el path es semántico (ej. audios/<orden>-<agrup>/<obra>.<ext>).
     * `upsert=true` permite sobrescribir si existe (para reemplazo).
     */
    public function uploadPublicFileAt(string $tmpPath, string $mime, string $path, bool $upsert = true): string
    {
        $uploadUrl = rtrim($this->url, '/') . "/storage/v1/object/{$this->bucket}/$path";
        $fileContents = file_get_contents($tmpPath);
        if ($fileContents === false) {
            throw new RuntimeException('No se pudo leer el archivo subido');
        }

        // POST con body binario + x-upsert para sobrescribir.
        // cURL agrega Content-Length automáticamente desde POSTFIELDS.
        $ch = curl_init($uploadUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $fileContents,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 0,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $this->serviceKey,
                'apikey: ' . $this->serviceKey,
                'Content-Type: ' . $mime,
                'x-upsert: ' . ($upsert ? 'true' : 'false'),
                'Cache-Control: public, max-age=3600',
            ],
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            error_log("[supabase] upload@path cURL: $err");
            throw new RuntimeException('Conexión falló: ' . $err);
        }
        if ($http < 200 || $http >= 300) {
            $snippet = is_string($resp) ? substr($resp, 0, 500) : '';
            error_log("[supabase] upload@path HTTP $http path=$path: $snippet");
            throw new RuntimeException('Storage HTTP ' . $http . ': ' . $snippet);
        }

        return rtrim($this->url, '/') . "/storage/v1/object/public/{$this->bucket}/$path";
    }

    /**
     * Sube archivo (nombre autogenerado). Si es imagen rasterizada, genera
     * WebP optimizado (redimensionado) y lo sirve; el ORIGINAL se preserva en
     * `<prefix>/originals/`. Reutiliza uploadPublicFileAt para subir bytes.
     */
    public function uploadPublicFile(string $tmpPath, string $mime, string $prefix): string
    {
        $base = sprintf('%d-%s', (int)(microtime(true) * 1000), uuidv4());

        if (in_array($mime, ['image/jpeg', 'image/png', 'image/gif', 'image/webp'], true)) {
            $webp = $this->toWebp($tmpPath, $mime);
            if ($webp !== null) {
                // Preservar original (best-effort).
                try {
                    $this->uploadPublicFileAt($tmpPath, $mime, "$prefix/originals/$base." . $this->extFromType($mime), true);
                } catch (Throwable $e) {
                    error_log('[supabase] no se pudo guardar original: ' . $e->getMessage());
                }
                // Subir webp desde tempfile.
                $wt = tempnam(sys_get_temp_dir(), 'webp_');
                file_put_contents($wt, $webp);
                try {
                    return $this->uploadPublicFileAt($wt, 'image/webp', "$prefix/$base.webp", true);
                } finally {
                    @unlink($wt);
                }
            }
            // GD sin webp -> guardado normal abajo.
        }

        return $this->uploadPublicFileAt($tmpPath, $mime, "$prefix/$base." . $this->extFromType($mime), false);
    }

    /**
     * Convierte una imagen a WebP redimensionada (lado mayor <= $maxDim).
     * Devuelve bytes WebP, o null si GD no soporta webp / falla la lectura.
     */
    private function toWebp(string $tmpPath, string $mime, int $maxDim = 512, int $quality = 80): ?string
    {
        if (!function_exists('imagewebp')) return null;
        $src = match ($mime) {
            'image/jpeg' => @imagecreatefromjpeg($tmpPath),
            'image/png'  => @imagecreatefrompng($tmpPath),
            'image/gif'  => @imagecreatefromgif($tmpPath),
            'image/webp' => @imagecreatefromwebp($tmpPath),
            default      => null,
        };
        if (!$src) return null;

        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1.0, $maxDim / max($w, $h));
        $nw = max(1, (int)round($w * $scale));
        $nh = max(1, (int)round($h * $scale));

        $dst = imagecreatetruecolor($nw, $nh);
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        ob_start();
        $ok = imagewebp($dst, null, $quality);
        $bytes = ob_get_clean();
        imagedestroy($src);
        imagedestroy($dst);

        return ($ok && $bytes !== '') ? $bytes : null;
    }

    public function mirrorExternalUrl(string $url, string $prefix): ?string
    {
        if ($url === '') return null;
        $ourBase = rtrim($this->url, '/') . "/storage/v1/object/public/{$this->bucket}/";
        if (str_starts_with($url, $ourBase)) return $url;

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_USERAGENT      => 'Festival-Danzarte-Mirror/1.0',
        ]);
        $body = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        if ($body === false || $http < 200 || $http >= 300) return null;
        $mime = trim(explode(';', $contentType)[0] ?? 'image/jpeg');
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) return null;

        $tmp = tempnam(sys_get_temp_dir(), 'mirror_');
        if ($tmp === false) return null;
        file_put_contents($tmp, $body);
        try {
            return $this->uploadPublicFile($tmp, $mime, $prefix);
        } catch (Throwable $e) {
            return null;
        } finally {
            @unlink($tmp);
        }
    }

    public function deleteObject(string $bucketPath): void
    {
        $url = rtrim($this->url, '/') . "/storage/v1/object/{$this->bucket}/$bucketPath";
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'DELETE',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $this->serviceKey,
                'apikey: ' . $this->serviceKey,
            ],
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    private function extFromType(string $mime): string
    {
        return [
            'image/jpeg' => 'jpg',
            'image/png'  => 'png',
            'image/webp' => 'webp',
            'image/gif'  => 'gif',
        ][$mime] ?? 'bin';
    }
}

function supabase(): SupabaseClient
{
    static $client = null;
    if ($client === null) {
        $cfg = require __DIR__ . '/../config.php';
        $key = $cfg['supabase_service_role_key'] ?? $cfg['supabase_service_key'] ?? '';
        $bucket = $cfg['storage_bucket'] ?? '';
        $client = new SupabaseClient($cfg['supabase_url'], $key, $bucket);
    }
    return $client;
}
