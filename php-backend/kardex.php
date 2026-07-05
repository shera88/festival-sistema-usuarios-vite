<?php
/**
 * POST /api/kardex.php
 *
 * Versión post-refactor 2026-04-30.
 *
 * Flujo:
 *   1. Validar (cargos válidos: BAILARIN, COREOGRAFO, DIRECTOR, ENCARGADO,
 *      STAFF, AUSPICIADOR, JURADO, ORGANIZACION).
 *   2. Subir foto a Storage.
 *   3. INSERT registro_kardex_2026 con id_contacto si vino.
 *      Trigger trigger_registro_kardex ramifica por cargo:
 *        - DIRECTOR   → INSERT/UPDATE directores (cascada festival)
 *        - COREOGRAFO → INSERT/UPDATE coreografos (cascada)
 *        - ENCARGADO  → INSERT/UPDATE representantes (cascada)
 *        - otros      → solo registro_kardex_2026
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

if (!empty($_POST['website'])) jok(['bot' => true]);

// ---------------- Validación ----------------
$nombre       = clean_str($_POST['nombre_y_apellido']  ?? null, 100);
$idAgrupacion = clean_str($_POST['id_agrupacion']      ?? null, 40) ?: null;
$idContacto   = clean_str($_POST['id_contacto']        ?? null, 40) ?: null;
$agrupacion   = clean_str($_POST['agrupacion']         ?? null, 150);
$cargo        = clean_str($_POST['cargo']              ?? null, 30);
$telefono     = clean_str($_POST['telefono']           ?? null, 20);
$correo       = clean_str($_POST['correo_electronico'] ?? null, 120);
$ciudad       = clean_str($_POST['ciudad']             ?? null, 80);
$edadStr      = clean_str($_POST['edad']               ?? null, 5);
$ci           = clean_str($_POST['ci']                 ?? null, 15);

// Membresía de Videos (checkbox "1"/"0") + bailes seleccionados (JSON del multiselect).
$membresia    = (($_POST['membresia'] ?? '0') === '1' || strtolower((string)($_POST['membresia'] ?? '')) === 'true');
$bailesArr    = json_decode((string)($_POST['bailes'] ?? '[]'), true);
if (!is_array($bailesArr)) $bailesArr = [];

if (mb_strlen($nombre) < 2) jerror(400, 'Nombre y apellido obligatorio');
if (mb_strlen($agrupacion) < 2) jerror(400, 'Agrupación obligatoria');
$CARGOS_VALIDOS = ['BAILARIN', 'COREOGRAFO', 'DIRECTOR', 'ENCARGADO', 'STAFF', 'AUSPICIADOR', 'JURADO', 'ORGANIZACION'];
if (!in_array($cargo, $CARGOS_VALIDOS, true)) jerror(400, 'Cargo inválido');
if (!ctype_digit($telefono) || mb_strlen($telefono) < 7) jerror(400, 'Teléfono inválido');
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) jerror(400, 'Correo electrónico inválido');
if (mb_strlen($ciudad) < 2) jerror(400, 'Ciudad obligatoria');
$edad = (int)$edadStr;
if ($edad < 1 || $edad > 120) jerror(400, 'Edad inválida');
if (!ctype_digit($ci) || mb_strlen($ci) < 5) jerror(400, 'Carnet de identidad inválido');

if (!isset($_FILES['foto']) || $_FILES['foto']['error'] !== UPLOAD_ERR_OK) {
    jerror(400, 'Debe adjuntar la fotografía');
}
$foto = $_FILES['foto'];
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($foto['tmp_name']);
if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
    jerror(400, 'Formato de foto no permitido (JPG/PNG/WebP)');
}
if ((int)$foto['size'] > 10 * 1024 * 1024) {
    jerror(400, 'La foto supera los 10 MB');
}

$nombreNorm     = upper_norm($nombre);
$agrupacionNorm = upper_norm($agrupacion);
$ciudadNorm     = upper_norm($ciudad);
$correoNorm     = email_norm($correo);

// ---------------- Cliente Supabase ----------------
$sb = new SupabaseClient(
    $CFG['supabase_url'],
    $CFG['supabase_service_key'],
    $CFG['storage_bucket']
);

try {
    // Snapshot PRE-INSERT de "todo lo relacionado a la persona/agrupación".
    // Se hace ANTES del INSERT para que el flag es_nuevo refleje el estado
    // previo a este envío.
    $relacion_pre = gather_person_relations($sb, $idContacto ?: null, $idAgrupacion);

    $id_kardex = new_id8();
    $slugAgrupacion = slugify($agrupacionNorm);
    $slugPersona    = slugify($nombreNorm);
    $foto_url = $sb->uploadPublicFile(
        $foto['tmp_name'],
        $mime,
        "kardex/$slugAgrupacion/$slugPersona"
    );

    $idContactoUuid = $idContacto ?: null;

    $sb->insert('registro_kardex_2026', [
        'id_kardex'           => $id_kardex,
        'fecha'               => fecha_bolivia(),
        'hora'                => hora_bolivia(),
        'nombre_y_apellido'   => $nombreNorm,
        'agrupacion'          => $agrupacionNorm,
        'id_agrupacion'       => $idAgrupacion,
        'cargo'               => $cargo,
        'telefono'            => (int)$telefono,
        'correo_electronico'  => $correoNorm,
        'ciudad'              => $ciudadNorm,
        'edad'                => $edad,
        'ci'                  => (int)$ci,
        'foto'                => $foto_url,
        'estado'              => 'PENDIENTE',
        'id_contacto'         => $idContactoUuid,
        'membresia'           => $membresia,
        'bailes'              => $bailesArr,
    ]);

    // Lookup id_contacto resuelto.
    $karRow = $sb->selectOne('registro_kardex_2026',
        'id_contacto',
        ['id_kardex' => "eq.$id_kardex"]
    );
    $id_contacto_final = $karRow['id_contacto'] ?? $idContactoUuid;

    // Lookup id_X según cargo (resuelto por trigger).
    $id_director = null; $id_coreografo = null; $id_encargado = null;
    if ($id_contacto_final) {
        switch ($cargo) {
            case 'DIRECTOR':
                $r = $sb->selectOne('directores', 'id_director',
                    ['id_contacto' => "eq.$id_contacto_final"]);
                $id_director = $r['id_director'] ?? null;
                break;
            case 'COREOGRAFO':
                $r = $sb->selectOne('coreografos', 'id_coreografo',
                    ['id_contacto' => "eq.$id_contacto_final"]);
                $id_coreografo = $r['id_coreografo'] ?? null;
                break;
            case 'ENCARGADO':
                $r = $sb->selectOne('representantes', 'id_encargado',
                    ['id_contacto' => "eq.$id_contacto_final"]);
                $id_encargado = $r['id_encargado'] ?? null;
                break;
        }
    }

    rate_limit_record($rlDir, $ip);

    dispatch_webhook($CFG['webhooks']['kardex'] ?? null, [
        'event' => 'kardex',
        'form' => [
            'id_kardex'          => $id_kardex,
            'id_director'        => $id_director,
            'id_coreografo'      => $id_coreografo,
            'id_encargado'       => $id_encargado,
            'id_contacto'        => $id_contacto_final,
            'fecha'              => fecha_bolivia(),
            'hora'               => hora_bolivia(),
            'nombre_y_apellido'  => $nombreNorm,
            'agrupacion'         => $agrupacionNorm,
            'id_agrupacion'      => $idAgrupacion,
            'cargo'              => $cargo,
            'telefono'           => (int)$telefono,
            'correo_electronico' => $correoNorm,
            'ciudad'             => $ciudadNorm,
            'edad'               => $edad,
            'ci'                 => (int)$ci,
            'foto_url'           => $foto_url,
            'estado'             => 'PENDIENTE',
            'membresia'          => $membresia,
            'bailes'             => $bailesArr,
        ],
        'relacion'        => $relacion_pre,
        // imagen_persona: foto recién subida tiene prioridad. Kardex siempre tiene foto.
        'imagen_persona'  => $foto_url,
        'logo_agrupacion' => resolve_logo_agrupacion($relacion_pre),
    ]);

    jok([
        'id_kardex'     => $id_kardex,
        'id_director'   => $id_director,
        'id_coreografo' => $id_coreografo,
        'id_encargado'  => $id_encargado,
        'id_contacto'   => $id_contacto_final,
        'foto_url'      => $foto_url,
        'cargo'         => $cargo,
        'message'       => 'Kárdex registrado con éxito',
    ]);
} catch (Throwable $e) {
    error_log('[kardex] ' . $e->getMessage());
    jerror(502, 'Error al guardar el kárdex: ' . $e->getMessage());
}
