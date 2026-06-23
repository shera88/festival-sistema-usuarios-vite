"""
WF2 (JFvN1ByShgodQqIO): después de marcar verificado/rechazado, hacer fan-out
del ACK a TODOS los admins (no solo al que clickeó).

Cambios:
- Inserta nodo Function "Fanout admins (confirmado)" después de "Detalle pago confirmado"
- Inserta nodo Function "Fanout admins (rechazado)" después de "Detalle pago rechazado"
- ACKs ahora itera sobre cada admin y manda el mensaje enriquecido con
  "Acción por: <senderPhone>" para que todos sepan quién aprobó/rechazó.
- Preserva el fix anti-regresion del nodo Generar recibo PDF.
"""
import json, urllib.request

ADMINS_CSV = "59175571497,59172116494,59169485185"

# Mapa telefono -> nombre. Si un numero no esta aca, se muestra "+<numero>".
ADMIN_NAMES = {
    "59175571497": "Shera Serrano",
    "59172116494": "Yacu Serrano",
    "59169485185": "Briza",
}

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


def make_fanout_node(node_id, name, position):
    """Function node que recibe el detalle del pago (array de 1 elemento desde RPC)
    y emite N items (uno por admin) con: detalle + to + clicker + clickerName."""
    names_js = json.dumps(ADMIN_NAMES, ensure_ascii=False)
    code = (
        f"const adminsCsv = '{ADMINS_CSV}';\n"
        f"const ADMIN_NAMES = {names_js};\n"
        "const admins = adminsCsv.split(',').map(s => s.trim().replace(/^\\+/, '')).filter(Boolean);\n"
        "const inputArr = $input.all();\n"
        "const first = inputArr[0] && inputArr[0].json;\n"
        "const detalle = (Array.isArray(first) ? first[0] : (first && first[0]) || first) || {};\n"
        "const clicker = ($items('Parse button reply')[0].json.senderPhone || '').replace(/^\\+/, '');\n"
        "const clickerName = ADMIN_NAMES[clicker] || ('+' + clicker);\n"
        "return admins.map(phone => ({ json: { to: '+' + phone, detalle, clicker, clickerName } }));"
    )
    return {
        "parameters": {"functionCode": code},
        "name": name,
        "type": "n8n-nodes-base.function",
        "typeVersion": 1,
        "position": position,
        "id": node_id,
    }


def confirmado_text_value():
    """Template usando $json.detalle (en lugar de $json directo)."""
    return (
        '={{ ({ body: '
        '"✅ *PAGO VERIFICADO*\\n\\n" + '
        '"📋 *Agrupación:* " + ($json.detalle.nombre_agrupacion || "—") + "\\n\\n" + '
        '"🎭 *Obra:* " + ($json.detalle.nombre_obra || "—") + "\\n\\n" + '
        '"👤 *Titular:* " + ($json.detalle.nombre_pagador || "—") + "\\n\\n" + '
        '"💰 *Monto:* " + Number($json.detalle.monto || 0).toFixed(2) + " Bs\\n\\n" + '
        '"🏷️ *Concepto:* " + ($json.detalle.concepto || "—") + "\\n\\n" + '
        '"💳 *Método:* " + ($json.detalle.metodo_pago || "—") + "\\n\\n" + '
        '"🧾 *Recibo Nº:* " + ($json.detalle.numero_recibo || $json.detalle.id_pago || "—") + "\\n\\n" + '
        '($json.detalle.recibo_pdf_url ? "📎 PDF: " + $json.detalle.recibo_pdf_url + "\\n\\n" : "📎 PDF: se está generando…\\n\\n") + '
        '"👮 *Verificado por:* " + ($json.clickerName || "—")'
        ' }) }}'
    )


def rechazado_text_value():
    return (
        '={{ ({ body: '
        '"❌ *PAGO RECHAZADO*\\n\\n" + '
        '"📋 *Agrupación:* " + ($json.detalle.nombre_agrupacion || "—") + "\\n\\n" + '
        '"🎭 *Obra:* " + ($json.detalle.nombre_obra || "—") + "\\n\\n" + '
        '"👤 *Titular:* " + ($json.detalle.nombre_pagador || "—") + "\\n\\n" + '
        '"💰 *Monto:* " + Number($json.detalle.monto || 0).toFixed(2) + " Bs\\n\\n" + '
        '"🏷️ *Concepto:* " + ($json.detalle.concepto || "—") + "\\n\\n" + '
        '"💳 *Método:* " + ($json.detalle.metodo_pago || "—") + "\\n\\n" + '
        '"🆔 *ID Pago:* " + ($json.detalle.id_pago || "—") + "\\n\\n" + '
        '"👮 *Rechazado por:* " + ($json.clickerName || "—")'
        ' }) }}'
    )


