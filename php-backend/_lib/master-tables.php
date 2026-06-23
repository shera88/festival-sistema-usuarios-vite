<?php
/**
 * Master tables — versión thin post-refactor 2026-04-30.
 *
 * Antes este archivo concentraba toda la lógica de upsert para encargados,
 * coreógrafos, directores, participantes_global, prospectos_global, etc.
 * Esa lógica se movió a triggers SQL plpgsql:
 *
 *   PHP INSERT registro_X
 *        ↓ trigger_registro_*
 *       tabla consolidada (representantes / solicitantes / coreografos /
 *       directores)
 *        ↓ festival_sync_*
 *       festival_contactos_global
 *
 * Lo único que sigue manejando PHP es `instituciones`, que es lookup-or-create
 * por nombre normalizado y se llama desde Inscripción y Solicitud antes del
 * INSERT en `registro_X` (porque el INSERT necesita `id_agrupacion`).
 *
 * Spec: docs/superpowers/specs/2026-04-30-master-tables-php-refactor-design.md
 * Plan: docs/superpowers/plans/2026-04-30-master-tables-php-refactor.md
 */

declare(strict_types=1);

/**
 * Prioridad de antecedentes — para no degradar al actualizar.
 *   'Ya_participó'           → 3 (más alto)
 *   'Solicitó_no_participó'  → 2
 *   'prospecto_no_participo' → 1
 *   null                     → 0
 */
function antecedentes_priority(?string $a): int {
    return match ($a) {
        'Ya_participó'           => 3,
        'Solicitó_no_participó'  => 2,
        'prospecto_no_participo' => 1,
        default                  => 0,
    };
}

/**
 * Lookup-or-create de una agrupación en `instituciones`.
 *
 * Inputs soportados:
 *   - id_agrupacion (string)         — si vino del picker, reutilizar.
 *   - nombre_agrupacion (string)     — para crear / matchear si no hay id.
 *   - ciudad (string)                — opcional.
 *   - telefono (string|int|null)     — opcional, contacto institucional (Solicitud).
 *   - correo_electronico (string)    — opcional, contacto institucional (Solicitud).
 *   - antecedentes (string)          — 'Ya_participó' | 'Solicitó_no_participó' |
 *                                      'prospecto_no_participo'. Default 'Ya_participó'
 *                                      si Inscripción, 'prospecto_no_participo' si Solicitud.
 *   - año_de_participacion (string)  — default '2026'.
 *
 * Reglas:
 *   - Si llega `id_agrupacion`, usar ese (UPDATE con campos no nulos, sin
 *     degradar antecedentes).
 *   - Si no, buscar por nombre normalizado (ilike + comparación case-insensitive
 *     sin tildes). Si match, UPDATE no destructivo.
 *   - Si nada matchea, INSERT nuevo con id 8-hex.
 */
function ensure_agrupacion(SupabaseClient $sb, array $input): string {
    $nombreInput = upper_norm($input['nombre_agrupacion'] ?? null);
    if ($nombreInput === null) {
        throw new RuntimeException('ensure_agrupacion: nombre_agrupacion es obligatorio');
    }

    $ciudadInput   = upper_norm($input['ciudad'] ?? null);
    $telefono      = isset($input['telefono']) && trim((string)$input['telefono']) !== ''
                     ? (string)$input['telefono'] : null;
    $correo        = email_norm($input['correo_electronico'] ?? null);
    $antecInput    = $input['antecedentes'] ?? 'Ya_participó';
    $anioInput     = $input['año_de_participacion'] ?? '2026';
    $now           = now_iso();

    // 1) Si vino id_agrupacion explícito, reutilizar.
    if (!empty($input['id_agrupacion']) && trim((string)$input['id_agrupacion']) !== '') {
        $existing = $sb->selectOne('instituciones',
            'id_agrupacion,antecedentes,ciudad,telefono,correo_electronico',
            ['id_agrupacion' => 'eq.' . trim((string)$input['id_agrupacion'])]
        );
        if ($existing) {
            $patch = build_agrupacion_patch($existing, [
                'ciudad'             => $ciudadInput,
                'telefono'           => $telefono,
                'correo_electronico' => $correo,
                'antecedentes'       => $antecInput,
                'año_de_participacion' => $anioInput,
            ], $now);
            if (!empty($patch)) {
                $sb->update('instituciones', 'id_agrupacion', $existing['id_agrupacion'], $patch);
            }
            return $existing['id_agrupacion'];
        }
    }

    // 2) Buscar por nombre normalizado.
    $norm = normalize_name($nombreInput);
    $candidates = $sb->select('instituciones',
        'id_agrupacion,nombre_agrupacion,antecedentes,ciudad,telefono,correo_electronico',
        ['nombre_agrupacion' => "ilike.$nombreInput"], 10
    );
    foreach ($candidates as $row) {
        if (normalize_name($row['nombre_agrupacion']) === $norm) {
            $patch = build_agrupacion_patch($row, [
                'ciudad'             => $ciudadInput,
                'telefono'           => $telefono,
                'correo_electronico' => $correo,
                'antecedentes'       => $antecInput,
                'año_de_participacion' => $anioInput,
            ], $now);
            if (!empty($patch)) {
                $sb->update('instituciones', 'id_agrupacion', $row['id_agrupacion'], $patch);
            }
            return $row['id_agrupacion'];
        }
    }

    // 3) Crear nueva.
    $id = new_id8();
    $sb->insert('instituciones', [
        'id_agrupacion'         => $id,
        'nombre_agrupacion'     => $nombreInput,
        'ciudad'                => $ciudadInput,
        'telefono'              => $telefono,
        'correo_electronico'    => $correo,
        'antecedentes'          => $antecInput,
        'año_de_participacion'  => $anioInput,
        'fecha_actualizacion'   => $now,
    ]);
    return $id;
}

