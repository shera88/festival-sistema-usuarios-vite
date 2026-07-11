<?php
/**
 * PDF de REVISIÓN para el admin: hoja 1 con los datos del pago + el COMPROBANTE
 * que subió el usuario anexado:
 *   - comprobante imagen (png/jpg/webp) → se embebe como hoja 2.
 *   - comprobante PDF                   → se fusionan sus páginas (FPDI) al final.
 * Sube el PDF a Storage (uploads-2026/revisiones) y devuelve la URL pública.
 * Best-effort: si algo falla, devuelve null y el caller usa el comprobante crudo.
 */
declare(strict_types=1);

if (!function_exists('revisionGenerarPdf')) {

function _revConcepto(string $c): string
{
    return [
        'por_participante'    => 'Inscripción · Por Participante',
        'pre_venta'           => 'Inscripción · Pre-Venta de Entradas',
        'credencial'          => 'Credenciales',
        'credencial_unitaria' => 'Credencial unitaria',
        'inscripcion'         => 'Inscripción',
    ][$c] ?? $c;
}

function _revDescargar(string $url): ?array
{
    if ($url === '') return null;
    $bin = @file_get_contents($url);
    if ($bin === false || $bin === '') return null;
    $ext = strtolower((string) pathinfo((string)(parse_url($url, PHP_URL_PATH) ?: $url), PATHINFO_EXTENSION));
    $tmp = tempnam(sys_get_temp_dir(), 'comp_') . ($ext !== '' ? '.' . $ext : '');
    file_put_contents($tmp, $bin);
    return ['path' => $tmp, 'ext' => $ext];
}

/** Devuelve URL pública del PDF combinado, o null si falla. */
function revisionGenerarPdf(array $pago, string $agrupacion = ''): ?string
{
    // Guard: si falta vendor (mpdf) NO reventar el request (require de archivo ausente
    // es fatal uncatchable). Devolver null → el llamador usa el comprobante crudo.
    $autoload = __DIR__ . '/../vendor/autoload.php';
    if (!is_file($autoload)) {
        error_log('[revision] vendor/autoload.php ausente; se omite el PDF de revisión');
        return null;
    }
    require_once $autoload;
    try {
        $numero  = (string)($pago['numero_recibo'] ?? $pago['id_pago'] ?? 'pago');
        $nombre  = (string)($pago['nombre_pagador'] ?? '—');
        $tel     = (string)($pago['telefono_pagador'] ?? '—');
        $monto   = number_format((float)($pago['monto'] ?? 0), 0, ',', '.');
        $concep  = _revConcepto((string)($pago['concepto'] ?? ''));
        $fecha   = (string)($pago['fecha'] ?? '');
        $hora    = (string)($pago['hora'] ?? '');
        $metodo  = (string)($pago['metodo_pago'] ?? '—');
        $agr     = $agrupacion !== '' ? $agrupacion : (string)($pago['agrupacion'] ?? '—');
        $compUrl = (string)($pago['comprobante_url'] ?? '');
        $esc     = fn ($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');

        $tmpDir = sys_get_temp_dir() . '/mpdf-rev-' . getmypid();
        if (!is_dir($tmpDir)) @mkdir($tmpDir, 0777, true);

        // Misma gráfica que el recibo: fuentes Inter + logo negro + acento amarillo (#F5A623).
        $assets   = __DIR__ . '/../_assets';
        $defCfg   = (new \Mpdf\Config\ConfigVariables())->getDefaults();
        $defFont  = (new \Mpdf\Config\FontVariables())->getDefaults();
        $hasInter = is_file($assets . '/Inter-Regular.ttf');
        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8', 'format' => 'A4',
            'margin_left' => 20, 'margin_right' => 20, 'margin_top' => 20, 'margin_bottom' => 16,
            'tempDir'  => $tmpDir,
            'fontDir'  => array_merge($defCfg['fontDir'], [$assets]),
            'fontdata' => $defFont['fontdata'] + ($hasInter ? [
                'inter'      => ['R' => 'Inter-Regular.ttf', 'B' => 'Inter-Bold.ttf'],
                'intermed'   => ['R' => 'Inter-Medium.ttf'],
                'interlight' => ['R' => 'Inter-Light.ttf'],
            ] : []),
            'default_font'      => $hasInter ? 'inter' : 'dejavusanscondensed',
            'default_font_size' => 10,
        ]);
        $mpdf->SetTitle('Revisión de pago ' . $numero);
        $mpdf->SetAuthor('Festival Danzarte');

        $logoPath = $assets . '/logo-recibo-negro.png';
        $logoSrc  = is_file($logoPath) ? 'data:image/png;base64,' . base64_encode((string) file_get_contents($logoPath)) : '';
        $logoTag  = $logoSrc !== ''
            ? '<div style="text-align:center"><img src="' . $logoSrc . '" style="width:40mm"></div>'
            : '<div style="text-align:center;font-family:intermed;font-size:18pt;color:#0F0F12;letter-spacing:0.1em">DANZARTE</div>'
              . '<div style="text-align:center;font-family:interlight;font-size:8pt;color:#787880;letter-spacing:0.24em">XVIII FESTIVAL · 2026</div>';

        $row = fn ($l, $v) => '<tr>'
            . '<td style="padding:7px 12px;font-family:interlight;color:#787880;border-bottom:0.3mm solid #E2E2E8;width:42%">' . $esc($l) . '</td>'
            . '<td style="padding:7px 12px;font-family:intermed;color:#1C1C1E;border-bottom:0.3mm solid #E2E2E8">' . $esc($v) . '</td></tr>';
        $html = $logoTag
            . '<div style="text-align:center;font-family:intermed;font-size:13pt;color:#0F0F12;letter-spacing:0.1em;margin-top:5mm">PAGO PENDIENTE DE VERIFICACIÓN</div>'
            . '<div style="text-align:center;font-family:interlight;font-size:8pt;color:#787880;margin-top:1.6mm">Nº ' . $esc($numero) . '</div>'
            . '<div style="border-top:1mm solid #F5A623;margin:5mm 0 6mm"></div>'
            . '<table style="width:100%;border-collapse:collapse;font-size:9.5pt">'
            . $row('Agrupación', $agr)
            . $row('Representante / Pagador', $nombre)
            . $row('Teléfono', $tel)
            . $row('Concepto', $concep)
            . $row('Monto', 'Bs ' . $monto)
            . $row('Método', $metodo)
            . $row('Fecha', trim($fecha . '  ' . $hora))
            . '</table>'
            . '<div style="border-top:0.2mm solid #F5A623;margin:6mm 0 2mm"></div>'
            . '<div style="text-align:center;font-family:interlight;font-size:8pt;color:#787880">Comprobante adjunto en la(s) página(s) siguiente(s).</div>';
        $mpdf->WriteHTML($html);

        // Anexar comprobante
        $comp = _revDescargar($compUrl);
        if ($comp) {
            if (in_array($comp['ext'], ['png', 'jpg', 'jpeg', 'webp', 'gif'], true)) {
                $info = @getimagesize($comp['path']);
                $mpdf->AddPage();
                $mpdf->WriteHTML('<div style="text-align:center;font-family:interlight;font-size:9pt;color:#787880;margin-bottom:6px">Comprobante de pago</div>');
                if ($info && $info[0] > 0 && $info[1] > 0) {
                    $boxW = 174.0; $boxH = 235.0; $ratio = $info[0] / $info[1];
                    $w = $boxW; $h = $w / $ratio;
                    if ($h > $boxH) { $h = $boxH; $w = $h * $ratio; }
                    $x = (210 - $w) / 2;
                    $mpdf->Image($comp['path'], $x, 32, $w, $h);
                }
            } elseif ($comp['ext'] === 'pdf') {
                try {
                    $n = $mpdf->setSourceFile($comp['path']);
                    for ($i = 1; $i <= $n; $i++) {
                        $tpl  = $mpdf->importPage($i);
                        $size = $mpdf->getTemplateSize($tpl);
                        $mpdf->AddPageByArray([
                            'orientation' => ($size['width'] > $size['height']) ? 'L' : 'P',
                            'sheet-size'  => [$size['width'], $size['height']],
                        ]);
                        $mpdf->useTemplate($tpl);
                    }
                } catch (\Throwable $e) {
                    error_log('[revision] merge pdf comprobante falló: ' . $e->getMessage());
                }
            }
            @unlink($comp['path']);
        }

        $bytes = $mpdf->Output('', 'S');
        $tmpPdf = tempnam(sys_get_temp_dir(), 'rev_') . '.pdf';
        file_put_contents($tmpPdf, $bytes);
        $path = 'revisiones/' . $numero . '-' . substr(bin2hex(random_bytes(4)), 0, 8) . '.pdf';
        $url = supabase()->uploadPublicFileAt($tmpPdf, 'application/pdf', $path, true);
        @unlink($tmpPdf);
        return $url ?: null;
    } catch (\Throwable $e) {
        error_log('[revision] generarPdf falló: ' . $e->getMessage());
        return null;
    }
}

}
