#!/usr/bin/env python
"""Sube kardex-listar.php arreglado a /portal/api (backend prod) con backup previo.
Correr por PowerShell. NO toca config.php."""
from __future__ import annotations
import io, json, sys, ftplib
from pathlib import Path
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)
REMOTE_BASE = "/festivaldanzarte.com/public_html/portal/api"
PHP_DIR = ROOT / "php-backend"
BACKUP_DIR = ROOT / "_prod_backup_portalapi_2026-07-17"
FILES = ["kardex-listar.php"]

def connect():
    ftps = ftplib.FTP_TLS(timeout=120)
    ftps.connect(CREDS["host"], CREDS["port"]); ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p(); ftps.set_pasv(True); print("[ftps] login ok", flush=True); return ftps

def main():
    ftps = connect()
    for rel in FILES:
        local = PHP_DIR / rel
        if not local.exists(): print(f"[fatal] falta {rel}"); return 2
        remote = REMOTE_BASE + "/" + rel
        b = BACKUP_DIR / rel; b.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(b, "wb") as bf: ftps.retrbinary(f"RETR {remote}", bf.write)
            print(f"[backup] {rel}", flush=True)
        except Exception: print(f"[backup-none] {rel}", flush=True)
        with open(local, "rb") as fh: ftps.storbinary(f"STOR {remote}", fh, blocksize=64*1024)
        print(f"[ok] {local.stat().st_size/1024:.1f}KB {rel}", flush=True)
    ftps.quit(); print(f"[done] -> {REMOTE_BASE}", flush=True); return 0

if __name__ == "__main__":
    sys.exit(main())
