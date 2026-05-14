<?php
/**
 * POST /api/inscripcion.php
 *
 * Recibe FormData con datos del representante + obra + agrupación + (opcional) logo.
 * Versión post-refactor 2026-04-30: PHP queda thin, los triggers SQL hacen
 * upsert de representantes/coreografos y sync a festival_contactos_global.
 *
 * Flujo:
 *   1. Validar método, rate-limit, honeypot, campos.
 *   2. Subir logo a Storage (si vino).
 *   3. ensure_agrupacion (instituciones).
 *   4. ensure_coreografo (coreografos) — necesario porque
 *      registro_de_inscripcion_2026 requiere id_coreografo.
 *   5. INSERT registro_de_inscripcion_2026 con id_contacto (si vino).
 *      Trigger trigger_registro_inscripcion ramifica:
 *        - persona en solicitantes → MOVE a representantes
 *        - persona en representantes → UPDATE
 *        - persona nueva → INSERT representantes
 *      Trigger festival_sync_encargado_insert sync a festival.
 *   6. Lookup id_contacto resuelto post-trigger (por si trigger lo backfilled).
 *   7. Webhook + respuesta.
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

if (!empty($_POST['website'])) {
    jok(['bot' => true]);
}

// ---------------- Validación ----------------
$nombre        = clean_str($_POST['nombre_y_apellido'] ?? null, 100);
$ci            = clean_str($_POST['numero_de_carnet']  ?? null, 15);
$telefono      = clean_str($_POST['telefono']          ?? null, 20);
$ciudad        = clean_str($_POST['ciudad']            ?? null, 80);
$correo        = clean_str($_POST['correo_electronico'] ?? null, 120);
$idContacto    = clean_str($_POST['id_contacto']       ?? null, 40) ?: null;
// URL de la foto que ya estaba registrada para este contacto (viene del
// match en el formulario). Si llega y es externa (legacy WordPress), el
// backend la mirrorea a Supabase Storage al guardar.
$fotoUrlActual = clean_str($_POST['foto_url_actual']   ?? null, 500) ?: null;
$idAgrupacion  = clean_str($_POST['id_agrupacion']     ?? null, 40) ?: null;
$idCoreografo  = clean_str($_POST['id_coreografo']     ?? null, 40) ?: null;
$agrupacion    = clean_str($_POST['agrupacion']        ?? null, 150);
$nombreObra    = clean_str($_POST['nombre_de_la_obra'] ?? null, 200);
$coreografoNm  = clean_str($_POST['coreografo']        ?? null, 100);
$categoria     = clean_str($_POST['categoria']         ?? null, 30);
$division      = clean_str($_POST['division']          ?? null, 30);
$subdivision   = clean_str($_POST['subdivision']       ?? null, 30);
$cantidadStr   = clean_str($_POST['cantidad']          ?? null, 5);
$modalidad     = clean_str($_POST['modalidad']         ?? null, 60);

if (mb_strlen($nombre) < 2) jerror(400, 'Nombre y apellido obligatorio');
if (!ctype_digit($ci) || mb_strlen($ci) < 5) jerror(400, 'Carnet de identidad inválido');
if (!ctype_digit($telefono) || mb_strlen($telefono) < 7) jerror(400, 'Teléfono inválido');
if (mb_strlen($ciudad) < 2) jerror(400, 'Ciudad obligatoria');
if (!filter_var($correo, FILTER_VALIDATE_EMAIL)) jerror(400, 'Correo electrónico inválido');
if (mb_strlen($agrupacion) < 2) jerror(400, 'Agrupación obligatoria');
if (mb_strlen($nombreObra) < 2) jerror(400, 'Nombre de la obra obligatorio');
if (mb_strlen($coreografoNm) < 2) jerror(400, 'Coreógrafo obligatorio');
if (!in_array($categoria, ['colegios', 'universidades', 'agrupacion'], true)) jerror(400, 'Categoría inválida');
$cantidad = (int)$cantidadStr;
if ($cantidad < 1 || $cantidad > 60) jerror(400, 'Cantidad inválida (1-60)');

$CATEGORIA_LABELS    = ['colegios' => 'Colegios', 'universidades' => 'Universidades', 'agrupacion' => 'Agrupación'];
$DIVISION_LABELS     = [
    'pre_infantil' => 'Pre infantil',
    'infantil'     => 'Infantil',
    'pre_juvenil'  => 'Pre Juvenil',
    'juvenil'      => 'Juvenil',
    'mayores'      => 'Mayores',
    'adultos'      => 'Adultos',
];
$SUBDIVISION_LABELS  = [
    'solo'           => 'Solo',
    'duo'            => 'Dúo',
    'trio'           => 'Trío',
    'grupo_pequeno'  => 'Grupo Pequeño',
    'grupo_grande'   => 'Grupo Grande',
];
if (!isset($DIVISION_LABELS[$division]))    jerror(400, 'División inválida');
if (!isset($SUBDIVISION_LABELS[$subdivision])) jerror(400, 'Subdivisión inválida');

$categoriaLabel    = upper_norm($CATEGORIA_LABELS[$categoria]);
$divisionLabel     = upper_norm($DIVISION_LABELS[$division]);
$subdivisionLabel  = upper_norm($SUBDIVISION_LABELS[$subdivision]);
$modalidadUp       = upper_norm($modalidad);

$norm = [
    'nombre_y_apellido'  => upper_norm($nombre),
    'ciudad'             => upper_norm($ciudad),
    'correo_electronico' => email_norm($correo),
    'agrupacion'         => upper_norm($agrupacion),
    'nombre_de_la_obra'  => upper_norm($nombreObra),
    'coreografo'         => upper_norm($coreografoNm),
];

$generoLabel = derive_genero($modalidadUp);

// ---------------- Cliente Supabase ----------------
$sb = new SupabaseClient(
    $CFG['supabase_url'],
    $CFG['supabase_service_key'],
    $CFG['storage_bucket']
);

try {
    // 0) Snapshot PRE-INSERT de "todo lo relacionado a la persona/agrupación".
    //    Se hace ANTES de ensure_agrupacion + INSERT para que el flag es_nuevo
    //    refleje el estado previo a este envío.
    $relacion_pre = gather_person_relations($sb, $idContacto ?: null, $idAgrupacion);

    // 1) Logo de la agrupación (opcional). Si el usuario sube un archivo
    //    nuevo, se persiste en Storage y reemplaza el logo registrado en
    //    `instituciones.enlace_del_logo`. Si no hay archivo, se intenta
    //    heredar el logo existente de instituciones (el usuario eligió
    //    una agrupación existente con id_agrupacion ya registrado).
    $logoNuevoUrl = null;
    if (isset($_FILES['logo']) && $_FILES['logo']['error'] === UPLOAD_ERR_OK) {
        $logo = $_FILES['logo'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($logo['tmp_name']);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
            jerror(400, 'Formato de logo no permitido (JPG/PNG/WebP/GIF)');
        }
        if ((int)$logo['size'] > 10 * 1024 * 1024) {
            jerror(400, 'El logo supera los 10 MB');
        }
        $slug = slugify($norm['agrupacion']);
        $logoNuevoUrl = $sb->uploadPublicFile($logo['tmp_name'], $mime, "inscripciones/$slug");
    }

    // 2) Foto del participante (opcional). Si el usuario sube una foto nueva,
    //    se persiste en Storage; el URL se escribe a `representantes.imagen`
    //    DESPUÉS de que el trigger haga upsert de la fila (paso 8).
    $fotoNuevaUrl = null;
    if (isset($_FILES['foto_nueva']) && $_FILES['foto_nueva']['error'] === UPLOAD_ERR_OK) {
        $foto = $_FILES['foto_nueva'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime  = $finfo->file($foto['tmp_name']);
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], true)) {
            jerror(400, 'Formato de foto no permitido (JPG/PNG/WebP/GIF)');
        }
        if ((int)$foto['size'] > 10 * 1024 * 1024) {
            jerror(400, 'La foto supera los 10 MB');
        }
        $slug = slugify($norm['nombre_y_apellido']);
        $fotoNuevaUrl = $sb->uploadPublicFile($foto['tmp_name'], $mime, "personas/$slug");
    }

    // 3) ensure_agrupacion: lookup-or-create en instituciones.
    $id_agrupacion = ensure_agrupacion($sb, [
        'id_agrupacion'        => $idAgrupacion,
        'nombre_agrupacion'    => $norm['agrupacion'],
        'ciudad'               => $norm['ciudad'],
        'antecedentes'         => 'Ya_participó',
        'año_de_participacion' => '2026',
    ]);

    // 4) Resolver enlace_del_logo final:
    //    a) Si subió logo nuevo → usar ese y UPDATE instituciones (override).
    //    b) Si no, heredar el actual de instituciones para esta agrupación.
    //       Si ese enlace es externo (legacy WordPress), mirrorearlo a
    //       Storage para tener una copia controlada por nosotros y refrescar
    //       el registro en instituciones con la nueva URL.
    $enlace_del_logo = null;
    if ($logoNuevoUrl !== null) {
        $enlace_del_logo = $logoNuevoUrl;
        $sb->update('instituciones', 'id_agrupacion', $id_agrupacion, [
            'enlace_del_logo'      => $logoNuevoUrl,
            'fecha_actualizacion'  => now_iso(),
        ]);
    } else {
        $instRow = $sb->selectOne('instituciones', 'enlace_del_logo',
            ['id_agrupacion' => "eq.$id_agrupacion"]);
        if ($instRow && !empty($instRow['enlace_del_logo'])) {
            $logoExistente = (string)$instRow['enlace_del_logo'];
            $slug = slugify($norm['agrupacion']);
            $logoMirror = $sb->mirrorExternalUrl($logoExistente, "inscripciones/$slug");
            if ($logoMirror !== null && $logoMirror !== $logoExistente) {
                // Mirror exitoso → persistir nueva URL en instituciones.
                $sb->update('instituciones', 'id_agrupacion', $id_agrupacion, [
                    'enlace_del_logo'      => $logoMirror,
                    'fecha_actualizacion'  => now_iso(),
                ]);
                $enlace_del_logo = $logoMirror;
            } else {
                // Mirror falló (URL muerta) o ya está en nuestro bucket.
                $enlace_del_logo = $logoMirror ?? $logoExistente;
            }
        }
    }

    // 4) ensure_coreografo: necesario para id_coreografo en registro_de_inscripcion.
    $id_coreografo = ensure_coreografo($sb, [
        'id_coreografo'      => $idCoreografo,
        'nombre_y_apellido'  => $norm['coreografo'],
    ]);

    // 5) INSERT registro_de_inscripcion_2026.
    //    Trigger trigger_registro_inscripcion se encarga de:
    //      - INSERT/UPDATE/MOVE en representantes según matching de persona.
    //      - Cascada a festival_contactos_global vía trigger sync_encargado.
    $id_inscripcion = new_id8();
    $idContactoUuid = $idContacto ? $idContacto : null;

    $sb->insert('registro_de_inscripcion_2026', [
        'id_inscripcion'      => $id_inscripcion,
        'fecha'               => fecha_bolivia(),
        'hora'                => hora_bolivia(),
        'nombre_y_apellido'   => $norm['nombre_y_apellido'],
        'numero_de_carnet'    => (int)$ci,
        'telefono'            => (int)$telefono,
        'ciudad'               => $norm['ciudad'],
        'correo_electronico'  => $norm['correo_electronico'],
        'agrupacion'          => $norm['agrupacion'],
        'id_agrupacion'       => $id_agrupacion,
        'nombre_de_la_obra'   => $norm['nombre_de_la_obra'],
        'coreografo'          => $norm['coreografo'],
        'id_coreografo'       => $id_coreografo,
        'categoria'           => $categoriaLabel,
        'division'            => $divisionLabel,
        'subdivision'         => $subdivisionLabel,
        'cantidad'            => $cantidad,
        'modalidad'           => $modalidadUp,
        'genero'              => $generoLabel,
        'enlace_del_logo'     => $enlace_del_logo,
        'estado'              => 'pendiente',
        'id_contacto'         => $idContactoUuid,
    ]);

    // 6) Lookup id_contacto resuelto post-trigger.
    $insRow = $sb->selectOne('registro_de_inscripcion_2026',
        'id_contacto',
        ['id_inscripcion' => "eq.$id_inscripcion"]
    );
    $id_contacto_final = $insRow['id_contacto'] ?? $idContactoUuid;

    // 7) Lookup id_encargado (resuelto por el trigger).
    $reprRow = null;
    if ($id_contacto_final) {
        $reprRow = $sb->selectOne('representantes', 'id_encargado',
            ['id_contacto' => "eq.$id_contacto_final"]
        );
    }
    $id_encargado_final = $reprRow['id_encargado'] ?? null;

    // 8) Persistir foto en `representantes.imagen` para todas las filas con
    //    este id_contacto. Tres casos:
    //    a) Subió foto nueva → usar esa URL.
    //    b) Mantuvo la foto registrada (foto_url_actual) y es externa →
    //       descargarla y subirla a Storage para tener copia propia. Esto
    //       libera al festival del hosting WordPress original.
    //    c) Mantuvo y ya está en nuestro bucket → no-op.
    if ($id_contacto_final) {
        $imagenPersistir = null;
        if ($fotoNuevaUrl !== null) {
            $imagenPersistir = $fotoNuevaUrl;
        } elseif ($fotoUrlActual !== null && $fotoUrlActual !== '') {
            $slug = slugify($norm['nombre_y_apellido']);
            $mirror = $sb->mirrorExternalUrl($fotoUrlActual, "personas/$slug");
            if ($mirror !== null && $mirror !== $fotoUrlActual) {
                $imagenPersistir = $mirror;
            }
            // Si mirror falló o ya estaba en nuestro bucket, no tocamos imagen.
        }
        if ($imagenPersistir !== null) {
            $sb->update('representantes', 'id_contacto', $id_contacto_final, [
                'imagen'              => $imagenPersistir,
                'fecha_actualizacion' => now_iso(),
            ]);
        }
    }

    rate_limit_record($rlDir, $ip);

    dispatch_webhook($CFG['webhooks']['inscripcion'] ?? null, [
        'event' => 'inscripcion',
        'form' => [
            'id_inscripcion'     => $id_inscripcion,
            'id_encargado'       => $id_encargado_final,
            'id_coreografo'      => $id_coreografo,
            'id_agrupacion'      => $id_agrupacion,
            'id_contacto'        => $id_contacto_final,
            'fecha'              => fecha_bolivia(),
            'hora'               => hora_bolivia(),
            'nombre_y_apellido'  => $norm['nombre_y_apellido'],
            'numero_de_carnet'   => (int)$ci,
            'telefono'           => (int)$telefono,
            'ciudad'             => $norm['ciudad'],
            'correo_electronico' => $norm['correo_electronico'],
            'agrupacion'         => $norm['agrupacion'],
            'nombre_de_la_obra'  => $norm['nombre_de_la_obra'],
            'coreografo'         => $norm['coreografo'],
            'categoria'          => $categoriaLabel,
            'division'           => $divisionLabel,
            'subdivision'        => $subdivisionLabel,
            'cantidad'           => $cantidad,
            'modalidad'          => $modalidadUp,
            'genero'             => $generoLabel,
            'enlace_del_logo'    => $enlace_del_logo,
            'estado'             => 'pendiente',
        ],
        'relacion'        => $relacion_pre,
        // imagen_persona: prioridad foto recién subida > foto de relación pre-existente.
        // logo_agrupacion: el logo final resuelto en este envío (puede ser nuevo o heredado).
        'imagen_persona'  => $fotoNuevaUrl ?? resolve_imagen_persona($relacion_pre),
        'logo_agrupacion' => $enlace_del_logo ?? resolve_logo_agrupacion($relacion_pre),
    ]);

    jok([
        'id_inscripcion' => $id_inscripcion,
        'id_encargado'   => $id_encargado_final,
        'id_coreografo'  => $id_coreografo,
        'id_agrupacion'  => $id_agrupacion,
        'id_contacto'    => $id_contacto_final,
        'message'        => 'Inscripción registrada con éxito',
    ]);
} catch (Throwable $e) {
    error_log('[inscripcion] ' . $e->getMessage());
    jerror(502, 'Error al guardar la inscripción: ' . $e->getMessage());
}
