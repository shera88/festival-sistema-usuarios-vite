<?php
declare(strict_types=1);

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $cfg = require __DIR__ . '/../config.php';
    session_name($cfg['session_name']);
    session_set_cookie_params([
        'lifetime' => $cfg['session_lifetime'],
        'path'     => '/',
        'domain'   => $cfg['cookie_domain'],
        'secure'   => $cfg['cookie_secure'],
        'httponly' => true,
        'samesite' => $cfg['cookie_samesite'],
    ]);
    session_start();

    if (!empty($_SESSION['user_id'])) {
        setcookie(
            session_name(),
            session_id(),
            [
                'expires'  => time() + $cfg['session_lifetime'],
                'path'     => '/',
                'domain'   => $cfg['cookie_domain'],
                'secure'   => $cfg['cookie_secure'],
                'httponly' => true,
                'samesite' => $cfg['cookie_samesite'],
            ]
        );
    }
}

function destroySession(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) startSecureSession();
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
