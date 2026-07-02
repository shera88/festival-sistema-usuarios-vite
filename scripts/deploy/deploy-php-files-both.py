#!/usr/bin/env python
"""Sube archivos PHP (args, relativos a php-backend/) a AMBOS backends prod:
   /portal/api      (el que usa el SPA en prod: client.ts BASE_URL=/portal/)
   /app-portal/php  (copia legacy/alterna)
vía FTPS. NO toca config.php. Correr por PowerShell (MSYS mangla rutas /...).

Uso: python scripts/deploy/deploy-php-files-both.py _lib/auth.php multimedia-presign.php ...
"""
from __future__ import annotations
import io, json, sys, ftplib
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
PHP_DIR = ROOT_DIR / "php-backend"


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
    if len(sys.argv) < 2:
        print("Usage: deploy-php-files-both.py <relative-path> [more...]", file=sys.stderr)
        return 2
    rels = sys.argv[1:]
    # validar que existan localmente antes de conectar
    missing = [r for r in rels if not (PHP_DIR / r).exists()]
    if missing:
        print("[fatal] no existen:", missing, file=sys.stderr)
        return 2
    ftps = connect()
    total = ok = 0
    for base in BASES:
        print(f"--- {base} ---", flush=True)
        for rel in rels:
            local = PHP_DIR / rel
            remote = base + "/" + rel.replace("\\", "/")
            parent = "/".join(remote.split("/")[:-1])
            if parent:
                ensure_dir(ftps, parent)
            total += 1
            with open(local, "rb") as fh:
                ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
            ok += 1
            print(f"[ok]  {local.stat().st_size/1024:6.1f}KB  {remote}", flush=True)
    ftps.quit()
    print(f"[done] {ok}/{total} subidos a {len(BASES)} backends", flush=True)
    return 0 if ok == total else 1


if __name__ == "__main__":
    sys.exit(main())
