"""
Fix:
1) Workflow 2 (Respuesta Admin): cambiar parser a usar interactive.button_reply.id (snake_case).
2) Bandeja Inbox forwarder IF: usar ambos paths posibles.
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


def fix_workflow_2():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    for node in wf["nodes"]:
        if node["name"] == "Parse button reply":
            node["parameters"]["functionCode"] = (
                "const body = $items('Webhook YCloud (inbound)')[0].json.body || $items('Webhook YCloud (inbound)')[0].json;\n"
                "const inbound = body.whatsappInboundMessage || body;\n"
                "if (!inbound) return [{ json: { ignored: true, reason: 'no inbound' } }];\n"
                "\n"
                "let payload = '';\n"
                "let senderPhone = (inbound.from || '').toString().replace(/^\\+/, '');\n"
                "\n"
                "// Caso 1: button reply tradicional con .button.payload\n"
                "if (inbound.button && inbound.button.payload) {\n"
                "  payload = inbound.button.payload;\n"
                "}\n"
                "// Caso 2: interactive type con button_reply (snake_case, YCloud real)\n"
                "else if (inbound.interactive && (inbound.interactive.button_reply || inbound.interactive.buttonReply)) {\n"
                "  const br = inbound.interactive.button_reply || inbound.interactive.buttonReply;\n"
                "  payload = br.id || '';\n"
                "}\n"
                "else {\n"
                "  return [{ json: { ignored: true, reason: 'not button reply', type: inbound.type } }];\n"
                "}\n"
                "\n"
                "const [accion, idPago] = (payload || '').split(':');\n"
                "if (!accion || !idPago) return [{ json: { ignored: true, reason: 'payload malformado', payload } }];\n"
                "\n"
                "return [{ json: { senderPhone, accion, idPago, payload } }];"
            )
            print(f"  Parser actualizado")
            break
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print(f"  Workflow 2 actualizado y activado")


def fix_bandeja_if():
    wf = n8n("GET", f"/workflows/{BANDEJA_ID}")
    for node in wf["nodes"]:
        if node["name"] == "¿Es button reply pago?":
            cond = node["parameters"]["conditions"]
            # Reemplazar la condición: ahora usar leftValue que incluye ambos paths
            cond["conditions"] = [{
                "id": "is-pago-button",
                "leftValue": "={{ ($json.body?.whatsappInboundMessage?.button?.payload || $json.body?.whatsappInboundMessage?.interactive?.button_reply?.id || $json.body?.whatsappInboundMessage?.interactive?.buttonReply?.id || '') }}",
                "rightValue": "^(confirmar|rechazar):",
                "operator": {"type": "string", "operation": "regex"}
            }]
            print(f"  IF actualizado")
            break
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{BANDEJA_ID}/deactivate")
    n8n("PUT", f"/workflows/{BANDEJA_ID}", payload)
    n8n("POST", f"/workflows/{BANDEJA_ID}/activate")
    print(f"  Bandeja actualizada y activada")


if __name__ == "__main__":
    print("=== Fix Workflow 2 parser ===")
    fix_workflow_2()
    print("\n=== Fix Bandeja IF ===")
    fix_bandeja_if()
    print("\nListo. Probá click en WhatsApp.")
