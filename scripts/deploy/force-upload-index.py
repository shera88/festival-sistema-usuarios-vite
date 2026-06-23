#!/usr/bin/env python
"""Force-upload dist/index.html y dist/assets/*.js a /portal/ sin skip."""
import ftplib, io, json, os
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
with open(ROOT / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    c = json.load(f)

REMOTE_DIR = "/festivaldanzarte.com/public_html/portal"
DIST = ROOT / "dist"

ftps = ftplib.FTP_TLS(timeout=60)
ftps.connect(c["host"], c["port"])
ftps.login(c["user"], c["password"])
ftps.prot_p()
ftps.set_pasv(True)

# Upload index.html
print("[force] index.html")
with open(DIST / "index.html", "rb") as f:
    ftps.storbinary(f"STOR {REMOTE_DIR}/index.html", f)

# Upload all bundles fresh
for root, dirs, files in os.walk(DIST):
    for fname in files:
        local = Path(root) / fname
        rel = local.relative_to(DIST).as_posix()
        remote = f"{REMOTE_DIR}/{rel}"
        # Ensure parent dir
        parent = "/".join(remote.split("/")[:-1])
        try:
            ftps.cwd(parent)
        except ftplib.error_perm:
            parts = [p for p in parent.split("/") if p]
            cwd = ""
            for p in parts:
                cwd = cwd + "/" + p
                try:
                    ftps.cwd(cwd)
                except ftplib.error_perm:
                    try:
                        ftps.mkd(cwd)
                    except Exception:
                        pass
        with open(local, "rb") as fh:
            try:
                ftps.storbinary(f"STOR {remote}", fh, blocksize=64*1024)
                print(f"[ok] {rel}")
            except Exception as e:
                print(f"[FAIL] {rel} :: {e}")

ftps.quit()
print("[done]")
