<?php
declare(strict_types=1);

/**
 * NOMINADOS — la misma lista que el «PDF público» de la app de jurados.
 *
 * Devuelve los bloques de premiación y, dentro de cada uno, las agrupaciones
 * nominadas. NUNCA devuelve el lugar ni la nota: quien mira esto no debe poder
 * deducir quién ganó qué antes de la premiación.
 *
 * Tres cosas lo garantizan, y hacen falta las tres:
 *   1. El lugar y la nota no salen en la respuesta. Se calculan acá adentro
 *      sólo para decidir QUIÉNES entran, y se descartan.
 *   2. El orden dentro de cada bloque se MEZCLA, y la numeración se asigna
 *      DESPUÉS de mezclar. Si se enviara en orden de nota, el primero de la
 *      lista sería el primer lugar. La mezcla es DETERMINISTA: misma semilla
 *      siempre, así todas las personas ven exactamente la misma lista y no se
 *      reacomoda al recargar. Aleatoria y estable no se contradicen — lo que
 *      importa es que el orden no guarde relación con la nota.
 *   3. La mezcla se hace ACÁ, en el servidor. Si se hiciera en el navegador, el
 *      orden real igual habría viajado y se leería en la pestaña de red.
 *
 * ABIERTO A TODA PERSONA CON SESIÓN en el portal (2026-08-24). Antes estaba
 * reservado a super admin. Sigue exigiendo sesión iniciada —requireAuth()—: no
 * es un endpoint anónimo, y el gate vive en el servidor, no en la pestaña.
 *
 * Lo que hace seguro abrirlo son los tres puntos de arriba. Si alguna vez se
 * agrega un campo a la respuesta, hay que releerlos: cualquier dato que
 * correlacione con la nota (el lugar, el promedio, el orden real, la posición
 * dentro del bloque) vuelve a delatar el resultado antes de la premiación.
 *
 * Y hay una cuarta condición, que no vive en este archivo: la respuesta SÍ trae
 * la clave natural agrupación+obra. Hoy eso es inofensivo porque este es el
 * ÚNICO endpoint del portal que toca recepcion_notas_final_2026 /
 * premios_placas_2026 (calificaciones.php lee la ronda de CLASIFICACIÓN y sólo
 * de las agrupaciones propias). El día que se agregue otro endpoint que exponga
 * la ronda final indexable por agrupación u obra, cruzarlo con esta lista
 * reconstruye el podio — revisar esto antes de agregarlo, no después.
 *
 * La regla de quién es nominado replica la de la app de jurados
 * (ganadores-page.tsx): promedio de la ronda final, lugar por rango de nota
 * (>=90 primer · 85-89 segundo · 80-84 tercer) salvo que haya lugar manual en
 * premios_placas_2026; se descartan las excluidas y las marcadas SIN_LUGAR.
 */

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');
requireAuth();

$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if ($year !== '2026') {           // la ronda final sólo existe en 2026
    sendJson(['ano' => $year, 'total' => 0, 'bloques' => []]);
    exit;
}

/** Mayúsculas y espacios colapsados, como limpiar() en los generadores. */
function nomLimpiar(?string $v): string
{
    return trim(preg_replace('/\s+/u', ' ', mb_strtoupper((string)$v, 'UTF-8')));
}

/**
 * Saca los acentos pero NO la Ñ.
 *
 * Se hace con un mapa explícito y no descomponiendo Unicode a propósito: al
 * descomponer, la Ñ se parte en N + virgulilla y un barrido de marcas la
 * convierte en N — «GRUPO PEQUEÑO» quedaría «PEQUENO» y sería otro bloque.
 */
function nomSinAcentos(string $v): string
{
    return strtr($v, [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U',
        'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U', 'Ä' => 'A',
        'Ë' => 'E', 'Ï' => 'I', 'Ö' => 'O', 'Â' => 'A', 'Ê' => 'E', 'Î' => 'I',
        'Ô' => 'O', 'Û' => 'U',
    ]);
}

/** GRUPO PEQUEÑO y GRUPO GRANDE compiten juntos: para las placas son «GRUPO». */
function nomSubdiv(?string $v): string
{
    $u = nomLimpiar($v);
    return preg_match('/^GRUPO\b/u', $u) ? 'GRUPO' : $u;
}

