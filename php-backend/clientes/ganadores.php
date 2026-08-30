<?php
declare(strict_types=1);

/**
 * Ganadores para un CLIENTE de membresía.
 *
 * Mismo cálculo que ganadores.php —los dos llaman a ganadoresPayload()— pero
 * detrás de un interruptor APAGADO por defecto.
 *
 * El motivo no es técnico: este payload trae el LUGAR y la NOTA de cada obra.
 * Publicarlo antes de la premiación arruina la premiación, y no hay forma de
 * deshacerlo. Por eso el endpoint existe y está listo, pero devuelve
 * `publicado: false` hasta que alguien cambie a mano
 * ganadoresVisiblesParaClientes() en _lib/auth-cliente.php.
 *
 * Responde 200 y no 403 a propósito: así la pantalla puede mostrar "todavía no
 * se publicaron los resultados", que es la verdad, en vez de un error.
 */

require __DIR__ . '/../_lib/auth-cliente.php';   // ya trae supabase.php
require __DIR__ . '/../_lib/ganadores-data.php';

handlePreflight();
requireMethod('GET');
requireCliente();

if (!ganadoresVisiblesParaClientes()) {
    sendJson(['publicado' => false, 'bloques' => [], 'absolutos' => [], 'total' => 0]);
    exit;
}

$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
sendJson(['publicado' => true] + ganadoresPayload($year));
