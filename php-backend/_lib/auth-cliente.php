<?php
declare(strict_types=1);

/**
 * Guard y utilidades de los endpoints de CLIENTE.
 *
 * Se apoya en auth.php sólo para lo compartido que no tiene que ver con la
 * identidad (sendJson, CORS, handlePreflight, requireMethod). Incluirlo NO abre
 * ninguna sesión: auth.php sólo declara funciones, y startSecureSession() se
 * llama explícitamente desde requireAuth(). Así un endpoint de cliente nunca
 * toca el realm de participantes.
 */

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/session-cliente.php';
require_once __DIR__ . '/publicacion.php';
require_once __DIR__ . '/supabase.php';

/** Normaliza el correo para comparar. Debe coincidir con el índice único
 *  portal_clientes_email_lower_key, que es lower(btrim(email)). */
function emailCliente(string $email): string
{
    return mb_strtolower(trim($email), 'UTF-8');
}

/**
 * Exige sesión de CLIENTE. Devuelve los datos guardados en la sesión.
 *
 * Deliberadamente NO acepta una sesión de participante: son credenciales de
 * distinta calidad (carnet vs. bcrypt) y mezclarlas dejaría que un participante
 * entre al área de clientes sin haber comprado, o al revés.
 */
function requireCliente(): array
{
    startSesionCliente();
    if (empty($_SESSION['cliente_id']) || empty($_SESSION['cliente_data'])) {
        sendJson(['error' => 'No autenticado'], 401);
        exit;
    }
    return $_SESSION['cliente_data'];
}

/**
 * ¿Este cliente pagó el paquete completo?
 *
 * Fuente de verdad: membresias_videos_2026 por owner_id = cliente_id. Un cliente
 * nunca tiene kárdex, así que no se miran los flags legacy del kárdex como en
 * videos.php.
 *
 * Ante cualquier fallo devuelve false, y eso es lo correcto para un permiso: si
 * no se puede comprobar que pagó, no se le abre el contenido. El costo de
 * equivocarse hacia el otro lado es regalar el producto.
 */
function clientePagoPaquete(string $clienteId): bool
{
    if ($clienteId === '') return false;
    try {
        $rows = supabase()->selectRaw(
            'membresias_videos_2026',
            'select=paquete_pagada&owner_id=eq.' . rawurlencode($clienteId) . '&limit=1'
        );
    } catch (\Throwable $e) {
        error_log('[cliente] no se pudo leer la membresia: ' . $e->getMessage());
        return false;
    }
    return is_array($rows) && count($rows) > 0 && !empty($rows[0]['paquete_pagada']);
}

/**
 * Deja pasar a CUALQUIERA de los dos: participante con sesión, o cliente con
 * sesión. Para el contenido que ven los dos por igual (hoy, Nominados), que es
 * público de todas formas: la lista de nominados va mezclada y sin el lugar,
 * justamente para poder mostrarse afuera.
 *
 * Se prueba primero el realm de participantes porque es el que ya usa la
 * mayoría de los endpoints. Sólo si no hay sesión ahí se mira el de clientes.
 */
function requireParticipanteOCliente(): void
{
    $cfg = require __DIR__ . '/../config.php';

    // PHP sólo abre UNA sesión por request, así que primero se mira qué cookie
    // trajo el navegador y recién ahí se abre el realm que corresponde. Si se
    // abriera uno a ciegas, el otro ya no se podría comprobar.
    if (!empty($_COOKIE[$cfg['session_name']])) {
        startSecureSession();
        if (!empty($_SESSION['user_id']) && !empty($_SESSION['user_data'])) return;
        // Cookie vieja o inválida: se cierra para poder probar el otro realm.
        // Después de esto session_status() vuelve a NONE y startSesionCliente()
        // puede hacer su trabajo.
        session_write_close();
    }

    if (!empty($_COOKIE[$cfg['cliente_session_name'] ?? 'fdz_cliente'])) {
        startSesionCliente();
        if (!empty($_SESSION['cliente_id']) && !empty($_SESSION['cliente_data'])) return;
    }

    sendJson(['error' => 'No autenticado'], 401);
    exit;
}

/**
 * ¿Se muestran ya los GANADORES fuera de la organización?
 *
 * Ya no decide aquí: delega en `ganadoresPublicos()` de _lib/publicacion.php,
 * que es el interruptor único para participantes y clientes a la vez. Se
 * conserva el nombre porque clientes/ganadores.php lo llama por él.
 */
function ganadoresVisiblesParaClientes(): bool
{
    return ganadoresPublicos();
}

/** Los campos del cliente que pueden viajar al navegador. Nunca password_hash
 *  ni los tokens de recuperación. */
function clientePublico(array $row): array
{
    return [
        'cliente_id' => $row['cliente_id'] ?? null,
        'email'      => $row['email'] ?? null,
        'nombre'     => $row['nombre'] ?? null,
        'telefono'   => $row['telefono'] ?? null,
    ];
}
