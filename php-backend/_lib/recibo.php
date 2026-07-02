<?php
declare(strict_types=1);

require_once __DIR__ . '/supabase.php';
require_once __DIR__ . '/datetime.php';

/** Normaliza los 3 vocabularios de `concepto` que conviven en pagos_2026 al vocab de deudas_2026. */
function reciboNormConcepto(string $c): string
{
    switch ($c) {
        case 'por_participante':
        case 'inscripcion':            return 'inscripcion';
        case 'credencial':
        case 'credencial_unit':
        case 'credencial_unitaria':    return 'credencial';
        case 'convenio_entradas':
        case 'convenio':
        case 'pre_venta':              return 'convenio_entradas';
        default:                       return $c;
    }
}

/** id_referencia de la deuda para un pago (resuelve null desde las FKs). */
function reciboResolverRef(array $pago, string $conceptoDeuda, string $idAgrupacion): string
{
    $idRef = (string)($pago['id_referencia'] ?? '');
    if ($idRef !== '') return $idRef;
    if ($conceptoDeuda === 'inscripcion')       return (string)($pago['id_inscripcion'] ?? '');
    if ($conceptoDeuda === 'convenio_entradas') return (string)($pago['id_convenio'] ?? '');
    if ($conceptoDeuda === 'credencial')        return 'cred-' . $idAgrupacion; // PK real del compromiso (no la FK legacy)
    return '';
}

/**
 * Carga datos para el recibo a partir de id_pago, CONCEPT-AWARE.
 * Usa deudas_2026 para monto_total/descripcion y RE-SUMA pagos verificados anteriores
 * directo de pagos_2026 (deuda.pagado_verificado no incluye el vocabulario credencial_unit).
 */
