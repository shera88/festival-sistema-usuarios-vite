<?php
declare(strict_types=1);

/**
 * Plantilla pública. Copiar a config.php y rellenar SUPABASE_SERVICE_ROLE_KEY.
 * config.php está en .gitignore.
 */
return [
    // Supabase
    'supabase_url'              => 'https://supabase.imaginarte.cloud',
    'supabase_service_role_key' => 'REPLACE_ME_WITH_REAL_JWT',

    // Sesión
    'session_name'     => 'fdz_session',
    'session_lifetime' => 60 * 60 * 24 * 7,        // 7 días
    'cookie_secure'    => false,                    // true en prod (HTTPS)
    'cookie_samesite'  => 'Lax',
    'cookie_domain'    => '',                       // '' en dev local; 'usuarios.festivaldanzarte.com' en prod

    // CORS
    'cors_origin' => 'http://127.0.0.1:5173',       // ajustar por entorno

    // Debug
    'debug' => true,                                 // false en prod
];
