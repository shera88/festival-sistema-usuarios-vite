<?php
/**
 * GET /inscripcion-obtener.php?id_inscripcion=<x>   ó   ?id_convenio=<x>
 *
 * Devuelve los campos editables de una inscripción propia, para prellenar el modal
 * de edición cuando se abre desde una card de Pagos (donde solo se tiene el
 * id_inscripcion o —en pre-venta— el id_convenio).
 *
 * Auth: requireEditor + usuarioAutorizadoInscripcion (mismo scope que Inscripciones).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireEditor();
$sb = supabase();

$id_inscripcion = trim((string)($_GET['id_inscripcion'] ?? ''));
$id_convenio    = trim((string)($_GET['id_convenio'] ?? ''));

// Pre-venta: resolver la inscripción a partir del convenio.
if ($id_inscripcion === '' && $id_convenio !== '') {
    $conv = $sb->selectOne(
        'recepcion_convenio_2026',
        'id_inscripcion',
        ['id_convenio' => "eq.$id_convenio"]
    );
    $id_inscripcion = trim((string)($conv['id_inscripcion'] ?? ''));
}

if ($id_inscripcion === '') {
    sendJson(['error' => 'No se pudo resolver la inscripción'], 404);
    exit;
}

if (!usuarioAutorizadoInscripcion($user, $id_inscripcion, 2026)) {
    sendJson(['error' => 'No autorizado para esta inscripción'], 403);
    exit;
}

$row = $sb->selectOne(
    'registro_de_inscripcion_2026',
    'id_inscripcion,nombre_de_la_obra,cantidad,modalidad,categoria,division',
    ['id_inscripcion' => "eq.$id_inscripcion"]
);
if (!$row) {
    sendJson(['error' => 'Inscripción no encontrada'], 404);
    exit;
}

sendJson([
    'id_inscripcion'    => $row['id_inscripcion'],
    'nombre_de_la_obra' => $row['nombre_de_la_obra'],
    'cantidad'          => $row['cantidad'],
    'modalidad'         => $row['modalidad'],
    'categoria'         => $row['categoria'] ?? null,
    'division'          => $row['division'] ?? null,
]);
