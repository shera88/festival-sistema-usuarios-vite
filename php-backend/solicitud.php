<?php
/**
 * POST /api/solicitud.php
 *
 * Recibe JSON. Versión post-refactor 2026-04-30.
 *
 * Flujo:
 *   1. Validar.
 *   2. ensure_agrupacion (instituciones) con antecedentes='prospecto_no_participo'
 *      si la agrupación es nueva. Si existe, no degrada antecedentes.
 *   3. INSERT registro_solicitud_2026 con id_contacto si vino del frontend.
 *      Trigger trigger_registro_solicitud ramifica:
 *        - persona en representantes → UPDATE rep + UPDATE festival es_solic=true
 *        - persona en solicitantes → UPDATE solicitantes
 *        - solo en festival (coreografo/director) → UPDATE festival es_solic=true
 *        - persona nueva → INSERT solicitantes (cascada → festival)
 *   4. Lookup id_contacto resuelto post-trigger.
 *   5. Webhook + respuesta.
 */

declare(strict_types=1);

require_once __DIR__ . '/_lib/helpers.php';
require_once __DIR__ . '/_lib/normalize.php';
require_once __DIR__ . '/_lib/datetime.php';
require_once __DIR__ . '/_lib/supabase.php';
require_once __DIR__ . '/_lib/master-tables.php';
require_once __DIR__ . '/_lib/webhooks.php';
require_once __DIR__ . '/_lib/relations.php';

$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) jerror(500, 'Servidor mal configurado');
$CFG = require $configPath;

apply_cors($CFG['allowed_origin'] ?? null);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') jerror(405, 'Método no permitido');

$ip = get_client_ip();
$rlDir = __DIR__ . '/rate-limit-data';
if (rate_limit_check($rlDir, $ip, $CFG['rate_limit_max'], $CFG['rate_limit_window'])) {
    jerror(429, 'Demasiados envíos. Intente de nuevo en unos minutos.');
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody ?: 'null', true);
if (!is_array($data)) jerror(400, 'Body JSON inválido');

if (!empty($data['website'])) jok(['bot' => true]);

// ---------------- Validación ----------------
$nombre       = clean_str($data['nombre_y_apellido']  ?? null, 100);
$ci           = clean_str($data['numero_de_carnet']   ?? null, 15);
$idContacto   = clean_str($data['id_contacto']        ?? null, 40) ?: null;
$idAgrupacion = clean_str($data['id_agrupacion']      ?? null, 40) ?: null;
$agrupacion   = clean_str($data['agrupacion']         ?? null, 150);
$ciudad       = clean_str($data['ciudad']             ?? null, 80);
$telefono     = clean_str($data['telefono']           ?? null, 20);
$correo       = clean_str($data['correo_electronico'] ?? null, 120);
// genero/categoria/division pueden venir como string singular o como CSV
// (ej. "academico,urbano") cuando el formulario es multi-select.
$genero       = clean_str($data['genero']             ?? null, 200);
$categoria    = clean_str($data['categoria']          ?? null, 200);
$division     = clean_str($data['division']           ?? null, 200);

if (mb_strlen($nombre) < 2) jerror(400, 'Nombre y apellido obligatorio');
if (!ctype_digit($ci) || mb_strlen($ci) < 5) jerror(400, 'Carnet de identidad inválido');
if (mb_strlen($agrupacion) < 2) jerror(400, 'Agrupación obligatoria');
if (mb_strlen($ciudad) < 2) jerror(400, 'Ciudad obligatoria');
if (!ctype_digit($telefono) || mb_strlen($telefono) < 7) jerror(400, 'Teléfono inválido');
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) jerror(400, 'Correo electrónico inválido');

$CATEGORIA_LABELS = ['colegios' => 'Colegios', 'universidades' => 'Universidades', 'agrupacion' => 'Agrupación'];
$DIVISION_LABELS  = [
    'pre_infantil' => 'Pre infantil',
    'infantil'     => 'Infantil',
    'pre_juvenil'  => 'Pre Juvenil',
    'juvenil'      => 'Juvenil',
    'mayores'      => 'Mayores',
    'adultos'      => 'Adultos',
];

