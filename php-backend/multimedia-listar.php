<?php
/**
 * GET /multimedia-listar.php?id_inscripcion=X
 *   o /multimedia-listar.php?id_institucion=Y&year=2026
 *
 * Lista archivos multimedia + estado de confirmación de la inscripción.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();

$id_inscripcion = trim((string)($_GET['id_inscripcion'] ?? ''));
$id_institucion = trim((string)($_GET['id_institucion'] ?? ''));
$year = (int)($_GET['year'] ?? 2026);

if ($id_inscripcion === '' && $id_institucion === '') {
    sendJson(['error' => 'Falta id_inscripcion o id_institucion'], 400);
    exit;
}

$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
$sb = supabase();

// Si solo viene id_inscripcion, resolver id_agrupacion para validar contexto
if ($id_inscripcion !== '') {
    $insc = $sb->selectOne(
        'registro_de_inscripcion_2026',
        'id_inscripcion,id_agrupacion',
        ['id_inscripcion' => "eq.$id_inscripcion"]
    );
    if (!$insc) {
        sendJson(['error' => 'Inscripción no encontrada'], 404);
        exit;
    }
    $id_institucion = (string)($insc['id_agrupacion'] ?? '');
}

if (!in_array($id_institucion, $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

// Listar multimedia
$qs = "year=eq.$year&id_institucion=eq.$id_institucion&order=tipo.asc,created_at.desc";
if ($id_inscripcion !== '') {
    $qs .= "&id_inscripcion=eq.$id_inscripcion";
}
$rows = $sb->selectRaw('multimedia', "select=*&$qs");

// Estado de confirmación si pidió por inscripción
$confirmado = false;
$fecha_confirmacion = null;
if ($id_inscripcion !== '') {
    $estado = $sb->selectOne(
        'inscripcion_multimedia_estado',
        'confirmado,fecha_confirmacion',
        [
            'id_inscripcion' => "eq.$id_inscripcion",
            'year' => "eq.$year",
        ]
    );
    if ($estado) {
        $confirmado = !empty($estado['confirmado']);
        $fecha_confirmacion = $estado['fecha_confirmacion'] ?? null;
    }
}

sendJson([
    'archivos' => $rows,
    'confirmado' => $confirmado,
    'fecha_confirmacion' => $fecha_confirmacion,
]);
