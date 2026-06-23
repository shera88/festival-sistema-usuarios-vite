<?php
declare(strict_types=1);

/**
 * Google Drive uploader.
 * Resumable upload (handles files hasta 2 GB+).
 * Refresh-token flow: no requiere login interactivo.
 */

class DriveClient
{
    public function __construct(
        private string $clientId,
        private string $clientSecret,
        private string $refreshToken,
        private string $folderId
    ) {}

    private function accessToken(): string
    {
        static $cached = null;
        static $expiresAt = 0;
        if ($cached && time() < $expiresAt - 30) return $cached;

        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_POSTFIELDS => http_build_query([
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
                'grant_type' => 'refresh_token',
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($http !== 200) {
            throw new RuntimeException("Drive token HTTP $http: $resp");
        }
        $data = json_decode($resp, true);
        if (!isset($data['access_token'])) {
            throw new RuntimeException('Drive token sin access_token: ' . $resp);
        }
        $cached = $data['access_token'];
        $expiresAt = time() + (int)($data['expires_in'] ?? 3600);
        return $cached;
    }

    /**
     * Sube archivo a Drive vía resumable upload.
     * Marca el archivo como "anyone with link can view" y retorna links.
     *
     * @return array{file_id:string, web_view_link:string, embed_link:string, direct_link:string}
     */
    public function uploadVideo(string $localPath, string $mime, string $filename): array
    {
        if (!is_readable($localPath)) {
            throw new RuntimeException("Archivo local no legible: $localPath");
        }
        $size = filesize($localPath);
        if ($size === false || $size <= 0) {
            throw new RuntimeException('Tamaño de archivo inválido');
        }
        $token = $this->accessToken();

        // Paso 1: iniciar resumable session, obtener Location header
        $metadata = json_encode([
            'name' => $filename,
            'parents' => [$this->folderId],
        ]);
        $location = null;
        $ch = curl_init('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POSTFIELDS => $metadata,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json; charset=UTF-8',
                'X-Upload-Content-Type: ' . $mime,
                'X-Upload-Content-Length: ' . $size,
            ],
            CURLOPT_HEADERFUNCTION => function ($curl, $header) use (&$location) {
                if (stripos($header, 'location:') === 0) {
                    $location = trim(substr($header, 9));
                }
                return strlen($header);
            },
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($http !== 200 || !$location) {
            throw new RuntimeException("Drive init HTTP $http: $resp");
        }

        // Paso 2: PUT del file body al upload URL
        $fp = fopen($localPath, 'rb');
        if (!$fp) throw new RuntimeException('No se pudo abrir archivo para lectura');
        $ch = curl_init($location);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'PUT',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 0, // sin límite para videos grandes
            CURLOPT_PUT => true,
            CURLOPT_INFILE => $fp,
            CURLOPT_INFILESIZE => $size,
            CURLOPT_HTTPHEADER => [
                'Content-Type: ' . $mime,
                'Content-Length: ' . $size,
            ],
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        fclose($fp);
        if ($http !== 200 && $http !== 201) {
            throw new RuntimeException("Drive upload HTTP $http: $resp $err");
        }
        $data = json_decode($resp, true);
        $fileId = $data['id'] ?? null;
        if (!$fileId) throw new RuntimeException('Drive upload sin id: ' . $resp);

        // Paso 3: marcar como anyone-with-link reader
        $this->makePublic($fileId);

        return [
            'file_id' => $fileId,
            'web_view_link' => "https://drive.google.com/file/d/$fileId/view",
            'embed_link' => "https://drive.google.com/file/d/$fileId/preview",
            'direct_link' => "https://drive.google.com/uc?export=download&id=$fileId",
        ];
    }

    private function makePublic(string $fileId): void
    {
        $token = $this->accessToken();
        $ch = curl_init("https://www.googleapis.com/drive/v3/files/$fileId/permissions?supportsAllDrives=true");
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_POSTFIELDS => json_encode([
                'role' => 'reader',
                'type' => 'anyone',
            ]),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $token,
                'Content-Type: application/json',
            ],
        ]);
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($http < 200 || $http >= 300) {
            throw new RuntimeException("Drive permissions HTTP $http: $resp");
        }
    }

    public function deleteFile(string $fileId): void
    {
        $token = $this->accessToken();
        $ch = curl_init("https://www.googleapis.com/drive/v3/files/$fileId?supportsAllDrives=true");
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        ]);
        curl_exec($ch);
        curl_close($ch);
    }
}

function drive(): DriveClient
{
    static $client = null;
    if ($client === null) {
        $cfg = require __DIR__ . '/../config.php';
        $d = $cfg['drive'] ?? [];
        foreach (['client_id', 'client_secret', 'refresh_token', 'folder_id'] as $k) {
            if (empty($d[$k])) {
                throw new RuntimeException("Falta config drive.$k");
            }
        }
        $client = new DriveClient($d['client_id'], $d['client_secret'], $d['refresh_token'], $d['folder_id']);
    }
    return $client;
}

/** Detecta si un storage_path apunta a Drive (prefijo drive:) vs Supabase Storage. */
function isDrivePath(string $path): bool
{
    return str_starts_with($path, 'drive:');
}

/** Extrae fileId de un storage_path tipo drive:FILEID */
function driveFileIdFromPath(string $path): string
{
    return isDrivePath($path) ? substr($path, 6) : '';
}
