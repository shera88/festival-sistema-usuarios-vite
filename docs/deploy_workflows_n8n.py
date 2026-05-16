"""
Crea/actualiza los workflows del Festival Danzarte en la instancia n8n.
Ejecutar: python deploy_workflows_n8n.py
"""
import json, sys, urllib.request, urllib.error
from pathlib import Path

HERE = Path(__file__).parent
CRED_FILE = Path(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json")
CRED = json.load(open(CRED_FILE, encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]

WORKFLOWS = [
    HERE / "n8n-pago-revision-workflow.json",
    HERE / "n8n-respuesta-admin-workflow.json",
]

ALLOWED_KEYS = {"name", "nodes", "connections", "settings", "staticData"}


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
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:1500]
        print(f"HTTP {e.code} {url}\n{msg}")
        raise


def sanitize(wf):
    """Filtra solo campos aceptados por POST /workflows."""
    out = {}
    for k in ALLOWED_KEYS:
        if k in wf:
            out[k] = wf[k]
    if "settings" not in out:
        out["settings"] = {}
    return out


def find_existing_by_name(name):
    res = n8n("GET", f"/workflows?limit=100")
    items = res.get("data", res) if isinstance(res, dict) else res
    for wf in items:
        if wf.get("name") == name:
            return wf
    return None


def create_or_update(file_path):
    wf_raw = json.load(open(file_path, encoding="utf-8"))
    name = wf_raw.get("name")
    print(f"\n>>> {name}")
    payload = sanitize(wf_raw)

    existing = find_existing_by_name(name)
    if existing:
        wf_id = existing["id"]
        print(f"  existe (id={wf_id}) → actualizando")
        try:
            updated = n8n("PUT", f"/workflows/{wf_id}", payload)
        except urllib.error.HTTPError:
            # Algunos n8n require activar/desactivar antes
            n8n("POST", f"/workflows/{wf_id}/deactivate")
            updated = n8n("PUT", f"/workflows/{wf_id}", payload)
        print(f"  OK actualizado id={updated.get('id')}")
        return updated
    else:
        print("  no existe → creando")
        created = n8n("POST", "/workflows", payload)
        print(f"  OK creado id={created.get('id')}")
        return created


def main():
    print(f"n8n base: {BASE}")
    results = []
    for f in WORKFLOWS:
        if not f.exists():
            print(f"  ERROR: no existe {f}", file=sys.stderr)
            continue
        wf = create_or_update(f)
        results.append({"name": wf.get("name"), "id": wf.get("id"), "active": wf.get("active")})

    print("\n=== RESUMEN ===")
    for r in results:
        print(f"  {r['name']:55s}  id={r['id']:6}  active={r['active']}")
    print(
        f"\nWebhooks producidos:\n"
        f"  POST {BASE}/webhook/pago-revision\n"
        f"  POST {BASE}/webhook/ycloud-inbound\n"
    )


if __name__ == "__main__":
    main()
