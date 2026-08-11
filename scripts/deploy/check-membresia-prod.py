#!/usr/bin/env python
"""Descarga (SOLO LECTURA) los .php de membresía que hay HOY en producción para
compararlos con los locales antes de deployar el cambio de precio.

Rutas candidatas: /portal/api (backend REAL que usa el SPA) y /app-portal/php
(copia vieja). Correr por PowerShell. Uso:
    python scripts/deploy/check-membresia-prod.py
"""
from __future__ import annotations
import io, json, sys, ftplib, hashlib
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

HERE = Path(__file__).parent
ROOT_DIR = HERE.parent.parent
with open(ROOT_DIR / ".credentials" / "deploy-credentials.json", encoding="utf-8") as f:
    CREDS = json.load(f)

BASES = [
    "/festivaldanzarte.com/public_html/portal/api",
    "/festivaldanzarte.com/public_html/app-portal/php",
]
FILES = ["_lib/promo.php", "videos.php", "membresia-checkout.php"]
OUT = ROOT_DIR / "backups" / "prod-php-2026-08-10"
PHP_DIR = ROOT_DIR / "php-backend"


def main():
    ftps = ftplib.FTP_TLS(timeout=120)
    ftps.connect(CREDS["host"], CREDS["port"])
    ftps.login(CREDS["user"], CREDS["password"])
    ftps.prot_p()
    ftps.set_pasv(True)
    print("[ftps] login ok", flush=True)

    for base in BASES:
        print(f"\n=== {base} ===", flush=True)
        for rel in FILES:
            remote = base + "/" + rel
            buf = io.BytesIO()
            try:
                ftps.retrbinary(f"RETR {remote}", buf.write)
            except ftplib.error_perm as e:
                print(f"  [falta] {rel}  ({e})", flush=True)
                continue
            data = buf.getvalue()
            tag = base.strip("/").split("/")[-2] + "-" + base.strip("/").split("/")[-1]
            dest = OUT / tag / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)

            local = PHP_DIR / rel
            same = local.exists() and hashlib.md5(local.read_bytes()).hexdigest() == hashlib.md5(data).hexdigest()
            txt = data.decode("utf-8", "replace")
            marks = []
            if "promoMembresiaTodos" in txt:
                marks.append("llama/define promoMembresiaTodos")
            if "return true" in txt and rel.endswith("promo.php"):
                marks.append("PROMO=true (todos precio oferta)")
            if "return false" in txt and rel.endswith("promo.php"):
                marks.append("PROMO=false (precio completo a quien no reservo)")
            print(f"  [ok] {rel}  {len(data)/1024:.1f}KB  igual_al_local={same}  {'| '.join(marks)}", flush=True)

    ftps.quit()
    print(f"\n[done] copias guardadas en {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