/** El GÉNERO lo decide la MODALIDAD; la columna `genero` queda de respaldo. */
function nomGenero(?string $modalidad, ?string $genero): string
{
    $m = nomSinAcentos(nomLimpiar($modalidad));
    if (preg_match('/URBAN|HIP\s*HOP|COMERCIAL/u', $m)) return 'URBANO';
    if (preg_match('/FOLCLOR|FOLKLOR|SAYA|CAPORAL|TINKU|ETNICA|TRIBAL/u', $m)) return 'FOLKLORE';
    if (preg_match('/JAZZ|CONTEMPORANE|TROPICAL|BALLET|ARABE|INDIA|INDU|MODALIDAD LIBRE|SALON/u', $m)) {
        return 'ACADEMICO';
    }
    $g = nomSinAcentos(nomLimpiar($genero));
    if (preg_match('/FOLCLOR|FOLKLOR/u', $g)) return 'FOLKLORE';
    if (preg_match('/URBAN|HIP\s*HOP|COMERCIAL/u', $g)) return 'URBANO';
    return 'ACADEMICO';
}

/** Lugar por rango de nota. Null = no alcanza para placa. */
function nomLugarPorNota(?float $nota): ?string
{
    if ($nota === null) return null;
    if ($nota >= 90) return 'PRIMER';
    if ($nota >= 85) return 'SEGUNDO';
    if ($nota >= 80) return 'TERCER';
    return null;
}

/**
 * Mezcla determinista, IDÉNTICA a la de la RPC `nominados_publico` de la landing.
 *
 * La clave de orden es md5(semilla|rótulo|agrupación|obra). Se eligió md5 —y no
 * un Fisher-Yates con PRNG propio— por una sola razón: Postgres también sabe
 * hacer md5, así que el portal y la landing producen EXACTAMENTE la misma lista.
 * Dos superficies públicas mostrando los mismos nominados en distinto orden se
 * lee como falla, e invita a preguntarse cuál es «la buena».
 *
 * Sigue cumpliendo lo único que importa: el orden no guarda relación con la
 * nota. Y es estable en el tiempo, así que no se reacomoda al recargar.
 *
 * Si se cambia la semilla o la fórmula acá, hay que cambiarla igual en
 * sql/nominados_publico.sql del repo de la landing, o los dos vuelven a diferir.
 */
function nomMezclar(array $items, string $semilla, string $etiqueta): array
{
    usort($items, function ($a, $b) use ($semilla, $etiqueta) {
        $ka = md5($semilla . '|' . $etiqueta . '|' . $a['agrupacion'] . '|' . $a['obra']);
        $kb = md5($semilla . '|' . $etiqueta . '|' . $b['agrupacion'] . '|' . $b['obra']);
        return strcmp($ka, $kb);
    });
    return $items;
}


function nomCfg(): array
{
    static $c = null;
    if ($c === null) {
        $cfg = require __DIR__ . '/config.php';
        $c = [
            'url' => rtrim((string)($cfg['supabase_url'] ?? ''), '/'),
            'key' => (string)($cfg['supabase_service_role_key'] ?? $cfg['supabase_service_key'] ?? ''),
        ];
    }
    return $c;
}

function nomHeaders(): array
{
    $c = nomCfg();
    return [
        'Authorization: Bearer ' . $c['key'],
        'apikey: ' . $c['key'],
        'Content-Type: application/json',
    ];
}

/** GET a PostgREST que LANZA si la respuesta no es 2xx (o si cURL falló). */
function nomGet(string $tabla, string $qs): array
{
    $ch = curl_init(nomCfg()['url'] . "/rest/v1/$tabla?" . $qs);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => nomHeaders(),
    ]);
    $resp = curl_exec($ch);
    $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    $dec = is_string($resp) ? json_decode($resp, true) : null;
    if ($http >= 200 && $http < 300 && is_array($dec)) return $dec;
    error_log("[nominados] GET $tabla HTTP $http $err");
    throw new RuntimeException("GET $tabla HTTP $http");
}

/**
 * Las consultas en paralelo (curl_multi). Lanza si CUALQUIERA falla.
 * Un timeout de cURL deja el status en 0: también cuenta como fallo.
 */
function nomGetBatch(array $consultas): array
{
    $mh = curl_multi_init();
    $handles = [];
    foreach ($consultas as $clave => [$tabla, $qs]) {
        $ch = curl_init(nomCfg()['url'] . "/rest/v1/$tabla?" . $qs);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_HTTPHEADER     => nomHeaders(),
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$clave] = $ch;
    }
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running > 0) curl_multi_select($mh, 0.5);
    } while ($running > 0);

    $out = [];
    $malas = [];
    foreach ($handles as $clave => $ch) {
        $resp = curl_multi_getcontent($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
        $dec = is_string($resp) ? json_decode($resp, true) : null;
        if ($http >= 200 && $http < 300 && is_array($dec)) {
            $out[$clave] = $dec;
        } else {
            error_log("[nominados] batch[$clave] HTTP $http");
            $malas[] = "$clave(HTTP $http)";
        }
    }
    curl_multi_close($mh);
    if ($malas) throw new RuntimeException('Consultas fallidas: ' . implode(', ', $malas));
    return $out;
}

