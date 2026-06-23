#!/usr/bin/env python
"""
Deploy completo a /festivaldanzarte.com/public_html/portal/.

Pasos:
 1. Rename /portal -> /portal-backup-YYYY-MM-DD (backup atomic)
 2. mkdir /portal
 3. Upload dist/* -> /portal/
 4. Upload php-backend/* -> /portal/api/  (config.prod.php se sube como config.php)
 5. Upload .htaccess SPA-fallback en /portal/

Uso:
    python scripts/deploy/deploy-portal-full.py
    python scripts/deploy/deploy-portal-full.py --no-backup  # si /portal ya está vacío
"""
from __future__ import annotations
import argparse, datetime as dt, ftplib, io, json, os, sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

REMOTE_ROOT = "/festivaldanzarte.com/public_html"
PORTAL = f"{REMOTE_ROOT}/portal"
TODAY = dt.date.today().isoformat()
BACKUP = f"{REMOTE_ROOT}/portal-backup-{TODAY}"

DIST = ROOT_DIR / "dist"
PHP_DIR = ROOT_DIR / "php-backend"

SKIP_NAMES = {
    ".gitkeep", ".gitignore", "README.md", "config.example.php",
    "stderr.log", "webhook-log.txt", "config.php",  # config.php local NO se sube tal cual
}
SKIP_DIRS = {"rate-limit-data", "node_modules", ".git", "__pycache__"}


def connect() -> ftplib.FTP_TLS:
    print(f"[ftps] connecting {CREDS['host']}:{CREDS['port']}", flush=True)
    ftps = ftplib.FTP_TLS(timeout=60)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p()
    ftps.set_pasv(True)
    print(f"[ftps] login ok", flush=True)
    return ftps


def exists(ftps, remote_path: str) -> bool:
    try:
        ftps.cwd(remote_path)
        ftps.cwd("/")
        return True
    except ftplib.error_perm:
        return False


def mkdir(ftps, remote_path: str) -> None:
    parts = [p for p in remote_path.split("/") if p]
    cwd = ""
    for p in parts:
        cwd = cwd + "/" + p
        try:
            ftps.cwd(cwd)
        except ftplib.error_perm:
            try:
                ftps.mkd(cwd)
                print(f"[mkdir] {cwd}", flush=True)
            except ftplib.error_perm as e:
                print(f"[mkdir-fail] {cwd} :: {e}", flush=True)
    ftps.cwd("/")


FATAL_ERRORS = (ftplib.error_temp, ftplib.error_perm, ConnectionResetError, EOFError, TimeoutError, OSError)


def reconnect(holder: dict) -> None:
    try:
        holder["ftps"].quit()
    except Exception:
        pass
    holder["ftps"] = connect()


def safe_size(holder: dict, remote: str) -> int | None:
    for attempt in range(3):
        try:
            return holder["ftps"].size(remote)
        except (ftplib.error_perm, ftplib.error_temp):
            return None
        except FATAL_ERRORS as e:
            print(f"[retry size {attempt+1}] {remote} :: {e}", flush=True)
            reconnect(holder)
    return None


def safe_mkdir(holder: dict, remote_path: str) -> None:
    for attempt in range(3):
        try:
            mkdir(holder["ftps"], remote_path)
            return
        except FATAL_ERRORS as e:
            print(f"[retry mkdir {attempt+1}] {remote_path} :: {e}", flush=True)
            reconnect(holder)


def upload_file(holder: dict, local: Path, remote: str, *, skip_if_same_size: bool = True) -> None:
    size = local.stat().st_size
    sz = f"{size/1024:.1f} KB" if size < 1024 * 1024 else f"{size/(1024*1024):.1f} MB"

    if skip_if_same_size:
        existing = safe_size(holder, remote)
        if existing == size:
            print(f"[skip] {sz:>10}  {remote}", flush=True)
            return

    parent = "/".join(remote.split("/")[:-1])
    if parent:
        safe_mkdir(holder, parent)

    for attempt in range(4):
        try:
            with open(local, "rb") as f:
                holder["ftps"].storbinary(f"STOR {remote}", f, blocksize=64 * 1024)
            print(f"[ok]  {sz:>10}  {remote}", flush=True)
            return
        except FATAL_ERRORS as e:
            print(f"[retry {attempt+1}] {remote} :: {e}", flush=True)
            reconnect(holder)
    print(f"[FAIL] {remote}", flush=True)


