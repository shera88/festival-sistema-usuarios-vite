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
require_once __DIR__ . '/_lib/ganador-detalle-data.php';

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

// El armado vive en _lib/ganador-detalle-data.php porque el endpoint PÚBLICO de
// la web sirve exactamente lo mismo. Dos copias del mismo desglose terminarían
// mostrando promedios distintos de la misma obra.
$payload = ganadorDetallePayload($id);
if ($payload === null) {
    sendJson(['error' => 'Obra no encontrada'], 404);
    exit;
}
sendJson($payload);
