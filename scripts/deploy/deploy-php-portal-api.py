#!/usr/bin/env python
"""Sube los .php cambiados de php-backend/ al portal de PRODUCCION
(/festivaldanzarte.com/public_html/portal/api) vía FTPS.

Path /portal/api = el que usa el SPA en prod (client.ts: BASE_URL=/portal/ -> /portal/api).
NO toca config.php. Targeted: solo FILES. Correr SIEMPRE por PowerShell, NO por Bash
(MSYS mangla rutas /...). Uso: python scripts/deploy/deploy-php-portal-api.py
"""
from __future__ import annotations
import io, json, sys, ftplib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

REMOTE_BASE = "/festivaldanzarte.com/public_html/portal/api"
PHP_DIR = ROOT_DIR / "php-backend"

FILES = [
    "_lib/context.php",
    "_lib/master-tables.php",
    "inscripciones.php",
    "solicitud.php",
    "inscripcion.php",
]


def connect():
    print(f"[ftps] {CREDS['host']}:{CREDS['port']}", flush=True)
    ftps = ftplib.FTP_TLS(timeout=120)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p()
    ftps.set_pasv(True)
    print("[ftps] login ok", flush=True)
    return ftps


def ensure_dir(ftps, remote_path):
    parts = [p for p in remote_path.split("/") if p]
    cwd = "/"
    for p in parts:
        cwd = cwd.rstrip("/") + "/" + p
        try:
            ftps.cwd(cwd)
        except ftplib.error_perm:
            ftps.mkd(cwd)


def main():
    ftps = connect()
    ok = 0
    for rel in FILES:
        local = PHP_DIR / rel
        if not local.exists():
            print(f"[skip] {local} no existe", flush=True)
            continue
        remote = REMOTE_BASE + "/" + rel.replace("\\", "/")
        parent = "/".join(remote.split("/")[:-1])
        if parent:
            ensure_dir(ftps, parent)
        with open(local, "rb") as fh:
            ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
        print(f"[ok]  {local.stat().st_size/1024:.1f}KB  {remote}", flush=True)
        ok += 1
    ftps.quit()
    print(f"[done] {ok}/{len(FILES)} -> https://www.festivaldanzarte.com/portal/api/", flush=True)
    return 0 if ok == len(FILES) else 1


if __name__ == "__main__":
    sys.exit(main())
