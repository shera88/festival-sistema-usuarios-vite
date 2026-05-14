<?php
/**
 * Helpers para `agrupacion_credenciales`.
 *
 * Diseño lazy/sparse: tabla solo tiene rows para agrupaciones que cerraron.
 * Ausencia de row = estado 'incompleto' por defecto.
 */
declare(strict_types=1);

require_once __DIR__ . '/supabase.php';

/** Devuelve estado para una agrupación + año. 'incompleto' si no hay row. */
function credEstado(SupabaseClient $sb, string $id_agrupacion, int $year): string
{
    $row = $sb->selectOne(
        'agrupacion_credenciales',
        'estado',
        [
            'id_agrupacion' => "eq.$id_agrupacion",
            'year' => "eq.$year",
        ]
    );
    if (!$row) return 'incompleto';
    return mb_strtolower(trim((string)($row['estado'] ?? 'incompleto')));
}

/** True si la agrupación está cerrada en ese año. */
function credCerrada(SupabaseClient $sb, string $id_agrupacion, int $year): bool
{
    return credEstado($sb, $id_agrupacion, $year) === 'completo';
}

/** Batch lookup: devuelve map [id_agrupacion => estado] para varios ids. */
function credEstadosBatch(SupabaseClient $sb, array $ids, int $year): array
{
    $map = [];
    if (count($ids) === 0) return $map;

    $list = implode(',', array_map(fn($id) => '"' . rawurlencode((string)$id) . '"', $ids));
    $qs = 'select=id_agrupacion,estado&year=eq.' . $year . '&id_agrupacion=in.(' . $list . ')';
    $rows = $sb->selectRaw('agrupacion_credenciales', $qs);

    foreach ($rows as $r) {
        $id = (string)($r['id_agrupacion'] ?? '');
        if ($id === '') continue;
        $map[$id] = mb_strtolower(trim((string)($r['estado'] ?? 'incompleto')));
    }
    return $map;
}
