"""
Agrega forwarder al workflow Bandeja Inbox (YCloud → Supabase).
El forwarder hace POST al webhook /ycloud-inbound (workflow Respuesta Admin)
con el body original cuando es button reply con payload 'confirmar:*' o 'rechazar:*'.

NO interrumpe el flujo normal del bandeja: corre en paralelo al webhook entry.
"""
import json, urllib.request, urllib.error

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]
BANDEJA_ID = "9MJzeAOyfsHGGNdw"

FORWARD_NODE_NAME = "Forward a Pago Respuesta Admin"
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
        print(f"HTTP {e.code}: {e.read().decode()[:1500]}")
        raise


ALLOWED_SETTINGS_KEYS = {"executionOrder", "saveManualExecutions", "callerPolicy", "errorWorkflow", "saveDataErrorExecution", "saveDataSuccessExecution", "saveExecutionProgress", "timezone"}

def sanitize(wf):
    out = {k: wf[k] for k in ALLOWED_KEYS if k in wf}
    raw_settings = wf.get("settings", {}) or {}
    out["settings"] = {k: v for k, v in raw_settings.items() if k in ALLOWED_SETTINGS_KEYS}
    # Strip unknown keys per node
    NODE_ALLOWED = {"parameters", "id", "name", "type", "typeVersion", "position", "credentials", "disabled", "notes", "notesInFlow", "executeOnce", "alwaysOutputData", "retryOnFail", "continueOnFail", "onError", "maxTries", "waitBetweenTries", "webhookId"}
    if "nodes" in out:
        out["nodes"] = [{k: v for k, v in n.items() if k in NODE_ALLOWED} for n in out["nodes"]]
    return out


def main():
    wf = n8n("GET", f"/workflows/{BANDEJA_ID}")
    print(f"Workflow: {wf['name']}  active={wf.get('active')}")

    nodes = wf["nodes"]
    connections = wf["connections"]

    # Check if forwarder already exists
    if any(n["name"] == FORWARD_NODE_NAME for n in nodes):
        print(f"  '{FORWARD_NODE_NAME}' ya existe — skip")
        return

    # Find webhook entry
    webhook = next((n for n in nodes if n["type"] == "n8n-nodes-base.webhook"), None)
    if not webhook:
        print("ERROR: no encuentro webhook entry")
        return
    print(f"  webhook entry: {webhook['name']}")

    # Add IF node + HTTP node in parallel from webhook
    if_node = {
        "name": "¿Es button reply pago?",
        "type": "n8n-nodes-base.if",
        "typeVersion": 2,
        "position": [webhook["position"][0] + 280, webhook["position"][1] + 200],
        "parameters": {
            "conditions": {
                "options": {"version": 2, "leftValue": "", "caseSensitive": True, "typeValidation": "loose"},
                "conditions": [
                    {
                        "id": "is-pago-button",
                        "leftValue": "={{ ($json.body?.whatsappInboundMessage?.button?.payload || $json.body?.whatsappInboundMessage?.interactive?.buttonReply?.id || '') }}",
                        "rightValue": "^(confirmar|rechazar):",
                        "operator": {"type": "string", "operation": "regex"}
                    }
                ],
                "combinator": "and"
            }
        }
    }

    forward_node = {
        "name": FORWARD_NODE_NAME,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1,
        "position": [webhook["position"][0] + 560, webhook["position"][1] + 200],
        "parameters": {
            "url": f"{BASE}/webhook/ycloud-inbound",
            "method": "POST",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "Content-Type", "value": "application/json"}
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": "={{ JSON.stringify({ body: $json.body || $json }) }}",
            "options": {"timeout": 8000}
        }
    }

    nodes.extend([if_node, forward_node])

    # Connect webhook → IF (parallel branch). Webhook may have existing connections; preserve them.
    wh_conn = connections.get(webhook["name"], {"main": [[]]})
    if not wh_conn.get("main"):
        wh_conn["main"] = [[]]
    if not wh_conn["main"]:
        wh_conn["main"] = [[]]
    # Append IF target as an extra output target on main[0]
    wh_conn["main"][0].append({"node": if_node["name"], "type": "main", "index": 0})
    connections[webhook["name"]] = wh_conn

    # Connect IF → forward (only on true branch)
    connections[if_node["name"]] = {
        "main": [
            [{"node": forward_node["name"], "type": "main", "index": 0}],
            []  # false branch: nada (corta)
        ]
    }
    # forward terminator (no continuación)

    payload = sanitize(wf)
    payload["nodes"] = nodes
    payload["connections"] = connections

    # n8n requires deactivate antes de PUT en algunos casos
    print("  desactivando temporalmente...")
    n8n("POST", f"/workflows/{BANDEJA_ID}/deactivate")
    print("  actualizando...")
    updated = n8n("PUT", f"/workflows/{BANDEJA_ID}", payload)
    print(f"  activando...")
    n8n("POST", f"/workflows/{BANDEJA_ID}/activate")
    print(f"  OK actualizado id={updated.get('id')}")


if __name__ == "__main__":
    main()
