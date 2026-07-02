<?php
declare(strict_types=1);

function buildContextFilter(array $user, bool $includeContacto = false): ?string
{
    $conditions = [];

    // Match por id_contacto (la persona logueada ES el contacto de la inscripción).
    // Captura inscripciones donde la persona figura como encargado aunque la
    // agrupación NO la tenga vinculada en instituciones.encargados ni la
    // inscripción tenga id_encargado. Solo en tablas que tienen id_contacto
    // (registro_de_inscripcion_2026+); las históricas no, por eso es opt-in.
    if ($includeContacto) {
        foreach (parseIdCsv($user['id_contacto'] ?? '') as $id) {
            $conditions[] = 'id_contacto.eq.' . quoteIfNeeded($id);
        }
    }

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

/**
 * ¿El usuario puede gestionar la multimedia de esta inscripción? Aplica el MISMO
 * scope que el listado de inscripciones (buildContextFilter): agrupación propia, o
 * ser encargado/representante, director o coreógrafo de la obra. Los admins pueden
 * con cualquiera. Regla: "si la obra aparece en tu lista, podés subirle multimedia".
 * Requiere que auth.php (usuarioEsAdmin) y supabase.php ya estén cargados — los
 * endpoints multimedia los cargan antes que context.php.
 */
function usuarioAutorizadoInscripcion(array $user, string $idInscripcion, int $year = 2026): bool
{
    if ($idInscripcion === '') return false;
    if (usuarioEsAdmin($user)) return true;
    $filter = buildContextFilter($user, $year >= 2026);
    if ($filter === null) return false;
    $qs = 'select=id_inscripcion&limit=1&id_inscripcion=eq.' . rawurlencode($idInscripcion) . '&' . $filter;
    $rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);
    return is_array($rows) && count($rows) > 0;
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
