#!/usr/bin/env python
"""Reemplaza /portal/.htaccess agregando no-cache a index.html."""
import ftplib, io, json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    c = json.load(f)

BODY = b"""# SPA fallback: cualquier ruta no-archivo va a index.html
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

ftps = ftplib.FTP_TLS(timeout=60)
ftps.connect(c["host"], c["port"])
ftps.login(c["user"], c["password"])
ftps.prot_p()
ftps.set_pasv(True)
ftps.storbinary("STOR /festivaldanzarte.com/public_html/portal/.htaccess", io.BytesIO(BODY))
print(f"uploaded {len(BODY)} bytes")
ftps.quit()
