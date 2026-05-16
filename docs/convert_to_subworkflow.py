"""
Convierte:
- Workflow 2 (Respuesta Admin): Webhook trigger → Execute Workflow Trigger (sub-workflow)
- Bandeja Inbox forwarder: HTTP Request → Execute Workflow node
"""
import json, urllib.request, urllib.error

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]
WF2_ID = "JFvN1ByShgodQqIO"
BANDEJA_ID = "9MJzeAOyfsHGGNdw"

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
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        raise


def sanitize(wf):
    out = {k: wf[k] for k in ALLOWED_KEYS if k in wf}
    raw_settings = wf.get("settings", {}) or {}
    out["settings"] = {k: v for k, v in raw_settings.items() if k in ALLOWED_SETTINGS_KEYS}
    if "nodes" in out:
        out["nodes"] = [{k: v for k, v in n.items() if k in NODE_ALLOWED} for n in out["nodes"]]
    return out


def convert_wf2_to_subworkflow():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    new_nodes = []
    rename_map = {}
    for node in wf["nodes"]:
        if node["type"] == "n8n-nodes-base.webhook" and node["name"] == "Webhook YCloud (inbound)":
            trigger = {
                "name": "Sub-workflow trigger",
                "type": "n8n-nodes-base.executeWorkflowTrigger",
                "typeVersion": 1,
                "position": node["position"],
                "parameters": {
                    "inputSource": "passthrough"
                }
            }
            new_nodes.append(trigger)
            rename_map[node["name"]] = trigger["name"]
        elif node["name"] == "Respuesta a YCloud":
            # Reemplazar respondToWebhook por un Set node terminal
            terminator = {
                "name": "Respuesta sub-workflow",
                "type": "n8n-nodes-base.set",
                "typeVersion": 3.4,
                "position": node["position"],
                "parameters": {
                    "assignments": {
                        "assignments": [
                            {"id": "ok", "name": "ok", "value": True, "type": "boolean"}
                        ]
                    },
                    "options": {}
                }
            }
            new_nodes.append(terminator)
            rename_map[node["name"]] = terminator["name"]
        else:
            new_nodes.append(node)

    # Update parser to use $json (input from sub-workflow trigger directly)
    for node in new_nodes:
        if node["name"] == "Parse button reply":
            node["parameters"]["functionCode"] = (
                "// Sub-workflow input: el body del webhook YCloud pasado as-is\n"
                "const input = $input.first().json;\n"
                "// Puede venir wrapped en .body o directo\n"
                "const body = input.body || input;\n"
                "const inbound = body.whatsappInboundMessage || body;\n"
                "if (!inbound) return [{ json: { ignored: true, reason: 'no inbound' } }];\n"
                "\n"
                "let payload = '';\n"
                "let senderPhone = (inbound.from || '').toString().replace(/^\\+/, '');\n"
                "\n"
                "if (inbound.button && inbound.button.payload) {\n"
                "  payload = inbound.button.payload;\n"
                "} else if (inbound.interactive && (inbound.interactive.button_reply || inbound.interactive.buttonReply)) {\n"
                "  const br = inbound.interactive.button_reply || inbound.interactive.buttonReply;\n"
                "  payload = br.id || '';\n"
                "} else {\n"
                "  return [{ json: { ignored: true, reason: 'not button reply', type: inbound.type } }];\n"
                "}\n"
                "\n"
                "const [accion, idPago] = (payload || '').split(':');\n"
                "if (!accion || !idPago) return [{ json: { ignored: true, reason: 'payload malformado', payload } }];\n"
                "\n"
                "return [{ json: { senderPhone, accion, idPago, payload } }];"
            )

    # Update connections to rename old nodes
    new_connections = {}
    for src, conn in wf["connections"].items():
        new_src = rename_map.get(src, src)
        new_conn = {}
        for output_name, outputs in conn.items():
            new_outputs = []
            for branch in outputs:
                new_branch = []
                for target in branch:
                    target_node = target.get("node", "")
                    new_target = {**target, "node": rename_map.get(target_node, target_node)}
                    new_branch.append(new_target)
                new_outputs.append(new_branch)
            new_conn[output_name] = new_outputs
        new_connections[new_src] = new_conn

    wf["nodes"] = new_nodes
    wf["connections"] = new_connections
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    # Sub-workflows no necesitan estar 'active' para ser invocados, pero activamos por consistencia
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print(f"  Workflow 2 convertido a sub-workflow")


def replace_bandeja_forwarder():
    wf = n8n("GET", f"/workflows/{BANDEJA_ID}")
    nodes = wf["nodes"]
    forwarder_idx = None
    for i, n in enumerate(nodes):
        if n["name"] == "Forward a Pago Respuesta Admin":
            forwarder_idx = i
            break
    if forwarder_idx is None:
        print("  No encuentro forwarder existente")
        return

    old_pos = nodes[forwarder_idx]["position"]
    new_node = {
        "name": "Ejecutar Respuesta Admin",
        "type": "n8n-nodes-base.executeWorkflow",
        "typeVersion": 1.2,
        "position": old_pos,
        "parameters": {
            "source": "database",
            "workflowId": {
                "__rl": True,
                "value": WF2_ID,
                "mode": "list"
            },
            "mode": "each",
            "options": {
                "waitForSubWorkflow": False
            }
        }
    }
    nodes[forwarder_idx] = new_node

    # Update connections: rename in source connections target
    conn = wf["connections"]
    for src, c in conn.items():
        for output_name, outputs in c.items():
            for branch in outputs:
                for target in branch:
                    if target.get("node") == "Forward a Pago Respuesta Admin":
                        target["node"] = new_node["name"]
    # Update connection key if exists
    if "Forward a Pago Respuesta Admin" in conn:
        conn[new_node["name"]] = conn.pop("Forward a Pago Respuesta Admin")

    wf["nodes"] = nodes
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{BANDEJA_ID}/deactivate")
    n8n("PUT", f"/workflows/{BANDEJA_ID}", payload)
    n8n("POST", f"/workflows/{BANDEJA_ID}/activate")
    print(f"  Bandeja: forwarder HTTP reemplazado por Execute Workflow")


if __name__ == "__main__":
    print("=== Convirtiendo Workflow 2 a sub-workflow ===")
    convert_wf2_to_subworkflow()
    print("\n=== Reemplazando forwarder en Bandeja ===")
    replace_bandeja_forwarder()
    print("\nListo. Probá click en WhatsApp.")
