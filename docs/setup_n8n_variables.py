"""
Crea/actualiza las variables del Festival Danzarte en n8n.
Ejecutar: python setup_n8n_variables.py
"""
import json, urllib.request, urllib.error
from pathlib import Path

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]

# Secret compartido PHP ↔ n8n
WEBHOOK_SHARED_SECRET = "dba176baa6127feca1657aa99e0c2f358408c715c1a5fa43d202d4aa5c55674e"

SUPABASE_SERVICE_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc3NjcyNTcwMCwiZXhwIjo0OTMyMzk5MzAwLCJyb2xlIjoic2VydmljZV9yb2xlIn0.l3QcebgXlSMsZ4krkM9cdGlBXnWxBtptwyH97xmnPuI"

VARS = {
    "YCLOUD_API_KEY": "2a98d6fcfacb400f9dbe625b50d21fc8",
    "YCLOUD_FROM": "+59162180085",
    "WA_ADMINS": "59175571497",
    "SUPABASE_SERVICE_KEY": SUPABASE_SERVICE_KEY,
    "WEBHOOK_SHARED_SECRET": WEBHOOK_SHARED_SECRET,
    "PHP_INTERNAL_SECRET": "",  # opcional, se configurará cuando el endpoint recibo-generar.php lo soporte
}


def n8n(method, path, body=None):
    url = f"{BASE}/api/v1{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-N8N-API-KEY", KEY)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            txt = r.read().decode("utf-8")
            return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:1000]
        print(f"  HTTP {e.code}: {msg}")
        return None


def list_vars():
    res = n8n("GET", "/variables")
    if not res:
        return []
    return res.get("data", res) if isinstance(res, dict) else res


def upsert_var(key, value):
    existing = list_vars()
    found = next((v for v in existing if v.get("key") == key), None)
    payload = {"key": key, "value": value, "type": "string"}
    if found:
        vid = found["id"]
        print(f"  {key}: existe → actualizando")
        return n8n("PUT", f"/variables/{vid}", payload)
    print(f"  {key}: creando")
    return n8n("POST", "/variables", payload)


def main():
    print(f"n8n: {BASE}")
    for k, v in VARS.items():
        if not v:
            print(f"  {k}: vacío, skip")
            continue
        upsert_var(k, v)

    print("\n=== Variables actuales ===")
    for v in list_vars():
        masked = v.get("value", "")
        if len(masked) > 24:
            masked = masked[:8] + "..." + masked[-4:]
        print(f"  {v.get('key'):28s} = {masked}")


if __name__ == "__main__":
    main()
