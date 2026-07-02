#!/usr/bin/env python
"""Sube el QR de pago de CREDENCIALES a Supabase Storage (uploads-2026/templates).
El QR de inscripción (qr-inscripcion.png) NO se toca. Correr por PowerShell.
"""
from __future__ import annotations
import json, sys, urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
CRED = json.load(open(r"C:/Claude/festival-danzarte-repo/all-credentials.json", encoding="utf-8"))["supabase"]
URL = CRED["url"].rstrip("/")
KEY = CRED["service_role_key"]
SRC = r"C:/Claude/festival-danzarte-repo/QR CREDENCIALES.png"
DEST = "uploads-2026/templates/qr-credenciales.png"


def main():
    with open(SRC, "rb") as f:
        data = f.read()
    endpoint = f"{URL}/storage/v1/object/{DEST}"
    req = urllib.request.Request(endpoint, data=data, method="POST", headers={
        "Authorization": "Bearer " + KEY,
        "apikey": KEY,
        "Content-Type": "image/png",
        "x-upsert": "true",
        "Cache-Control": "public, max-age=3600",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            print(f"[ok] HTTP {r.status} -> {DEST} ({len(data)/1024:.0f} KB)")
    except urllib.error.HTTPError as e:
        print(f"[fail] HTTP {e.code}: {e.read().decode('utf-8', 'replace')[:300]}")
        return 1
    print(f"[url] {URL}/storage/v1/object/public/{DEST}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