def main():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    nodes = wf["nodes"]

    # Quitar nodos viejos para idempotencia
    nodes = [n for n in nodes if n["name"] not in ("Fanout admins (confirmado)", "Fanout admins (rechazado)")]

    by_name = {n["name"]: n for n in nodes}
    det_conf = by_name.get("Detalle pago confirmado")
    det_rech = by_name.get("Detalle pago rechazado")
    ack_conf = by_name.get("ACK al admin (confirmado)")
    ack_rech = by_name.get("ACK al admin (rechazado)")
    pdf_node = by_name.get("Generar recibo PDF")
    if not (det_conf and det_rech and ack_conf and ack_rech and pdf_node):
        raise RuntimeError("Nodos esperados no encontrados")

    # Anti-regresion del nodo PDF
    pdf_node["parameters"]["url"] = "https://festivaldanzarte.com/app-portal/php/recibo-generar.php"
    pdf_node["parameters"]["sendHeaders"] = True
    pdf_node["parameters"]["headerParameters"] = {
        "parameters": [
            {"name": "Content-Type", "value": "application/json"},
            {"name": "X-Webhook-Secret", "value": SHARED_SECRET},
        ]
    }
    pdf_node["parameters"]["sendBody"] = True
    pdf_node["parameters"]["specifyBody"] = "json"
    pdf_node["parameters"]["jsonBody"] = '={{ JSON.stringify({ id_pago: $node["Parse button reply"].json.idPago }) }}'
    pdf_node["parameters"].pop("bodyParameters", None)
    pdf_node["parameters"].setdefault("options", {})["timeout"] = 30000
    pdf_node["onError"] = "continueRegularOutput"

    # Insertar fanout entre Detalle y ACK
    fanout_conf = make_fanout_node(
        "fanout-conf-001",
        "Fanout admins (confirmado)",
        [det_conf["position"][0] + 180, det_conf["position"][1]],
    )
    fanout_rech = make_fanout_node(
        "fanout-rech-001",
        "Fanout admins (rechazado)",
        [det_rech["position"][0] + 180, det_rech["position"][1]],
    )
    nodes.extend([fanout_conf, fanout_rech])

    # Actualizar ACKs: ahora usan $json.to (del fanout) y template enriquecido con $json.detalle
    ack_conf["parameters"]["sendBody"] = True
    ack_conf["parameters"]["specifyBody"] = "keypair"
    ack_conf["parameters"]["bodyParameters"] = {
        "parameters": [
            {"name": "from", "value": "+59162180085"},
            {"name": "to", "value": "={{ $json.to }}"},
            {"name": "type", "value": "text"},
            {"name": "text", "value": confirmado_text_value()},
        ]
    }
    ack_conf["parameters"].pop("jsonBody", None)

    ack_rech["parameters"]["sendBody"] = True
    ack_rech["parameters"]["specifyBody"] = "keypair"
    ack_rech["parameters"]["bodyParameters"] = {
        "parameters": [
            {"name": "from", "value": "+59162180085"},
            {"name": "to", "value": "={{ $json.to }}"},
            {"name": "type", "value": "text"},
            {"name": "text", "value": rechazado_text_value()},
        ]
    }
    ack_rech["parameters"].pop("jsonBody", None)

    wf["nodes"] = nodes

    # Reconectar:
    # Detalle pago confirmado -> Fanout admins (confirmado) -> ACK al admin (confirmado)
    # Detalle pago rechazado -> Fanout admins (rechazado) -> ACK al admin (rechazado)
    conn = wf["connections"]
    conn["Detalle pago confirmado"] = {"main": [[{"node": "Fanout admins (confirmado)", "type": "main", "index": 0}]]}
    conn["Fanout admins (confirmado)"] = {"main": [[{"node": "ACK al admin (confirmado)", "type": "main", "index": 0}]]}
    conn["Detalle pago rechazado"] = {"main": [[{"node": "Fanout admins (rechazado)", "type": "main", "index": 0}]]}
    conn["Fanout admins (rechazado)"] = {"main": [[{"node": "ACK al admin (rechazado)", "type": "main", "index": 0}]]}
    wf["connections"] = conn

    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print(f"OK — fanout configurado para admins: {ADMINS_CSV}")


if __name__ == "__main__":
    main()
