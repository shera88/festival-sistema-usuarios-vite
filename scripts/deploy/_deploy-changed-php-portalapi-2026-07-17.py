#!/usr/bin/env python
"""Sube los .php CAMBIADOS de esta tanda a /portal/api (backend REAL de prod),
con BACKUP previo de la version en vivo para poder revertir. NO toca config.php.
Correr por PowerShell. Uso: python scripts/deploy/_deploy-changed-php-portalapi-2026-07-17.py
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
BACKUP_DIR = ROOT_DIR / "_prod_backup_portalapi_2026-07-17"

FILES = [
    "_lib/context.php", "_lib/session.php", "_lib/promo.php",
    "agrupacion-cerrar.php", "impersonar.php", "inscripciones.php",
    "kardex.php", "kardex-editar.php", "kardex-eliminar.php", "kardex-foto.php",
    "kardex-rotar-foto.php", "kardex-verificar.php", "kardex-regenerar-credencial.php",
    "membresia-checkout.php", "search-participants.php", "videos.php",
    "supervisar-directorio.php",
]

assert "config.php" not in FILES  # nunca tocar config.php de prod


def connect():
    ftps = ftplib.FTP_TLS(timeout=120)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p(); ftps.set_pasv(True)
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
            try: ftps.mkd(cwd)
            except ftplib.error_perm: pass


def main():
    for rel in FILES:
        if not (PHP_DIR / rel).exists():
            print(f"[fatal] falta local {rel}", flush=True); return 2
    ftps = connect()
    backed = up = 0
    for rel in FILES:
        remote = REMOTE_BASE + "/" + rel
        # 1) backup de la version en vivo
        bpath = BACKUP_DIR / rel
        bpath.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(bpath, "wb") as bf:
                ftps.retrbinary(f"RETR {remote}", bf.write)
            backed += 1
            print(f"[backup] {rel}", flush=True)
        except (ftplib.error_perm, ftplib.error_temp):
            print(f"[backup-none] {rel} (no existia en prod)", flush=True)
            if bpath.exists() and bpath.stat().st_size == 0:
                bpath.unlink()
        # 2) subir el local
        parent = "/".join(remote.split("/")[:-1])
        ensure_dir(ftps, parent)
        with open(PHP_DIR / rel, "rb") as fh:
            ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
        up += 1
        print(f"[ok] {(PHP_DIR/rel).stat().st_size/1024:6.1f}KB  {rel}", flush=True)
    ftps.quit()
    print(f"[done] subidos={up}/{len(FILES)} backups={backed} -> {REMOTE_BASE}", flush=True)
    print(f"[backup-dir] {BACKUP_DIR}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
