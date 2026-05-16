<?php
/**
 * Descarga letterhead.png del Storage, cubre "INVITACIÓN" con un rectángulo
 * que matchea el bg purple del top band, escribe "RECIBO" centrado, sube
 * el nuevo letterhead-recibo.png a Storage.
 *
 * Ejecutar una sola vez:
 *   php _tools/generar_letterhead_recibo.php
 */
declare(strict_types=1);

require __DIR__ . '/../_lib/supabase.php';

$srcUrl = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/letterhead.png';
echo "Descargando letterhead.png...\n";
$src = file_get_contents($srcUrl);
if (!$src) { fwrite(STDERR, "ERROR descarga\n"); exit(1); }

$im = imagecreatefromstring($src);
if (!$im) { fwrite(STDERR, "ERROR decode\n"); exit(1); }

$w = imagesx($im); $h = imagesy($im);
echo "Tamaño: {$w}x{$h}\n";

// Sample color del bg purple en y=100 x=600 (zona oscura uniforme)
$rgb = imagecolorat($im, 600, 100);
$r = ($rgb >> 16) & 0xFF; $g = ($rgb >> 8) & 0xFF; $b = $rgb & 0xFF;
echo "Color bg muestra: rgb($r,$g,$b)\n";

// "INVITACIÓN" ocupa ~ x:700-1450  y:75-165 en 1862x2560
$bg = imagecolorallocate($im, $r, $g, $b);
imagefilledrectangle($im, 700, 70, 1480, 170, $bg);

// Cyan light color usado en "INVITACIÓN"
$cyan = imagecolorallocate($im, 130, 200, 230);

// Texto "RECIBO" centrado
$text = 'RECIBO';
$fontFile = null;
// Buscar font común; si no, usar imagestring (bitmap)
foreach ([
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/arialbd.ttf',
    'C:/Windows/Fonts/calibri.ttf',
] as $f) {
    if (file_exists($f)) { $fontFile = $f; break; }
}

if ($fontFile) {
    $fontSize = 56;
    $bbox = imagettfbbox($fontSize, 0, $fontFile, $text);
    $textW = $bbox[2] - $bbox[0];
    $textH = $bbox[1] - $bbox[7];
    $x = (int)(700 + (780 - $textW) / 2);
    $y = (int)(70 + (100 + $textH) / 2);
    // Letter spacing manual
    $cx = $x;
    $chars = mb_str_split($text);
    foreach ($chars as $ch) {
        imagettftext($im, $fontSize, 0, $cx, $y, $cyan, $fontFile, $ch);
        $cb = imagettfbbox($fontSize, 0, $fontFile, $ch);
        $cx += ($cb[2] - $cb[0]) + 18;
    }
    echo "Texto agregado con TTF.\n";
} else {
    fwrite(STDERR, "No se halló font TTF — fallback bitmap\n");
    imagestring($im, 5, 1000, 110, $text, $cyan);
}

$tmpOut = sys_get_temp_dir() . '/letterhead-recibo.png';
imagepng($im, $tmpOut);
imagedestroy($im);
echo "Generado: $tmpOut (" . filesize($tmpOut) . " bytes)\n";

// Subir a Storage
$s = supabase();
$url = $s->uploadPublicFileAt($tmpOut, 'image/png', 'templates/letterhead-recibo.png', true);
echo "Subido: $url\n";
