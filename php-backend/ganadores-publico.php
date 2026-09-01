<?php
declare(strict_types=1);

/**
 * GANADORES para la web pública — sin sesión.
 *
 * Lo consume festivaldanzarte.com (mismo dominio, otra aplicación) para armar su
 * panel de ganadores y para poner las notas de la final en las pestañas de
 * sábado y domingo del ranking.
 *
 * POR QUÉ UN ENDPOINT Y NO UNA RPC DE POSTGRES
 * --------------------------------------------
 * Lo natural en este proyecto sería una RPC `SECURITY DEFINER` con grant a anon,
 * como `nominados_publico`. Aquí NO se hizo, a propósito: las reglas de
 * premiación —quién entra, con qué lugar, en qué orden van los bloques— viven en
 * `_lib/premiacion.php` y leen el acomodo MANUAL de `premios_bloques_2026` y
 * `premios_placas_2026`. Reescribir todo eso en SQL sería mantener dos
 * implementaciones de la misma regla, y el día que se separen la web mostraría
 * un orden distinto al del portal y al de la planilla. Este endpoint llama al
 * MISMO `ganadoresPayload()` que usa el portal, así que no hay nada que se pueda
 * desincronizar: es el mismo byte.
 *
 * QUÉ EXPONE, Y QUÉ NO
 * --------------------
 * Expone lo mismo que ve un participante en el portal: bloque, obra, agrupación,
 * lugar y nota. NO expone el desglose por jurado — ese sigue en
 * `ganador-detalle.php`, que exige sesión. Una cosa es publicar los resultados y
 * otra distinta dejar en internet abierto qué puntuó cada jurado con nombre y
 * apellido.
 *
 * Detrás del MISMO interruptor que el resto (`_lib/publicacion.php`): mientras
 * esté apagado responde `publicado: false` con listas vacías, y no 403, para que
 * la web pueda decir "todavía no se publicaron" en vez de mostrar un error.
 *
 * Sólo lectura. No escribe en ninguna tabla.
 */

require __DIR__ . '/_lib/supabase.php';
require_once __DIR__ . '/_lib/publicacion.php';
require __DIR__ . '/_lib/ganadores-data.php';

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Método no permitido']);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
// Es contenido público y estable: se deja cachear un rato para no recalcular
// esto en cada visita. Son ~250 KB y unas cuantas consultas a Supabase.
header('Cache-Control: public, max-age=300');

if (!ganadoresPublicos()) {
    echo json_encode(
        ['publicado' => false, 'ano' => '2026', 'total' => 0, 'bloques' => [], 'absolutos' => []],
        JSON_UNESCAPED_UNICODE
    );
    exit;
}

$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if ($year === '') {
    $year = '2026';
}

echo json_encode(['publicado' => true] + ganadoresPayload($year), JSON_UNESCAPED_UNICODE);