def upload_tree(holder, local_dir: Path, remote_dir: str, *, rename_map: dict[str, str] | None = None) -> int:
    rename_map = rename_map or {}
    n = 0
    for root, dirs, files in os.walk(local_dir):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = Path(root).relative_to(local_dir)
        for fname in files:
            if fname in SKIP_NAMES:
                continue
            remote_name = rename_map.get(fname, fname)
            rel = (rel_root / remote_name).as_posix()
            remote = remote_dir.rstrip("/") + "/" + rel
            upload_file(holder, Path(root) / fname, remote)
            n += 1
    return n


HTACCESS_PORTAL = """\
# SPA fallback: cualquier ruta no-archivo va a index.html
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /portal/
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_URI} !^/portal/api/
  RewriteRule . /portal/index.html [L]
</IfModule>

# Cache estaticos (1 ano)
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/webp "access plus 1 year"
</IfModule>

# index.html SIEMPRE revalidar (evita servir bundle viejo)
<FilesMatch "^index\\.html$">
  <IfModule mod_headers.c>
    Header set Cache-Control "no-cache, no-store, must-revalidate"
    Header set Pragma "no-cache"
    Header set Expires "0"
  </IfModule>
</FilesMatch>
"""

HTACCESS_API = """\
# Bloquea acceso directo a config + dirs sensibles
<Files "config.php">
  Require all denied
</Files>
<Files "config.prod.php">
  Require all denied
</Files>
<Files "config.example.php">
  Require all denied
</Files>
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^_lib/ - [F,L]
  RewriteRule ^_tools/ - [F,L]
  RewriteRule ^rate-limit-data/ - [F,L]
</IfModule>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-backup", action="store_true", help="No renombrar /portal antes de subir")
    args = ap.parse_args()

    if not DIST.exists():
        print(f"[fatal] {DIST} no existe. Corre `npx vite build --base=/portal/` primero", flush=True)
        return 2
    if not PHP_DIR.exists():
        print(f"[fatal] {PHP_DIR} no existe", flush=True)
        return 2
    if not (PHP_DIR / "config.prod.php").exists():
        print(f"[fatal] php-backend/config.prod.php no existe", flush=True)
        return 2

    holder = {"ftps": connect()}

    # Paso 1: backup
    if not args.no_backup:
        if exists(holder["ftps"], BACKUP):
            print(f"[fatal] {BACKUP} ya existe. Borralo manualmente o usa otro nombre.", flush=True)
            holder["ftps"].quit()
            return 3
        if exists(holder["ftps"], PORTAL):
            print(f"[backup] rename {PORTAL} -> {BACKUP}", flush=True)
            holder["ftps"].rename(PORTAL, BACKUP)
        else:
            print(f"[backup] {PORTAL} no existe, saltando", flush=True)

    # Paso 2: mkdir /portal
    mkdir(holder["ftps"], PORTAL)

    # Paso 3: upload dist/* -> /portal/
    print(f"[upload] dist -> {PORTAL}", flush=True)
    n1 = upload_tree(holder, DIST, PORTAL)

    # Paso 4: upload php-backend/* -> /portal/api/ (config.prod.php -> config.php remote)
    api_remote = f"{PORTAL}/api"
    print(f"[upload] php-backend -> {api_remote}", flush=True)
    n2 = upload_tree(holder, PHP_DIR, api_remote, rename_map={"config.prod.php": "config.php"})

    # Paso 5: .htaccess portal + api
    print("[write] .htaccess", flush=True)
    for path, body in [(f"{PORTAL}/.htaccess", HTACCESS_PORTAL), (f"{api_remote}/.htaccess", HTACCESS_API)]:
        for attempt in range(3):
            try:
                bio = io.BytesIO(body.encode("utf-8"))
                holder["ftps"].storbinary(f"STOR {path}", bio)
                print(f"[ok]  .htaccess  {path}", flush=True)
                break
            except (ftplib.error_temp, ftplib.error_perm, ConnectionResetError, EOFError, TimeoutError, OSError) as e:
                print(f"[retry .htaccess {attempt+1}] {path} :: {e}", flush=True)
                try:
                    holder["ftps"].quit()
                except Exception:
                    pass
                holder["ftps"] = connect()

    print(f"[done] frontend={n1} files, php={n2} files", flush=True)
    holder["ftps"].quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
