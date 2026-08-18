"""
Genera las miniaturas de los videos y (opcionalmente) las sube a R2.

POR QUÉ: hoy cada tarjeta de la grilla usa el propio mp4 como miniatura. Para
pintar el fotograma del segundo 3 el navegador se baja ~4 MB del video. Con 235
tarjetas son casi 1 GB sólo en portadas. Una miniatura WebP pesa ~17 KB: 220
veces menos.

CÓMO: descarga sólo los primeros MB de cada video (con Range), saca el fotograma
con ffmpeg y lo guarda en WebP. Nunca baja el archivo entero.

Uso:
    python generar_miniaturas.py --limite 3            # prueba, sólo local
    python generar_miniaturas.py                       # todas, sólo local
    python generar_miniaturas.py --subir               # todas y las sube a R2
"""
from __future__ import annotations
import argparse, io, json, subprocess, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CRED = Path(r'C:\Claude\festival-danzarte-repo\all-credentials.json')
SALIDA = Path(__file__).parent / 'salida'
# El fotograma se toma a MITAD de obra, no al principio: los videos empiezan con
# la cortina del festival y la presentación del locutor, así que los primeros
# segundos darían portadas casi idénticas. Al 45% ya está el baile.
PORCENTAJE = 45
# Si no se puede averiguar la duración, se prueban estos instantes fijos.
SEGUNDOS_RESPALDO = [40, 20, 8, 3]
ANCHO = 480            # suficiente para una tarjeta de la grilla
CALIDAD = 72


def creds():
    return json.loads(CRED.read_text(encoding='utf-8'))


def obras():
    sb = creds()['supabase']
    H = {'apikey': sb['service_role_key'], 'Authorization': 'Bearer ' + sb['service_role_key'],
         'Content-Type': 'application/json'}
    sql = """select id_inscripcion, nombre_de_la_obra, agrupacion, dia, orden, url_video
             from public.registro_de_inscripcion_2026
             where coalesce(url_video,'') <> '' order by dia, orden"""
    req = urllib.request.Request(sb['url'] + '/pg/query',
                                 data=json.dumps({'query': sql}).encode(), headers=H)
    return json.load(urllib.request.urlopen(req, timeout=90))


def duracion(url):
    """Segundos del video, preguntándole al servidor sólo la cabecera."""
    try:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                            '-of', 'csv=p=0', url], capture_output=True, text=True, timeout=180)
        return int(float(r.stdout.strip()))
    except Exception:
        return 0


def miniatura(o):
    """Devuelve (id, ruta_webp, bytes) o (id, None, motivo).

    ffmpeg lee directamente de la URL: sabe saltar al instante pedido con
    peticiones por rango, así que baja unos pocos MB en vez del archivo entero.
    """
    url = o['url_video']
    dest = SALIDA / f"{o['id_inscripcion']}.webp"
    if dest.exists() and dest.stat().st_size > 0:
        return (o['id_inscripcion'], dest, dest.stat().st_size)

    d = duracion(url)
    instantes = ([int(d * PORCENTAJE / 100)] if d > 20 else []) + SEGUNDOS_RESPALDO
    for ss in instantes:
        try:
            r = subprocess.run(
                ['ffmpeg', '-v', 'error', '-ss', str(ss), '-i', url,
                 '-frames:v', '1', '-vf', f'scale={ANCHO}:-2',
                 '-q:v', str(CALIDAD), '-y', str(dest)],
                capture_output=True, timeout=900)
            if r.returncode == 0 and dest.exists() and dest.stat().st_size > 0:
                return (o['id_inscripcion'], dest, dest.stat().st_size)
        except Exception:
            continue
    return (o['id_inscripcion'], None, 'ffmpeg no pudo sacar el fotograma')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limite', type=int, default=0, help='procesar sólo N videos (prueba)')
    ap.add_argument('--subir', action='store_true', help='subir las miniaturas a R2')
    args = ap.parse_args()

    SALIDA.mkdir(parents=True, exist_ok=True)
    lista = obras()
    if args.limite:
        lista = lista[:args.limite]
    print(f'Generando {len(lista)} miniatura(s)…\n', flush=True)

    with ThreadPoolExecutor(max_workers=6) as ex:
        res = list(ex.map(miniatura, lista))

    ok = [r for r in res if r[1]]
    mal = [r for r in res if not r[1]]
    total = sum(r[2] for r in ok)
    print(f'  generadas: {len(ok)}   ·   fallidas: {len(mal)}')
    if ok:
        print(f'  peso total: {total/1024:.0f} KB   ·   media por miniatura: {total/len(ok)/1024:.1f} KB')
    for _id, _, motivo in mal[:10]:
        print(f'    fallo {_id}: {motivo}')
    print(f'\n  quedaron en: {SALIDA}')

    if args.subir:
        print('\n  (la subida a R2 se hace con subir_miniaturas.py, tras revisar el resultado)')


if __name__ == '__main__':
    sys.exit(main())
