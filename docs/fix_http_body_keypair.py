"""
Convierte los HTTP nodes a especificar body con 'Using Fields Below' (keypair).
n8n serializa correctamente cada campo a JSON sin ambigüedad de templating.
"""
import json, urllib.request, urllib.error

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]
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


# Body parameters per nodo (formato keypair)
BODIES = {
    "Generar recibo PDF": [
        {"name": "id_pago", "value": '={{ $node["Parse button reply"].json.idPago }}'},
    ],
    "ACK al admin (confirmado)": [
        {"name": "from", "value": "+59162180085"},
        {"name": "to", "value": '=+{{ $node["Parse button reply"].json.senderPhone }}'},
        {"name": "type", "value": "text"},
        # Para 'text' que es un objeto anidado, usamos JSON expression
        {"name": "text", "value": '={{ { body: "✅ Pago " + $node["Parse button reply"].json.idPago + " marcado como VERIFICADO. Recibo PDF generado." } }}'},
    ],
    "ACK al admin (rechazado)": [
        {"name": "from", "value": "+59162180085"},
        {"name": "to", "value": '=+{{ $node["Parse button reply"].json.senderPhone }}'},
        {"name": "type", "value": "text"},
        {"name": "text", "value": '={{ { body: "❌ Pago " + $node["Parse button reply"].json.idPago + " marcado como RECHAZADO." } }}'},
    ],
    "Reject unauthorized": [
        {"name": "from", "value": "+59162180085"},
        {"name": "to", "value": '=+{{ $node["Valida admin autorizado"].json.senderPhone }}'},
        {"name": "type", "value": "text"},
        {"name": "text", "value": '={{ { body: "⚠️ Tu número no está autorizado para verificar pagos. Contacta al administrador principal." } }}'},
    ],
    "Supabase: marcar verificado": [
        {"name": "estado", "value": "verificado"},
        {"name": "verificado_en", "value": "={{ $now.toISO() }}"},
        {"name": "verificado_por", "value": '=WA:{{ $json.senderPhone }}'},
    ],
    "Supabase: marcar rechazado": [
        {"name": "estado", "value": "rechazado"},
        {"name": "verificado_en", "value": "={{ $now.toISO() }}"},
        {"name": "verificado_por", "value": '=WA:{{ $json.senderPhone }}'},
    ],
}


def main():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    for node in wf["nodes"]:
        name = node["name"]
        if name in BODIES:
            p = node["parameters"]
            # Switch body specification to 'Using Fields Below'
            p["specifyBody"] = "keypair"
            p["bodyParameters"] = {"parameters": BODIES[name]}
            # Drop jsonBody to avoid conflict
            p.pop("jsonBody", None)
            print(f"  fixed: {name}")
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print("OK")


if __name__ == "__main__":
    main()