/**
 * Acepta string singular o CSV. Devuelve los tokens originales validados
 * contra el array `$valid`. Vacío o token inválido → jerror.
 */
$validateCsv = function (string $csv, array $valid, string $errMsg): array {
    $tokens = array_values(array_filter(array_map('trim', explode(',', $csv)), 'strlen'));
    if (empty($tokens)) jerror(400, $errMsg);
    foreach ($tokens as $t) {
        if (!in_array($t, $valid, true)) jerror(400, $errMsg);
    }
    return $tokens;
};

$categoriaTokens = $validateCsv($categoria, array_keys($CATEGORIA_LABELS), 'Categoría inválida');
$divisionTokens  = $validateCsv($division,  array_keys($DIVISION_LABELS),  'División inválida');
$generoTokens    = array_values(array_filter(array_map('trim', explode(',', $genero)), 'strlen'));
if (empty($generoTokens)) jerror(400, 'Género obligatorio');

$categoriaLabel = upper_norm(implode(',', array_map(fn($t) => $CATEGORIA_LABELS[$t], $categoriaTokens)));
$divisionLabel  = upper_norm(implode(',', array_map(fn($t) => $DIVISION_LABELS[$t],  $divisionTokens)));
$generoLabel    = upper_norm(implode(',', $generoTokens));

$norm = [
    'nombre_y_apellido'  => upper_norm($nombre),
    'agrupacion'         => upper_norm($agrupacion),
    'ciudad'             => upper_norm($ciudad),
    'correo_electronico' => email_norm($correo),
];

// ---------------- Cliente Supabase ----------------
$sb = new SupabaseClient(
    $CFG['supabase_url'],
    $CFG['supabase_service_key'],
    $CFG['storage_bucket']
);

