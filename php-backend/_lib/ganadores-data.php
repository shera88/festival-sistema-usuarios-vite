<?php
declare(strict_types=1);

/**
 * Armado de los GANADORES, compartido por los dos endpoints que lo sirven:
 * ganadores.php (super admin) y clientes/ganadores.php (público que compró la
 * membresía, detrás de un flag).
 *
 * Se extrajo de ganadores.php sin tocar ni una regla: el cálculo es el mismo de
 * antes, sólo cambió de archivo. Si dos endpoints calcularan los premios por su
 * cuenta, tarde o temprano mostrarían resultados distintos del mismo festival, y
 * eso en una premiación no se arregla con un parche.
 *
 * Las reglas de quién entra y con qué lugar viven en _lib/premiacion.php y son
 * las mismas de la app de jurados.
 */

require_once __DIR__ . '/premiacion.php';

function ganadoresPayload(string $year): array
{
    // La ronda final sólo existe en 2026: para otros años no hay nada que armar.
    if ($year !== '2026') {
        return ['ano' => $year, 'total' => 0, 'bloques' => [], 'absolutos' => []];
    }

    $premiadas = premiacionObras(supabase());

    /* ── Por CATEGORÍA ──────────────────────────────────────────────────────
       Mismo orden que la planilla: manda el acomodo manual de los bloques si lo
       hay, y dentro de cada bloque por nota de mayor a menor. */
    $bloques = premiacionBloques($premiadas);
    $n = 0;
    foreach ($bloques as &$b) {
        usort($b['items'], fn($x, $y) => ($y['nota'] <=> $x['nota'])
            ?: strcmp((string)$x['obra'], (string)$y['obra']));
        foreach ($b['items'] as &$it) {
            $it['n'] = ++$n;
        }
        unset($it);
    }
    unset($b);

    /* ── Por GÉNERO: los cuatro cuadros ─────────────────────────────────────
       A diferencia de los «absolutos» de la app de jurados, aquí NO hay tope de
       5: va TODA la ronda final de ese género, ordenada de mayor a menor nota.
       El #1 de cada cuadro es el ganador; el resto es el ranking completo.

       A igualdad de nota se desempata por el nombre de la obra, para que el
       orden no dependa de en qué orden llegaron las filas de las dos noches. */
    $porNota = fn($a, $b) => ($b['nota'] <=> $a['nota'])
        ?: strcmp((string)$a['obra'], (string)$b['obra']);

    $cuadros = [
        'FOLKLORE'  => ['titulo' => 'Ganadores folklore',   'items' => []],
        'URBANO'    => ['titulo' => 'Ganadores urbano',     'items' => []],
        'ACADEMICO' => ['titulo' => 'Ganadores académico',  'items' => []],
        'COLEGIOS'  => ['titulo' => 'Ganadores colegios o universidades', 'items' => []],
    ];

    foreach ($premiadas as $o) {
        if (isset($cuadros[$o['genero']])) {
            $cuadros[$o['genero']]['items'][] = $o;
        }
        // Colegios y universidades comparten cuadro, como en la planilla oficial.
        // Una misma obra puede figurar en su género Y aquí: son cuadros distintos.
        if (preg_match('/COLEGIO|UNIVERSID/u', $o['categoria'])) {
            $cuadros['COLEGIOS']['items'][] = $o;
        }
    }

    $absolutos = [];
    foreach ($cuadros as $clave => $c) {
        usort($c['items'], $porNota);
        foreach ($c['items'] as $i => &$it) {
            $it['pos'] = $i + 1;          // el #1 es el ganador del cuadro
        }
        unset($it);
        $absolutos[] = [
            'clave'  => $clave,
            'titulo' => $c['titulo'],
            'total'  => count($c['items']),
            'items'  => $c['items'],
        ];
    }

    return [
        'ano'       => $year,
        'total'     => $n,
        'bloques'   => array_values($bloques),
        'absolutos' => $absolutos,
    ];
}
