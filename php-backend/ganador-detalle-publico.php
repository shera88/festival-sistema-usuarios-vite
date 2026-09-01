<?php
declare(strict_types=1);

/**
 * DETALLE de una obra de la ronda final, para la web pública — sin sesión.
 *
 * Es el mismo desglose por jurado que ve el portal: llama a
 * `ganadorDetallePayload()`, el mismo de `ganador-detalle.php`. Dos copias del
 * cálculo terminarían mostrando promedios distintos de la misma obra.
 *
 * LO QUE ESTO PUBLICA, para que quede escrito: cualquiera en internet, sin
 * cuenta, puede ver qué nota puso cada jurado —con su nombre y su foto— a cada
 * obra, y el comentario que dejó. Es lo más sensible del sistema. Se abre
 * porque la organización lo pidió expresamente para la web, del mismo modo que
 * antes se abrió dentro del portal.
 *
 * Detrás del MISMO interruptor que todo lo demás (`_lib/publicacion.php`):
 * mientras esté apagado responde 404, como si la obra no existiera, en vez de
 * confirmar que hay algo ahí esperando a ser publicado.
 *
 * Sólo lectura. No escribe en ninguna tabla.
 */

require __DIR__ . '/_lib/supabase.php';
require_once __DIR__ . '/_lib/publicacion.php';
require_once __DIR__ . '/_lib/ganador-detalle-data.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

if (!ganadoresPublicos()) {
    http_response_code(404);
    echo json_encode(['error' => 'No disponible']);
    exit;
}

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Falta la obra']);
    exit;
}

// Cacheable: el desglose de una obra ya calificada no cambia.
header('Cache-Control: public, max-age=300');

$payload = ganadorDetallePayload($id);
if ($payload === null) {
    http_response_code(404);
    echo json_encode(['error' => 'Obra no encontrada']);
    exit;
}

echo json_encode($payload, JSON_UNESCAPED_UNICODE);
