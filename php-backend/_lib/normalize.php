<?php
/**
 * Normalización de strings — único origen de verdad para los 3 endpoints PHP.
 * Réplica funcional de lo que viven en TypeScript:
 *   - upper_norm(): trim + colapso espacios + sin tildes (preserva Ñ) + MAYÚSCULAS.
 *   - email_norm(): trim + minúsculas (sin strip de tildes — SMTP no las acepta).
 *   - normalize_name(): forma comparable case-insensitive (lower + colapso).
 *   - add_to_list(): mantiene una columna histórica separada por ", " sin
 *     duplicados (case-insensitive sobre la forma normalizada).
 *   - derive_genero(): mapea modalidad → género (FOLKLORE / ACADEMICO / URBANO).
 */

declare(strict_types=1);

const ACCENT_MAP = [
    'á' => 'a', 'à' => 'a', 'ä' => 'a', 'â' => 'a', 'ã' => 'a',
    'é' => 'e', 'è' => 'e', 'ë' => 'e', 'ê' => 'e',
    'í' => 'i', 'ì' => 'i', 'ï' => 'i', 'î' => 'i',
    'ó' => 'o', 'ò' => 'o', 'ö' => 'o', 'ô' => 'o', 'õ' => 'o',
    'ú' => 'u', 'ù' => 'u', 'ü' => 'u', 'û' => 'u',
    'Á' => 'A', 'À' => 'A', 'Ä' => 'A', 'Â' => 'A', 'Ã' => 'A',
    'É' => 'E', 'È' => 'E', 'Ë' => 'E', 'Ê' => 'E',
    'Í' => 'I', 'Ì' => 'I', 'Ï' => 'I', 'Î' => 'I',
    'Ó' => 'O', 'Ò' => 'O', 'Ö' => 'O', 'Ô' => 'O', 'Õ' => 'O',
    'Ú' => 'U', 'Ù' => 'U', 'Ü' => 'U', 'Û' => 'U',
];

function strip_accents(string $s): string {
    return strtr($s, ACCENT_MAP);
}

/**
 * trim + colapsa espacios múltiples + sin tildes (preserva Ñ) + MAYÚSCULAS.
 * Devuelve null si el resultado quedó vacío (para no propagar strings vacíos).
 */
function upper_norm(?string $s): ?string {
    if ($s === null) return null;
    $t = trim($s);
    $t = preg_replace('/\s+/u', ' ', $t) ?? '';
    $t = strip_accents($t);
    return $t === '' ? null : mb_strtoupper($t, 'UTF-8');
}

/** trim + lowercase. Devuelve null si vacío. */
function email_norm(?string $s): ?string {
    if ($s === null) return null;
    $t = mb_strtolower(trim($s), 'UTF-8');
    return $t === '' ? null : $t;
}

/** Forma comparable de un nombre — para deduplicar lookups. */
function normalize_name(string $s): string {
    $t = mb_strtolower(trim($s), 'UTF-8');
    return preg_replace('/\s+/u', ' ', $t) ?? '';
}

/**
 * Acumula `$newValue` en una lista separada por ", " preservando orden de
 * inserción y deduplicando case-insensitive. Devuelve null si no hay items.
 */
function add_to_list(?string $existing, ?string $newValue): ?string {
    $items = [];
    $seen = [];
    $push = function (string $v) use (&$items, &$seen): void {
        $t = trim($v);
        $t = preg_replace('/\s+/u', ' ', $t) ?? '';
        if ($t === '') return;
        $key = mb_strtolower($t, 'UTF-8');
        if (isset($seen[$key])) return;
        $seen[$key] = true;
        $items[] = $t;
    };
    if ($existing) {
        foreach (explode(',', $existing) as $part) $push($part);
    }
    if ($newValue) $push($newValue);
    return empty($items) ? null : implode(', ', $items);
}

/**
 * Convierte un nombre humano en un slug seguro para paths de Storage.
 *   "BALLET ÑACA-ÑACA"   → "ballet-naca-naca"
 *   "Academia Pasos & Co" → "academia-pasos-co"
 *   "  María José Pérez " → "maria-jose-perez"
 *
 * Solo permite [a-z0-9-]. Los espacios y símbolos se colapsan a "-",
 * tildes/diacríticos se quitan (preserva ñ → n), y el resultado se trunca
 * a 80 caracteres para no superar el límite de path de Storage.
 *
 * Si el resultado queda vacío (caso extremo: nombre con solo símbolos),
 * devuelve "_" para evitar paths como "kardex//foto.jpg".
 */
function slugify(string $s): string {
    $t = strip_accents($s);
    // ñ/Ñ → n/N (no estaba en ACCENT_MAP por convención)
    $t = strtr($t, ['ñ' => 'n', 'Ñ' => 'N']);
    $t = mb_strtolower($t, 'UTF-8');
    // Reemplazar todo lo que no sea [a-z0-9] por "-"
    $t = preg_replace('/[^a-z0-9]+/u', '-', $t) ?? '';
    // Colapsar guiones múltiples y trim
    $t = preg_replace('/-+/', '-', $t) ?? '';
    $t = trim($t, '-');
    if ($t === '') return '_';
    return mb_substr($t, 0, 80, 'UTF-8');
}

/** modalidad → "FOLKLORE" | "ACADEMICO" | "URBANO". */
function derive_genero(string $modalidad): string {
    $m = mb_strtoupper(trim($modalidad), 'UTF-8');
    if (str_starts_with($m, 'FOLKLORE') || $m === 'DANZA ETNICA' || $m === 'DANZA ÉTNICA') {
        return 'FOLKLORE';
    }
    if ($m === 'HIP HOP' || $m === 'COMERCIAL DANCE' || $m === 'DANZA URBANA LIBRE') {
        return 'URBANO';
    }
    return 'ACADEMICO';
}