/**
 * Construye un patch de UPDATE para `instituciones` aplicando reglas:
 *   - Solo incluye campos no-null del input.
 *   - Para campos existentes (ciudad, telefono, correo), solo override si el
 *     valor existente es null/vacío (no destructivo).
 *   - antecedentes: solo upgrade (mayor prioridad).
 *   - fecha_actualizacion siempre se setea.
 */
function build_agrupacion_patch(array $existing, array $input, string $now): array {
    $patch = ['fecha_actualizacion' => $now];

    foreach (['ciudad', 'telefono', 'correo_electronico'] as $col) {
        $newV = $input[$col] ?? null;
        $oldV = $existing[$col] ?? null;
        if ($newV !== null && ($oldV === null || $oldV === '')) {
            $patch[$col] = $newV;
        }
    }

    $newAntec = $input['antecedentes'] ?? null;
    $oldAntec = $existing['antecedentes'] ?? null;
    if ($newAntec !== null && antecedentes_priority($newAntec) > antecedentes_priority($oldAntec)) {
        $patch['antecedentes'] = $newAntec;
    }

    return $patch;
}

/**
 * Lookup-or-create de un coreógrafo en `coreografos`.
 *
 * Inscripción captura el nombre del coreógrafo en el form. Necesitamos
 * el `id_coreografo` para el INSERT en `registro_de_inscripcion_2026`.
 * Una vez insertado en `coreografos`, el trigger `festival_sync_coreografo_insert`
 * sincroniza a festival_contactos_global con `es_coreografo=true`.
 *
 * Inputs:
 *   - id_coreografo (string)        — si vino del picker, reutilizar.
 *   - nombre_y_apellido (string)    — para crear / matchear.
 *   - id_encargado (string|null)    — link al representante actual.
 */
function ensure_coreografo(SupabaseClient $sb, array $input): string {
    if (!empty($input['id_coreografo']) && trim((string)$input['id_coreografo']) !== '') {
        return trim((string)$input['id_coreografo']);
    }

    $nombreUpper = upper_norm($input['nombre_y_apellido']);
    if ($nombreUpper === null) {
        throw new RuntimeException('ensure_coreografo: nombre_y_apellido es obligatorio');
    }
    $norm = normalize_name($nombreUpper);

    $candidates = $sb->select('coreografos',
        'id_coreografo,nombre_y_apellido',
        ['nombre_y_apellido' => "ilike.$nombreUpper"], 10
    );
    foreach ($candidates as $r) {
        if (normalize_name($r['nombre_y_apellido']) === $norm) {
            return $r['id_coreografo'];
        }
    }

    $id = new_id8();
    $sb->insert('coreografos', [
        'id_coreografo'         => $id,
        'nombre_y_apellido'     => $nombreUpper,
        'id_encargado'          => $input['id_encargado'] ?? null,
        'antecedentes'          => 'Ya_participó',
        'año_de_participacion'  => '2026',
        'fuentes'               => 'INSCRIPCION',
        'total_obras'           => 0,
        'fecha_actualizacion'   => now_iso(),
    ]);
    return $id;
}

