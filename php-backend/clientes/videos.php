<?php
declare(strict_types=1);

/**
 * Videos del festival para un CLIENTE de membresía.
 *
 * Distinto de videos.php en dos cosas, y las dos vienen de que el cliente no
 * participa del festival:
 *
 *   1. No hay scope de agrupación. `buildContextFilter()` devuelve null para
 *      quien no tiene agrupación, así que aquí ni se usa: el cliente compra el
 *      Paquete Completo, que es todo el festival 2026, o no compra nada. Tampoco
 *      hay histórico ≤2025: eso es "los videos de MI agrupación en años
 *      anteriores", y un cliente no tiene agrupación.
 *
 *   2. El estado de membresía se reduce a un booleano. Nada de kárdex, ni
 *      reservas, ni membresía por agrupación: paquete pagado o no.
 *
 * Se conserva la misma FORMA de respuesta que videos.php ({ videos, membresia })
 * para que la vista pueda reutilizar los mismos componentes de tarjeta y modal.
 */

require __DIR__ . '/../_lib/auth-cliente.php';

handlePreflight();
requireMethod('GET');

$cliente = requireCliente();
$pagado  = clientePagoPaquete((string)($cliente['cliente_id'] ?? ''));

$select = 'id_inscripcion,orden,dia,agrupacion,enlace_del_logo,nombre_de_la_obra,url_video,'
    . 'categoria,division,subdivision,modalidad,coreografo,director,bloque,genero,'
    . 'url_video_final,dia_final,orden_final';

$videos = [];
// Entra la obra que tenga CUALQUIERA de los dos videos. 21 obras del festival
// sólo tienen el de la noche final —no bailaron clasificatoria o no se subió—
// y con el filtro viejo, que exigía url_video, quedaban invisibles.
$rows = supabase()->selectRaw(
    'registro_de_inscripcion_2026',
    "or=(url_video.not.is.null,url_video_final.not.is.null)&select=$select&order=dia.asc,orden.asc&limit=3000"
);

if (is_array($rows) && count($rows) > 0) {
    // Al que no pagó se le muestra el catálogo COMPLETO pero bloqueado: es el
    // argumento de venta. Igual que en videos.php, la url viaja para poder
    // reproducir la vista previa de 20 s, que se corta en el navegador
    // (VideoModal). Quien sepa mirar la pestaña de red puede saltarse ese corte:
    // es una limitación conocida y heredada del portal, no algo nuevo de aquí.
    foreach ($rows as &$r) {
        $r['bloqueado'] = !$pagado;
    }
    unset($r);
    $videos['2026'] = $rows;
}

sendJson([
    'videos'    => $videos ?: new stdClass(),
    'membresia' => ['paquete_pagada' => $pagado],
]);
