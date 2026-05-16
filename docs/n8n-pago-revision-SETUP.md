# Setup n8n — Notificación de pagos a admins por WhatsApp (YCloud)

## Resumen del flujo

```
[Usuario sube comprobante]
    └─> pago-crear.php
         ├─> INSERT pagos_2026 (estado='enviado')
         └─> POST n8n /webhook/pago-revision
                 └─> Workflow 1 "Pago en Revisión"
                         └─> YCloud /v2/whatsapp/messages/sendDirectly
                             template "pago_pendiente" con header image + 2 quick reply buttons
                                 ├─> Admin tap "✅ Confirmar" o "❌ Rechazar"
                                 └─> YCloud envía inbound a /webhook/ycloud-inbound
                                         └─> Workflow 2 "Respuesta Admin"
                                                 ├─> PATCH pagos_2026.estado = verificado|rechazado
                                                 ├─> Si verificado: POST recibo-generar.php
                                                 └─> ACK al admin
```

## Archivos

- `n8n-pago-revision-workflow.json` — Workflow 1
- `n8n-respuesta-admin-workflow.json` — Workflow 2

## 1) NO se usa template Meta — mensaje `interactive` directo

El workflow envía un mensaje **`interactive`** con header image + body + botones quick reply construido directamente en el payload. NO requiere template aprobado por Meta.

**Restricción única:** WhatsApp Cloud API permite enviar mensajes `interactive` libres solo dentro de la **ventana de 24h** desde la última respuesta del destinatario. Esto significa:

- La primera vez, el admin debe escribir cualquier mensaje al número `+59162180085` (un simple "hola"). Esto abre la ventana de 24h.
- Cada vez que el admin **tap un botón** (Confirmar/Rechazar) refresca la ventana 24h.
- Si pasan más de 24h sin que el admin interactúe, el siguiente mensaje fallará con error `131047 — re-engagement required`.

**Mitigación:** crear una rutina diaria donde n8n envíe un "ping" al admin (puede ser un template `hello_world` que ya está pre-aprobado en cualquier número WABA) para reactivar la ventana. O simplemente pedirle al admin que escriba "hola" cada mañana al bot.

**Si el festival lo requiere zero-touch:** crear más adelante un template `pago_pendiente` aprobado por Meta y cambiar el `type` de `interactive` a `template` en el workflow.

## 2) Importar workflows en n8n

1. Abrir https://danzarte-n8n.rgxmhp.easypanel.host
2. Workflows → Import from File → `n8n-pago-revision-workflow.json`
3. Repetir con `n8n-respuesta-admin-workflow.json`

## 3) Variables de entorno en n8n

Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `YCLOUD_API_KEY` | Tu API Key de YCloud (panel → API → Keys) |
| `YCLOUD_FROM` | `+59162180085` (número WhatsApp Business del festival) |
| `WA_ADMINS` | `59175571497` (CSV con `+` opcional: extensible separando con coma) |
| `SUPABASE_SERVICE_KEY` | Service role key |
| `WEBHOOK_SHARED_SECRET` | Mismo valor que en `php-backend/config.php` |
| `PHP_INTERNAL_SECRET` | (opcional) Para auth en recibo-generar.php |

## 4) Configurar inbound webhook en YCloud

Panel YCloud → Settings → Webhooks → Add Endpoint:

- **URL:** `https://danzarte-n8n.rgxmhp.easypanel.host/webhook/ycloud-inbound`
- **Events:** marcar `whatsapp.inbound_message.received`
- **Method:** POST
- **Save**

## 5) Activar ambos workflows en n8n

Toggle "Active" en cada uno.

## 6) Editar `php-backend/config.php`

Ya está parcialmente configurado. Verifique:

```php
'webhooks' => [
    'pago_revision' => 'https://danzarte-n8n.rgxmhp.easypanel.host/webhook/pago-revision',
],
'webhook_shared_secret' => 'PEGAR-MISMO-VALOR-QUE-EN-N8N',
```

Generar secret aleatorio:
```bash
openssl rand -hex 32
```

## 7) Probar end-to-end

1. Login en la app como representante.
2. Pagos → click PAGAR en cualquier inscripción.
3. Subir un comprobante de prueba.
4. **Verificar:**
   - Llega WhatsApp al `+59175571497` con template `pago_pendiente`:
     - Imagen del comprobante en header
     - Cuerpo con monto, método, pagador, agrupación, concepto
     - 2 botones: `✅ Confirmar` / `❌ Rechazar`
5. Tap "Confirmar":
   - Supabase: `pagos_2026.estado` pasa a `verificado`, `verificado_por='WA:59175571497'`
   - Se genera el PDF de recibo automáticamente
   - El admin recibe ACK: "✅ Pago X marcado como VERIFICADO"
   - En la app del usuario aparece "Recibo" disponible
6. Tap "Rechazar":
   - `estado='rechazado'`
   - ACK al admin
   - En la app aparece como rechazado (UI debe manejar este estado)

## Agregar más administradores

Edit la variable `WA_ADMINS` en n8n. CSV separado por coma:
```
WA_ADMINS=59175571497,59171234567,59179876543
```
No requiere redeploy del código ni nuevos templates. El workflow itera sobre cada número.

## Notas técnicas

- **YCloud cobra por mensaje:** templates iniciados por business ≈ $0.02 USD. Para festival con ~500 pagos → ~$10 USD totales.
- **Ventana de 24h:** después de la primera respuesta del admin, hay 24h para enviar mensajes libres (no-template).
- **Webhook URL pública:** n8n debe estar accesible desde internet (ya está en easypanel).
- **Reintentos:** YCloud reintenta automáticamente si el webhook responde con 5xx; respondemos siempre 200 (text "OK").
- **Seguridad:** validamos secret entrante en Workflow 1 y `senderPhone ∈ WA_ADMINS` en Workflow 2.

## Tabla de payloads

### Workflow 1 — payload entrante desde PHP

```json
{
  "secret": "...",
  "id_pago": "abc123",
  "numero_recibo": "I-260515-ABC123",
  "concepto": "inscripcion",
  "id_referencia": "f1df6e0b",
  "monto": 700,
  "fecha": "2026-05-15",
  "hora": "18:03:00",
  "metodo_pago": "TRANSFERENCIA QR",
  "nombre_pagador": "YACU SERRANO LOPEZ",
  "telefono_pagador": "75571497",
  "comprobante_url": "https://supabase.imaginarte.cloud/storage/v1/.../comprobante.jpg",
  "agrupacion": "DANZARTE",
  "nombre_obra": "SHERA PRUEBA"
}
```

### Workflow 2 — payload inbound desde YCloud

```json
{
  "type": "whatsapp.inbound_message.received",
  "whatsappInboundMessage": {
    "from": "59175571497",
    "phoneNumber": "+59162180085",
    "type": "button",
    "button": { "payload": "confirmar:abc123", "text": "✅ Confirmar" }
  }
}
```

(El nodo `Parse button reply` también maneja `type: 'interactive'` por compatibilidad.)
