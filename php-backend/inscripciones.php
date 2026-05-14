<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';
require __DIR__ . '/_lib/credenciales.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if (!in_array($year, ['2023', '2024', '2025', '2026'], true)) {
    sendJson(['error' => 'Año inválido'], 400);
    exit;
}

$filter = buildContextFilter($user);
if (!$filter) {
    sendJson([$year => []]);
    exit;
}

$qs = $filter . "&select=*&limit=200";
$sb = supabase();
$rows = $sb->selectRaw("registro_de_inscripcion_$year", $qs);

// Estado de credenciales por agrupación (batch lookup)
$idsAgrup = array_values(array_unique(array_filter(array_column($rows, 'id_agrupacion'))));
$credMap = credEstadosBatch($sb, $idsAgrup, (int)$year);

// Estado de multimedia confirmado + URLs audio/video por inscripción (batch)
$idsInsc = array_values(array_unique(array_filter(array_column($rows, 'id_inscripcion'))));
$mmConfirmadoMap = [];
$mmAudioMap = [];
$mmVideoMap = [];
if (count($idsInsc) > 0) {
    $list = implode(',', array_map(fn($id) => '"' . rawurlencode((string)$id) . '"', $idsInsc));

    $estadoQs = 'select=id_inscripcion,confirmado&year=eq.' . (int)$year . '&id_inscripcion=in.(' . $list . ')';
    foreach ($sb->selectRaw('inscripcion_multimedia_estado', $estadoQs) as $m) {
        $iid = (string)($m['id_inscripcion'] ?? '');
        if ($iid !== '') $mmConfirmadoMap[$iid] = !empty($m['confirmado']);
    }

    $mmQs = 'select=id_inscripcion,tipo,url_publica&year=eq.' . (int)$year . '&id_inscripcion=in.(' . $list . ')';
    foreach ($sb->selectRaw('multimedia', $mmQs) as $mm) {
        $iid = (string)($mm['id_inscripcion'] ?? '');
        $tipo = (string)($mm['tipo'] ?? '');
        $url = (string)($mm['url_publica'] ?? '');
        if ($iid === '' || $url === '') continue;
        if ($tipo === 'audio') $mmAudioMap[$iid] = $url;
        elseif ($tipo === 'video_led') $mmVideoMap[$iid] = $url;
    }
}

foreach ($rows as &$r) {
    $idA = (string)($r['id_agrupacion'] ?? '');
    $idI = (string)($r['id_inscripcion'] ?? '');
    $r['estado_credenciales'] = $credMap[$idA] ?? 'incompleto';
    $r['multimedia_confirmado'] = $mmConfirmadoMap[$idI] ?? false;
    $r['audio_url_multimedia'] = $mmAudioMap[$idI] ?? null;
    $r['video_led_url_multimedia'] = $mmVideoMap[$idI] ?? null;
}
unset($r);

sendJson([$year => $rows]);
