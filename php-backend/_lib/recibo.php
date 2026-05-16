<?php
declare(strict_types=1);

require_once __DIR__ . '/supabase.php';
require_once __DIR__ . '/datetime.php';

/**
 * Carga datos completos para generar recibo a partir de id_pago.
 * Devuelve estructura uniforme o lanza RuntimeException.
 */
function reciboCargarDatos(string $idPago): array
{
    $s = supabase();

    $pago = $s->selectOne('pagos_2026', '*', ['id_pago' => 'eq.' . $idPago]);
    if (!$pago) {
        throw new RuntimeException('Pago no encontrado: ' . $idPago);
    }

    $concepto      = (string)($pago['concepto'] ?? '');
    $idRef         = (string)($pago['id_referencia'] ?? '');
    $idAgrupacion  = (string)($pago['id_agrupacion'] ?? '');
    $monto         = (float)($pago['monto'] ?? 0);

    // Datos de inscripción/credencial/convenio según concepto
    $inscripcion = null;
    if ($concepto === 'inscripcion') {
        $inscripcion = $s->selectOne('registro_de_inscripcion_2026', '*', ['id_inscripcion' => 'eq.' . $idRef]);
    }

    // Agrupación
    $agrupacion = null;
    if ($idAgrupacion !== '') {
        $agrupacion = $s->selectOne('instituciones', '*', ['id_agrupacion' => 'eq.' . $idAgrupacion]);
    }

    // Pagos previos verificados del mismo compromiso (para calcular saldo)
    $todosPagos = $s->select('pagos_2026', 'id_pago,monto,estado,fecha,hora,created_at', [
        'concepto'      => 'eq.' . $concepto,
        'id_referencia' => 'eq.' . $idRef,
        'order'         => 'created_at.asc',
    ]);

    $pagosAnteriores = 0.0;
    foreach ($todosPagos as $p) {
        if (($p['id_pago'] ?? '') === $idPago) break;
        if (($p['estado'] ?? '') === 'verificado') {
            $pagosAnteriores += (float)($p['monto'] ?? 0);
        }
    }

    // Monto total del compromiso (precio_subdivision * cantidad)
    $montoTotal = 0.0;
    if ($inscripcion) {
        $subdiv = (string)($inscripcion['subdivision'] ?? '');
        $cantidad = (int)($inscripcion['cantidad'] ?? 0);
        $cfg = require __DIR__ . '/../config.php';
        $key = $cfg['supabase_service_role_key'] ?? $cfg['supabase_service_key'];
        $rpcUrl = rtrim($cfg['supabase_url'], '/') . '/rest/v1/rpc/precio_subdivision';
        $ch = curl_init($rpcUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['p_sub' => $subdiv, 'p_ano' => 2026]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $key,
                'apikey: ' . $key,
                'Content-Type: application/json',
            ],
        ]);
        $r = curl_exec($ch);
        curl_close($ch);
        $precio = (float)(is_string($r) ? trim($r) : 0);
        $montoTotal = $precio > 0 ? $precio * max(1, $cantidad) : 0;
    }

    $saldoAnterior = max(0, $montoTotal - $pagosAnteriores);
    $saldoNuevo    = max(0, $montoTotal - $pagosAnteriores - $monto);

    return [
        'pago'            => $pago,
        'inscripcion'     => $inscripcion,
        'agrupacion'      => $agrupacion,
        'monto_total'     => $montoTotal,
        'pagos_anteriores'=> $pagosAnteriores,
        'saldo_anterior'  => $saldoAnterior,
        'saldo_nuevo'     => $saldoNuevo,
    ];
}

/**
 * Render HTML del recibo (80mm, modern minimalist).
 * Se inyecta a mPDF.
 */