try {
    // 0) Snapshot PRE-INSERT de "todo lo relacionado a la persona/agrupación".
    //    Se hace ANTES de ensure_agrupacion + INSERT para que el flag es_nuevo
    //    refleje el estado previo a este envío. Si la persona/agrupación
    //    no existían, los sub-objetos vienen null.
    $relacion_pre = gather_person_relations($sb, $idContacto ?: null, $idAgrupacion);

    // 1) ensure_agrupacion: lookup-or-create. Solicitud guarda tel/correo
    //    institucional + antecedentes='prospecto_no_participo' si nueva.
    //    Si la institución ya tiene antecedentes='Ya_participó' o
    //    'Solicitó_no_participó', NO se degrada (lógica en build_agrupacion_patch).
    $id_agrupacion = ensure_agrupacion($sb, [
        'id_agrupacion'        => $idAgrupacion,
        'nombre_agrupacion'    => $norm['agrupacion'],
        'ciudad'               => $norm['ciudad'],
        'telefono'             => $telefono,
        'correo_electronico'   => $norm['correo_electronico'],
        'antecedentes'         => 'prospecto_no_participo',
        'año_de_participacion' => '2026',
    ]);

    // 2) INSERT registro_solicitud_2026.
    //    Trigger trigger_registro_solicitud ramifica.
    $id_solicitud = new_id8();
    $idContactoUuid = $idContacto ?: null;

    // Derivables (igual que sample 2025).
    // whatsappera = "591<tel>,<nombre>" — usado por n8n para mensajes.
    // url_whatsapp = link directo a chat WA.
    $waPhone     = '591' . ltrim((string)$telefono, '0');
    $whatsappera = $waPhone . ',' . $norm['nombre_y_apellido'];
    $urlWhatsapp = 'https://api.whatsapp.com/send?phone=' . $waPhone;

    $sb->insert('registro_solicitud_2026', [
        'id_solicitud'        => $id_solicitud,
        'fecha'               => fecha_bolivia(),
        'hora'                => hora_bolivia(),
        'nombre_y_apellido'   => $norm['nombre_y_apellido'],
        'numero_de_carnet'    => (int)$ci,
        'agrupacion'          => $norm['agrupacion'],
        'id_agrupacion'       => $id_agrupacion,
        'ciudad'              => $norm['ciudad'],
        'telefono'            => (int)$telefono,
        'correo_electronico'  => $norm['correo_electronico'],
        'genero'              => $generoLabel,
        'categoria'           => $categoriaLabel,
        'division'            => $divisionLabel,
        'estado_2026'         => 'PENDIENTE',
        'procedencia_2026'    => 'FORM DE SOLICITUD 2026',
        'whatsappera'         => $whatsappera,
        'url_whatsapp'        => $urlWhatsapp,
        'id_contacto'         => $idContactoUuid,
    ]);

    // 3) Lookup id_contacto resuelto post-trigger + numero/numero_solicitud
    //    asignados por la sequence + generated column en DB.
    $solRow = $sb->selectOne('registro_solicitud_2026',
        'id_contacto,numero,numero_solicitud',
        ['id_solicitud' => "eq.$id_solicitud"]
    );
    $id_contacto_final  = $solRow['id_contacto']     ?? $idContactoUuid;
    $numero             = $solRow['numero']          ?? null;
    $numero_solicitud   = $solRow['numero_solicitud'] ?? null;

    // Determinar si fue promocionado (representante existente en festival).
    $promoted = false;
    $id_encargado_final = null;
    if ($id_contacto_final) {
        $reprRow = $sb->selectOne('representantes', 'id_encargado',
            ['id_contacto' => "eq.$id_contacto_final"]
        );
        if ($reprRow) {
            $id_encargado_final = $reprRow['id_encargado'];
            $promoted = true;
        }
    }

    rate_limit_record($rlDir, $ip);

    dispatch_webhook($CFG['webhooks']['solicitud'] ?? null, [
        'event' => 'solicitud',
        'form' => [
            'id_solicitud'       => $id_solicitud,
            'numero'             => $numero,
            'numero_solicitud'   => $numero_solicitud,
            'id_encargado'       => $id_encargado_final,
            'id_contacto'        => $id_contacto_final,
            'id_agrupacion'      => $id_agrupacion,
            'promoted'           => $promoted,
            'fecha'              => fecha_bolivia(),
            'hora'               => hora_bolivia(),
            'nombre_y_apellido'  => $norm['nombre_y_apellido'],
            'numero_de_carnet'   => (int)$ci,
            'agrupacion'         => $norm['agrupacion'],
            'ciudad'             => $norm['ciudad'],
            'telefono'           => (int)$telefono,
            'correo_electronico' => $norm['correo_electronico'],
            'genero'             => $generoLabel,
            'categoria'          => $categoriaLabel,
            'division'           => $divisionLabel,
            'estado_2026'        => 'PENDIENTE',
            'procedencia_2026'   => 'FORM DE SOLICITUD 2026',
            'whatsappera'        => $whatsappera,
            'url_whatsapp'       => $urlWhatsapp,
        ],
        'relacion'        => $relacion_pre,
        'imagen_persona'  => resolve_imagen_persona($relacion_pre),
        'logo_agrupacion' => resolve_logo_agrupacion($relacion_pre),
    ]);

    jok([
        'id_solicitud'     => $id_solicitud,
        'numero'           => $numero,
        'numero_solicitud' => $numero_solicitud,
        'id_encargado'     => $id_encargado_final,
        'id_contacto'      => $id_contacto_final,
        'id_agrupacion'    => $id_agrupacion,
        'promoted'         => $promoted,
        'message'          => 'Solicitud registrada con éxito',
    ]);
} catch (Throwable $e) {
    error_log('[solicitud] ' . $e->getMessage());
    jerror(502, 'Error al guardar la solicitud: ' . $e->getMessage());
}
