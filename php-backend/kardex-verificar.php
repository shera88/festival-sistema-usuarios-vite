<?php
/**
 * POST /kardex-verificar.php  { id_kardex, verificado: bool }
 *
 * Toggle del flag `verificado` en registro_kardex_2026.
 *
 * Reglas:
 *  - Solo 2026.
 *  - Usuario tiene que tener contexto sobre la agrupación del row clickeado.
 *  - Si la agrupación está cerrada (agrupacion_credenciales.estado='completo'),
 *    se rechaza con 423.
 *
 * Replicación CI + nombre normalizado:
 *  - Si TODOS los rows con mismo CI tienen el MISMO nombre normalizado
 *    (upper + sin acentos + collapse spaces), se replica el flag a todos
 *    los rows de esa persona, en agrupaciones NO cerradas.
 *  - Si hay nombres distintos con mismo CI (data sucia: CI placeholder
 *    para múltiples personas), solo se afecta el id_kardex específico.
 *  - Sin CI (raro): solo afecta el id_kardex específico.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();

$id_kardex = trim((string)($body['id_kardex'] ?? ''));
if ($id_kardex === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_kardex)) {
    sendJson(['error' => 'id_kardex inválido'], 400);
    exit;
}
$verificado = !empty($body['verificado']);

$sb = supabase();
$row = $sb->selectOne(
    'registro_kardex_2026',
    'id_kardex,id_agrupacion,ci,nombre_y_apellido',
    ['id_kardex' => "eq.$id_kardex"]
);
if (!$row) {
    sendJson(['error' => 'Registro no encontrado'], 404);
    exit;
}
$id_agrupacion = (string)($row['id_agrupacion'] ?? '');
$ci = (string)($row['ci'] ?? '');
$nombre = (string)($row['nombre_y_apellido'] ?? '');

$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
// Admins / super-admin verifican CUALQUIER agrupación (igual que multimedia-*).
$esAdmin = sesionEsAdmin();
if (!$esAdmin && !in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

if (!$esAdmin && credCerrada($sb, $id_agrupacion, 2026)) {
    sendJson(['error' => 'Agrupación cerrada. Solicite habilitar.'], 423);
    exit;
}

/** Normaliza: trim + collapse spaces + upper + sin acentos */
function normName(string $s): string
{
    $s = trim($s);
    $s = preg_replace('/\s+/', ' ', $s) ?? $s;
    $s = mb_strtoupper($s, 'UTF-8');
    // Quita acentos comunes en español
    $map = [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U',
        'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U',
        'Ñ' => 'N',
    ];
    return strtr($s, $map);
}

$nombreNorm = normName($nombre);

// Decidir conjunto de id_kardex a actualizar
$targetIds = [];

if ($ci !== '') {
    // Buscar todos los rows con mismo CI
    $rowsSameCi = $sb->selectRaw(
        'registro_kardex_2026',
        'select=id_kardex,nombre_y_apellido,id_agrupacion&ci=eq.' . rawurlencode($ci) . '&limit=500'
    );

    // Filtrar por nombre normalizado coincidente
    $mismaPersona = array_values(array_filter(
        $rowsSameCi,
        fn($r) => normName((string)($r['nombre_y_apellido'] ?? '')) === $nombreNorm
    ));

    if (count($mismaPersona) >= 1) {
        // Excluir agrupaciones cerradas
        $idsAgrup = array_values(array_unique(array_filter(array_column($mismaPersona, 'id_agrupacion'))));
        $estadosMap = credEstadosBatch($sb, $idsAgrup, 2026);

        foreach ($mismaPersona as $r) {
            $idA = (string)($r['id_agrupacion'] ?? '');
            $estado = $estadosMap[$idA] ?? 'incompleto';
            if ($estado === 'completo') continue; // bloqueada, no tocar
            $targetIds[] = (string)$r['id_kardex'];
        }
    }
}

if (count($targetIds) === 0) {
    // Fallback: solo el row clickeado
    $targetIds = [$id_kardex];
}

// UPDATE batch via PostgREST: id_kardex=in.(...)
$list = implode(',', array_map(fn($id) => '"' . rawurlencode($id) . '"', $targetIds));
$url = rtrim((require __DIR__ . '/config.php')['supabase_url'], '/')
    . '/rest/v1/registro_kardex_2026?id_kardex=in.(' . $list . ')';

$ch = curl_init($url);
$cfg = require __DIR__ . '/config.php';
$key = $cfg['supabase_service_role_key'] ?? ($cfg['supabase_service_key'] ?? '');
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'PATCH',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $key,
        'apikey: ' . $key,
        'Content-Type: application/json',
        'Prefer: return=minimal',
    ],
    CURLOPT_POSTFIELDS     => json_encode(['verificado' => $verificado]),
]);
curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($status < 200 || $status >= 300) {
    sendJson(['error' => 'Update falló (HTTP ' . $status . ')'], 500);
    exit;
}

sendJson([
    'ok' => true,
    'id_kardex' => $id_kardex,
    'verificado' => $verificado,
    'ci' => $ci,
    'rows_updated' => count($targetIds),
    'ids_actualizados' => $targetIds,
]);
