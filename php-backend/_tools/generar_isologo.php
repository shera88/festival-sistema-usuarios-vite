<?php
declare(strict_types=1);
require __DIR__ . '/../_lib/supabase.php';

// Descargar Anton TTF si no existe
$fontDir = __DIR__ . '/../_fonts';
if (!is_dir($fontDir)) mkdir($fontDir, 0777, true);
$fontPath = $fontDir . '/Anton-Regular.ttf';
if (!file_exists($fontPath)) {
    echo "Descargando Anton TTF...\n";
    $ttf = file_get_contents('https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf');
    file_put_contents($fontPath, $ttf);
}
echo "Font: $fontPath (" . filesize($fontPath) . " bytes)\n";

// Crear isologo 512x512 con bg dark purple + D blanco
$size = 512;
$im = imagecreatetruecolor($size, $size);
imagealphablending($im, true);
imagesavealpha($im, true);

// Bg transparente para que sea solo el círculo visible
$transparent = imagecolorallocatealpha($im, 0, 0, 0, 127);
imagefill($im, 0, 0, $transparent);

// Círculo bg sólido dark purple
$purple = imagecolorallocate($im, 26, 10, 64); // #1a0a40
imagefilledellipse($im, $size / 2, $size / 2, $size, $size, $purple);

// Letra D centrada blanca, font size grande
$white = imagecolorallocate($im, 255, 255, 255);
$fontSize = 320;
$bbox = imagettfbbox($fontSize, 0, $fontPath, 'D');
$textW = $bbox[2] - $bbox[0];
$textH = $bbox[1] - $bbox[7];
$x = (int)(($size - $textW) / 2) - $bbox[0];
$y = (int)(($size + $textH) / 2) - $bbox[1];
imagettftext($im, $fontSize, 0, $x, $y, $white, $fontPath, 'D');

$tmp = sys_get_temp_dir() . '/isologo-d.png';
imagepng($im, $tmp);
imagedestroy($im);
echo "Generado: $tmp (" . filesize($tmp) . " bytes)\n";

$s = supabase();
$url = $s->uploadPublicFileAt($tmp, 'image/png', 'templates/isologo-d.png', true);
echo "Subido: $url\n";
