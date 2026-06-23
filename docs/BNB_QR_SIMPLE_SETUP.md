# BNB QR Simple - Setup en n8n (prueba credenciales)

Workflow: [`n8n_workflow_bnb_qr_simple_prueba.json`](n8n_workflow_bnb_qr_simple_prueba.json)

Genera QR fijo de **100 BOB** contra sandbox BNB. Sin credenciales n8n — todo editable en un solo nodo Set.

URLs y formato basados en `BNB-API-Integration-Festival-Danzarte.docx` (docs oficiales del proyecto).

---

## 1. Importar

n8n → Workflows → **Import from File** → seleccionar el `.json`. Listo, no hay credentials para crear.

---

## 2. Editar tu accountId / authorizationId

Abrir nodo **"Credenciales y parametros (EDITAR AQUI)"** (segundo nodo, color naranja Set).

Reemplazar valores:

| Campo | Valor por defecto | Qué poner |
|---|---|---|
| `accountId` | `REEMPLAZAR_CON_TU_ACCOUNT_ID` | tu accountId BNB (ej. `__BNB_ACCOUNT_ID__`) |
| `authorizationId` | `REEMPLAZAR_CON_TU_AUTHORIZATION_ID` | tu authorizationId BNB |
| `amount` | `100` | monto en BOB (string) |
| `currency` | `BOB` | o `USD` |
| `gloss` | `Festival Danzarte - prueba credenciales` | aparece en extracto |
| `expirationDate` | `2026-06-29` | formato `yyyy-MM-dd` |
| `singleUse` | `true` | `true` un solo uso, `false` reutilizable |

Save.

---

## 3. URLs (ya configuradas)

| Acción | URL |
|---|---|
| Auth | `https://clientauthenticationapiv2.azurewebsites.net/api/v1/auth/token` |
| QR | `https://qrsimpleapiv2.azurewebsites.net/api/v1/main/getQRWithImageAsync` |

Si BNB te dio URLs distintas, editar en los nodos **"BNB - Auth Token"** y **"BNB - Generar QR (monto fijo)"** (campo URL).

---

## 4. Ejecutar

**Execute Workflow** (botón abajo).

Flujo:

```
Disparar manualmente
  -> Credenciales y parametros (EDITAR AQUI)   carga vars en pipeline
       -> BNB - Auth Token                      POST con accountId/authorizationId del body
            -> BNB - Generar QR                 POST con Bearer {{$json.message}}
                 -> Extraer QR                  qrId, qrBase64, dataUri
                      -> Base64 -> PNG          archivo qr-bnb-festival-100bob.png
```

Output último nodo: PNG descargable desde panel n8n. Escanealo con app banco para validar.

---

## 5. Respuestas esperadas (según docs BNB)

**Auth (200 OK)**:
```json
{ "success": true, "message": "<JWT_LARGO>" }
```
Si `success=false`, `message` trae el error. El header `Authorization: Bearer {{ $json.message }}` del siguiente nodo solo funciona si `message` es el token (cuando `success=true`).

**QR (200 OK)**:
```json
{
  "success": true,
  "message": "OK",
  "id": "59",
  "qr": "<base64-PNG>"
}
```

---

## 6. Errores comunes

| Síntoma | Causa | Fix |
|---|---|---|
| 401 en Auth Token | accountId/authorizationId mal | revisar nodo Set, sin espacios extra |
| 400 en QR | `amount` no es string, o `expirationDate` formato mal | tienen que ser string `"100"` y `"yyyy-MM-dd"` |
| 401 en QR | token vencido o path mal | confirmar response auth tiene token en `message` |
| `Credentials not found` | nodo HTTP pide credential antigua | esta versión NO usa credenciales — re-importar el JSON |
| Timeout | URL sandbox cambió o IP no whitelisted | confirmar URLs con BNB |

---

## 7. Próximo paso (cuando esta prueba devuelva PNG escaneable)

Implementar el flujo de producción descrito en `BNB-API-Integration-Festival-Danzarte.docx` sección 6:
- Polling cada 30s del endpoint `getQRStatusAsync`
- Marcar `pagos_2026.estado = 'verificado'` cuando `qrId == 2`
- Generar recibo PDF + notificar al usuario

Eso ya está documentado, pero primero confirmar que esta prueba funciona end-to-end con tus credenciales.
