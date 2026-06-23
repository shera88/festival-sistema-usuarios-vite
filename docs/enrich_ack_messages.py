"""
Workflow 2 (JFvN1ByShgodQqIO): enriquecer mensajes ACK al admin con detalles del pago.

Agrega un nuevo nodo HTTP "Obtener detalle pago" que llama al RPC
pago_detalle_para_notificacion(p_id_pago) en Supabase, entre "Generar recibo PDF"
y "ACK al admin (confirmado)", y otra rama de RPC antes de "ACK al admin (rechazado)".

Actualiza el cuerpo de los mensajes WhatsApp con template enriquecido:
  - Nombre de agrupación
  - Nombre de obra
  - Pagador (nombre y CI)
  - Concepto + método de pago
  - Monto
  - Número de recibo + URL PDF (solo para confirmado)
"""
import json
import urllib.request
import urllib.error

CRED = json.load(
    open(
        r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json",
        encoding="utf-8",
    )
)
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]
WF2_ID = "JFvN1ByShgodQqIO"

SUPABASE_URL = "https://supabase.imaginarte.cloud"
SERVICE_ROLE_KEY = "__SUPABASE_SERVICE_ROLE_KEY__"

ALLOWED_KEYS = {"name", "nodes", "connections", "settings", "staticData"}
ALLOWED_SETTINGS_KEYS = {
    "executionOrder", "saveManualExecutions", "callerPolicy", "errorWorkflow",
    "saveDataErrorExecution", "saveDataSuccessExecution", "saveExecutionProgress", "timezone",
}
NODE_ALLOWED = {
    "parameters", "id", "name", "type", "typeVersion", "position", "credentials",
    "disabled", "notes", "notesInFlow", "executeOnce", "alwaysOutputData",
    "retryOnFail", "continueOnFail", "onError", "maxTries", "waitBetweenTries", "webhookId",
}


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


def make_rpc_node(node_id, name, position):
    """HTTP node que llama al RPC en Supabase via REST."""
    return {
        "parameters": {
            "method": "POST",
            "url": f"{SUPABASE_URL}/rest/v1/rpc/pago_detalle_para_notificacion",
            "sendHeaders": True,
            "headerParameters": {
                "parameters": [
                    {"name": "apikey", "value": SERVICE_ROLE_KEY},
                    {"name": "Authorization", "value": f"Bearer {SERVICE_ROLE_KEY}"},
                    {"name": "Content-Type", "value": "application/json"},
                    {"name": "Accept", "value": "application/json"},
                ]
            },
            "sendBody": True,
            "specifyBody": "json",
            "jsonBody": '={{ JSON.stringify({ p_id_pago: $node["Parse button reply"].json.idPago }) }}',
            "options": {"timeout": 15000},
        },
        "name": name,
        "type": "n8n-nodes-base.httpRequest",
        "typeVersion": 4.1,
        "position": position,
        "id": node_id,
    }


def make_text_object_value(template_kind: str) -> str:
    """Devuelve el value del campo 'text' en bodyParameters (object con body).

    template_kind: 'confirmado' | 'rechazado'
    Se ejecuta sobre el output del nodo RPC anterior (single-row).
    Usa $json directo (single item) con fallback a $json[0] si viene array.
    """
    if template_kind == "confirmado":
        return (
            '={{ ({ body: '
            '"✅ *PAGO VERIFICADO*\\n\\n" + '
            '"📋 *Agrupación:* " + (($json.nombre_agrupacion ?? ($json[0] && $json[0].nombre_agrupacion)) || "—") + "\\n\\n" +'
            '"🎭 *Obra:* " + (($json.nombre_obra ?? ($json[0] && $json[0].nombre_obra)) || "—") + "\\n\\n" +'
            '"👤 *Pagador:* " + (($json.nombre_pagador ?? ($json[0] && $json[0].nombre_pagador)) || "—") + "\\n\\n" +'
            '"💰 *Monto:* " + Number(($json.monto ?? ($json[0] && $json[0].monto)) || 0).toFixed(2) + " Bs\\n\\n" +'
            '"🏷️ *Concepto:* " + (($json.concepto ?? ($json[0] && $json[0].concepto)) || "—") + "\\n\\n" +'
            '"💳 *Método:* " + (($json.metodo_pago ?? ($json[0] && $json[0].metodo_pago)) || "—") + "\\n\\n" + '
            '"🧾 *Recibo Nº:* " + (($json.numero_recibo ?? ($json[0] && $json[0].numero_recibo)) || ($json.id_pago ?? ($json[0] && $json[0].id_pago)) || "—") + "\\n\\n" +'
            '(($json.recibo_pdf_url ?? ($json[0] && $json[0].recibo_pdf_url)) ? "📎 PDF: " + ($json.recibo_pdf_url ?? $json[0].recibo_pdf_url) : "📎 PDF: se está generando…")'
            ' }) }}'
        )
    return (
        '={{ ({ body: '
        '"❌ *PAGO RECHAZADO*\\n\\n" + '
        '"📋 *Agrupación:* " + (($json.nombre_agrupacion ?? ($json[0] && $json[0].nombre_agrupacion)) || "—") + "\\n\\n" +'
        '"🎭 *Obra:* " + (($json.nombre_obra ?? ($json[0] && $json[0].nombre_obra)) || "—") + "\\n\\n" +'
        '"👤 *Pagador:* " + (($json.nombre_pagador ?? ($json[0] && $json[0].nombre_pagador)) || "—") + "\\n\\n" +'
        '"💰 *Monto:* " + Number(($json.monto ?? ($json[0] && $json[0].monto)) || 0).toFixed(2) + " Bs\\n\\n" +'
        '"🏷️ *Concepto:* " + (($json.concepto ?? ($json[0] && $json[0].concepto)) || "—") + "\\n\\n" +'
        '"💳 *Método:* " + (($json.metodo_pago ?? ($json[0] && $json[0].metodo_pago)) || "—") + "\\n\\n" + '
        '"🆔 ID Pago: " + (($json.id_pago ?? ($json[0] && $json[0].id_pago)) || "—")'
        ' }) }}'
    )


