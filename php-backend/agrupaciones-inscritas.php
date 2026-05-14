<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireAuth();
requireMethod('GET');

$rows = supabase()->rpc('listar_agrupaciones_inscritas', []);
sendJson($rows);
