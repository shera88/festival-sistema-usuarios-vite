<?php
/**
 * fecha/hora en zona horaria del festival (Bolivia · UTC-4, sin DST).
 *
 * Necesario porque SiteGround corre en UTC: si usamos date('Y-m-d') / date('H:i:s'),
 * `fecha` puede saltar al día siguiente y `hora` queda con 4 horas de desfase
 * respecto a lo que vive el usuario en Bolivia.
 */

declare(strict_types=1);

const TZ_BOLIVIA = 'America/La_Paz';

function fecha_bolivia(): string {
    $tz = new DateTimeZone(TZ_BOLIVIA);
    return (new DateTime('now', $tz))->format('Y-m-d');
}

function hora_bolivia(): string {
    $tz = new DateTimeZone(TZ_BOLIVIA);
    return (new DateTime('now', $tz))->format('H:i:s');
}

function now_iso(): string {
    return (new DateTime('now'))->format('Y-m-d\TH:i:s.u\Z');
}
