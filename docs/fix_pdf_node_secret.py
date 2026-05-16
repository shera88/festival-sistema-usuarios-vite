"""
Set X-Webhook-Secret header on 'Generar recibo PDF' node so PHP recibo-generar.php
authenticates the n8n call (server-to-server). Keep onError=continueRegularOutput
so a transient failure does not break the ACK flow.
"""
import json, urllib.request

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]
WF2_ID = "JFvN1ByShgodQqIO"
SHARED_SECRET = "dba176baa6127feca1657aa99e0c2f358408c715c1a5fa43d202d4aa5c55674e"

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


def main():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    for node in wf["nodes"]:
        if node["name"] == "Generar recibo PDF":
            p = node["parameters"]
            p["url"] = "https://festivaldanzarte.com/app-portal/php/recibo-generar.php"
            p["headerParameters"] = {
                "parameters": [
                    {"name": "Content-Type", "value": "application/json"},
                    {"name": "X-Webhook-Secret", "value": SHARED_SECRET},
                ]
            }
            p["sendHeaders"] = True
            # JSON body, not keypair (PHP reads php://input)
            p["specifyBody"] = "json"
            p["jsonBody"] = '={{ JSON.stringify({ id_pago: $node["Parse button reply"].json.idPago }) }}'
            p.pop("bodyParameters", None)
            # Keep defensive: si la red falla, ACK sigue
            node["onError"] = "continueRegularOutput"
            # Add timeout sano
            p.setdefault("options", {})["timeout"] = 30000
            print("fixed: Generar recibo PDF")
            print(json.dumps(node, indent=2, ensure_ascii=False))
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print("OK")


if __name__ == "__main__":
    main()
