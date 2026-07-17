#!/usr/bin/env python
"""Sube los PHP de kardex (rotar/foto/editar/verificar/eliminar + _lib/auth)
a AMBAS bases de produccion:
  - /festivaldanzarte.com/public_html/portal/api        (web SPA)
  - /festivaldanzarte.com/public_html/app-portal/php     (mobile Capacitor)

NO toca config.php. Correr por PowerShell (MSYS mangla rutas /...).
Uso: python scripts/deploy/deploy-kardex-perms.py
"""
from __future__ import annotations
import io, json, sys, ftplib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

PHP_DIR = ROOT_DIR / "php-backend"
BASES = [
    "/festivaldanzarte.com/public_html/portal/api",
    "/festivaldanzarte.com/public_html/app-portal/php",
]
FILES = [
    "kardex-rotar-foto.php",   # rotacion + dispara regenCredencial()
    "kardex-foto.php",
    "kardex-editar.php",
    "kardex-verificar.php",
    "kardex-eliminar.php",
    "impersonar.php",          # supervision super admin (entrar/salir) — faltaba en prod
    "agrupacion-cerrar.php",   # marcar COMPLETADO / reabrir (estado libre) — scope multi-agrupacion
    "search-participants.php", # busqueda supervision: tambien por agrupacion
    "supervisar-directorio.php",  # directorio con roles/dia para el modal supervisar (super admin)
    "inscripciones.php",       # + saldo_pago/estado_pago por fila (chip habilitado/pendiente)
    "me.php",                  # devuelve es_super_admin → gatea la UI de supervision (faltaba)
    "login.php",               # sesion + user_data para el gate super admin
    "_lib/auth.php",           # sesionEsAdmin() + bypass supervision
    "_lib/context.php",        # resolveUserAgrupaciones (strval keys) — fix 403 agrupaciones num.
    "_lib/regen.php",          # regenCredencial() -> webhook n8n
    "_lib/supabase.php",       # require helpers.php (fix uuidv4 en subir/rotar foto)
]
# config.prod.php se sube como config.php (trae el webhook regen_credencial).
RENAME = {"config.prod.php": "config.php"}
FILES_RENAMED = ["config.prod.php"]


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
            try:
                ftps.mkd(cwd)
            except ftplib.error_perm:
                pass


def main():
    all_rel = list(FILES) + list(FILES_RENAMED)
    missing = [rel for rel in all_rel if not (PHP_DIR / rel).exists()]
    if missing:
        print(f"[fatal] faltan: {missing}", flush=True)
        return 2
    ftps = connect()
    ok = 0
    # config.php (FILES_RENAMED) SOLO a la primera base (web /portal/api): el
    # /app-portal/php mobile puede tener config propia y no se debe pisar.
    total = len(FILES) * len(BASES) + len(FILES_RENAMED)
    for i, base in enumerate(BASES):
        # solo sube a la base si su carpeta raiz existe (evita crear /app-portal si no aplica)
        try:
            ftps.cwd(base)
        except ftplib.error_perm:
            print(f"[skip-base] {base} no existe en prod", flush=True)
            total -= len(FILES) + (len(FILES_RENAMED) if i == 0 else 0)
            continue
        rels = list(FILES) + (list(FILES_RENAMED) if i == 0 else [])
        for rel in rels:
            local = PHP_DIR / rel
            remote_rel = RENAME.get(rel, rel)
            remote = base + "/" + remote_rel.replace("\\", "/")
            parent = "/".join(remote.split("/")[:-1])
            if parent:
                ensure_dir(ftps, parent)
            with open(local, "rb") as fh:
                ftps.storbinary(f"STOR {remote}", fh, blocksize=64 * 1024)
            print(f"[ok]  {local.stat().st_size/1024:6.1f}KB  {remote}", flush=True)
            ok += 1
    ftps.quit()
    print(f"[done] {ok}/{total} archivos subidos", flush=True)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
