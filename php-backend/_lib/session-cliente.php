<?php
declare(strict_types=1);

/**
 * Sesión de los CLIENTES de membresía (público general), separada de la de
 * participantes.
 *
 * Son dos mundos con credenciales distintas: el participante entra con su
 * número de carnet contra festival_contactos_global; el cliente entra con
 * correo + contraseña propia (bcrypt) contra portal_clientes. Mezclarlos en la
 * misma sesión obligaría a que cada endpoint del portal adivine con quién está
 * hablando, y el primero que se olvide de preguntar deja entrar a quien no debe.
 *
 * La separación es por NOMBRE DE COOKIE: `fdz_cliente` en vez de `fdz_session`.
 * Así el navegador puede tener las dos a la vez sin pisarse —alguien puede ser
 * participante Y haber comprado la membresía— y, sobre todo, una sesión de
 * cliente NUNCA satisface requireAuth(), que mira $_SESSION['user_id'] dentro
 * del otro realm.
 *
 * Se calca session.php a propósito (mismo manejo de HTTPS, SameSite y renovación
 * del cookie) para no tener dos comportamientos distintos que mantener.
 */

function startSesionCliente(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $cfg = require __DIR__ . '/../config.php';

    // El GC de PHP borra el ARCHIVO de sesión por inactividad (~24 min por
    // defecto) aunque el cookie siga vivo. Mismo problema que ya se resolvió en
    // session.php: el usuario volvía a los dos días y aparecía deslogueado.
    @ini_set('session.gc_maxlifetime', (string)(int)$cfg['session_lifetime']);

    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
    $samesite = $isHttps ? 'None' : ($cfg['cookie_samesite'] ?? 'Lax');
    $secure   = $isHttps ? true : (bool)($cfg['cookie_secure'] ?? false);

    // Con `??` y no leyendo una clave nueva de config.php: ese archivo es
    // compartido y vive en producción, y no hace falta editarlo para esto.
    session_name($cfg['cliente_session_name'] ?? 'fdz_cliente');
    session_set_cookie_params([
        'lifetime' => $cfg['session_lifetime'],
        'path'     => '/',
        'domain'   => $cfg['cookie_domain'],
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => $samesite,
    ]);
    session_start();

    if (!empty($_SESSION['cliente_id'])) {
        setcookie(
            session_name(),
            session_id(),
            [
                'expires'  => time() + $cfg['session_lifetime'],
                'path'     => '/',
                'domain'   => $cfg['cookie_domain'],
                'secure'   => $secure,
                'httponly' => true,
                'samesite' => $samesite,
            ]
        );
    }
}

function destroySesionCliente(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) startSesionCliente();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    session_destroy();
}
