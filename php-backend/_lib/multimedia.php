<?php
/**
 * Helpers para multimedia.
 *
 * Storage paths:
 *  - audio:     uploads-2026/audios/<orden>-<agrupacion>/<obra>.<ext>
 *  - video_led: uploads-2026/videos-led/<orden>-<agrupacion>/<obra>.<ext>
 *
 * Reglas:
 *  - audio: max 100 MB, MIME audio/*
 *  - video_led: sin límite hard (depende del server), MIME video/*
 *  - 1 audio + 1 video por inscripción (UNIQUE en BD)
 */
declare(strict_types=1);

require_once __DIR__ . '/supabase.php';

const MULTIMEDIA_AUDIO_MIMES = [
    'audio/mpeg', 'audio/mp3',
    'audio/wav', 'audio/x-wav',
    'audio/mp4', 'audio/x-m4a', 'audio/m4a',
    'audio/aac',
    'audio/ogg', 'audio/opus',
    'audio/flac',
];

const MULTIMEDIA_VIDEO_MIMES = [
    'video/mp4',
    'video/quicktime',     // .mov
    'video/x-msvideo',     // .avi
    'video/x-matroska',    // .mkv
    'video/webm',
    'video/mpeg',
];

const MULTIMEDIA_AUDIO_MAX_BYTES = 100 * 1024 * 1024;        // 100 MB
const MULTIMEDIA_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024;   // 2 GB

/** Normaliza string a slug ASCII seguro para path/filename. */
function mmSafe(string $s): string
{
    $s = trim($s);
    if ($s === '') return 'sin-nombre';

    // Quita acentos
    $map = [
        'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u',
        'à' => 'a', 'è' => 'e', 'ì' => 'i', 'ò' => 'o', 'ù' => 'u',
        'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ü' => 'u',
        'À' => 'a', 'È' => 'e', 'Ì' => 'i', 'Ò' => 'o', 'Ù' => 'u',
        'ñ' => 'n', 'Ñ' => 'n',
    ];
    $s = strtr($s, $map);
    $s = mb_strtolower($s, 'UTF-8');
    // Reemplaza no-ASCII por dash
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? $s;
    $s = trim($s, '-');
    if ($s === '') return 'sin-nombre';
    // Cap longitud
    if (mb_strlen($s) > 80) $s = mb_substr($s, 0, 80);
    return $s;
}

/** Devuelve extensión válida del MIME (sin punto). */
function mmExtFromMime(string $mime): ?string
{
    $map = [
        'audio/mpeg' => 'mp3', 'audio/mp3' => 'mp3',
        'audio/wav' => 'wav', 'audio/x-wav' => 'wav',
        'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a', 'audio/m4a' => 'm4a',
        'audio/aac' => 'aac',
        'audio/ogg' => 'ogg', 'audio/opus' => 'opus',
        'audio/flac' => 'flac',

        'video/mp4' => 'mp4',
        'video/quicktime' => 'mov',
        'video/x-msvideo' => 'avi',
        'video/x-matroska' => 'mkv',
        'video/webm' => 'webm',
        'video/mpeg' => 'mpeg',
    ];
    return $map[$mime] ?? null;
}

/** Construye storage_path completo (sin el bucket prefix). */
function mmStoragePath(string $tipo, int $orden, string $agrupacion, string $obra, string $ext): string
{
    $folder = $orden . '-' . mmSafe($agrupacion);
    $file = mmSafe($obra) . '.' . $ext;
    $sub = $tipo === 'video_led' ? 'videos-led' : 'audios';
    return "$sub/$folder/$file";
}

/** Genera id_multimedia hex 8. */
function mmNewId(): string
{
    return bin2hex(random_bytes(4));
}
