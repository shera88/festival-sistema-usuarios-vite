#!/usr/bin/env python
"""Sube SOLO el frontend (dist/) a /portal/ vía FTPS. NO toca /portal/api (php).
Útil cuando solo cambió el frontend y hay cambios PHP locales que NO se deben
desplegar. Sin rename/backup: sube index.html + bundles nuevos (skip same-size);
los bundles viejos quedan huérfanos (inofensivos, index.html revalida por htaccess).

Uso: python scripts/deploy/deploy-portal-dist.py   (build antes: vite build --base=/portal/)
Correr por PowerShell (MSYS mangla rutas /...).
"""
from __future__ import annotations
import io, json, os, sys, ftplib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

PORTAL = "/festivaldanzarte.com/public_html/portal"
DIST = ROOT_DIR / "dist"


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
    if not DIST.exists():
        print(f"[fatal] {DIST} no existe. Corre: npx vite build --base=/portal/", flush=True)
        return 2
    ftps = connect()
    n = skipped = 0
    for root, dirs, files in os.walk(DIST):
        rel_root = Path(root).relative_to(DIST)
        for fname in files:
            local = Path(root) / fname
            rel = (rel_root / fname).as_posix()
            remote = PORTAL + "/" + rel
            size = local.stat().st_size
            try:
                if ftps.size(remote) == size:
                    skipped += 1
                    continue
            except (ftplib.error_perm, ftplib.error_temp):
                pass
            ensure_dir(ftps, "/".join(remote.split("/")[:-1]))
            with open(local, "rb") as fh:
                ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
            n += 1
            print(f"[ok]  {size/1024:7.1f}KB  {rel}", flush=True)
    ftps.quit()
    print(f"[done] {n} subidos, {skipped} sin cambio -> {PORTAL}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
