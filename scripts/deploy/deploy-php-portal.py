#!/usr/bin/env python
"""Sube php-backend/* a /festivaldanzarte.com/public_html/app-portal/php/ via FTPS."""
from __future__ import annotations
import io, json, os, sys, ftplib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

REMOTE_BASE = "/festivaldanzarte.com/public_html/app-portal/php"
PHP_DIR = ROOT_DIR / "php-backend"

SKIP_NAMES = {".gitkeep", ".gitignore", "README.md", "config.example.php", "stderr.log", "webhook-log.txt",
              "config.php", "_test_recibo.php", "_test-recibo.php"}  # config.php dev NO se sube (va config.prod.php)
SKIP_DIRS = {"rate-limit-data", "node_modules", ".git", "__pycache__", "vendor"}  # vendor ya está en prod
RENAME = {"config.prod.php": "config.php"}  # prod usa config.prod.php como config.php


def connect():
    print(f"[ftps] {CREDS['host']}:{CREDS['port']}", flush=True)
    ftps = ftplib.FTP_TLS(timeout=60)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p()
    ftps.set_pasv(True)
    print(f"[ftps] login ok", flush=True)
    return ftps


def ensure_dir(ftps, remote_path):
    parts = [p for p in remote_path.split("/") if p]
    cwd = "/"
    for p in parts:
        cwd = cwd.rstrip("/") + "/" + p
        try:
            ftps.cwd(cwd)
        except ftplib.error_perm:
            try:
                ftps.mkd(cwd)
                print(f"[mkdir] {cwd}", flush=True)
            except ftplib.error_perm as e:
                print(f"[mkdir-fail] {cwd} :: {e}", flush=True)


def upload_file(ftps, local, remote):
    parent = "/".join(remote.split("/")[:-1])
    if parent:
        ensure_dir(ftps, parent)
    size = local.stat().st_size
    sz = f"{size/1024:.1f} KB" if size < 1024 * 1024 else f"{size/(1024*1024):.1f} MB"
    with open(local, "rb") as f:
        try:
            ftps.storbinary(f"STOR {remote}", f, blocksize=64 * 1024)
            print(f"[ok]  {sz:>10}  {remote}", flush=True)
        except ftplib.error_perm as e:
            print(f"[ERR] {remote} :: {e}", flush=True)


def upload_tree(ftps, local_dir, remote_dir):
    n = 0
    for root, dirs, files in os.walk(local_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = Path(root).relative_to(local_dir)
        for fname in files:
            if fname in SKIP_NAMES:
                continue
            remote_name = RENAME.get(fname, fname)
            rel = (rel_root / remote_name).as_posix()
            remote = remote_dir.rstrip("/") + "/" + rel
            upload_file(ftps, Path(root) / fname, remote)
            n += 1
    return n


def main():
    if not PHP_DIR.exists():
        print(f"[fatal] {PHP_DIR} no existe.", flush=True)
        return 2

    ftps = connect()
    ensure_dir(ftps, REMOTE_BASE)
    print(f"[upload] {PHP_DIR} -> {REMOTE_BASE}", flush=True)
    n = upload_tree(ftps, PHP_DIR, REMOTE_BASE)
    print(f"[done] {n} archivos subidos.", flush=True)
    ftps.quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
