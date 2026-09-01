<?php
declare(strict_types=1);

/**
 * EL INTERRUPTOR de publicación de los ganadores.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  PARA ABRIR LOS GANADORES A TODO EL MUNDO: poner `true` en la línea de abajo,
 *  desplegar este archivo, y listo. No hay nada más que tocar.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Está APAGADO a propósito. El payload de ganadores trae el LUGAR y la NOTA de
 * cada obra: si esto se enciende antes de tiempo se arruina la premiación, y eso
 * no se deshace.
 *
 * Qué cambia exactamente al encenderlo:
 *
 *   - `ganadores.php` deja de exigir super admin y responde a cualquier
 *     participante con sesión iniciada.
 *   - `clientes/ganadores.php` deja de responder `publicado: false` y sirve los
 *     resultados a quien compró la membresía.
 *   - La pestaña «Ganadores» aparece en el portal de participantes y en el de
 *     clientes, porque `me.php` publica esta misma bandera y el frontend la lee.
 *
 * Qué NO cambia, y es deliberado: el contenido. Se publica EXACTAMENTE lo que
 * hoy ve un super admin, calculado por el mismo `ganadoresPayload()` de siempre.
 * No se recalcula nada, no se reordena nada y no se toca ninguna tabla de
 * premios: el acomodo manual de `premios_bloques_2026` y `premios_placas_2026`
 * es del usuario y se lee tal cual está.
 *
 * Una sola bandera y en un solo archivo, en vez de una por endpoint: con dos
 * interruptores, tarde o temprano se enciende uno y se olvida el otro, y el
 * resultado es medio festival viendo los premios y la otra mitad no.
 */

/** ¿Ya se publicaron los ganadores fuera de la organización? */
function ganadoresPublicos(): bool
{
    return true;    // PUBLICADO el 2026-09-01 por pedido de la organización
}