def main():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    nodes = wf["nodes"]

    # Quitar nodos previamente agregados si existen (idempotente)
    nodes = [n for n in nodes if n["name"] not in ("Detalle pago confirmado", "Detalle pago rechazado")]

    # Localizar nodos existentes para conectar
    by_name = {n["name"]: n for n in nodes}
    pdf_node = by_name.get("Generar recibo PDF")
    rechaz_supa = by_name.get("Supabase: marcar rechazado")
    ack_conf = by_name.get("ACK al admin (confirmado)")
    ack_rech = by_name.get("ACK al admin (rechazado)")

    if not (pdf_node and rechaz_supa and ack_conf and ack_rech):
        raise RuntimeError("Nodos esperados no encontrados en el workflow")

    # Defensa anti-regresión: forzar config correcta del nodo Generar recibo PDF
    # cada vez que corre este script. Cualquier edición manual en n8n UI que rompa
    # la URL/header se sobrescribe acá.
    SHARED_SECRET = "dba176baa6127feca1657aa99e0c2f358408c715c1a5fa43d202d4aa5c55674e"
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

    # Posiciones: insertar entre nodos existentes
    detalle_conf_pos = [pdf_node["position"][0] + 180, pdf_node["position"][1]]
    detalle_rech_pos = [rechaz_supa["position"][0] + 180, rechaz_supa["position"][1]]

    detalle_conf = make_rpc_node("detalle-conf-rpc-001", "Detalle pago confirmado", detalle_conf_pos)
    detalle_rech = make_rpc_node("detalle-rech-rpc-001", "Detalle pago rechazado", detalle_rech_pos)
    nodes.extend([detalle_conf, detalle_rech])

    # Actualizar parámetros de ACKs con templates ricos
    ack_conf["parameters"]["sendBody"] = True
    ack_conf["parameters"]["specifyBody"] = "keypair"
    ack_conf["parameters"]["bodyParameters"] = {
        "parameters": [
            {"name": "from", "value": "+59162180085"},
            {
                "name": "to",
                "value": '=+{{ $node["Parse button reply"].json.senderPhone }}',
            },
            {"name": "type", "value": "text"},
            {"name": "text", "value": make_text_object_value("confirmado")},
        ]
    }
    ack_conf["parameters"].pop("jsonBody", None)

    ack_rech["parameters"]["sendBody"] = True
    ack_rech["parameters"]["specifyBody"] = "keypair"
    ack_rech["parameters"]["bodyParameters"] = {
        "parameters": [
            {"name": "from", "value": "+59162180085"},
            {
                "name": "to",
                "value": '=+{{ $node["Parse button reply"].json.senderPhone }}',
            },
            {"name": "type", "value": "text"},
            {"name": "text", "value": make_text_object_value("rechazado")},
        ]
    }
    ack_rech["parameters"].pop("jsonBody", None)

    wf["nodes"] = nodes

    # Reconectar:
    # Generar recibo PDF -> Detalle pago confirmado -> ACK al admin (confirmado)
    # Supabase: marcar rechazado -> Detalle pago rechazado -> ACK al admin (rechazado)
    conn = wf["connections"]
    conn["Generar recibo PDF"] = {
        "main": [[{"node": "Detalle pago confirmado", "type": "main", "index": 0}]]
    }
    conn["Detalle pago confirmado"] = {
        "main": [[{"node": "ACK al admin (confirmado)", "type": "main", "index": 0}]]
    }
    conn["Supabase: marcar rechazado"] = {
        "main": [[{"node": "Detalle pago rechazado", "type": "main", "index": 0}]]
    }
    conn["Detalle pago rechazado"] = {
        "main": [[{"node": "ACK al admin (rechazado)", "type": "main", "index": 0}]]
    }
    wf["connections"] = conn

    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print("OK — workflow actualizado")


if __name__ == "__main__":
    main()
