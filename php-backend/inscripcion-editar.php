<?php
/**
 * POST /inscripcion-editar.php   (JSON)
 *   { id_inscripcion, nombre_de_la_obra, cantidad, modalidad, categoria, division }
 *
 * Edita los datos que el representante puede cambiar de SU inscripción:
 *   - Nombre de la obra
 *   - Categoría (colegios/universidades/agrupacion) y Subcategoría/División (por edad)
 *   - Total de participantes (cantidad de bailarines)
 *   - Modalidad → deriva el GÉNERO (Folklore/Académico/Urbano), igual que el
 *     formulario de inscripción de la web.
 * La SUBDIVISIÓN se re-deriva de la cantidad (Solo/Dúo/Grupo Pequeño/Grupo Grande)
 * para que el precio por-participante y el conteo de credenciales queden coherentes.
 *
 * Auth: requireEditor + usuarioAutorizadoInscripcion (mismo scope que Inscripciones).
 */
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/normalize.php';

handlePreflight();
requireMethod('POST');

$user = requireEditor();
$body = jsonBody();

$id_inscripcion = trim((string)($body['id_inscripcion'] ?? ''));
$obra           = trim((string)($body['nombre_de_la_obra'] ?? ''));
$cantidad       = (int)($body['cantidad'] ?? 0);
$modalidad      = trim((string)($body['modalidad'] ?? ''));
$categoria      = trim((string)($body['categoria'] ?? ''));
$division       = trim((string)($body['division'] ?? ''));

// value slug → etiqueta (mismos mapas que el formulario de inscripción web para
// que el dato quede idéntico al que se guarda al crear, y los chips rendericen igual).
$CATEGORIA_LABELS = ['colegios' => 'Colegios', 'universidades' => 'Universidades', 'agrupacion' => 'Agrupación'];
$DIVISION_LABELS  = [
    'pre_infantil' => 'Pre infantil', 'infantil' => 'Infantil', 'pre_juvenil' => 'Pre Juvenil',
    'juvenil' => 'Juvenil', 'mayores' => 'Mayores', 'adultos' => 'Adultos',
];

if ($id_inscripcion === '') { sendJson(['error' => 'Falta id_inscripcion'], 400); exit; }
if (mb_strlen($obra) < 2)   { sendJson(['error' => 'Nombre de la obra muy corto'], 400); exit; }
if ($cantidad < 1 || $cantidad > 60) { sendJson(['error' => 'Cantidad inválida (1–60)'], 400); exit; }
if (mb_strlen($modalidad) < 2) { sendJson(['error' => 'Modalidad obligatoria'], 400); exit; }
if (!isset($CATEGORIA_LABELS[$categoria])) { sendJson(['error' => 'Categoría inválida'], 400); exit; }
if (!isset($DIVISION_LABELS[$division]))   { sendJson(['error' => 'Subcategoría inválida'], 400); exit; }

// Autorización: la inscripción debe estar dentro del scope del usuario
// (su agrupación / ser encargado, director o coreógrafo). Los admin pueden con todas.
if (!usuarioAutorizadoInscripcion($user, $id_inscripcion, 2026)) {
    sendJson(['error' => 'No autorizado para editar esta inscripción'], 403);
    exit;
}

// Subdivisión derivada de la cantidad (mismos rangos que la convocatoria; 3–4 —hueco
// del formulario, trío eliminado— cae en Grupo Pequeño para no dejar el dato inválido).
$subdivisionLabel =
    $cantidad === 1  ? 'Solo' :
    ($cantidad === 2 ? 'Dúo' :
    ($cantidad <= 14 ? 'Grupo Pequeño' : 'Grupo Grande'));

$patch = [
    'nombre_de_la_obra' => upper_norm($obra),
    'cantidad'          => $cantidad,
    'modalidad'         => upper_norm($modalidad),
    'genero'            => derive_genero(upper_norm($modalidad) ?? ''),
    'subdivision'       => upper_norm($subdivisionLabel),
    'categoria'         => upper_norm($CATEGORIA_LABELS[$categoria]),
    'division'          => upper_norm($DIVISION_LABELS[$division]),
];

$sb = supabase();
try {
    $sb->update('registro_de_inscripcion_2026', 'id_inscripcion', $id_inscripcion, $patch);
} catch (Throwable $e) {
    sendJson(['error' => 'Error al guardar: ' . $e->getMessage()], 500);
    exit;
}

sendJson([
    'ok'                => true,
    'id_inscripcion'    => $id_inscripcion,
    'nombre_de_la_obra' => $patch['nombre_de_la_obra'],
    'cantidad'          => $cantidad,
    'modalidad'         => $patch['modalidad'],
    'genero'            => $patch['genero'],
    'subdivision'       => $patch['subdivision'],
    'categoria'         => $patch['categoria'],
    'division'          => $patch['division'],
]);
