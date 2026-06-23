"""Cambiar 'Pagador' -> 'Titular' en WF1 notif inicial."""
import json, urllib.request

CRED = json.load(open(r"D:\Claude\APPS\APP FESTIVAL DANZARTE 2026 - VITE\.credentials\n8n-api-key.json", encoding="utf-8"))
BASE = CRED["base_url"].rstrip("/")
KEY = CRED["api_key"]
WF1_ID = "W4B9IPH6RHbG8ffT"

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
    wf = n8n("GET", f"/workflows/{WF1_ID}")
    changed = 0
    for node in wf["nodes"]:
        p = node.get("parameters", {})
        body = p.get("jsonBody", "")
        if "Pagador" in body:
            p["jsonBody"] = body.replace("Pagador", "Titular")
            changed += 1
            print(f"  fixed: {node['name']}")
    print(f"Nodos cambiados: {changed}")
    if changed:
        payload = sanitize(wf)
        n8n("POST", f"/workflows/{WF1_ID}/deactivate")
        n8n("PUT", f"/workflows/{WF1_ID}", payload)
        n8n("POST", f"/workflows/{WF1_ID}/activate")
        print("OK")


if __name__ == "__main__":
    main()
