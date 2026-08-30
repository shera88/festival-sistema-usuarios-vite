<?php
declare(strict_types=1);

/**
 * Reglas de PREMIACIÓN del festival, en un solo lugar.
 *
 * Hoy la usa ganadores.php (resultados reales, con todo).
 *
 * nominados.php —la lista pública, sin lugar ni nota— tiene su propia copia de
 * esta misma regla: quedó autocontenido a propósito cuando se lo abrió a todo
 * el portal, para que un cambio acá no pueda destapar sin querer un resultado
 * afuera. Es duplicación consciente, no olvido. Si se toca la regla (los cortes
 * de nota, el armado del bloque, el manejo de SIN_LUGAR) hay que tocar LOS DOS
 * archivos, o las dos vistas empiezan a decir cosas distintas del mismo
 * festival.
 *
 * Replica lo que hace la app de jurados (ganadores-page.tsx):
 *   · La nota que vale es el PROMEDIO de la RONDA FINAL (recepcion_notas_final_2026,
 *     estado enviada/bloqueada), no la de clasificación.
 *   · El lugar sale del rango de nota — >=90 primer · 85-89 segundo · 80-84
 *     tercer — salvo que haya lugar manual en premios_placas_2026, que manda.
 *   · Se descartan las excluidas y las marcadas SIN_LUGAR.
 *   · El bloque es «CATEGORÍA - MODALIDAD - DIVISIÓN - SUBDIVISIÓN» sin acentos,
 *     con GRUPO PEQUEÑO y GRUPO GRANDE unidos en «GRUPO».
 */

require_once __DIR__ . '/supabase.php';

/** Mayúsculas y espacios colapsados. */
function premLimpiar(?string $v): string
{
    return trim(preg_replace('/\s+/u', ' ', mb_strtoupper((string)$v, 'UTF-8')));
}

/**
 * Saca los acentos pero NO la Ñ.
 *
 * Mapa explícito y no descomposición Unicode a propósito: al descomponer, la Ñ
 * se parte en N + virgulilla y un barrido de marcas la convierte en N —
 * «GRUPO PEQUEÑO» quedaría «PEQUENO» y sería otro bloque.
 */
function premSinAcentos(string $v): string
{
    return strtr($v, [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U',
        'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U', 'Ä' => 'A',
        'Ë' => 'E', 'Ï' => 'I', 'Ö' => 'O', 'Â' => 'A', 'Ê' => 'E', 'Î' => 'I',
        'Ô' => 'O', 'Û' => 'U',
    ]);
}

/** GRUPO PEQUEÑO y GRUPO GRANDE compiten juntos: para las placas son «GRUPO». */
function premSubdiv(?string $v): string
{
    $u = premLimpiar($v);
    return preg_match('/^GRUPO\b/u', $u) ? 'GRUPO' : $u;
}

/** El GÉNERO lo decide la MODALIDAD; la columna `genero` queda de respaldo. */
function premGenero(?string $modalidad, ?string $genero): string
{
    $m = premSinAcentos(premLimpiar($modalidad));
    if (preg_match('/URBAN|HIP\s*HOP|COMERCIAL/u', $m)) return 'URBANO';
    if (preg_match('/FOLCLOR|FOLKLOR|SAYA|CAPORAL|TINKU|ETNICA|TRIBAL/u', $m)) return 'FOLKLORE';
    if (preg_match('/JAZZ|CONTEMPORANE|TROPICAL|BALLET|ARABE|INDIA|INDU|MODALIDAD LIBRE|SALON/u', $m)) {
        return 'ACADEMICO';
    }
    $g = premSinAcentos(premLimpiar($genero));
    if (preg_match('/FOLCLOR|FOLKLOR/u', $g)) return 'FOLKLORE';
    if (preg_match('/URBAN|HIP\s*HOP|COMERCIAL/u', $g)) return 'URBANO';
    return 'ACADEMICO';
}

/** Lugar por rango de nota. Null = no alcanza para placa. */
function premLugarPorNota(?float $nota): ?string
{
    if ($nota === null) return null;
    if ($nota >= 90) return 'PRIMER';
    if ($nota >= 85) return 'SEGUNDO';
    if ($nota >= 80) return 'TERCER';
    return null;
}

/**
 * Trae TODAS las filas, de a tandas.
 *
 * PostgREST tiene un tope propio de 1000 filas y NO respeta un `limit` mayor:
 * pedir 5000 devuelve 1000 y ni un error. Las notas de la ronda final son ~1210,
 * así que sin paginar se pierden ~210 y varias obras quedan con el promedio
 * incompleto — dejan de figurar sin que nada lo avise.
 */
function premTraerTodo($sb, string $tabla, string $qs, int $tanda = 1000, int $desde = 0): array
{
    $todo = [];
    for ($offset = $desde; ; $offset += $tanda) {
        $filas = $sb->selectRaw($tabla, "$qs&limit=$tanda&offset=$offset");
        $todo = array_merge($todo, $filas);
        if (count($filas) < $tanda) return $todo;   // última tanda
        if ($offset > 100000) return $todo;         // cinturón: nunca un bucle infinito
    }
}

/**
 * Todas las obras de la RONDA FINAL, con su nota, su lugar y su bloque.
 *
 * Devuelve TAMBIÉN las que no alcanzan placa (lugar = null) y las marcadas
 * SIN_LUGAR (sin_lugar = true), para que cada vista decida qué mostrar:
 * la de categorías se queda sólo con las premiadas, la de géneros las lista
 * todas. Las EXCLUIDAS no salen nunca: ésas están sacadas a mano.
 *
 * @return array<int,array<string,mixed>>
 */
