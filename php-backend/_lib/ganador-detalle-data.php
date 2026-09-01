<?php
declare(strict_types=1);

/**
 * DETALLE de una obra de la ronda final: las notas que puso CADA jurado.
 *
 * Se extrajo de ganador-detalle.php SIN tocar ni una regla, para que lo puedan
 * servir dos endpoints —el del portal, con sesión, y el público de la web— sin
 * mantener dos copias del mismo cálculo. Quién puede verlo lo decide cada
 * endpoint; este archivo sólo arma los datos.
 *
 * Sólo lectura: no escribe en ninguna tabla.
 */

require_once __DIR__ . '/supabase.php';

/**
 * @return array|null  null si la obra no existe (cada endpoint decide qué responder).
 */
function ganadorDetallePayload(string $id): ?array
{
    $sb = supabase();

    /* Las TRES consultas a la vez, no una tras otra.
       Cada viaje a Supabase cuesta ~1,2 s desde acá, así que encadenarlas hacía
       que el modal tardara ~2,4 s en abrir. Con curl_multi el costo es el de la
       más lenta, no la suma.

       La de jurados normalmente dependería de las notas —para filtrar por los
       ids que aparecen—, y eso obligaría a un segundo viaje. Se traen TODOS los
       jurados y se filtra en PHP: son unas pocas decenas de filas, sale más
       barato que esperar otro viaje. */
    $lote = $sb->selectRawBatch([
        'obra' => ['table' => 'registro_de_inscripcion_2026', 'qs' =>
            'select=id_inscripcion,agrupacion,nombre_de_la_obra,categoria,modalidad,division,subdivision,'
            . 'coreografo,director,dia,dia_final,genero,orden,enlace_del_logo'
            . '&id_inscripcion=eq.' . rawurlencode($id) . '&limit=1'],
        'notas' => ['table' => 'recepcion_notas_final_2026', 'qs' =>
            'select=id_jurado,jurado,tematica,interpretacion,coreografia,dificultad_y_ejecucion,'
            . 'total,comentario,dia,estado'
            . '&id_inscripcion=eq.' . rawurlencode($id)
            . '&estado=in.(enviada,bloqueada)&order=total.desc&limit=100'],
        'jurados' => ['table' => 'jurados_consolidado', 'qs' =>
            'select=id_jurado,nombre_y_apellido,foto&limit=300'],
    ]);

    if (empty($lote['obra'])) {
        return null;
    }

    $o     = $lote['obra'][0];
    $notas = $lote['notas'] ?? [];

    $mapa = [];
    foreach ($lote['jurados'] ?? [] as $j) {
        $mapa[$j['id_jurado']] = $j;
    }

    $suma = 0.0;
    $califs = array_map(function ($n) use ($mapa, &$suma) {
        $j = $mapa[$n['id_jurado'] ?? ''] ?? [];
        $suma += (float)($n['total'] ?? 0);
        return [
            'id_jurado'      => $n['id_jurado'] ?? null,
            'jurado'         => $j['nombre_y_apellido'] ?? ($n['jurado'] ?? 'Jurado'),
            'foto'           => $j['foto'] ?? null,
            'tematica'       => $n['tematica'],
            'interpretacion' => $n['interpretacion'],
            'coreografia'    => $n['coreografia'],
            'dificultad'     => $n['dificultad_y_ejecucion'],
            'total'          => $n['total'],
            'comentario'     => $n['comentario'] ?: null,
        ];
    }, $notas);

    return [
        'obra' => [
            'id_inscripcion' => $o['id_inscripcion'],
            'agrupacion'     => $o['agrupacion'],
            'obra'           => $o['nombre_de_la_obra'],
            'categoria'      => $o['categoria'],
            'modalidad'      => $o['modalidad'],
            'division'       => $o['division'],
            'subdivision'    => $o['subdivision'],
            'coreografo'     => $o['coreografo'],
            'director'       => $o['director'],
            'dia'            => $o['dia'],
            'dia_final'      => $o['dia_final'],
            // genero y orden los pide el modal de la web, que es el mismo que
            // usa la pantalla de Notas.
            'genero'         => $o['genero'] ?? null,
            'orden'          => $o['orden'] ?? null,
            'logo'           => $o['enlace_del_logo'] ?: null,
        ],
        // El promedio se recalcula acá con las mismas notas que se muestran,
        // para que el número de arriba y el desglose de abajo no discrepen.
        'nota'           => $califs ? round($suma / count($califs), 2) : null,
        'jurados'        => count($califs),
        'calificaciones' => $califs,
    ];
}
