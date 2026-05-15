<?php
declare(strict_types=1);

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $cfg = require __DIR__ . '/../config.php';
    // Cookies cross-origin (Capacitor, Vercel) requieren SameSite=None + Secure.
    // Detectamos HTTPS (no permitir None sin Secure).
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'
        || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
    $samesite = $isHttps ? 'None' : ($cfg['cookie_samesite'] ?? 'Lax');
    $secure   = $isHttps ? true : (bool)($cfg['cookie_secure'] ?? false);

    session_name($cfg['session_name']);
    session_set_cookie_params([
        'lifetime' => $cfg['session_lifetime'],
        'path'     => '/',
        'domain'   => $cfg['cookie_domain'],
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => $samesite,
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
                'secure'   => $secure,
                'httponly' => true,
                'samesite' => $samesite,
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
