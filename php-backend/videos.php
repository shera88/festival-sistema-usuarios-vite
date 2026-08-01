<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/promo.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();

$select = 'id_inscripcion,orden,dia,agrupacion,enlace_del_logo,nombre_de_la_obra,url_video,categoria,division,subdivision,modalidad,coreografo,director,bloque,genero';

$videos = [];

// Historial ≤2025: scope de agrupación (sin id_contacto; las tablas viejas no lo tienen).
$filter = buildContextFilter($user);
if ($filter) {
    foreach (['2023', '2024', '2025'] as $year) {
        $qs = $filter . "&url_video=not.is.null&select=$select&limit=200";
        $rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);
        if (count($rows) > 0) $videos[$year] = $rows;
    }
}

// Estado de la Membresía de Videos de la persona logueada (resuelto por su carnet).
$membresia = estadoMembresia($user);

// Videos 2026:
//  - Paquete Completo pagado → TODOS los videos del festival, desbloqueados.
//  - Membresía de Videos pagada → los videos de SU agrupación, desbloqueados.
//  - Ninguna → los de su agrupación, bloqueados (upsell).
if (!empty($membresia['paquete_pagada'])) {
    $qs = "url_video=not.is.null&select=$select&order=dia.asc,orden.asc&limit=3000";
    $rows = supabase()->selectRaw('registro_de_inscripcion_2026', $qs);
    if (count($rows) > 0) {
        foreach ($rows as &$r) { $r['bloqueado'] = false; }
        unset($r);
        $videos['2026'] = $rows;
    }
} else {
    $filter2026 = buildContextFilter($user, true);
    if ($filter2026) {
        $qs = $filter2026 . "&url_video=not.is.null&select=$select&limit=300";
        $rows = supabase()->selectRaw('registro_de_inscripcion_2026', $qs);
        if (count($rows) > 0) {
            $bloqueado = !$membresia['pagada'];
            foreach ($rows as &$r) { $r['bloqueado'] = $bloqueado; }
            unset($r);
            $videos['2026'] = $rows;
        }
    }
}

sendJson(['videos' => $videos ?: new stdClass(), 'membresia' => $membresia]);


/**
 * Estado de la membresía de la persona logueada, resuelto por su carnet (ci) sobre
 * registro_kardex_2026. Una persona puede tener más de una fila de kárdex: se
 * considera "pagada"/"reservó" si CUALQUIERA lo está. Degrada a vacío ante cualquier
 * error (p.ej. si aún no se corrió la migración 017 y falta la columna).
 */
function estadoMembresia(array $user): array
{
    // Ancla = IDENTIDAD DE SESIÓN (owner_id): login kárdex → id_kardex; login
    // contacto → id_contacto (UUID). La membresía vive en membresias_videos_2026
    // (desacoplada del kárdex) para que reps/dir/coreo compren SIN kárdex y la
    // membresía siga sirviendo si después meten kárdex. Se lee tanto la tabla
    // nueva (fuente de verdad) como los flags legacy del kárdex (compat hacia atrás).
    $idContacto = trim((string)($user['id_contacto'] ?? ''));
    if ($idContacto === '') return membresiaVacia();
    $origen  = $user['origen'] ?? 'contacto';
    $ownerId = $idContacto;
    $idFilter = ($origen === 'kardex')
        ? 'id_kardex=eq.' . rawurlencode($idContacto)
        : 'id_contacto=eq.' . rawurlencode($idContacto);

    // Reservó + pagos legacy: de las filas de kárdex del usuario (si tiene).
    $reservo = false; $paqueteReservo = false; $idKardex = null; $tieneKardex = false;
    $pagada = false; $paquetePagada = false;
    try {
        $kar = supabase()->selectRaw(
            'registro_kardex_2026',
            'select=id_kardex,membresia,membresia_pagada,membresia_paquete,membresia_paquete_pagada&' . $idFilter . '&limit=50'
        );
    } catch (\Throwable $e) { $kar = []; }
    if (is_array($kar) && count($kar) > 0) {
        $tieneKardex = true;
        foreach ($kar as $r) {
            if (!empty($r['membresia']))                $reservo = true;
            if (!empty($r['membresia_paquete']))        $paqueteReservo = true;
            if (!empty($r['membresia_pagada']))         $pagada = true;          // legacy
            if (!empty($r['membresia_paquete_pagada'])) $paquetePagada = true;   // legacy
            if ($idKardex === null && !empty($r['id_kardex'])) $idKardex = (string)$r['id_kardex'];
        }
    }

    // Pago (fuente de verdad): tabla nueva por owner_id.
    try {
        $mem = supabase()->selectRaw(
            'membresias_videos_2026',
            'select=reservo,pagada,paquete_reservo,paquete_pagada&owner_id=eq.' . rawurlencode($ownerId) . '&limit=1'
        );
    } catch (\Throwable $e) { $mem = []; }
    if (is_array($mem) && count($mem) > 0) {
        $m = $mem[0];
        if (!empty($m['pagada']))          $pagada = true;
        if (!empty($m['paquete_pagada']))  $paquetePagada = true;
        if (!empty($m['reservo']))         $reservo = true;
        if (!empty($m['paquete_reservo'])) $paqueteReservo = true;
    }

    // Promo pre-festival: todos ven el precio de oferta (reserva) hasta que arranque.
    if (promoMembresiaTodos()) { $reservo = true; $paqueteReservo = true; }

    return [
        'id_kardex'       => $idKardex,
        'owner_id'        => $ownerId,
        'origen'          => $origen,
        'reservo'         => $reservo,
        'pagada'          => $pagada,
        'paquete_reservo' => $paqueteReservo,
        'paquete_pagada'  => $paquetePagada,
        'tiene_kardex'    => $tieneKardex,
        'puede_comprar'   => true,   // ya no se exige kárdex para comprar
    ];
}

function membresiaVacia(): array
{
    return [
        'id_kardex' => null, 'owner_id' => null, 'origen' => null,
        'reservo' => false, 'pagada' => false,
        'paquete_reservo' => false, 'paquete_pagada' => false,
        'tiene_kardex' => false, 'puede_comprar' => false,
    ];
}
