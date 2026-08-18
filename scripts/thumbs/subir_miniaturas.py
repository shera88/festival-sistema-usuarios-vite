"""
Sube las miniaturas generadas a Cloudflare R2, bajo `thumbs-2026/`.

Sólo AÑADE archivos nuevos: no toca ni borra ningún video. Cada miniatura se
guarda como `thumbs-2026/<id_inscripcion>.webp`, así la app puede construir su
URL sin consultar nada.

Uso:
    python subir_miniaturas.py --probar     # sube sólo 3, para revisar
    python subir_miniaturas.py              # sube todas las que falten
"""
from __future__ import annotations
import argparse, hashlib, hmac, io, json, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

CRED = Path(r'C:\Claude\festival-danzarte-repo\all-credentials.json')
SALIDA = Path(__file__).parent / 'salida'
PREFIJO = 'thumbs-2026'


def cfg():
    c = json.loads(CRED.read_text(encoding='utf-8'))['cloudflare_r2_festival_danzarte']
    return {
        'cuenta': c['account_id'],
        'bucket': c['bucket_name'],
        'clave': c['access_key_id'],
        'secreto': c['secret_access_key'],
        'endpoint': c['s3_endpoint'],
        'publico': c.get('public_url_base', ''),
    }


def firmar(k, msg):
    return hmac.new(k, msg.encode('utf-8'), hashlib.sha256).digest()


def subir_uno(args):
    """PUT de un objeto a R2 firmado con AWS SigV4."""
    ruta, c = args
    key = f"{PREFIJO}/{ruta.name}"
    datos = ruta.read_bytes()
    host = c['endpoint'].replace('https://', '')
    ahora = datetime.now(timezone.utc)
    fecha = ahora.strftime('%Y%m%dT%H%M%SZ')
    dia = ahora.strftime('%Y%m%d')
    payload = hashlib.sha256(datos).hexdigest()

    canonical = (f"PUT\n/{c['bucket']}/{key}\n\n"
                 f"content-type:image/webp\nhost:{host}\n"
                 f"x-amz-content-sha256:{payload}\nx-amz-date:{fecha}\n\n"
                 f"content-type;host;x-amz-content-sha256;x-amz-date\n{payload}")
    scope = f"{dia}/auto/s3/aws4_request"
    to_sign = f"AWS4-HMAC-SHA256\n{fecha}\n{scope}\n{hashlib.sha256(canonical.encode()).hexdigest()}"
    k = firmar(firmar(firmar(firmar(('AWS4' + c['secreto']).encode(), dia), 'auto'), 's3'), 'aws4_request')
    firma = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()

    req = urllib.request.Request(f"{c['endpoint']}/{c['bucket']}/{key}", data=datos, method='PUT')
    req.add_header('Content-Type', 'image/webp')
    req.add_header('x-amz-content-sha256', payload)
    req.add_header('x-amz-date', fecha)
    req.add_header('Authorization',
                   f"AWS4-HMAC-SHA256 Credential={c['clave']}/{scope}, "
                   f"SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature={firma}")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return (ruta.name, r.status in (200, 201), '')
    except Exception as e:
        return (ruta.name, False, f'{type(e).__name__}: {e}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--probar', action='store_true', help='subir sólo 3 para revisar')
    args = ap.parse_args()

    c = cfg()
    archivos = sorted(SALIDA.glob('*.webp'))
    if args.probar:
        archivos = archivos[:3]
    if not archivos:
        print('No hay miniaturas generadas. Corra antes generar_miniaturas.py')
        return 1

    print(f'Subiendo {len(archivos)} miniatura(s) a {c["bucket"]}/{PREFIJO}/ …\n', flush=True)
    with ThreadPoolExecutor(max_workers=8) as ex:
        res = list(ex.map(subir_uno, [(a, c) for a in archivos]))

    ok = [r for r in res if r[1]]
    mal = [r for r in res if not r[1]]
    print(f'  subidas: {len(ok)}   ·   fallidas: {len(mal)}')
    for n, _, err in mal[:8]:
        print(f'    {n}: {err}')
    if ok and c['publico']:
        print(f'\n  ejemplo: {c["publico"]}/{PREFIJO}/{ok[0][0]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
