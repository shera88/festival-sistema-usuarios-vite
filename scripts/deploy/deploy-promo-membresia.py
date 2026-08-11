#!/usr/bin/env python
"""Sube php-backend/_lib/promo.php a PRODUCCIÓN (cierre de la promo de membresías).

Sube a las DOS rutas para que no queden desincronizadas:
  /portal/api      → backend REAL que usa el SPA (client.ts BASE_URL=/portal/)
  /app-portal/php  → copia legacy

videos.php y membresia-checkout.php NO se tocan: ya están idénticos en prod
(verificado con check-membresia-prod.py) y sólo leen promoMembresiaTodos().
Correr por PowerShell. Uso: python scripts/deploy/deploy-promo-membresia.py
"""
from __future__ import annotations
import io, json, sys, ftplib, hashlib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

BASES = [
    "/festivaldanzarte.com/public_html/portal/api",
    "/festivaldanzarte.com/public_html/app-portal/php",
]
REL = "_lib/promo.php"
LOCAL = ROOT_DIR / "php-backend" / REL


def main():
    if not LOCAL.exists():
        print(f"[error] no existe {LOCAL}", flush=True)
        return 1
    data = LOCAL.read_bytes()
    local_md5 = hashlib.md5(data).hexdigest()
    print(f"[local] {REL} {len(data)/1024:.1f}KB md5={local_md5[:8]}", flush=True)

    ftps = ftplib.FTP_TLS(timeout=120)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p()
    ftps.set_pasv(True)
    print("[ftps] login ok", flush=True)

    ok = 0
    for base in BASES:
        remote = base + "/" + REL
        with open(LOCAL, "rb") as fh:
            ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
        # verificación: releer lo subido y comparar md5
        buf = io.BytesIO()
        ftps.retrbinary(f"RETR {remote}", buf.write)
        remote_md5 = hashlib.md5(buf.getvalue()).hexdigest()
        estado = "OK" if remote_md5 == local_md5 else "MISMATCH"
        print(f"[{estado}] {remote}  md5={remote_md5[:8]}", flush=True)
        if remote_md5 == local_md5:
            ok += 1

    ftps.quit()
    print(f"[done] {ok}/{len(BASES)} rutas actualizadas", flush=True)
    return 0 if ok == len(BASES) else 1


if __name__ == "__main__":
    sys.exit(main())
