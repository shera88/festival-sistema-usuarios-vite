#!/usr/bin/env python
"""Sube .htaccess fix a /portal/api/ (reemplaza <DirectoryMatch> con RewriteRule)."""
import ftplib, io, json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    c = json.load(f)

BODY = b"""# Bloquea acceso directo a config + dirs sensibles
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

ftps = ftplib.FTP_TLS(timeout=60)
ftps.connect(c["host"], c["port"])
ftps.login(c["user"], c["password"])
ftps.prot_p()
ftps.set_pasv(True)
ftps.storbinary("STOR /festivaldanzarte.com/public_html/portal/api/.htaccess", io.BytesIO(BODY))
print(f"uploaded {len(BODY)} bytes")
ftps.quit()
