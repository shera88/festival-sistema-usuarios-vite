#!/usr/bin/env python
"""One-off: sube los php-backend cambiados (WIP + fixes) a /portal/api vía FTPS.
NO toca config.php. Correr por PowerShell.
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
    "_lib/context.php", "_lib/promo.php", "_lib/session.php",
    "agrupacion-cerrar.php", "impersonar.php", "inscripciones.php",
    "kardex-editar.php", "kardex-eliminar.php", "kardex-foto.php",
    "kardex-regenerar-credencial.php", "kardex-rotar-foto.php",
    "kardex-verificar.php", "kardex.php", "membresia-checkout.php",
    "search-participants.php", "supervisar-directorio.php", "videos.php",
]


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
    ftps = connect()
    ok = 0
    for rel in FILES:
        local = PHP_DIR / rel
        if not local.exists():
            print(f"[skip] no existe local: {rel}", flush=True)
            continue
        remote = REMOTE_BASE + "/" + rel
        ensure_dir(ftps, "/".join(remote.split("/")[:-1]))
        with open(local, "rb") as fh:
            ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
        ok += 1
        print(f"[ok] {local.stat().st_size/1024:7.1f}KB  {rel}", flush=True)
    ftps.quit()
    print(f"[done] {ok}/{len(FILES)} -> https://festivaldanzarte.com/portal/api/", flush=True)
    return 0 if ok == len(FILES) else 1


if __name__ == "__main__":
    sys.exit(main())
