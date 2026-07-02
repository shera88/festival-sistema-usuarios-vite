# -*- coding: utf-8 -*-
"""Mueve la construcción del mensaje (header condicional image/document/fallback) al
function node 'Loop por admin' del workflow pago-revision; YCloud solo manda {{ $json.bodyJson }}.
n8n no soporta IIFE/var/statements dentro de {{ }} -> por eso se hace en el function node."""
import json, urllib.request

SC = r'C:/Users/PC/AppData/Local/Temp/claude/d--Claude-Formulario-HTML-Supabase/97e3ed46-07d3-4c26-b2fb-5d672d43cf4b/scratchpad/pagowf2.json'
KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJmYWRmZDUzZC1kMGIzLTRhMjAtOGFhNi04ZWI2MmYxYzZiZWUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGViOTUxN2QtOGE0Zi00ZDE3LWFlYTAtNzA5NjQwOWUwYjE2IiwiaWF0IjoxNzc4MDMwMDI4fQ.KnprnXcNzmV5RYREY_7IIa9Y46lV2xPEvmT_yvpSQHI'

FCODE = """const body = $items('Webhook PHP (pago nuevo)')[0].json.body || $items('Webhook PHP (pago nuevo)')[0].json;
const adminsCsv = '59175571497,59172116494,59169485185';
const admins = adminsCsv.split(',').map(s => s.trim()).filter(Boolean);
const fb = 'https://supabase.imaginarte.cloud/storage/v1/object/public/uploads-2026/templates/logo-color-navy.png';
const NL = String.fromCharCode(10);
return admins.map(phone => {
  const to = phone.startsWith('+') ? phone : '+' + phone;
  const p = body;
  const url = (p.comprobante_url || '');
  const isPdf = url.toLowerCase().indexOf('.pdf') !== -1;
  const header = !url
    ? { type: 'image', image: { link: fb } }
    : (isPdf
        ? { type: 'document', document: { link: url, filename: 'comprobante.pdf' } }
        : { type: 'image', image: { link: url } });
  const text = '💰 *PAGO PENDIENTE DE VERIFICACIÓN*' + NL + NL +
    '*Monto:* ' + p.monto + ' Bs' + NL +
    '*Método:* ' + p.metodo_pago + NL +
    '*Fecha:* ' + p.fecha + ' · ' + p.hora + NL + NL +
    '*Titular:* ' + p.nombre_pagador + NL +
    '*Tel:* ' + (p.telefono_pagador || 's/d') + NL + NL +
    '*Agrupación:* ' + (p.agrupacion || 's/d') + NL +
    '*Obra:* ' + (p.nombre_obra || 's/d') + NL +
    '*Concepto:* ' + p.concepto + NL + NL +
    '*Recibo N°:* ' + (p.numero_recibo || p.id_pago);
  const msg = {
    from: '+59162180085', to: to, type: 'interactive',
    interactive: {
      type: 'button', header: header, body: { text: text },
      footer: { text: 'Festival Danzarte 2026' },
      action: { buttons: [
        { type: 'reply', reply: { id: 'confirmar:' + p.id_pago, title: '✅ Confirmar' } },
        { type: 'reply', reply: { id: 'rechazar:' + p.id_pago, title: '❌ Rechazar' } }
      ] }
    },
    externalId: 'pago-revision-' + p.id_pago + '-' + to
  };
  return { json: { to: to, pago: p, bodyJson: JSON.stringify(msg) } };
});"""

d = json.load(open(SC, encoding='utf-8'))
for n in d['nodes']:
    if n['name'] == 'Loop por admin':
        n['parameters']['functionCode'] = FCODE
        print('Loop por admin actualizado')
    if n['name'] == 'YCloud: enviar template':
        n['parameters']['jsonBody'] = '={{ $json.bodyJson }}'
        print('YCloud jsonBody -> {{ $json.bodyJson }}')

payload = json.dumps({
    'name': d['name'], 'nodes': d['nodes'], 'connections': d['connections'],
    'settings': {'executionOrder': d.get('settings', {}).get('executionOrder', 'v1')},
}, ensure_ascii=False).encode('utf-8')
req = urllib.request.Request(
    'https://danzarte-n8n.rgxmhp.easypanel.host/api/v1/workflows/W4B9IPH6RHbG8ffT',
    data=payload, headers={'X-N8N-API-KEY': KEY, 'Content-Type': 'application/json'}, method='PUT')
print('PUT:', urllib.request.urlopen(req, timeout=30).status)
