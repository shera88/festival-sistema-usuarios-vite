<?php
declare(strict_types=1);

function buildContextFilter(array $user): ?string
{
    $conditions = [];

    foreach (parseIdCsv($user['id_agrupacion'] ?? '') as $id) {
        $conditions[] = 'id_agrupacion.eq.' . quoteIfNeeded($id);
    }
    foreach (parseIdCsv($user['id_original_representante'] ?? '') as $id) {
        $conditions[] = 'id_encargado.eq.' . quoteIfNeeded($id);
    }
    foreach (parseIdCsv($user['id_original_director'] ?? '') as $id) {
        $conditions[] = 'id_director.eq.' . quoteIfNeeded($id);
    }
    foreach (parseIdCsv($user['id_original_coreografo'] ?? '') as $id) {
        $conditions[] = 'id_coreografo.eq.' . quoteIfNeeded($id);
    }

    if (count($conditions) === 0) return null;
    return 'or=(' . implode(',', $conditions) . ')';
}

function parseIdCsv($value): array
{
    if (!$value) return [];
    return array_values(array_filter(array_map('trim', explode(',', (string)$value))));
}

function quoteIfNeeded(string $value): string
{
    // PostgREST: comillas dobles si el valor tiene caracteres especiales
    // de su sintaxis (`,`, `=`, ` `, `(`, `)`), o si contiene non-ASCII
    // (acentos, etc.). URL-encode siempre para que el HTTP request sea válido.
    $needsQuotes = preg_match('/[=, ()"]/u', $value) || !preg_match('/^[\x20-\x7e]*$/', $value);
    $encoded = rawurlencode($value);
    if ($needsQuotes) return '"' . $encoded . '"';
    return $encoded;
}

function buildInFilter(string $column, array $ids): ?string
{
    if (count($ids) === 0) return null;
    $list = implode(',', array_map(fn($id) => '"' . rawurlencode((string)$id) . '"', $ids));
    return "$column=in.($list)";
}
