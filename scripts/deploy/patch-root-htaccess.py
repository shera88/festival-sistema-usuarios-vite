#!/usr/bin/env python
"""
Inserta/actualiza redirect /login -> /portal/login en root .htaccess.
Usa 302 + no-cache para evitar cacheo agresivo por browsers.
Idempotent.
"""
import ftplib, io, json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    c = json.load(f)

REMOTE = "/festivaldanzarte.com/public_html/.htaccess"

REDIRECT_BLOCK_NEW = """\
# === Redirect /login -> /portal/login (portal users) ===
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteRule ^login/?$ /portal/login [R=302,L]
</IfModule>
<IfModule mod_headers.c>
  # Evita que el redirect quede cacheado en browsers/CDN
  <FilesMatch "^login$">
    Header always set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
    Header always set Pragma "no-cache"
  </FilesMatch>
</IfModule>
# === /Redirect ===

"""

OLD_MARKER = "# === Redirect /login -> /portal/login (portal users) ==="
END_MARKER = "# === /Redirect ===\n"

ftps = ftplib.FTP_TLS(timeout=60)
ftps.connect(c["host"], c["port"])
ftps.login(c["user"], c["password"])
ftps.prot_p()
ftps.set_pasv(True)

buf = io.BytesIO()
ftps.retrbinary(f"RETR {REMOTE}", buf.write)
current = buf.getvalue().decode("utf-8", errors="replace")

# Strip previous block if present
if OLD_MARKER in current:
    start = current.index(OLD_MARKER)
    end = current.index(END_MARKER, start) + len(END_MARKER)
    # Also strip trailing blank line(s)
    while end < len(current) and current[end] == "\n":
        end += 1
    current = current[:start] + current[end:]
    print("[strip] bloque previo removido")

new_content = REDIRECT_BLOCK_NEW + current
ftps.storbinary(f"STOR {REMOTE}", io.BytesIO(new_content.encode("utf-8")))
print(f"[ok] root .htaccess actualizado ({len(new_content)} bytes)")

ftps.quit()