function nomTraerTodo(string $tabla, string $qs, int $tanda = 1000, int $desde = 0): array
{
    $todo = [];
    for ($offset = $desde; ; $offset += $tanda) {
        // Estricto: antes un 500 en la segunda tanda devolvía [] y el bucle lo
        // leía como «última tanda», truncando las notas en silencio. Con menos
        // notas, obras que sí ganaron placa desaparecían de la lista sin aviso.
        $filas = nomGet($tabla, "$qs&limit=$tanda&offset=$offset");
        $todo = array_merge($todo, $filas);
        if (count($filas) < $tanda) return $todo;   // última tanda
        if ($offset > 100000) return $todo;         // cinturón: nunca un bucle infinito
    }
}

/**
 * Primera tanda de las cuatro consultas A LA VEZ, y sólo se pagina la que se
 * haya llenado. Antes iban una tras otra: cuatro viajes a Supabase en fila
 * (~3,3 s). Con curl_multi el costo es el de la más lenta, no la suma.
 */
// El `order` NO es cosmético. `notas` son ~1210 filas, o sea que SÍ se pagina
// (el tope de PostgREST es 1000), y un limit/offset sin ORDER BY no tiene orden
// definido en Postgres: entre la tanda 1 y la 2 una fila puede repetirse y otra
// perderse, y el promedio de esa obra sale mal — con eso cambia quién es
// nominado. Se ordena por la clave de la fila, que no tiene relación con la nota.
$CONSULTAS = [
    'notas'   => ['recepcion_notas_final_2026', 'select=id_inscripcion,total&estado=in.(enviada,bloqueada)&order=id_registro.asc'],
    'ajustes' => ['premios_placas_2026', 'select=id_inscripcion,lugar,excluido&ano=eq.2026&order=id_inscripcion.asc'],
    'orden'   => ['premios_bloques_2026', 'select=bloque,orden&ano=eq.2026&order=orden.asc'],
    'obras'   => ['registro_de_inscripcion_2026',
                  'select=id_inscripcion,agrupacion,nombre_de_la_obra,categoria,modalidad,division,subdivision,genero,enlace_del_logo&order=id_inscripcion.asc'],
];
/*
 * Si CUALQUIERA de las cuatro consultas falla, esto responde 503 y no una lista.
 *
 * Antes fallaba «para adelante»: selectRawBatch() devuelve [] ante un 502 y el
 * endpoint seguía como si esa tabla estuviera vacía. Perder `ajustes` hacía
 * reaparecer a las agrupaciones marcadas como excluidas y a las SIN_LUGAR;
 * perder `notas` dejaba la lista reducida a las de lugar manual. En ambos casos
 * salía HTTP 200, con el contador diciendo un número plausible, y el único
 * rastro era una línea en el log de PHP.
 *
 * Mientras esto lo veía un solo super admin era un problema chico. Con la vista
 * abierta a todo el portal, una lista de nominados equivocada se difunde sola:
 * más vale que la pantalla diga «no se pudieron cargar» a que muestre un
 * listado que parece bueno y no lo es.
 */
try {
    $primera = nomGetBatch(array_map(
        fn($c) => [$c[0], $c[1] . '&limit=1000&offset=0'],
        $CONSULTAS,
    ));
    $datos = [];
    foreach ($CONSULTAS as $clave => [$tabla, $qs]) {
        $filas = $primera[$clave] ?? [];
        // Sólo la que llegó al tope pudo haber quedado cortada (ver nomTraerTodo).
        if (count($filas) === 1000) {
            $filas = array_merge($filas, nomTraerTodo($tabla, $qs, 1000, 1000));
        }
        $datos[$clave] = $filas;
    }
} catch (Throwable $e) {
    error_log('[nominados] datos incompletos, no se responde lista: ' . $e->getMessage());
    sendJson(['error' => 'No se pudieron cargar los nominados en este momento'], 503);
    exit;
}

// ── Notas de la RONDA FINAL (no la de clasificación) ────────────────────────
$notas = $datos['notas'];
$suma = [];
$cuenta = [];
foreach ($notas as $n) {
    $id = $n['id_inscripcion'] ?? '';
    if ($id === '' || $n['total'] === null) continue;
    $suma[$id] = ($suma[$id] ?? 0) + (float)$n['total'];
    $cuenta[$id] = ($cuenta[$id] ?? 0) + 1;
}

