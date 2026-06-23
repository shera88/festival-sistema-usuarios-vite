"""
Actualiza la lista de admins WhatsApp en ambos workflows n8n.

WF1 (W4B9IPH6RHbG8ffT) — Notificación pago nuevo: nodo "Loop por admin" fan-out
WF2 (JFvN1ByShgodQqIO) — Respuesta admin: nodo "Valida admin autorizado" validación

Edita ADMINS_CSV abajo y corré: python docs/update_admin_list.py
"""
import json, urllib.request

ADMINS_CSV = "59175571497,59172116494,59169485185"

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]

WF1_ID = "W4B9IPH6RHbG8ffT"
WF2_ID = "JFvN1ByShgodQqIO"

ALLOWED_KEYS = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS_KEYS = {"executionOrder", "saveManualExecutions", "callerPolicy", "errorWorkflow", "saveDataErrorExecution", "saveDataSuccessExecution", "saveExecutionProgress", "timezone"}
NODE_ALLOWED = {"parameters", "id", "name", "type", "typeVersion", "position", "credentials", "disabled", "notes", "notesInFlow", "executeOnce", "alwaysOutputData", "retryOnFail", "continueOnFail", "onError", "maxTries", "waitBetweenTries", "webhookId"}


def n8n(method, path, body=None):
    url = f"{BASE}/api/v1{path}"
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-N8N-API-KEY", KEY)
    req.add_header("Accept", "application/json")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def sanitize(wf):
    out = {k: wf[k] for k in ALLOWED_KEYS if k in wf}
    raw = wf.get("settings", {}) or {}
    out["settings"] = {k: v for k, v in raw.items() if k in ALLOWED_SETTINGS_KEYS}
    if "nodes" in out:
        out["nodes"] = [{k: v for k, v in n.items() if k in NODE_ALLOWED} for n in out["nodes"]]
    return out


def update_wf1():
    wf = n8n("GET", f"/workflows/{WF1_ID}")
    for node in wf["nodes"]:
        if node["name"] == "Loop por admin":
            node["parameters"]["functionCode"] = (
                "const body = $items('Webhook PHP (pago nuevo)')[0].json.body || $items('Webhook PHP (pago nuevo)')[0].json;\n"
                f"const adminsCsv = '{ADMINS_CSV}';\n"
                "const admins = adminsCsv.split(',').map(s => s.trim()).filter(Boolean);\n"
                "return admins.map(phone => {\n"
                "  const to = phone.startsWith('+') ? phone : '+' + phone;\n"
                "  return { json: { to, pago: body } };\n"
                "});"
            )
            print(f"WF1 Loop por admin actualizado: {ADMINS_CSV}")
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF1_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF1_ID}", payload)
    n8n("POST", f"/workflows/{WF1_ID}/activate")


def update_wf2():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    for node in wf["nodes"]:
        if node["name"] == "Valida admin autorizado":
            node["parameters"]["functionCode"] = (
                f"const adminsCsv = '{ADMINS_CSV}';\n"
                "const admins = adminsCsv.split(',').map(s => s.trim().replace(/^\\+/, '')).filter(Boolean);\n"
                "const sender = ($items('Parse button reply')[0].json.senderPhone || '').replace(/^\\+/, '');\n"
                "const autorizado = admins.includes(sender);\n"
                "return [{ json: { ...$items('Parse button reply')[0].json, autorizado } }];"
            )
            print(f"WF2 Valida admin autorizado actualizado: {ADMINS_CSV}")
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")


def main():
    update_wf1()
    update_wf2()
    print("OK — ambos workflows reactivados")


if __name__ == "__main__":
    main()
