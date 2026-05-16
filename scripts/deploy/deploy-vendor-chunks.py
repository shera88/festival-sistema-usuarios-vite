#!/usr/bin/env python
"""Upload vendor/ in small chunks, reconnecting between batches.

SiteGround drops the FTPS session after ~minutes of activity. We commit chunks
of 50 files and reconnect to avoid hitting that ceiling.
"""
from __future__ import annotations
import io, json, os, sys, ftplib, time
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

REMOTE_BASE = "/festivaldanzarte.com/public_html/app-portal/php"
VENDOR_DIR = ROOT_DIR / "php-backend" / "vendor"
CHUNK = 60
SKIP_NAMES = {".gitkeep", ".gitignore"}


def connect():
    ftps = ftplib.FTP_TLS(timeout=90)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p()
    ftps.set_pasv(True)
    return ftps


def ensure_dir(ftps, remote_path, _cache):
    if remote_path in _cache:
        return
    parts = [p for p in remote_path.split("/") if p]
    cwd = "/"
    for p in parts:
        cwd = cwd.rstrip("/") + "/" + p
        if cwd in _cache:
            continue
        try:
            ftps.cwd(cwd)
        except ftplib.error_perm:
            try:
                ftps.mkd(cwd)
            except ftplib.error_perm:
                pass
        _cache.add(cwd)
    _cache.add(remote_path)


def file_size_remote(ftps, remote):
    try:
        return ftps.size(remote)
    except Exception:
        return None


def main():
    files = []
    for root, dirs, fnames in os.walk(VENDOR_DIR):
        for f in fnames:
            if f in SKIP_NAMES:
                continue
            local = Path(root) / f
            rel = local.relative_to(VENDOR_DIR.parent).as_posix()  # vendor/...
            remote = REMOTE_BASE + "/" + rel
            files.append((local, remote, local.stat().st_size))

    print(f"[plan] {len(files)} archivos en vendor/", flush=True)

    ftps = connect()
    dir_cache = set()
    uploaded = 0
    skipped = 0
    started = time.time()

    for i, (local, remote, size) in enumerate(files, 1):
        # Reconectar cada CHUNK archivos
        if i % CHUNK == 1 and i > 1:
            try:
                ftps.quit()
            except Exception:
                pass
            ftps = connect()
            dir_cache = set()

        parent = "/".join(remote.split("/")[:-1])
        ensure_dir(ftps, parent, dir_cache)

        # Skip si tamaño remoto = tamaño local
        remote_size = file_size_remote(ftps, remote)
        if remote_size is not None and remote_size == size:
            skipped += 1
            continue

        try:
            with open(local, "rb") as f:
                ftps.storbinary(f"STOR {remote}", f, blocksize=64 * 1024)
            uploaded += 1
            if uploaded % 20 == 0:
                elapsed = time.time() - started
                print(f"[prog] uploaded={uploaded} skipped={skipped} of {len(files)} ({elapsed:.0f}s)", flush=True)
        except Exception as e:
            print(f"[ERR] {remote} :: {e}", flush=True)
            try:
                ftps.quit()
            except Exception:
                pass
            ftps = connect()
            dir_cache = set()
            try:
                with open(local, "rb") as f:
                    ftps.storbinary(f"STOR {remote}", f, blocksize=64 * 1024)
                uploaded += 1
            except Exception as e2:
                print(f"[ERR2] {remote} :: {e2}", flush=True)

    try:
        ftps.quit()
    except Exception:
        pass
    print(f"[done] uploaded={uploaded} skipped={skipped} total={len(files)}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
