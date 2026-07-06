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
            // id_contacto en las tablas de inscripción es UUID. Los logins de
            // kárdex traen un id_kardex (hex8) que NO es UUID → si lo metemos en
            // el filtro, PostgREST responde 22P02 y rompe todo el query. Lo
            // omitimos; para esos usuarios el scope real es por id_agrupacion.
            if (preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $id)) {
                $conditions[] = 'id_contacto.eq.' . quoteIfNeeded($id);
            }
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

/**
 * Conjunto REAL de agrupaciones que la persona representa. Igual criterio que el
 * tab Inscripciones (buildContextFilter): la agrupación de su contacto + las de
 * todas sus inscripciones (por id_contacto / encargado / director / coreógrafo).
 *
 * `festival_contactos_global.id_agrupacion` es un ÚNICO valor (la "primaria"),
 * pero un representante puede firmar convenios / tener inscripciones para VARIAS
 * agrupaciones. Todo endpoint scopeado por agrupación (pagos-resumen, pago-crear)
 * DEBE usar este set, no el CSV del contacto — si no, da 403 / oculta datos de las
 * agrupaciones no-primarias. Requiere supabase() ya cargado.
 */
function resolveUserAgrupaciones(array $user): array
{
    require_once __DIR__ . '/supabase.php';
    $sb = supabase();
    $set = [];
    foreach (parseIdCsv($user['id_agrupacion'] ?? '') as $id) {
        if ($id !== '') $set[$id] = true;
    }
    $filter = buildContextFilter($user, true); // includeContacto
    if ($filter !== null) {
        $rows = $sb->selectRaw(
            'registro_de_inscripcion_2026',
            'select=id_agrupacion&limit=1000&' . $filter
        );
        foreach ($rows as $r) {
            $aid = $r['id_agrupacion'] ?? '';
            if ($aid !== '' && $aid !== null) $set[$aid] = true;
        }
    }
    return array_keys($set);
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
