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

// id_contacto solo existe en registro_de_inscripcion_2026+ (las históricas no).
$filter = buildContextFilter($user, (int)$year >= 2026);
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

// Estado de pago por inscripción (solo 2026, batch — misma fuente de verdad que
// el tab Pagos: vista `deudas_2026`, concepto 'por_participante' con
// id_referencia = id_inscripcion. saldo = GREATEST(monto_total −
// pagado_verificado, 0): el saldo solo baja con pagos estado 'verificado').
// habilitado = saldo <= 0.01. Las agrupaciones con convenio NO tienen compromiso
// por_participante (la vista las excluye) → sin dato → el frontend no muestra chip.
$pagoMap = [];
if ((int)$year >= 2026 && count($idsInsc) > 0) {
    $list = implode(',', array_map(fn($id) => '"' . rawurlencode((string)$id) . '"', $idsInsc));
    $deudaQs = 'select=id_referencia,saldo&concepto=eq.por_participante&id_referencia=in.(' . $list . ')';
    foreach ($sb->selectRaw('deudas_2026', $deudaQs) as $d) {
        $iid = (string)($d['id_referencia'] ?? '');
        if ($iid === '') continue;
        $saldo = (float)($d['saldo'] ?? 0);
        $pagoMap[$iid] = [
            'saldo'  => $saldo,
            'estado' => $saldo <= 0.01 ? 'habilitado' : 'pendiente',
        ];
    }
}

foreach ($rows as &$r) {
    $idA = (string)($r['id_agrupacion'] ?? '');
    $idI = (string)($r['id_inscripcion'] ?? '');
    // `informe` es una nota interna del CRM (agente/precios) — NO debe llegar al
    // portal del participante. Se remueve de la respuesta (select=* la traía).
    unset($r['informe']);
    $r['estado_credenciales'] = $credMap[$idA] ?? 'incompleto';
    $r['multimedia_confirmado'] = $mmConfirmadoMap[$idI] ?? false;
    $r['audio_url_multimedia'] = $mmAudioMap[$idI] ?? null;
    $r['video_led_url_multimedia'] = $mmVideoMap[$idI] ?? null;
    $r['saldo_pago'] = isset($pagoMap[$idI]) ? $pagoMap[$idI]['saldo'] : null;
    $r['estado_pago'] = isset($pagoMap[$idI]) ? $pagoMap[$idI]['estado'] : null;
}
unset($r);

sendJson([$year => $rows]);