function reciboRenderHtml(array $data): string
{
    $p   = $data['pago'];
    $ins = $data['inscripcion'] ?? [];
    $ag  = $data['agrupacion']  ?? [];

    $numero = htmlspecialchars((string)($p['numero_recibo'] ?? $p['id_pago'] ?? ''), ENT_QUOTES);
    $fechaRaw = (string)($p['fecha'] ?? '');
    $hora     = htmlspecialchars(substr((string)($p['hora'] ?? ''), 0, 5), ENT_QUOTES);
    $fecha    = htmlspecialchars($fechaRaw, ENT_QUOTES);
    $fechaTxt = $fechaRaw;
    $meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    $dt = DateTime::createFromFormat('Y-m-d', $fechaRaw);
    if ($dt) {
        $fechaTxt = $meses[(int)$dt->format('n') - 1] . ' ' . (int)$dt->format('j') . ', ' . $dt->format('Y');
    }
    $fechaTxt = htmlspecialchars($fechaTxt, ENT_QUOTES);

    $repNombre = htmlspecialchars((string)($p['nombre_pagador'] ?? $ins['nombre_y_apellido'] ?? '—'), ENT_QUOTES);
    $repCi     = htmlspecialchars((string)($p['ci_pagador']     ?? $ins['numero_de_carnet']  ?? ''), ENT_QUOTES);
    $repTel    = htmlspecialchars((string)($ins['telefono'] ?? ''), ENT_QUOTES);

    $agNombre  = htmlspecialchars((string)($ag['nombre_agrupacion'] ?? $ag['nombre'] ?? $ins['agrupacion'] ?? '—'), ENT_QUOTES);
    $agId      = htmlspecialchars((string)($p['id_agrupacion'] ?? ''), ENT_QUOTES);

    $obra      = htmlspecialchars((string)($ins['nombre_de_la_obra'] ?? '—'), ENT_QUOTES);
    $subdiv    = htmlspecialchars((string)($ins['subdivision'] ?? ''), ENT_QUOTES);
    $cantidad  = (int)($ins['cantidad'] ?? 0);
    $modalidad = htmlspecialchars((string)($ins['modalidad'] ?? ''), ENT_QUOTES);
    $division  = htmlspecialchars((string)($ins['division']  ?? ''), ENT_QUOTES);

    $metodo    = htmlspecialchars((string)($p['metodo_pago'] ?? ''), ENT_QUOTES);
    $concepto  = strtoupper(htmlspecialchars((string)($p['concepto'] ?? ''), ENT_QUOTES));

    $monto     = (float)($p['monto'] ?? 0);
    $total     = (float)($data['monto_total'] ?? 0);
    $anterior  = (float)($data['pagos_anteriores'] ?? 0);
    $saldo     = (float)($data['saldo_nuevo'] ?? 0);
    $saldoAntes = max(0, $total - $anterior);

    $fmt = fn (float $n) => number_format($n, 0, ',', '.');

    $bailLabel = $cantidad === 1 ? 'BAILARÍN' : 'BAILARINES';
    $detalle = trim("$subdiv · $cantidad $bailLabel");
    $modDiv  = trim($modalidad . ($division ? ' · ' . $division : ''));

    $estado    = strtolower((string)($p['estado'] ?? ''));
    $estadoTxt = $estado === 'verificado' ? 'VERIFICADO' : strtoupper($estado);

    $saldoCero  = $saldo <= 0.5;
    $saldoPill  = $saldoCero
        ? '<span class="pill-paid">Pagado</span>'
        : '<span class="pill-due">Saldo pendiente</span>';

    return <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; }
  body {
    margin: 0;
    padding: 0;
    font-family: 'dejavusans', sans-serif;
    color: #0a2540;
    font-size: 10pt;
    line-height: 1.5;
    background: #ffffff;
  }
  .mono { font-family: 'dejavusans', sans-serif; }
  .tabular { font-family: 'dejavusans', sans-serif; }

  /* Top purple bar full-width — Stripe signature */
  .top-bar { height: 4pt; background: #635bff; width: 100%; }

  .page { padding: 14mm 18mm 22mm; }

  /* Title row: "Recibo" + logo festival */
  .title-row { width: 100%; margin-top: 6mm; margin-bottom: 12mm; }
  .title-row td { vertical-align: middle; }
  .title { font-size: 26pt; font-weight: 600; color: #0a2540; letter-spacing: -0.02em; line-height: 1; }
  .logo-img { height: 18mm; width: 18mm; }

  /* Label-value pairs (numero/fecha) */
  .meta { width: 100%; margin-bottom: 12mm; }
  .meta td { padding: 1mm 0; vertical-align: top; }
  .meta-k { font-size: 9.5pt; color: #0a2540; font-weight: 600; padding-right: 4mm; }
  .meta-v { font-size: 9.5pt; color: #0a2540; font-weight: 400; }
  .meta-v-strong { font-size: 9.5pt; color: #0a2540; font-weight: 600; }

  /* Bill from + Bill to */
  .bill { width: 100%; margin-bottom: 11mm; }
  .bill td { vertical-align: top; padding-right: 6mm; }
  .bill-title { font-size: 10pt; font-weight: 600; color: #0a2540; margin-bottom: 2mm; }
  p.bill-line { font-size: 9.5pt; color: #0a2540; font-weight: 400; line-height: 1.4; margin: 0 0 2.5mm 0; padding: 0; }
  p.bill-line-strong { font-size: 9.5pt; color: #0a2540; font-weight: 600; line-height: 1.4; margin: 0 0 2.5mm 0; padding: 0; }
  .bill-title { margin: 0 0 3mm 0; padding: 0; }

  /* Big amount block */
  .amount-block { margin-bottom: 12mm; }
  .amount-big { font-size: 22pt; font-weight: 600; color: #0a2540; letter-spacing: -0.02em; line-height: 1.15; }
  .amount-thanks { margin-top: 4mm; font-size: 10pt; color: #0a2540; font-weight: 400; }

  /* Items table — Stripe style hairlines */
  .items { width: 100%; border-collapse: collapse; margin-bottom: 2mm; }
  .items thead td {
    border-bottom: 0.6pt solid #0a2540;
    padding: 0 0 2.5mm 0;
    font-size: 9.5pt;
    font-weight: 400;
    color: #0a2540;
  }
  .items tbody td {
    padding: 4.5mm 0 4.5mm 0;
    border-bottom: 0.4pt solid #e3e8ee;
    vertical-align: top;
    font-size: 10pt;
    color: #0a2540;
    font-weight: 400;
  }
  .items td.col-descr { width: 50%; }
  .items td.col-qty   { width: 12%; text-align: left; }
  .items td.col-unit  { width: 18%; text-align: left; }
  .items td.col-amt   { width: 20%; text-align: right; }
  .item-name { font-weight: 600; }
  .item-meta { font-size: 9pt; color: #425466; margin-top: 1mm; line-height: 1.5; font-weight: 400; }

  /* Totals — right aligned, label left value right */
  .totals { width: 100%; margin-top: 1mm; }
  .totals td.spacer { width: 50%; }
  .totals td.tot-col { width: 50%; }
  table.tot { width: 100%; border-collapse: collapse; }
  table.tot td { padding: 2mm 0; font-size: 10pt; color: #0a2540; font-weight: 400; }
  table.tot td.k { font-weight: 400; }
  table.tot td.v { text-align: right; font-weight: 400; }
  table.tot tr.sep td { border-top: 0.4pt solid #e3e8ee; }
  table.tot tr.due td { font-weight: 600; }
  table.tot tr.due td.k { font-size: 10.5pt; }
  table.tot tr.due td.v { font-size: 10.5pt; }

  /* Section divider */
  .section-rule { border-top: 0.4pt solid #e3e8ee; margin: 10mm 0 8mm; }

  /* Payment info — Stripe style with dashes */
  .pay-info { font-size: 9.5pt; color: #0a2540; line-height: 1.6; }
  .pay-info .pay-title { font-weight: 600; margin-bottom: 2mm; font-size: 10pt; }
  .pay-info .pay-desc { color: #425466; margin-bottom: 4mm; max-width: 100mm; line-height: 1.55; font-weight: 400; }
  table.pay-fields { margin-top: 2mm; }
  table.pay-fields td { padding: 0.8mm 0; font-size: 9.5pt; color: #0a2540; font-weight: 400; }
  table.pay-fields td.pk { padding-right: 8mm; font-weight: 400; }
  table.pay-fields td.pv { color: #0a2540; font-weight: 400; }

  /* Bottom footer line */
  .bottom-line {
    margin-top: 14mm;
    font-size: 9.5pt;
    color: #0a2540;
  }

  .pill-paid {
    display: inline-block;
    margin-left: 3mm;
    padding: 1.1mm 3.5mm;
    background: #a7f3d0;
    color: #065f46;
    font-size: 6pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    border-radius: 8mm;
    vertical-align: middle;
    text-transform: uppercase;
  }
  .pill-due {
    display: inline-block;
    margin-left: 3mm;
    padding: 1.1mm 3.5mm;
    background: #fde68a;
    color: #92400e;
    font-size: 6pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    border-radius: 8mm;
    vertical-align: middle;
    text-transform: uppercase;
  }
</style>
</head>
<body>

<div class="top-bar"></div>

<div class="page">

  <!-- Title (sin logo) -->
  <table class="title-row">
    <tr>
      <td style="width:60%"><div class="title">Recibo</div></td>
      <td style="width:40%; text-align:right; vertical-align:bottom;">
        <div style="font-size:11pt; font-weight:600; color:#0a2540; letter-spacing:0.06em; line-height:1.2;">DANZARTE</div>
        <div style="font-size:7.5pt; font-weight:600; color:#64748b; letter-spacing:0.28em; margin-top:1mm;">XVIII FESTIVAL · 2026</div>
      </td>
    </tr>
  </table>

  <!-- Meta key-value -->
  <table class="meta">
    <tr>
      <td class="meta-k" style="width:35%">Número de recibo</td>
      <td class="meta-v-strong" style="width:65%">$numero</td>
    </tr>
    <tr>
      <td class="meta-k">Fecha de emisión</td>
      <td class="meta-v">$fechaTxt</td>
    </tr>
  </table>

  <!-- Bill from + Bill to — minimalista -->
  <table class="bill">
    <tr>
      <td style="width:50%">
        <table cellpadding="0" cellspacing="0">
          <tr><td style="font-size:9.5pt; font-weight:600; color:#0a2540;">Festival Danzarte 2026</td></tr>
        </table>
      </td>
      <td style="width:50%">
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding-bottom:3mm; font-size:10pt; font-weight:600; color:#0a2540;">Pagado por</td></tr>
          <tr><td style="padding-bottom:2.5mm; font-size:9.5pt; font-weight:600; color:#0a2540;">$repNombre</td></tr>
          <tr><td style="font-size:9.5pt; font-weight:400; color:#0a2540;">$agNombre</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Big amount -->
  <div class="amount-block">
    <div class="amount-big">{$fmt($monto)} Bs pagado el $fechaTxt {$saldoPill}</div>
    <div class="amount-thanks">¡Gracias por su pago!</div>
  </div>

  <!-- Items table Stripe-style -->
  <table class="items">
    <thead>
      <tr>
        <td class="col-descr">Descripción</td>
        <td class="col-qty">Cant.</td>
        <td class="col-unit">Precio unit.</td>
        <td class="col-amt">Importe</td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="col-descr">
          <div class="item-name">$obra</div>
          <div class="item-meta">Inscripción · $detalle</div>
          <div class="item-meta">$modDiv</div>
        </td>
        <td class="col-qty">$cantidad</td>
        <td class="col-unit">{$fmt($total / max(1,$cantidad))} Bs</td>
        <td class="col-amt">{$fmt($total)} Bs</td>
      </tr>
    </tbody>
  </table>

  <!-- Totals — right column only -->
  <table class="totals">
    <tr>
      <td class="spacer"></td>
      <td class="tot-col">
        <table class="tot">
          <tr><td class="k">Subtotal</td><td class="v">{$fmt($total)} Bs</td></tr>
          <tr class="sep"><td class="k">Saldo actual</td><td class="v">{$fmt($saldoAntes)} Bs</td></tr>
          <tr><td class="k">A cuenta</td><td class="v">−{$fmt($monto)} Bs</td></tr>
          <tr class="sep due"><td class="k">Saldo pendiente</td><td class="v">{$fmt($saldo)} Bs</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <div class="section-rule"></div>

  <!-- Payment info Stripe-style -->
  <div class="pay-info">
    <div class="pay-title">Detalles del pago</div>
    <div class="pay-desc">
      Información de la transacción verificada por el equipo administrativo del festival.
    </div>
    <table class="pay-fields">
      <tr>
        <td class="pk" style="width:38mm">Método de pago</td>
        <td class="pv">$metodo</td>
      </tr>
      <tr>
        <td class="pk">Estado</td>
        <td class="pv"><strong>$estadoTxt</strong></td>
      </tr>
      <tr>
        <td class="pk">Categoría</td>
        <td class="pv">$detalle</td>
      </tr>
      <tr>
        <td class="pk">Modalidad</td>
        <td class="pv">$modDiv</td>
      </tr>
    </table>
  </div>

  <!-- Bottom line — Stripe footer -->
  <div class="bottom-line">
    $numero · {$fmt($monto)} Bs pagado el $fechaTxt
  </div>

</div>

</body>
</html>
HTML;
}

/**
 * Genera PDF binario desde HTML usando mPDF.
 * Devuelve [bytes, mime].
 */
function reciboGenerarPdfBytes(string $html): array
{
    require_once __DIR__ . '/../vendor/autoload.php';
    $tmpDir = sys_get_temp_dir() . '/mpdf-' . getmypid();
    if (!is_dir($tmpDir)) @mkdir($tmpDir, 0777, true);

    $mpdf = new \Mpdf\Mpdf([
        'mode'              => 'utf-8',
        'format'            => 'Letter',
        'margin_left'       => 0,
        'margin_right'      => 0,
        'margin_top'        => 0,
        'margin_bottom'     => 0,
        'margin_header'     => 0,
        'margin_footer'     => 0,
        'tempDir'           => $tmpDir,
        'default_font_size' => 10,
        'default_font'      => 'dejavusanscondensed',
    ]);
    $mpdf->SetTitle('Recibo Festival Danzarte');
    $mpdf->SetAuthor('Festival Danzarte');
    $mpdf->SetAutoPageBreak(false);
    $mpdf->WriteHTML($html);
    return [$mpdf->Output('', 'S'), 'application/pdf'];
}

/**
 * Genera PDF para un id_pago, sube a Storage, actualiza pagos_2026 + recibos_emitidos.
 * Devuelve URL pública del PDF (idempotente: si ya existe lo regenera con upsert).
 */
function reciboGenerarYGuardar(string $idPago, ?string $generadoPor = null): array
{
    $data = reciboCargarDatos($idPago);
    $html = reciboRenderHtml($data);
    [$bytes, $mime] = reciboGenerarPdfBytes($html);

    $pago = $data['pago'];
    $numero = (string)($pago['numero_recibo'] ?? $pago['id_pago']);
    $path = 'recibos-2026/' . $numero . '.pdf';

    // Guardar a tmp para uploadPublicFileAt
    $tmp = tempnam(sys_get_temp_dir(), 'recibo_') . '.pdf';
    file_put_contents($tmp, $bytes);

    $s = supabase();
    $url = $s->uploadPublicFileAt($tmp, $mime, $path, true);
    @unlink($tmp);

    // UPDATE pagos_2026.recibo_pdf_url
    $s->update('pagos_2026', 'id_pago', $idPago, [
        'recibo_pdf_url' => $url,
    ]);

    // INSERT recibos_emitidos (idempotent: upsert via merge)
    $idRecibo = (string)$numero;
    $row = [
        'id_recibo'        => $idRecibo,
        'id_pago'          => $idPago,
        'numero_recibo'    => $numero,
        'concepto'         => (string)($pago['concepto'] ?? ''),
        'id_referencia'    => (string)($pago['id_referencia'] ?? ''),
        'id_agrupacion'    => (string)($pago['id_agrupacion'] ?? ''),
        'agrupacion'       => (string)(($data['agrupacion']['nombre_agrupacion'] ?? $data['agrupacion']['nombre'] ?? '') ?: ($data['inscripcion']['agrupacion'] ?? '')),
        'nombre_pagador'   => (string)($pago['nombre_pagador'] ?? ''),
        'ci_pagador'       => (string)($pago['ci_pagador'] ?? ''),
        'telefono_pagador' => (string)($data['inscripcion']['telefono'] ?? ''),
        'nombre_obra'      => (string)($data['inscripcion']['nombre_de_la_obra'] ?? ''),
        'monto'            => (float)($pago['monto'] ?? 0),
        'monto_total'      => (float)($data['monto_total'] ?? 0),
        'saldo_anterior'   => (float)($data['saldo_anterior'] ?? 0),
        'saldo_nuevo'      => (float)($data['saldo_nuevo'] ?? 0),
        'metodo_pago'      => (string)($pago['metodo_pago'] ?? ''),
        'pdf_url'          => $url,
        'pdf_bytes'        => strlen($bytes),
        'generado_por'     => $generadoPor ?? 'system',
    ];
    // Upsert: usamos REST con Prefer=resolution=merge-duplicates
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
    curl_exec($ch);
    curl_close($ch);

    return [
        'url'    => $url,
        'numero' => $numero,
        'bytes'  => strlen($bytes),
    ];
}
