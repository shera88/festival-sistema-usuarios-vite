<?php
/**
 * Lookup de "todos los datos relacionados a la persona" para webhooks n8n.
 *
 * Estructura devuelta:
 *   [
 *     'es_nuevo'           => bool,    // true si nunca apareció en ninguna tabla
 *     'contacto'           => ?array,  // festival_contactos_global (source of truth)
 *     'representante'      => ?array,  // representantes (al menos una inscripción)
 *     'solicitante_previo' => ?array,  // solicitantes (solo solicitudes previas)
 *     'coreografo'         => ?array,  // coreografos (rol asignado)
 *     'director'           => ?array,  // directores (rol asignado)
 *     'agrupacion'         => ?array,  // instituciones (datos completos agrupación)
 *   ]
 *
 * Cuando id_contacto/id_agrupacion es null o no hay match, el sub-objeto es null.
 * El consumidor n8n debe tratar null como "no existe relación".
 */

declare(strict_types=1);

function gather_person_relations(
    SupabaseClient $sb,
    ?string $id_contacto,
    ?string $id_agrupacion
): array {
    $contacto = null;
    $representante = null;
    $solicitante_previo = null;
    $coreografo = null;
    $director = null;
    $agrupacion = null;

    if ($id_contacto) {
        $contacto = $sb->selectOne(
            'festival_contactos_global', '*',
            ['id_contacto' => "eq.$id_contacto"]
        );
        $representante = $sb->selectOne(
            'representantes', '*',
            ['id_contacto' => "eq.$id_contacto"]
        );
        $solicitante_previo = $sb->selectOne(
            'solicitantes', '*',
            ['id_contacto' => "eq.$id_contacto"]
        );
        $coreografo = $sb->selectOne(
            'coreografos', '*',
            ['id_contacto' => "eq.$id_contacto"]
        );
        $director = $sb->selectOne(
            'directores', '*',
            ['id_contacto' => "eq.$id_contacto"]
        );
    }

    if ($id_agrupacion) {
        $agrupacion = $sb->selectOne(
            'instituciones', '*',
            ['id_agrupacion' => "eq.$id_agrupacion"]
        );
    }

    $es_nuevo = !$contacto && !$representante && !$solicitante_previo
        && !$coreografo && !$director;

    return [
        'es_nuevo'           => $es_nuevo,
        'contacto'           => $contacto,
        'representante'      => $representante,
        'solicitante_previo' => $solicitante_previo,
        'coreografo'         => $coreografo,
        'director'           => $director,
        'agrupacion'         => $agrupacion,
    ];
}

/**
 * Resuelve URL de imagen de la persona según prioridad:
 *   1. festival_contactos_global.imagen_contacto
 *   2. representantes.imagen
 *   3. coreografos.foto
 *   4. directores.foto
 *   5. solicitantes.imagen
 * Devuelve null si no hay ninguna.
 */
function resolve_imagen_persona(array $relacion): ?string {
    $candidates = [
        $relacion['contacto']['imagen_contacto']      ?? null,
        $relacion['representante']['imagen']          ?? null,
        $relacion['coreografo']['foto']               ?? null,
        $relacion['director']['foto']                 ?? null,
        $relacion['solicitante_previo']['imagen']     ?? null,
    ];
    foreach ($candidates as $c) {
        if (is_string($c) && $c !== '') return $c;
    }
    return null;
}

/** Resuelve URL del logo de la agrupación. null si no hay. */
function resolve_logo_agrupacion(array $relacion): ?string {
    $logo = $relacion['agrupacion']['enlace_del_logo'] ?? null;
    return (is_string($logo) && $logo !== '') ? $logo : null;
}
