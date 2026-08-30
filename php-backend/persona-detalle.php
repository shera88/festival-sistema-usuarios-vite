<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireAuth();
requireMethod('GET');

$id = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
if ($id === '') {
    sendJson(null);
    exit;
}

$rows = supabase()->rpc('obtener_contacto_por_id', ['p_id' => $id]);
$persona = (is_array($rows) && count($rows) > 0) ? $rows[0] : null;

// `obtener_contacto_por_id` devuelve numero_de_carnet, telefono y correo, y el
// único gate de este endpoint es requireAuth(): CUALQUIER sesión válida podía
// pedir el detalle de CUALQUIER persona por su id_contacto. Como desde la
// migración 003 el carnet ES la contraseña del portal, eso convertía a este
// endpoint en un extractor de credenciales: los id_contacto los reparte
// search-participants.php, que ni siquiera pide sesión.
//
// Ninguna vista consume estos campos —de hecho `lookups.personaDetalle` no la
// llama nadie—, así que se filtran en vez de borrar el endpoint: si quedara
// algún build viejo pidiéndolo, sigue respondiendo, sólo que sin la credencial.
// Si alguna pantalla llegara a necesitar el carnet, que lo pida un endpoint con
// su propio permiso, no éste.
if ($persona !== null) {
    unset($persona['numero_de_carnet'], $persona['telefono'], $persona['correo_electronico']);
}

sendJson($persona);
