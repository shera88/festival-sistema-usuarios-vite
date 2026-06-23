<?php
/**
 * POST /multimedia-eliminar.php  { id_multimedia }
 *
 * Borra row + objeto Storage. Bloqueado si la inscripción está confirmada.
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/r2.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();
$id_multimedia = trim((string)($body['id_multimedia'] ?? ''));
if ($id_multimedia === '' || !preg_match('/^[a-f0-9]{4,16}$/i', $id_multimedia)) {
    sendJson(['error' => 'id_multimedia inválido'], 400);
    exit;
}

$sb = supabase();
$row = $sb->selectOne(
    'multimedia',
    'id_multimedia,id_institucion,id_inscripcion,storage_path,year',
    ['id_multimedia' => "eq.$id_multimedia"]
);
if (!$row) {
    sendJson(['error' => 'Archivo no encontrado'], 404);
    exit;
}

$userAgrups = parseIdCsv($user['id_agrupacion'] ?? '');
if (!in_array((string)$row['id_institucion'], $userAgrups, true)) {
    sendJson(['error' => 'No autorizado'], 403);
    exit;
}

// Si la inscripción está confirmada, bloquear
$id_inscripcion = (string)($row['id_inscripcion'] ?? '');
if ($id_inscripcion !== '') {
    $estado = $sb->selectOne(
        'inscripcion_multimedia_estado',
        'confirmado',
        [
            'id_inscripcion' => "eq.$id_inscripcion",
            'year' => 'eq.' . (int)$row['year'],
        ]
    );
    if ($estado && !empty($estado['confirmado'])) {
        sendJson(['error' => 'Multimedia confirmada. Solicite al administrador para hacer cambios.'], 423);
        exit;
    }
}

// Borra objeto en R2 + row. (Los multimedia subidos antes de la migración viven en
// Supabase; ese caso es residual — el borrado en R2 no los toca, no rompe nada.)
if (!empty($row['storage_path'])) {
    r2()->deleteObject((string)$row['storage_path']);
}
$sb->delete('multimedia', 'id_multimedia', $id_multimedia);

sendJson(['ok' => true, 'id_multimedia' => $id_multimedia]);