function reciboCargarDatos(string $idPago): array
{
    $s = supabase();

    $pago = $s->selectOne('pagos_2026', '*', ['id_pago' => 'eq.' . $idPago]);
    if (!$pago) {
        throw new RuntimeException('Pago no encontrado: ' . $idPago);
    }

    $idAgrupacion  = (string)($pago['id_agrupacion'] ?? '');
    $monto         = (float)($pago['monto'] ?? 0);
    $conceptoDeuda = reciboNormConcepto((string)($pago['concepto'] ?? ''));
    $idRef         = reciboResolverRef($pago, $conceptoDeuda, $idAgrupacion);

    // Agrupación
    $agrupacion = $idAgrupacion !== ''
        ? $s->selectOne('instituciones', '*', ['id_agrupacion' => 'eq.' . $idAgrupacion])
        : null;

    // Deuda (monto_total, descripcion, bailarines)
    $deuda = null;
    if ($idRef !== '') {
        $rows = $s->select('deudas_2026', '*', [
            'concepto'      => 'eq.' . $conceptoDeuda,
            'id_referencia' => 'eq.' . $idRef,
        ]);
        $deuda = $rows[0] ?? null;
    }
    $montoTotal = (float)($deuda['monto_total'] ?? 0);

    // Detalle por concepto
    $inscripcion = null;
    $detalle = [
        'descripcion'     => (string)($deuda['descripcion'] ?? ''),
        'subdivision'     => (string)($deuda['subdivision'] ?? ''),
        'cantidad'        => (int)($deuda['bailarines'] ?? 0),
        'precio_unitario' => 0.0,
        'obra'            => '',
        'modalidad'       => '',
        'division'        => '',
    ];

    if ($conceptoDeuda === 'inscripcion') {
        $inscripcion = $idRef !== ''
            ? $s->selectOne('registro_de_inscripcion_2026', '*', ['id_inscripcion' => 'eq.' . $idRef])
            : null;
        if ($inscripcion) {
            $detalle['obra']        = (string)($inscripcion['nombre_de_la_obra'] ?? '');
            $detalle['subdivision'] = (string)($inscripcion['subdivision'] ?? $detalle['subdivision']);
            $detalle['cantidad']    = (int)($inscripcion['cantidad'] ?? $detalle['cantidad']);
            $detalle['modalidad']   = (string)($inscripcion['modalidad'] ?? '');
            $detalle['division']    = (string)($inscripcion['division'] ?? '');
        }
        if ($detalle['descripcion'] === '') $detalle['descripcion'] = $detalle['obra'];
    } elseif ($conceptoDeuda === 'credencial') {
        $comp = $idRef !== ''
            ? $s->selectOne('compromisos_credenciales_2026', '*', ['id_compromiso' => 'eq.' . $idRef])
            : null;
        if ($comp) {
            $detalle['cantidad']        = (int)($comp['cantidad'] ?? $detalle['cantidad']);
            $detalle['precio_unitario'] = (float)($comp['precio_unitario'] ?? 0);
            if (!$montoTotal) $montoTotal = (float)($comp['monto_total'] ?? 0);
        }
        if ($detalle['descripcion'] === '') $detalle['descripcion'] = $detalle['cantidad'] . ' credenciales';
    } elseif ($conceptoDeuda === 'convenio_entradas') {
        $conv = $idRef !== ''
            ? $s->selectOne('recepcion_convenio_2026', '*', ['id_convenio' => 'eq.' . $idRef])
            : null;
        if ($conv) {
            $detalle['cantidad']        = (int)($conv['cantidad_entradas'] ?? $detalle['cantidad']);
            $detalle['precio_unitario'] = (float)($conv['precio_unitario'] ?? 0);
            if (!$montoTotal) $montoTotal = (float)($conv['monto_total'] ?? 0);
        }
        if ($detalle['descripcion'] === '') $detalle['descripcion'] = $detalle['cantidad'] . ' entradas pre-venta';
    }

    // Pagos verificados ANTERIORES de esta misma deuda (re-suma directa; robusta al vocabulario)
    $pagosAnteriores = 0.0;
    if ($idAgrupacion !== '') {
        $allPagos = $s->select('pagos_2026',
            'id_pago,concepto,estado,monto,id_inscripcion,id_convenio,id_pago_credencial,id_referencia,created_at',
            ['id_agrupacion' => 'eq.' . $idAgrupacion, 'order' => 'created_at.asc']);
        foreach ($allPagos as $pg) {
            if ((string)($pg['id_pago'] ?? '') === $idPago) break; // hasta el actual (created_at asc)
            if (($pg['estado'] ?? '') !== 'verificado') continue;
            if (reciboNormConcepto((string)($pg['concepto'] ?? '')) !== $conceptoDeuda) continue;
            if (reciboResolverRef($pg, $conceptoDeuda, $idAgrupacion) !== $idRef) continue;
            $pagosAnteriores += (float)($pg['monto'] ?? 0);
        }
    }

    $saldoAnterior = max(0.0, $montoTotal - $pagosAnteriores);
    $saldoNuevo    = max(0.0, $montoTotal - $pagosAnteriores - $monto);

    return [
        'pago'             => $pago,
        'concepto'         => $conceptoDeuda,
        'id_referencia'    => $idRef,
        'inscripcion'      => $inscripcion,
        'agrupacion'       => $agrupacion,
        'deuda'            => $deuda,
        'detalle'          => $detalle,
        'monto_total'      => $montoTotal,
        'pagos_anteriores' => $pagosAnteriores,
        'saldo_anterior'   => $saldoAnterior,
        'saldo_nuevo'      => $saldoNuevo,
    ];
}

/** Altura estimada (mm) del ticket térmico según campos presentes (evita cortar/whitespace). */
function reciboEstimarAltura(array $data): float
{
    $concepto = (string)($data['concepto'] ?? '');
    $det      = $data['detalle'] ?? [];
    $esCred   = $concepto === 'credencial';

    $nFields = 3; // Fecha, Nombre, Agrupación
    if (!empty($det['obra'])) {
        $nFields++;
        $nFields += (int)floor(mb_strlen((string)$det['obra']) / 38); // wrap aprox a ~72mm
    }
    $nFields++; // Método
    if ($esCred && !empty($det['cantidad'])) {
        $nFields++;
    } elseif ($concepto === 'inscripcion') {
        if (($det['subdivision'] ?? '') !== '') $nFields++;
        if (($det['cantidad'] ?? 0) > 0)        $nFields++;
    } elseif ($concepto === 'convenio_entradas' && ($det['cantidad'] ?? 0) > 0) {
        $nFields++;
    }

    $hasSaldo = (float)($data['monto_total'] ?? 0) > 0.5;
    $nMoney = 1; // Monto abonado
    if ($hasSaldo) $nMoney += 2;
    if (!empty($det['precio_unitario']) && !empty($det['cantidad'])) $nMoney++;

    // base: título + Nº + logo(~8.5mm) + accent ; + campos + solid + dinero + solid + footer + buffer
    $h = 34 + $nFields * 4.6 + 7 + $nMoney * 5.8 + 7 + 24 + 12;
    return max($h, 95);
}

