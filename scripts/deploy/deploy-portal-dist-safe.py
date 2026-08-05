#!/usr/bin/env python
"""Deploy SEGURO del frontend del portal (dist/) a /portal/ vía FTPS, SIN ventana
de 404 con el festival en vivo.

Clave: sube PRIMERO todos los bundles (assets/*, favicon), skip same-size, y
RECIÉN AL FINAL el index.html (forzado). Así el index nuevo —que referencia los
bundles con hash nuevo— solo aparece cuando esos bundles YA están arriba. Los
bundles viejos quedan huérfanos (inofensivos). NO toca /portal/api (PHP) ni
.htaccess (dist no lo trae).

Correr por PowerShell:
  python scripts/deploy/deploy-portal-dist-safe.py
"""
from __future__ import annotations
import io, json, os, sys, ftplib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

PORTAL = "/festivaldanzarte.com/public_html/portal"
DIST = ROOT / "dist"


def connect():
    ftps = ftplib.FTP_TLS(timeout=120)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p(); ftps.set_pasv(True)
    print("[ftps] login ok", flush=True)
    return ftps


def ensure_dir(ftps, remote_dir):
    cwd = ""
    for p in [x for x in remote_dir.split("/") if x]:
        cwd = cwd + "/" + p
        try:
            ftps.cwd(cwd)
        except ftplib.error_perm:
            try: ftps.mkd(cwd)
            except ftplib.error_perm: pass


def put(ftps, local, rel, force=False):
    remote = PORTAL + "/" + rel
    size = local.stat().st_size
    if not force:
        try:
            if ftps.size(remote) == size:
                return False
        except (ftplib.error_perm, ftplib.error_temp):
            pass
    ensure_dir(ftps, "/".join(remote.split("/")[:-1]))
    with open(local, "rb") as fh:
        ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
    print(f"[ok]  {size/1024:8.1f}KB  {rel}", flush=True)
    return True


def main():
    if not DIST.exists():
        print(f"[fatal] {DIST} no existe. Corré: npm run build", flush=True)
        return 2
    if not (DIST / "index.html").exists():
        print("[fatal] dist/index.html no existe", flush=True)
        return 2

    # Todos los archivos menos el index.html de la raíz (ese va al final).
    resto, index_local = [], None
    for root, _dirs, files in os.walk(DIST):
        for fname in files:
            local = Path(root) / fname
            rel = local.relative_to(DIST).as_posix()
            if rel == "index.html":
                index_local = local
            elif rel == ".htaccess":
                continue  # nunca tocar el routing de prod
            else:
                resto.append((local, rel))

    ftps = connect()
    n = skip = 0
    # 1) Bundles + assets PRIMERO (skip same-size).
    for local, rel in sorted(resto, key=lambda x: x[1]):
        if put(ftps, local, rel):
            n += 1
        else:
            skip += 1
    # 2) index.html AL FINAL, forzado (garantiza que apunte a los bundles ya subidos).
    put(ftps, index_local, "index.html", force=True)
    print(f"[force] index.html  <-- al final", flush=True)
    ftps.quit()
    print(f"[done] {n} subidos, {skip} sin cambio + index -> {PORTAL}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
