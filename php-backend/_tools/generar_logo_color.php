<?php
declare(strict_types=1);
require __DIR__ . '/../_lib/supabase.php';

$src = file_get_contents('https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/logo-danzarte.png');
$im = imagecreatefromstring($src);
imagealphablending($im, true);
imagesavealpha($im, true);

$w = imagesx($im); $h = imagesy($im);
echo "Logo: {$w}x{$h}\n";

// Iterar pixels: pixeles blancos casi puros → navy #0a2540
$navyR = 10; $navyG = 37; $navyB = 64;

for ($y = 0; $y < $h; $y++) {
    for ($x = 0; $x < $w; $x++) {
        $rgba = imagecolorat($im, $x, $y);
        $a = ($rgba >> 24) & 0x7F;
        if ($a >= 100) continue; // pixel transparente, skip
        $r = ($rgba >> 16) & 0xFF;
        $g = ($rgba >> 8) & 0xFF;
        $b = $rgba & 0xFF;
        // blanco / muy claro y bajo saturación
        $max = max($r, $g, $b);
        $min = min($r, $g, $b);
        $sat = $max > 0 ? ($max - $min) / $max : 0;
        if ($max >= 190 && $sat < 0.20) {
            // remap blanco → navy preservando alpha
            $newColor = imagecolorallocatealpha($im, $navyR, $navyG, $navyB, $a);
            imagesetpixel($im, $x, $y, $newColor);
        }
    }
}

$tmp = sys_get_temp_dir() . '/logo-color-navy.png';
imagepng($im, $tmp);
imagedestroy($im);
echo "Generado: $tmp (" . filesize($tmp) . " bytes)\n";

$s = supabase();
$url = $s->uploadPublicFileAt($tmp, 'image/png', 'templates/logo-color-navy.png', true);
echo "Subido: $url\n";
