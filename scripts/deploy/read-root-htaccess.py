#!/usr/bin/env python
"""Descarga el .htaccess del root para inspeccionar antes de modificar."""
import ftplib, io, json
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    c = json.load(f)

ftps = ftplib.FTP_TLS(timeout=60)
ftps.connect(c["host"], c["port"])
ftps.login(c["user"], c["password"])
ftps.prot_p()
ftps.set_pasv(True)

buf = io.BytesIO()
try:
    ftps.retrbinary("RETR /festivaldanzarte.com/public_html/.htaccess", buf.write)
    content = buf.getvalue().decode("utf-8", errors="replace")
    print("=== ROOT .htaccess ===")
    print(content)
    # Save local backup
    backup_path = ROOT / "backups" / "root-htaccess-2026-05-23.txt"
    backup_path.parent.mkdir(exist_ok=True)
    backup_path.write_text(content, encoding="utf-8")
    print(f"\n[backup saved] {backup_path}")
except ftplib.error_perm as e:
    print(f"[no root .htaccess] {e}")

ftps.quit()
