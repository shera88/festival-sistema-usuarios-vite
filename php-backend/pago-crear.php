<?php
/**
 * POST multipart /pago-crear.php
 *   fields:
 *     concepto         (inscripcion | convenio_entradas | credencial)
 *     id_referencia    (id del compromiso)
 *     monto            (numeric > 0)
 *     id_metodo_pago   (FK metodos_de_pago_2026.id_metodo)
 *     observacion      (opt)
 *     comprobante      (file opt, max 5 MB, image/* o pdf)
 *
 * Crea fila pagos_2026 con estado='enviado'.
 * Sube comprobante a Storage si viene.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['error' => 'PHP fatal: ' . $err['message']]);
    }
});

handlePreflight();
requireMethod('POST');

$user = requireEditor();
// Set REAL de agrupaciones (un representante puede tener varias; ver context.php).
// Antes esto usaba solo el id_agrupacion único del contacto → daba 403 al pagar
// compromisos de agrupaciones no-primarias.
$userAgrups = resolveUserAgrupaciones($user);

$concepto       = trim((string)($_POST['concepto'] ?? ''));
$id_referencia  = trim((string)($_POST['id_referencia'] ?? ''));
$monto          = (float)($_POST['monto'] ?? 0);
$id_metodo_pago = trim((string)($_POST['id_metodo_pago'] ?? ''));
$observacion    = trim((string)($_POST['observacion'] ?? '')) ?: null;
// Cantidad de credenciales a comprar (solo credencial). La inscripción da un valor
// inicial pero el usuario puede ajustarlo → fija el compromiso (override) y el monto.
$cantidadCred   = isset($_POST['cantidad']) ? (int)$_POST['cantidad'] : null;
const PRECIO_CREDENCIAL = 15;

// Normalizar al vocab CANÓNICO de pagos_2026 (la gestión, los pagos guardados
// y la constraint chk_pagos_concepto_fk usan estos nombres). La app puede mandar
// nombres viejos durante la transición. TODO se guarda en pagos_2026.
$CONCEPTO_CANON = [
    'inscripcion'         => 'por_participante',
    'por_participante'    => 'por_participante',
    'convenio_entradas'   => 'pre_venta',
    'pre_venta'           => 'pre_venta',
    'credencial'          => 'credencial',
    'credencial_unit'     => 'credencial_unitaria',
    'credencial_unitaria' => 'credencial_unitaria',
];
$conceptoCanon = $CONCEPTO_CANON[$concepto] ?? null;
if ($conceptoCanon === null) {
    sendJson(['error' => 'Concepto inválido'], 400);
    exit;
}
if ($id_referencia === '' || !preg_match('/^[A-Za-z0-9_=+\/\-]{4,128}$/', $id_referencia)) {
    sendJson(['error' => 'id_referencia inválido'], 400);
    exit;
}
if ($monto <= 0) {
    sendJson(['error' => 'Monto debe ser mayor a 0'], 400);
    exit;
}
if ($id_metodo_pago === '') {
    sendJson(['error' => 'Falta método de pago'], 400);
    exit;
}

$sb = supabase();

// Validar método existe y activo
$metodo = $sb->selectOne(
    'metodos_de_pago_2026',
    'id_metodo,metodo,activo',
    ['id_metodo' => "eq.$id_metodo_pago"]
);
if (!$metodo || empty($metodo['activo'])) {
    sendJson(['error' => 'Método de pago inválido o inactivo'], 400);
    exit;
}

// Resolver id_agrupacion según concepto + verificar pertenencia
$id_agrupacion = null;
$monto_total = null;
$saldo_actual = null;

if ($conceptoCanon === 'por_participante') {
    $row = $sb->selectOne(
        'registro_de_inscripcion_2026',
        'id_inscripcion,id_agrupacion,subdivision,cantidad',
        ['id_inscripcion' => "eq.$id_referencia"]
    );
    if (!$row) { sendJson(['error' => 'Inscripción no encontrada'], 404); exit; }
    $id_agrupacion = (string)$row['id_agrupacion'];
} elseif ($conceptoCanon === 'pre_venta') {
    $row = $sb->selectOne(
        'recepcion_convenio_2026',
        'id_convenio,id_agrupacion,monto_total',
        ['id_convenio' => "eq.$id_referencia"]
    );
    if (!$row) { sendJson(['error' => 'Convenio no encontrado'], 404); exit; }
    $id_agrupacion = (string)$row['id_agrupacion'];
} else { // credencial / credencial_unitaria
    // id_referencia canónico = 'cred-<id_agrupacion>' (el compromiso se deriva de
    // los bailarines; ya no depende de que exista fila en compromisos_credenciales).
    if (!str_starts_with($id_referencia, 'cred-')) {
        sendJson(['error' => 'Referencia de credencial inválida'], 400);
        exit;
    }
    $id_agrupacion = substr($id_referencia, 5);
    if ($id_agrupacion === '') { sendJson(['error' => 'Agrupación de credencial inválida'], 400); exit; }
}

if (!in_array($id_agrupacion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado para esta agrupación'], 403);
    exit;
}

// Credencial con cantidad ajustada: el usuario define cuántas comprar. Se fija el
// override (compromisos_credenciales_2026) → el compromiso pasa a valer
// cantidad × 15 Bs, y el monto del pago se calcula desde ahí (autoridad server).
if ($conceptoCanon === 'credencial' && $cantidadCred !== null) {
    if ($cantidadCred < 1) { sendJson(['error' => 'Cantidad de credenciales inválida'], 400); exit; }
    try {
        $sb->upsert('compromisos_credenciales_2026', [
            'id_compromiso'   => $id_referencia,
            'id_agrupacion'   => $id_agrupacion,
            'cantidad'        => $cantidadCred,
            'precio_unitario' => PRECIO_CREDENCIAL,
            'origen'          => 'manual',
            'updated_at'      => date('c'),
        ], 'id_agrupacion');
    } catch (RuntimeException $e) {
        sendJson(['error' => 'No se pudo fijar la cantidad de credenciales: ' . $e->getMessage()], 500);
        exit;
    }
    // El monto lo manda el frontend (cantidad × 15) pero el server lo recomputa
    // para no confiar en el cliente.
    $monto = $cantidadCred * PRECIO_CREDENCIAL;
}

// Validar saldo (no permitir pagar de más)
$deudas = $sb->rpc('pagos_resumen_agrupacion', ['p_id_agrupacion' => $id_agrupacion]);
$saldo = 0;
foreach ($deudas as $d) {
    if ($d['concepto'] === $conceptoCanon && $d['id_referencia'] === $id_referencia) {
        $saldo = (float)($d['saldo'] ?? 0);
        break;
    }
}
if ($saldo <= 0) {
    sendJson(['error' => 'Este compromiso ya está pagado en su totalidad'], 400);
    exit;
}
if ($monto > $saldo + 0.01) {
    sendJson(['error' => 'Monto excede el saldo pendiente (' . number_format($saldo,2) . ' Bs)'], 400);
    exit;
}

// Upload comprobante si viene
$comprobante_url = null;
if (isset($_FILES['comprobante']) && is_uploaded_file($_FILES['comprobante']['tmp_name'])) {
    $file = $_FILES['comprobante'];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        sendJson(['error' => 'Error upload comprobante: ' . $file['error']], 400);
        exit;
    }
    if ($file['size'] > 5 * 1024 * 1024) {
        sendJson(['error' => 'Comprobante muy grande (máx 5 MB)'], 413);
        exit;
    }
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);
    $allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
    if (!in_array($mime, $allowed, true)) {
        sendJson(['error' => 'Formato no permitido (use JPG/PNG/WEBP/PDF)'], 415);
        exit;
    }
    $ext = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif','application/pdf'=>'pdf'][$mime];
    $fname = bin2hex(random_bytes(6)) . '-' . time() . '.' . $ext;
    $storagePath = "comprobantes/{$concepto}/{$id_agrupacion}/{$fname}";
    try {
        $comprobante_url = $sb->uploadPublicFileAt($file['tmp_name'], $mime, $storagePath, true);
    } catch (RuntimeException $e) {
        sendJson(['error' => 'Error storage: ' . $e->getMessage()], 500);
        exit;
    }
}

// Generar id_pago + numero_recibo
$id_pago = bin2hex(random_bytes(8));
$PREFIX = ['por_participante'=>'PP','pre_venta'=>'PV','credencial'=>'CR','credencial_unitaria'=>'CU'];
$numero_recibo = ($PREFIX[$conceptoCanon] ?? 'PG') . '-' . date('ymd') . '-' . strtoupper(substr($id_pago, 0, 6));

// Fecha/hora Bolivia (UTC-4)
$tz = new DateTimeZone('America/La_Paz');
$now = new DateTime('now', $tz);

$row = [
    'id_pago'             => $id_pago,
    'numero_recibo'       => $numero_recibo,
    'concepto'            => $conceptoCanon,
    'id_referencia'       => $id_referencia,
    'id_agrupacion'       => $id_agrupacion,
    'id_inscripcion'      => $conceptoCanon === 'por_participante' ? $id_referencia : null,
    'id_convenio'         => $conceptoCanon === 'pre_venta' ? $id_referencia : null,
    // Modelo unificado: TODO vive en pagos_2026 (link por id_referencia + id_agrupacion + concepto).
    // NO usar id_pago_credencial (FK legacy -> pagos_credenciales_2026, tabla deprecada).
    'id_pago_credencial'  => null,
    'fecha'               => $now->format('Y-m-d'),
    'hora'                => $now->format('H:i:s'),
    'metodo_pago'         => $metodo['metodo'],
    'id_metodo_pago'      => $id_metodo_pago,
    'monto'               => $monto,
    'id_contacto_pagador' => $user['id_contacto'],
    'nombre_pagador'      => $user['nombre_y_apellido'],
    'telefono_pagador'    => $user['telefono'] ?? null,
    'comprobante_url'     => $comprobante_url,
    'estado'              => 'enviado',
    'observacion'         => $observacion,
    'created_at'          => $now->format('Y-m-d\TH:i:sP'),
    'updated_at'          => $now->format('Y-m-d\TH:i:sP'),
];

try {
    $sb->insert('pagos_2026', $row);
} catch (RuntimeException $e) {
    sendJson(['error' => 'Error DB: ' . $e->getMessage()], 500);
    exit;
}

// Notificar a n8n para que avise a admins por WhatsApp
$cfgFull = require __DIR__ . '/config.php';
$n8nUrl = $cfgFull['webhooks']['pago_revision'] ?? '';
$n8nSecret = $cfgFull['webhook_shared_secret'] ?? '';
if ($n8nUrl) {
    // Datos contextuales para enriquecer la notificación
    $obra = '';
    $agrupacion = '';
    // Nombre de la agrupación desde instituciones (sirve para TODOS los conceptos:
    // inscripción, pre-venta, credenciales). Antes solo se llenaba para inscripción.
    $inst = $sb->selectOne('instituciones', 'nombre_agrupacion', ['id_agrupacion' => 'eq.' . $id_agrupacion]);
    $agrupacion = (string)($inst['nombre_agrupacion'] ?? '');
    if ($conceptoCanon === 'por_participante') {
        $insRow = $sb->selectOne('registro_de_inscripcion_2026', 'nombre_de_la_obra,agrupacion', ['id_inscripcion' => 'eq.' . $id_referencia]);
        $obra = (string)($insRow['nombre_de_la_obra'] ?? '');
        if ($agrupacion === '') $agrupacion = (string)($insRow['agrupacion'] ?? '');
    }
    // PDF de revisión para el admin: hoja 1 con los datos del pago + el comprobante
    // del usuario anexado (imagen embebida o PDF fusionado). Si falla, usa el comprobante crudo.
    require_once __DIR__ . '/_lib/revision.php';
    $revisionPdfUrl = revisionGenerarPdf($row, $agrupacion);
    $payload = [
        'secret'           => $n8nSecret,
        'id_pago'          => $id_pago,
        'numero_recibo'    => $numero_recibo,
        'concepto'         => $conceptoCanon,
        'id_referencia'    => $id_referencia,
        'monto'            => $monto,
        'fecha'            => $row['fecha'],
        'hora'             => $row['hora'],
        'metodo_pago'      => $row['metodo_pago'],
        'nombre_pagador'   => $row['nombre_pagador'],
        'telefono_pagador' => $row['telefono_pagador'],
        'comprobante_url'  => $comprobante_url,
        'revision_pdf_url' => $revisionPdfUrl ?: $comprobante_url,
        'agrupacion'       => $agrupacion,
        'nombre_obra'      => $obra,
    ];
    // Fire-and-forget, 2s timeout para no demorar la respuesta al usuario
    $ch = curl_init($n8nUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 2,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    ]);
    curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('[pago-crear] n8n notify falló: ' . curl_error($ch));
    }
    curl_close($ch);
}

sendJson([
    'ok' => true,
    'id_pago' => $id_pago,
    'numero_recibo' => $numero_recibo,
    'estado' => 'enviado',
    'comprobante_url' => $comprobante_url,
    'monto' => $monto,
]);
