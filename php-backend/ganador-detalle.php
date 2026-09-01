<?php
declare(strict_types=1);

/**
 * DETALLE de una obra de la ronda final: las notas que puso CADA jurado.
 *
 * Es el equivalente al modal de la app de jurados: el desglose por jurado
 * (temática, interpretación, coreografía, dificultad), su total y el comentario
 * que dejó.
 *
 * Gateado en el servidor, con el MISMO interruptor que ganadores.php
 * (_lib/publicacion.php). Mientras no se publiquen los resultados es sólo super
 * admin; una vez publicados lo abre cualquier participante o cliente con sesión,
 * porque la organización pidió que el desglose se vea igual que lo ve un super
 * admin.
 *
 * Lo que eso significa, para que quede escrito: publicado esto, cualquiera con
 * sesión puede ver QUÉ NOTA PUSO CADA JURADO —con su nombre— a cada obra, y su
 * comentario. Es lo más sensible del portal y no hay mezcla ni recorte que lo
 * proteja: la única defensa es el gate. Se abre porque se pidió expresamente.
 *
 * Ojo al agregar campos: acá NO hay mezcla ni ocultamiento que proteja nada,
 * como sí pasa en nominados.php. La única defensa es el gate.
 */

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require_once __DIR__ . '/_lib/auth-cliente.php';   // requireParticipanteOCliente()
require_once __DIR__ . '/_lib/publicacion.php';

handlePreflight();
requireMethod('GET');

// Publicado: participante O cliente (son dos sesiones distintas, y la del área
// de clientes no satisface requireAuth()). Sin publicar: sólo super admin.
if (ganadoresPublicos()) {
    requireParticipanteOCliente();
} else {
    requireSuperAdmin();
}

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    sendJson(['error' => 'Falta la obra'], 400);
    exit;
}

$sb = supabase();

/* Las TRES consultas a la vez, no una tras otra.
   Cada viaje a Supabase cuesta ~1,2 s desde acá, así que encadenarlas hacía que
   el modal tardara ~2,4 s en abrir. Con curl_multi el costo es el de la más
   lenta, no la suma.

   La de jurados normalmente dependería de las notas —para filtrar por los ids
   que aparecen—, y eso obligaría a un segundo viaje. Se traen TODOS los jurados
   y se filtra en PHP: son unas pocas decenas de filas, sale más barato que
   esperar otro viaje. */
$lote = $sb->selectRawBatch([
    'obra' => ['table' => 'registro_de_inscripcion_2026', 'qs' =>
        'select=id_inscripcion,agrupacion,nombre_de_la_obra,categoria,modalidad,division,subdivision,'
        . 'coreografo,director,dia,dia_final,enlace_del_logo'
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
    sendJson(['error' => 'Obra no encontrada'], 404);
    exit;
}
$o = $lote['obra'][0];
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
        'id_jurado'     => $n['id_jurado'] ?? null,
        'jurado'        => $j['nombre_y_apellido'] ?? ($n['jurado'] ?? 'Jurado'),
        'foto'          => $j['foto'] ?? null,
        'tematica'      => $n['tematica'],
        'interpretacion' => $n['interpretacion'],
        'coreografia'   => $n['coreografia'],
        'dificultad'    => $n['dificultad_y_ejecucion'],
        'total'         => $n['total'],
        'comentario'    => $n['comentario'] ?: null,
    ];
}, $notas);

sendJson([
    'obra' => [
        'id_inscripcion' => $o['id_inscripcion'],
        'agrupacion' => $o['agrupacion'],
        'obra'       => $o['nombre_de_la_obra'],
        'categoria'  => $o['categoria'],
        'modalidad'  => $o['modalidad'],
        'division'   => $o['division'],
        'subdivision' => $o['subdivision'],
        'coreografo' => $o['coreografo'],
        'director'   => $o['director'],
        'dia'        => $o['dia'],
        'dia_final'  => $o['dia_final'],
        'logo'       => $o['enlace_del_logo'] ?: null,
    ],
    // El promedio se recalcula acá con las mismas notas que se muestran, para
    // que el número de arriba y el desglose de abajo no puedan discrepar.
    'nota'         => $califs ? round($suma / count($califs), 2) : null,
    'jurados'      => count($califs),
    'calificaciones' => $califs,
]);