/**
 * Render HTML del recibo TÉRMICO 80mm (mismo diseño que la app de gestión), concept-aware.
 */
function reciboRenderHtml(array $data): string
{
    $p   = $data['pago'];
    $ag  = $data['agrupacion'] ?? [];
    $det = $data['detalle'] ?? [];
    $concepto = (string)($data['concepto'] ?? '');
    $esCred   = $concepto === 'credencial';

    $h   = fn ($v) => htmlspecialchars((string)$v, ENT_QUOTES);
    $fmt = fn (float $n) => number_format($n, 0, ',', '.');
    $bs  = fn (float $n) => 'Bs ' . number_format($n, 0, ',', '.');
    $kv  = fn (string $k, $v) => '<div class="kv"><span class="k">' . htmlspecialchars($k, ENT_QUOTES)
        . ':</span> <span class="v">' . htmlspecialchars((string)$v, ENT_QUOTES) . '</span></div>';

    $numero = $h($p['numero_recibo'] ?? $p['id_pago'] ?? '');

    $fechaRaw = (string)($p['fecha'] ?? '');
    $fechaFmt = $fechaRaw;
    if (strlen($fechaRaw) === 10) { [$yr, $mo, $dy] = explode('-', $fechaRaw); $fechaFmt = "$dy/$mo/$yr"; }
    $horaFmt   = substr((string)($p['hora'] ?? ''), 0, 5);
    $fechaHora = trim($fechaFmt . ($horaFmt ? '  ' . $horaFmt : ''));

    $nombre   = (string)($p['nombre_pagador'] ?? '') ?: '—';
    $agNombre = (string)($ag['nombre_agrupacion'] ?? $ag['nombre'] ?? '') ?: '—';
    $obra     = (string)($det['obra'] ?? '');
    $metodo   = (string)($p['metodo_pago'] ?? '') ?: '—';
    $cantidad = (int)($det['cantidad'] ?? 0);
    $pu       = (float)($det['precio_unitario'] ?? 0);
    $subdiv   = (string)($det['subdivision'] ?? '');

    $monto      = (float)($p['monto'] ?? 0);
    $montoTotal = (float)($data['monto_total'] ?? 0);
    $saldoAnt   = (float)($data['saldo_anterior'] ?? 0);
    $saldoAct   = (float)($data['saldo_nuevo'] ?? 0);
    $hasSaldo   = $montoTotal > 0.5;

    $titulo = $esCred ? 'RECIBO DE CREDENCIALES' : 'RECIBO DE INSCRIPCIÓN';
    $unidad = $esCred ? 'credenciales' : 'entradas';

    // ── Campos inline ──
    $campos  = $kv('Fecha', $fechaHora);
    $campos .= $kv('Nombre', $nombre);
    $campos .= $kv('Agrupación', $agNombre);
    if ($obra !== '') $campos .= $kv('Obra', $obra);
    $campos .= $kv('Método', $metodo);
    if ($esCred && $cantidad > 0) {
        $campos .= $kv('Credenciales', (string)$cantidad);
    } elseif ($concepto === 'inscripcion') {
        if ($subdiv !== '')  $campos .= $kv('Subdivisión', $subdiv);
        if ($cantidad > 0)   $campos .= $kv('Bailarines', (string)$cantidad);
    } elseif ($concepto === 'convenio_entradas' && $cantidad > 0) {
        $campos .= $kv('Entradas', (string)$cantidad);
    }

    // ── Filas de dinero (3 columnas: etiqueta | operador | monto) ──
    $moneyRow = function (string $label, string $amount, array $o = []) {
        $cls  = 'mrow' . (!empty($o['top']) ? ' mt' : '');
        $lcls = 'ml' . (!empty($o['bold']) ? ' mlb' : '');
        $acls = 'ma' . (!empty($o['bold']) ? ' mab' : '');
        $op   = isset($o['op']) ? (string)$o['op'] : '';
        return '<table class="' . $cls . '"><tr>'
            . '<td class="' . $lcls . '">' . htmlspecialchars($label, ENT_QUOTES) . '</td>'
            . '<td class="mo">' . htmlspecialchars($op, ENT_QUOTES) . '</td>'
            . '<td class="' . $acls . '">' . htmlspecialchars($amount, ENT_QUOTES) . '</td>'
            . '</tr></table>';
    };
    $money = '';
    if ($hasSaldo) $money .= $moneyRow('Saldo', $bs($saldoAnt));
    if ($pu > 0 && $cantidad > 0)
        $money .= $moneyRow('Bs ' . $fmt($pu) . ' x ' . $cantidad . ' ' . $unidad, $bs($pu * $cantidad), ['bold' => true]);
    $money .= $moneyRow('Monto abonado', $bs($monto), ['op' => $hasSaldo ? '−' : '', 'bold' => $esCred || !$hasSaldo]);
    if ($hasSaldo) $money .= $moneyRow('Saldo actual', $bs($saldoAct), ['op' => '=', 'bold' => true, 'top' => true]);

    $titulo = $h($titulo);

    // Logo NEGRO monocromo (igual gestión: recolor a [17,17,20] + trim), data URI
    $logoPath = __DIR__ . '/../_assets/logo-recibo-negro.png';
    $logoSrc  = is_file($logoPath) ? 'data:image/png;base64,' . base64_encode((string)file_get_contents($logoPath)) : '';
    $logoTag  = $logoSrc !== ''
        ? '<div class="center"><img class="logo" src="' . $logoSrc . '"></div>'
        : '<div class="center brand">DANZARTE</div><div class="center brandsub">XVIII FESTIVAL · 2026</div>';

    return <<<HTML
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><style>
  body { margin:0; padding:0; font-family:inter,sans-serif; color:#1C1C1E; font-size:6.9pt; line-height:1.3; }
  .center { text-align:center; }
  .title { font-family:intermed; font-size:11pt; color:#0F0F12; margin:0 0 1mm; }
  .num   { font-family:interlight; font-size:6.6pt; color:#787880; margin-bottom:2mm; }
  .logo  { width:20mm; }
  .brand { font-family:intermed; font-size:10pt; color:#0F0F12; letter-spacing:0.1em; }
  .brandsub { font-family:interlight; font-size:6pt; color:#787880; letter-spacing:0.24em; margin-top:0.3mm; }
  .accent      { border-top:0.5mm solid #F5A623; margin:2.4mm 0; }
  .accent-thin { border-top:0.2mm solid #F5A623; margin:1.8mm 0 1.5mm; }
  .solid  { border-top:0.3mm solid #BEBEC6; margin:2.6mm 0; }
  .kv { font-size:5.9pt; margin-bottom:1.7mm; }
  .kv .k { font-family:inter; font-weight:700; color:#1C1C1E; }
  .kv .v { font-family:inter; color:#1C1C1E; }
  table.mrow { width:100%; border-collapse:collapse; margin:0; }
  table.mrow td { padding:0.9mm 0; font-size:7pt; }
  table.mrow td.ml { text-align:left; font-family:interlight; color:#787880; }
  table.mrow td.mo { text-align:right; width:5mm; font-family:inter; font-size:7.5pt; color:#1C1C1E; }
  table.mrow td.ma { text-align:right; width:20mm; font-family:inter; font-size:7.5pt; color:#1C1C1E; }
  table.mrow td.mlb { font-family:intermed; color:#1C1C1E; }
  table.mrow td.mab { font-family:intermed; font-size:8pt; color:#1C1C1E; }
  table.mrow.mt td { border-top:0.3mm solid #BEBEC6; padding-top:1.7mm; }
  .ft { margin-bottom:0.4mm; }
  .ft .c1 { font-family:intermed; font-size:7.5pt; color:#1C1C1E; }
  .ft .c2 { font-family:interlight; font-size:7pt; color:#787880; }
  .ft .c3 { font-family:interlight; font-size:7pt; color:#1C1C1E; }
  .gracias { font-family:interlight; font-size:7pt; color:#787880; }
</style></head>
<body>

  <div class="center title">$titulo</div>
  <div class="center num">Nº $numero</div>
  $logoTag
  <div class="accent"></div>

  $campos
  <div class="solid"></div>

  $money
  <div class="solid"></div>

  <div class="center ft"><span class="c1">Coliseo Santa Rosita</span></div>
  <div class="center ft"><span class="c2">Tel: (591) 69485185</span></div>
  <div class="center ft"><span class="c3">festivaldanzarte.com</span></div>
  <div class="accent-thin"></div>
  <div class="center gracias">Gracias por su pago</div>

</body></html>
HTML;
}

/**
 * Genera PDF binario desde HTML usando mPDF — formato térmico 80mm de alto dinámico.
 */
function reciboGenerarPdfBytes(string $html, float $alturaMm = 150): array
{
    require_once __DIR__ . '/../vendor/autoload.php';
    $tmpDir = sys_get_temp_dir() . '/mpdf-' . getmypid();
    if (!is_dir($tmpDir)) @mkdir($tmpDir, 0777, true);

    // Registrar fuentes Inter (mismas que el recibo de gestión)
    $assets  = __DIR__ . '/../_assets';
    $defCfg  = (new \Mpdf\Config\ConfigVariables())->getDefaults();
    $defFont = (new \Mpdf\Config\FontVariables())->getDefaults();
    $hasInter = is_file($assets . '/Inter-Regular.ttf');

    $mpdf = new \Mpdf\Mpdf([
        'mode'              => 'utf-8',
        'format'            => [80, max(60, $alturaMm)],
        'margin_left'       => 5,
        'margin_right'      => 5,
        'margin_top'        => 5,
        'margin_bottom'     => 4,
        'margin_header'     => 0,
        'margin_footer'     => 0,
        'tempDir'           => $tmpDir,
        'default_font_size' => 8,
        'fontDir'           => array_merge($defCfg['fontDir'], [$assets]),
        'fontdata'          => $defFont['fontdata'] + ($hasInter ? [
            'inter'      => ['R' => 'Inter-Regular.ttf', 'B' => 'Inter-Bold.ttf'],
            'intermed'   => ['R' => 'Inter-Medium.ttf'],
            'interlight' => ['R' => 'Inter-Light.ttf'],
        ] : []),
        'default_font'      => $hasInter ? 'inter' : 'dejavusanscondensed',
    ]);
    $mpdf->SetTitle('Recibo Festival Danzarte');
    $mpdf->SetAuthor('Festival Danzarte');
    $mpdf->SetAutoPageBreak(false);
    $mpdf->WriteHTML($html);
    return [$mpdf->Output('', 'S'), 'application/pdf'];
}

/**
 * Envía el recibo por WhatsApp con templates oficiales YCloud (igual que gestión):
 *   - Cliente -> recibo_pago_util_v1   (nombre, monto, N° recibo) + PDF
 *   - Admins  -> danzarte_recibo_admin_util_v1 (agrupación, representante, monto, N° recibo) + PDF
 * Monto SIN "Bs" (la plantilla lo agrega).
 */
function reciboEnviarWhatsApp(array $data, string $url): array
{
    $cfg    = require __DIR__ . '/../config.php';
    $yk     = (string)($cfg['ycloud_api_key'] ?? '');
    $from   = (string)($cfg['ycloud_from'] ?? '+59162180085');
    $admins = $cfg['admins_recibo'] ?? ['59175571497', '59169485185', '59175663049'];
    if ($yk === '') {
        error_log('[recibo] ycloud_api_key no configurada; no se envía recibo por WhatsApp');
        return ['error' => 'ycloud_api_key no configurada'];
    }

    $p        = $data['pago'];
    $numero   = (string)($p['numero_recibo'] ?? $p['id_pago']);
    $nombre   = (string)($p['nombre_pagador'] ?? '') ?: '—';
    $agrup    = (string)(($data['agrupacion']['nombre_agrupacion'] ?? $data['agrupacion']['nombre'] ?? '') ?: '—');
    $montoStr = number_format((float)($p['monto'] ?? 0), 0, ',', '.');
    $tel      = (string)($p['telefono_pagador'] ?? '');
    $filename = 'Recibo-' . $numero . '.pdf';

    $docHeader = ['type' => 'header', 'parameters' => [
        ['type' => 'document', 'document' => ['link' => $url, 'filename' => $filename]],
    ]];

    $send = function (string $to, string $tpl, array $bodyParams) use ($yk, $from, $docHeader): array {
        $payload = [
            'from' => $from, 'to' => $to, 'type' => 'template',
            'template' => [
                'name' => $tpl, 'language' => ['code' => 'es'],
                'components' => [
                    $docHeader,
                    ['type' => 'body', 'parameters' => array_map(
                        fn ($t) => ['type' => 'text', 'text' => (string)$t], $bodyParams)],
                ],
            ],
        ];
        $ch = curl_init('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_HTTPHEADER     => ['X-API-Key: ' . $yk, 'Content-Type: application/json'],
        ]);
        $r = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code < 200 || $code >= 300) error_log("[recibo] YCloud $tpl -> $to HTTP $code: " . substr((string)$r, 0, 200));
        return ['http' => $code, 'resp' => is_string($r) ? substr($r, 0, 300) : null];
    };

    // Normalizador BO: deja +591XXXXXXXX o '' si no es válido.
    $norm = function (string $t): string {
        $d = preg_replace('/\D/', '', $t);
        if ($d === '') return '';
        if (strpos($d, '00') === 0) $d = substr($d, 2);   // prefijo internacional 00
        if (strlen($d) === 8)       $d = '591' . $d;        // móvil local 8 dígitos
        return preg_match('/^591\d{8}$/', $d) ? '+' . $d : '';
    };

    // El admin recibe el COMPROBANTE que subió el usuario + caption "PAGO APROBADO".
    // Mensaje LIBRE (no plantilla): al tocar "Verificado" se abrió sesión de 24h.
    // El TIPO sigue al archivo del comprobante: imagen → image, PDF → document.
    $compUrl  = (string)($p['comprobante_url'] ?? '') ?: $url; // fallback al recibo si no hubiera
    $cExt     = strtolower((string) pathinfo((string)(parse_url($compUrl, PHP_URL_PATH) ?: $compUrl), PATHINFO_EXTENSION));
    $compEsImg = in_array($cExt, ['png', 'jpg', 'jpeg', 'webp', 'gif'], true);
    $compName = 'Comprobante-' . $numero . '.' . ($cExt !== '' ? $cExt : 'pdf');
    $sendMedia = function (string $to, string $caption) use ($yk, $from, $compUrl, $compName, $compEsImg): array {
        $payload = $compEsImg
            ? ['from' => $from, 'to' => $to, 'type' => 'image', 'image' => ['link' => $compUrl, 'caption' => $caption]]
            : ['from' => $from, 'to' => $to, 'type' => 'document', 'document' => ['link' => $compUrl, 'filename' => $compName, 'caption' => $caption]];
        $ch = curl_init('https://api.ycloud.com/v2/whatsapp/messages/sendDirectly');
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
            CURLOPT_HTTPHEADER => ['X-API-Key: ' . $yk, 'Content-Type: application/json'],
        ]);
        $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code < 200 || $code >= 300) error_log("[recibo] YCloud media -> $to HTTP $code: " . substr((string)$r, 0, 200));
        return ['http' => $code, 'resp' => is_string($r) ? substr($r, 0, 300) : null];
    };

    $out = [];
    // Cliente → recibo oficial (plantilla recibo_pago_util_v1 + PDF). Solo al aprobar.
    $toCliente = $norm($tel);
    $out['cliente'] = $toCliente !== ''
        ? $send($toCliente, 'recibo_pago_util_v1', [$nombre, $montoStr, $numero])
        : ['skip' => 'sin telefono_pagador válido'];

    // Admins → el RECIBO (PDF) adjunto + caption "PAGO APROBADO" con resumen del
    // compromiso RELACIONADO (la inscripción pagada; credenciales solo si el pago
    // fue de credenciales). Mensaje libre, NO la plantilla con botones.
    $idAgr    = (string)($p['id_agrupacion'] ?? '');
    $idRef    = (string)($p['id_referencia'] ?? '');
    $caption  = _reciboResumenAdminMsg($cfg, $idAgr, $idRef, $agrup, $nombre, $montoStr, $numero, (string)($p['concepto'] ?? ''));
    foreach ($admins as $adm) {
        $to = $norm((string)$adm);
        if ($to !== '') $out['admin_' . $adm] = $sendMedia($to, $caption);
    }
    return $out;
}

/**
 * Texto del aviso al admin tras aprobar: "PAGO APROBADO" + resumen de pagos de
 * la agrupación (RPC pagos_resumen_agrupacion). Incluye la sección de inscripción
 * (pre-venta o por participante) como una de las líneas del resumen.
 */
function _reciboResumenAdminMsg(array $cfg, string $idAgr, string $idRef, string $agrup, string $nombre, string $montoStr, string $numero, string $concepto): string
{
    $LBL = [
        'por_participante'    => 'Inscripción · Por Participante',
        'pre_venta'           => 'Inscripción · Pre-Venta de Entradas',
        'credencial'          => 'Credenciales',
        'credencial_unitaria' => 'Credencial unitaria',
    ];
    $NL = "\n";
    $bs = fn ($x) => number_format((float)$x, 0, ',', '.');
    $head = '✅ *PAGO APROBADO*' . $NL .
        '*Agrupación:* ' . $agrup . $NL .
        '*Representante:* ' . $nombre . $NL .
        '*Monto:* Bs ' . $montoStr . '  ·  ' . ($LBL[$concepto] ?? $concepto) . $NL .
        '*Recibo N°:* ' . $numero;

    // Resumen SOLO del compromiso relacionado al pago (concepto + id_referencia).
    // Si fue inscripción → muestra esa inscripción; si fue credenciales → credenciales.
    // No se mezclan conceptos.
    if ($idAgr !== '') {
        $key = $cfg['supabase_service_role_key'] ?? $cfg['supabase_service_key'] ?? '';
        $rpc = rtrim((string)($cfg['supabase_url'] ?? ''), '/') . '/rest/v1/rpc/pagos_resumen_agrupacion';
        $ch = curl_init($rpc);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['p_id_agrupacion' => $idAgr]),
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12,
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key, 'apikey: ' . $key, 'Content-Type: application/json'],
        ]);
        $r = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $rows = ($code >= 200 && $code < 300) ? (json_decode((string)$r, true) ?: []) : [];
        $match = null;
        foreach ($rows as $c) {
            if ((string)($c['concepto'] ?? '') === $concepto
                && ($idRef === '' || (string)($c['id_referencia'] ?? '') === $idRef)) { $match = $c; break; }
        }
        if (!$match) foreach ($rows as $c) { if ((string)($c['concepto'] ?? '') === $concepto) { $match = $c; break; } }
        if ($match) {
            $titulo = ($concepto === 'credencial' || $concepto === 'credencial_unitaria') ? 'Credenciales' : 'Inscripción';
            $desc = trim((string)($match['descripcion'] ?? ''));
            $head .= $NL . $NL . '*Resumen — ' . $titulo . ':*' .
                $NL . '› ' . ($LBL[$match['concepto']] ?? $match['concepto']) . ($desc !== '' ? ' (' . $desc . ')' : '') .
                $NL . '› Total: Bs ' . $bs($match['monto_total'] ?? 0) .
                $NL . '› Pagado: Bs ' . $bs($match['pagado_verificado'] ?? 0) .
                $NL . '› Saldo: Bs ' . $bs($match['saldo'] ?? 0);
            if (!empty($match['pagado_pendiente']) && (float)$match['pagado_pendiente'] > 0)
                $head .= $NL . '› En revisión: Bs ' . $bs($match['pagado_pendiente']);
        }
    }
    return $head;
}

/**
 * Genera PDF para un id_pago, sube a Storage, actualiza pagos_2026 + recibos_emitidos.
 * Si $enviarWhatsApp=true (y no se envió antes), manda el recibo al cliente y a los admins.
 */
function reciboGenerarYGuardar(string $idPago, ?string $generadoPor = null, bool $enviarWhatsApp = false): array
{
    $data    = reciboCargarDatos($idPago);
    $html    = reciboRenderHtml($data);
    $altura  = reciboEstimarAltura($data);
    [$bytes, $mime] = reciboGenerarPdfBytes($html, $altura);

    $pago   = $data['pago'];
    $det    = $data['detalle'] ?? [];
    $numero = (string)($pago['numero_recibo'] ?? $pago['id_pago']);
    $path   = 'recibos-2026/' . $numero . '.pdf';

    $tmp = tempnam(sys_get_temp_dir(), 'recibo_') . '.pdf';
    file_put_contents($tmp, $bytes);

    $s   = supabase();
    $url = $s->uploadPublicFileAt($tmp, $mime, $path, true);
    @unlink($tmp);

    $s->update('pagos_2026', 'id_pago', $idPago, ['recibo_pdf_url' => $url]);

    // UPSERT recibos_emitidos (con chequeo de status)
    $row = [
        'id_recibo'        => (string)$numero,
        'id_pago'          => $idPago,
        'numero_recibo'    => $numero,
        'concepto'         => (string)($data['concepto'] ?? ($pago['concepto'] ?? '')),
        'id_referencia'    => (string)($data['id_referencia'] ?? ($pago['id_referencia'] ?? '')),
        'id_agrupacion'    => (string)($pago['id_agrupacion'] ?? ''),
        'agrupacion'       => (string)(($data['agrupacion']['nombre_agrupacion'] ?? $data['agrupacion']['nombre'] ?? '') ?: ''),
        'nombre_pagador'   => (string)($pago['nombre_pagador'] ?? ''),
        'ci_pagador'       => (string)($pago['ci_pagador'] ?? ''),
        'telefono_pagador' => (string)($pago['telefono_pagador'] ?? ''),
        'nombre_obra'      => (string)($det['obra'] ?? ''),
        'monto'            => (float)($pago['monto'] ?? 0),
        'monto_total'      => (float)($data['monto_total'] ?? 0),
        'saldo_anterior'   => (float)($data['saldo_anterior'] ?? 0),
        'saldo_nuevo'      => (float)($data['saldo_nuevo'] ?? 0),
        'metodo_pago'      => (string)($pago['metodo_pago'] ?? ''),
        'pdf_url'          => $url,
        'pdf_bytes'        => strlen($bytes),
        'generado_por'     => $generadoPor ?? 'system',
    ];
    $cfg = require __DIR__ . '/../config.php';
    $key = $cfg['supabase_service_role_key'] ?? $cfg['supabase_service_key'];
    $ch = curl_init(rtrim($cfg['supabase_url'], '/') . '/rest/v1/recibos_emitidos');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($row),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $key,
            'apikey: ' . $key,
            'Content-Type: application/json',
            'Prefer: resolution=merge-duplicates',
        ],
    ]);
    $resp = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300) error_log('[recibo] upsert recibos_emitidos HTTP ' . $code . ': ' . substr((string)$resp, 0, 300));

    // Envío WhatsApp (con guard anti-doble-envío si existe la columna recibo_enviado_at)
    $envio = null;
    if ($enviarWhatsApp) {
        if (!empty($pago['recibo_enviado_at'])) {
            $envio = ['skip' => 'ya_enviado'];
        } else {
            try {
                $envio = reciboEnviarWhatsApp($data, $url);
                try { $s->update('pagos_2026', 'id_pago', $idPago, ['recibo_enviado_at' => date('c')]); }
                catch (\Throwable $e) { /* columna inexistente: dedup deshabilitado, no rompe */ }
            } catch (\Throwable $e) {
                error_log('[recibo] envío WhatsApp falló: ' . $e->getMessage());
                $envio = ['error' => $e->getMessage()];
            }
        }
    }

    return [
        'url'    => $url,
        'numero' => $numero,
        'bytes'  => strlen($bytes),
        'envio'  => $envio,
    ];
}
