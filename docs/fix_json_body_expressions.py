"""
Fix invalid syntax in HTTP request jsonBody fields of workflow 2.
Causa: n8n trata `={...}` como expression JS. Donde tenemos templates con {{}}
debemos quitar el `=` inicial para que sea template puro.
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


# Formato n8n: jsonBody como JS object literal con `=` prefix
# n8n evalúa el objeto JS y lo serializa a JSON automáticamente — sin ambigüedad
FIXES = {
    "Generar recibo PDF": '={ id_pago: $node["Parse button reply"].json.idPago }',
    "ACK al admin (confirmado)": '={ from: "+59162180085", to: "+" + $node["Parse button reply"].json.senderPhone, type: "text", text: { body: "✅ Pago " + $node["Parse button reply"].json.idPago + " marcado como VERIFICADO. Recibo PDF generado." } }',
    "ACK al admin (rechazado)": '={ from: "+59162180085", to: "+" + $node["Parse button reply"].json.senderPhone, type: "text", text: { body: "❌ Pago " + $node["Parse button reply"].json.idPago + " marcado como RECHAZADO." } }',
    "Reject unauthorized": '={ from: "+59162180085", to: "+" + $node["Valida admin autorizado"].json.senderPhone, type: "text", text: { body: "⚠️ Tu número no está autorizado para verificar pagos. Contacta al administrador principal." } }',
    "Supabase: marcar verificado": '={ estado: "verificado", verificado_en: $now.toISO(), verificado_por: "WA:" + $json.senderPhone }',
    "Supabase: marcar rechazado": '={ estado: "rechazado", verificado_en: $now.toISO(), verificado_por: "WA:" + $json.senderPhone }',
}


def main():
    wf = n8n("GET", f"/workflows/{WF2_ID}")
    for node in wf["nodes"]:
        name = node["name"]
        if name in FIXES:
            node["parameters"]["jsonBody"] = FIXES[name]
            print(f"  fixed: {name}")
    payload = sanitize(wf)
    n8n("POST", f"/workflows/{WF2_ID}/deactivate")
    n8n("PUT", f"/workflows/{WF2_ID}", payload)
    n8n("POST", f"/workflows/{WF2_ID}/activate")
    print("OK")


if __name__ == "__main__":
    main()