// ── Ajustes del operador: lugar manual y excluidas ──────────────────────────
$ajustes = [];
foreach ($datos['ajustes'] as $a) {
    $ajustes[$a['id_inscripcion'] ?? ''] = $a;
}

// ── Orden manual de los bloques, si la organización lo acomodó ──────────────
$ordenBloque = [];
foreach ($datos['orden'] as $b) {
    $ordenBloque[$b['bloque']] = (int)$b['orden'];
}

// ── Obras ───────────────────────────────────────────────────────────────────
$obras = $datos['obras'];

$bloques = [];
foreach ($obras as $o) {
    $id = $o['id_inscripcion'] ?? '';
    if ($id === '') continue;

    $aj = $ajustes[$id] ?? null;
    if ($aj && !empty($aj['excluido'])) continue;

    $manual = $aj['lugar'] ?? null;
    if ($manual === 'SIN_LUGAR') continue;

    $nota = isset($cuenta[$id]) && $cuenta[$id] > 0
        ? round($suma[$id] / $cuenta[$id], 2)
        : null;

    $lugar = in_array($manual, ['PRIMER', 'SEGUNDO', 'TERCER'], true)
        ? $manual
        : nomLugarPorNota($nota);
    if ($lugar === null) continue;          // sin placa, no es nominado

    $etiqueta = implode(' - ', array_filter([
        nomSinAcentos(nomLimpiar($o['categoria'] ?? '')),
        nomSinAcentos(nomLimpiar($o['modalidad'] ?? '')),
        nomSinAcentos(nomLimpiar($o['division'] ?? '')),
        nomSinAcentos(nomSubdiv($o['subdivision'] ?? '')),
    ], fn($x) => $x !== ''));

    $genero = nomGenero($o['modalidad'] ?? '', $o['genero'] ?? '');
    if (!isset($bloques[$etiqueta])) {
        $bloques[$etiqueta] = ['label' => $etiqueta, 'genero' => $genero, 'items' => []];
    }
    // A partir de acá el LUGAR y la NOTA ya cumplieron su función y se tiran.
    $bloques[$etiqueta]['items'][] = [
        'agrupacion' => nomLimpiar($o['agrupacion'] ?? ''),
        'obra'       => nomLimpiar($o['nombre_de_la_obra'] ?? ''),
        'genero'     => $genero,
        // El logo es dato público de la agrupación: no dice nada del puesto.
        'logo'       => $o['enlace_del_logo'] ?: null,
    ];
}

// ── Orden de los bloques ────────────────────────────────────────────────────
// Manda el orden manual si existe; si no, un género completo y recién el
// siguiente (académico → urbano → folclore) y dentro por rótulo, como la hoja.
$ordenGenero = ['ACADEMICO' => 0, 'URBANO' => 1, 'FOLKLORE' => 2];
$lista = array_values($bloques);
usort($lista, function ($a, $b) use ($ordenBloque, $ordenGenero) {
    $oa = $ordenBloque[$a['label']] ?? null;
    $ob = $ordenBloque[$b['label']] ?? null;
    if ($oa !== null && $ob !== null) return $oa <=> $ob;
    if ($oa !== null) return -1;
    if ($ob !== null) return 1;
    $ga = $ordenGenero[$a['genero']] ?? 9;
    $gb = $ordenGenero[$b['genero']] ?? 9;
    return $ga <=> $gb ?: strcmp($a['label'], $b['label']);
});

// ── Mezclar y recién ahí numerar ────────────────────────────────────────────
// Antes era shuffle(), que reordena en CADA request. Con la vista abierta a
// todo el portal eso significaba que dos personas mirando a la vez vieran
// listas distintas, y que a una sola se le reacomodara la pantalla en cada
// refetch — se lee como falla, e invita a recargar buscándole un sentido al
// orden. Ahora la mezcla es determinista: aleatoria respecto de la nota (que es
// lo único que importa ocultar) pero igual para todos y estable en el tiempo.
$n = 0;
foreach ($lista as &$bloque) {
    $bloque['items'] = nomMezclar($bloque['items'], 'danzarte-nominados-' . $year, $bloque['label']);
    foreach ($bloque['items'] as &$item) {
        $item['n'] = ++$n;
    }
    unset($item);
}
unset($bloque);

sendJson(['ano' => $year, 'total' => $n, 'bloques' => $lista]);
