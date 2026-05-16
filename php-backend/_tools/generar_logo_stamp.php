<?php
declare(strict_types=1);
require __DIR__ . '/../_lib/supabase.php';

$src = file_get_contents('https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/letterhead.png');
$im = imagecreatefromstring($src);
// Crop logo area completo en letterhead 1862x2560
$logo = imagecreatetruecolor(540, 210);
imagecopy($logo, $im, 0, 0, 50, 10, 540, 210);

$tmp = sys_get_temp_dir() . '/logo-stamp.png';
imagepng($logo, $tmp);
echo "Generado: $tmp\n";

$s = supabase();
$url = $s->uploadPublicFileAt($tmp, 'image/png', 'templates/logo-stamp.png', true);
echo "Subido: $url\n";
