<?php
declare(strict_types=1);

/**
 * GANADORES — los resultados reales del festival, para la organización.
 *
 * OJO, no confundir con nominados.php: ahí el lugar y la nota se esconden a
 * propósito y el orden va mezclado, porque esa lista es la que se muestra
 * afuera. Aquí pasa lo contrario — el lugar, la nota y el orden por nota SON el
 * contenido. Por eso este endpoint no puede quedar abierto: sólo SUPER ADMIN.
 *
 * Devuelve dos armados de la misma información:
 *
 *   bloques   — por CATEGORÍA: los bloques de premiación (categoría · modalidad ·
 *               división · subdivisión) con sus obras y el lugar de cada una.
 *               Es lo que la app de jurados llama «Placas por categoría».
 *
 *   absolutos — los cuatro cuadros de GANADORES: folklore, urbano, académico y
 *               colegios-o-universidades. Top 5 de cada uno por nota. El #1 de
 *               cada cuadro es el ganador.
 *
 *               NO se incluye el cuadro del FESTIVAL (el que en jurados junta a
 *               los campeones de los otros cuatro): la organización pidió estos
 *               cuatro y nada más.
 *
 * Las reglas de quién entra y con qué lugar son las mismas de la app de jurados
 * (ganadores-page.tsx): promedio de la ronda final, lugar por rango de nota
 * (>=90 primer · 85-89 segundo · 80-84 tercer) salvo lugar manual en
 * premios_placas_2026, descartando excluidas y SIN_LUGAR.
 */

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/premiacion.php';
require __DIR__ . '/_lib/ganadores-data.php';

handlePreflight();
requireMethod('GET');
requireSuperAdmin();

$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));

// El cálculo vive en _lib/ganadores-data.php porque clientes/ganadores.php sirve
// exactamente lo mismo: dos copias de las reglas de premiación terminarían
// mostrando resultados distintos del mismo festival.
sendJson(ganadoresPayload($year));
