#!/usr/bin/env python
"""Upload single PHP file (or small list) to SiteGround via FTPS.

Usage: python deploy-php-file.py recibo-generar.php [_lib/recibo.php ...]

Paths are relative to php-backend/.
"""
from __future__ import annotations
import io, json, sys, ftplib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

REMOTE_BASE = "/festivaldanzarte.com/public_html/app-portal/php"
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


def upload_file(ftps, local, remote):
    parent = "/".join(remote.split("/")[:-1])
    if parent:
        ensure_dir(ftps, parent)
    size = local.stat().st_size
    sz = f"{size/1024:.1f} KB"
    with open(local, "rb") as f:
        ftps.storbinary(f"STOR {remote}", f, blocksize=64 * 1024)
        print(f"[ok]  {sz:>10}  {remote}", flush=True)


def main():
    if len(sys.argv) < 2:
        print("Usage: deploy-php-file.py <relative-path> [more...]", file=sys.stderr)
        return 2
    ftps = connect()
    for rel in sys.argv[1:]:
        local = PHP_DIR / rel
        if not local.exists():
            print(f"[skip] {local} no existe", flush=True)
            continue
        remote = REMOTE_BASE + "/" + rel.replace("\\", "/")
        upload_file(ftps, local, remote)
    ftps.quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