/**
 * Vincula a una persona como REPRESENTANTE de una agrupación cuando ésta todavía
 * NO tiene representante. Decisión de producto (2026-06-10):
 *   - SOLICITUD: si la agrupación no tiene representante, la persona se inserta
 *     también en `representantes` (sigue además en `solicitantes`) y se vincula
 *     en instituciones.encargados / encargados_nombres.
 *   - INSCRIPCIÓN: la persona ya entra a `representantes` por trigger; aquí solo
 *     se rellena instituciones.encargados si estaba vacío.
 * NUNCA pisa un representante ya registrado. Idempotente. El llamador DEBE
 * envolver esto en try/catch para que jamás rompa el guardado principal.
 *
 * @param array  $persona  ['nombre_y_apellido','numero_de_carnet','telefono',
 *                          'ciudad','correo_electronico','agrupacion','categoria','genero']
 * @param bool   $insertarRepresentante  true en solicitud; false en inscripción.
 * @return string|null  id_encargado vinculado, o null si no se hizo nada.
 */
function vincular_representante_agrupacion(
    SupabaseClient $sb,
    string $idAgrupacion,
    ?string $idContacto,
    array $persona,
    ?string $idEncargadoConocido = null,
    bool $insertarRepresentante = false
): ?string {
    if (trim($idAgrupacion) === '') return null;

    // 1) ¿La agrupación ya tiene representante? (fila en `representantes`).
    $reps = $sb->select('representantes', 'id_encargado',
        ['id_agrupacion' => "eq.$idAgrupacion"], 1);
    $yaTieneRepr = !empty($reps);

    $idEncargado = $idEncargadoConocido ?: ($reps[0]['id_encargado'] ?? null);

    // 2) SOLICITUD: la agrupación no tiene representante → registrar a esta persona.
    if ($insertarRepresentante && !$yaTieneRepr && $idContacto) {
        if (!$idEncargado) {
            // Reusar el id_encargado que ya tenga la persona (representantes o
            // solicitantes — el trigger de solicitud acaba de crear la fila), o nuevo.
            $rep = $sb->selectOne('representantes', 'id_encargado', ['id_contacto' => "eq.$idContacto"]);
            $sol = $sb->selectOne('solicitantes',   'id_encargado', ['id_contacto' => "eq.$idContacto"]);
            $idEncargado = $rep['id_encargado'] ?? $sol['id_encargado'] ?? new_id8();
        }
        // No duplicar fila para (id_contacto + id_agrupacion).
        $dup = $sb->selectOne('representantes', 'id_encargado',
            ['id_contacto' => "eq.$idContacto", 'id_agrupacion' => "eq.$idAgrupacion"]);
        if (!$dup) {
            $sb->insert('representantes', [
                'id_encargado'          => $idEncargado,
                'id_contacto'           => $idContacto,
                'id_agrupacion'         => $idAgrupacion,
                'nombre_y_apellido'     => $persona['nombre_y_apellido'] ?? null,
                'numero_de_carnet'      => $persona['numero_de_carnet'] ?? null,
                'telefono'              => $persona['telefono'] ?? null,
                'ciudad'                => $persona['ciudad'] ?? null,
                'correo_electronico'    => $persona['correo_electronico'] ?? null,
                'nombres_agrupaciones'  => $persona['agrupacion'] ?? null,
                'categoria'             => $persona['categoria'] ?? null,
                'genero'                => $persona['genero'] ?? null,
                'tipo_de_contacto'      => 'representante',
                'antecedentes'          => 'Solicitó_2026',
                'año_de_participacion'  => '2026',
                'fecha_actualizacion'   => now_iso(),
            ]);
        }
    }

    // 3) Vincular en instituciones SOLO si está vacío (nunca pisar).
    if ($idEncargado) {
        $inst = $sb->selectOne('instituciones', 'encargados', ['id_agrupacion' => "eq.$idAgrupacion"]);
        if ($inst !== null && trim((string)($inst['encargados'] ?? '')) === '') {
            $sb->update('instituciones', 'id_agrupacion', $idAgrupacion, [
                'encargados'           => $idEncargado,
                'encargados_nombres'   => $persona['nombre_y_apellido'] ?? null,
                'fecha_actualizacion'  => now_iso(),
            ]);
        }
    }
    return $idEncargado;
}