function premiacionObras($sb): array
{
    $CONSULTAS = [
        'notas'   => ['recepcion_notas_final_2026', 'select=id_inscripcion,total&estado=in.(enviada,bloqueada)'],
        'ajustes' => ['premios_placas_2026', 'select=id_inscripcion,lugar,excluido&ano=eq.2026'],
        'orden'   => ['premios_bloques_2026', 'select=bloque,orden&ano=eq.2026'],
        'obras'   => ['registro_de_inscripcion_2026',
                      'select=id_inscripcion,agrupacion,nombre_de_la_obra,categoria,modalidad,division,subdivision,genero,enlace_del_logo'],
    ];
    // Las cuatro a la vez: el costo es el de la más lenta, no la suma.
    $primera = $sb->selectRawBatch(array_map(
        fn($c) => ['table' => $c[0], 'qs' => $c[1] . '&limit=1000&offset=0'],
        $CONSULTAS,
    ));
    $datos = [];
    foreach ($CONSULTAS as $clave => [$tabla, $qs]) {
        $filas = $primera[$clave] ?? [];
        if (count($filas) === 1000) {   // sólo la que llegó al tope pudo quedar cortada
            $filas = array_merge($filas, premTraerTodo($sb, $tabla, $qs, 1000, 1000));
        }
        $datos[$clave] = $filas;
    }

    $suma = $cuenta = [];
    foreach ($datos['notas'] as $n) {
        $id = $n['id_inscripcion'] ?? '';
        if ($id === '' || $n['total'] === null) continue;
        $suma[$id] = ($suma[$id] ?? 0) + (float)$n['total'];
        $cuenta[$id] = ($cuenta[$id] ?? 0) + 1;
    }

    $ajustes = [];
    foreach ($datos['ajustes'] as $a) {
        $ajustes[$a['id_inscripcion'] ?? ''] = $a;
    }

    $ordenBloque = [];
    foreach ($datos['orden'] as $b) {
        $ordenBloque[$b['bloque']] = (int)$b['orden'];
    }

    $out = [];
    foreach ($datos['obras'] as $o) {
        $id = $o['id_inscripcion'] ?? '';
        if ($id === '') continue;
        if (!isset($cuenta[$id]) || $cuenta[$id] === 0) continue;   // no bailó la final

        $aj = $ajustes[$id] ?? null;
        if ($aj && !empty($aj['excluido'])) continue;               // sacada a mano

        $manual = $aj['lugar'] ?? null;
        $nota = round($suma[$id] / $cuenta[$id], 2);
        $sinLugar = ($manual === 'SIN_LUGAR');
        $lugar = in_array($manual, ['PRIMER', 'SEGUNDO', 'TERCER'], true)
            ? $manual
            : ($sinLugar ? null : premLugarPorNota($nota));

        $categoria = premLimpiar($o['categoria'] ?? '');
        $modalidad = premLimpiar($o['modalidad'] ?? '');
        $division = premLimpiar($o['division'] ?? '');
        $subdiv = premSubdiv($o['subdivision'] ?? '');

        $out[] = [
            'id_inscripcion' => $id,
            'agrupacion' => premLimpiar($o['agrupacion'] ?? ''),
            'obra'       => premLimpiar($o['nombre_de_la_obra'] ?? ''),
            'categoria'  => $categoria,
            'modalidad'  => $modalidad,
            'division'   => $division,
            'subdivision' => $subdiv,
            'genero'     => premGenero($o['modalidad'] ?? '', $o['genero'] ?? ''),
            'nota'       => $nota,
            'jurados'    => $cuenta[$id],
            'lugar'      => $lugar,
            'sin_lugar'  => $sinLugar,
            'logo'       => $o['enlace_del_logo'] ?: null,
            'bloque'     => implode(' - ', array_filter([
                premSinAcentos($categoria), premSinAcentos($modalidad),
                premSinAcentos($division), premSinAcentos($subdiv),
            ], fn($x) => $x !== '')),
            '_orden_bloque' => null,   // se completa abajo
        ];
    }

    foreach ($out as &$o) {
        $o['_orden_bloque'] = $ordenBloque[$o['bloque']] ?? null;
    }
    unset($o);

    return $out;
}

/**
 * Agrupa en BLOQUES DE PREMIACIÓN las obras que llevan placa.
 *
 * El orden de los bloques respeta el acomodo manual de premios_bloques_2026 si
 * lo hay; si no, un género completo y recién el siguiente (académico → urbano →
 * folclore) y dentro por rótulo, como la hoja oficial.
 */
function premiacionBloques(array $obras): array
{
    $bloques = [];
    foreach ($obras as $o) {
        if ($o['lugar'] === null) continue;     // sin placa no entra a la planilla
        $k = $o['bloque'];
        if (!isset($bloques[$k])) {
            $bloques[$k] = [
                'label' => $k,
                'genero' => $o['genero'],
                'orden' => $o['_orden_bloque'],
                'items' => [],
            ];
        }
        $bloques[$k]['items'][] = $o;
    }

    $ordenGenero = ['ACADEMICO' => 0, 'URBANO' => 1, 'FOLKLORE' => 2];
    uasort($bloques, function ($a, $b) use ($ordenGenero) {
        $oa = $a['orden'];
        $ob = $b['orden'];
        if ($oa !== null && $ob !== null) return $oa <=> $ob;
        if ($oa !== null) return -1;            // acomodado a mano va antes que uno nuevo
        if ($ob !== null) return 1;
        $ga = $ordenGenero[$a['genero']] ?? 9;
        $gb = $ordenGenero[$b['genero']] ?? 9;
        return $ga <=> $gb ?: strcmp($a['label'], $b['label']);
    });

    return $bloques;
}
