# Plan B — Screenshots de referencia (app legacy)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:auto-verify-loop o invocar Playwright MCP directamente (`mcp__playwright__browser_*`). Steps con checkbox `- [ ]`.

**Goal:** Capturar PNG de cada pantalla de la app legacy (`d:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/FESTIVAL SISTEMA DE USUARIOS/`) en mobile (375×812) y desktop (1440×900) viewport. Sirve como reference visual para el Plan C (frontend nuevo).

**Output esperado:** `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS ORIGINAL/<seccion>/<viewport>-<estado>.png`

**Test login (provisto por YACU):**
- `id_contacto`: `7d46f854-01bd-4ace-bb3a-f900e55eba9a` (no se usa en UI, sólo para verificar)
- Búsqueda: "PEDRO FLORES" → autocomplete selecciona
- Password: `8989079` (carnet) o `69166318` (teléfono — ambos válidos)
- Agrupación: BALLET FUERZA Y JUVENTUD

**Pantallas a capturar (16 estados × 2 viewports = 32 PNG):**

| # | Sección | Estado | Captura |
|---|---|---|---|
| 01 | `01-login` | empty | `desktop.png`, `mobile.png` |
| 02 | `02-login-suggestions` | autocomplete abierto con "PEDRO" | id. |
| 03 | `03-app-shell` | dashboard recién logueado (tab inscripciones default) | id. |
| 04 | `04-tab-inscripciones` | lista 2026 sin filtro | id. |
| 05 | `05-insc-card-expanded` | una card de inscripción expandida (subtab Detalles) | id. |
| 06 | `06-subtab-calificacion` | subtab Calificación dentro de card | id. |
| 07 | `07-subtab-video` | subtab Video dentro de card | id. |
| 08 | `08-tab-kardex` | tab Kardex 2025 (más data) | id. |
| 09 | `09-kardex-group-expanded` | grupo de institución expandido | id. |
| 10 | `10-kardex-row-expanded` | integrante expandido (foto + datos) | id. |
| 11 | `11-tab-calificaciones` | tab Calificaciones 2025 | id. |
| 12 | `12-calif-card-expanded` | card calificación expandida | id. |
| 13 | `13-jurado-card-expanded` | card jurado con notas grid | id. |
| 14 | `14-tab-videos` | grid videos all-years | id. |
| 15 | `15-video-modal` | modal de video abierto | id. |
| 16 | `16-tab-pagos` | placeholder vacío | id. |

---

## Pre-flight

- [ ] **Crear estructura de carpetas screenshots**

```bash
ROOT="D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS ORIGINAL"

mkdir -p "$ROOT/01-login" "$ROOT/02-login-suggestions" "$ROOT/03-app-shell" \
         "$ROOT/04-tab-inscripciones" "$ROOT/05-insc-card-expanded" \
         "$ROOT/06-subtab-calificacion" "$ROOT/07-subtab-video" \
         "$ROOT/08-tab-kardex" "$ROOT/09-kardex-group-expanded" \
         "$ROOT/10-kardex-row-expanded" "$ROOT/11-tab-calificaciones" \
         "$ROOT/12-calif-card-expanded" "$ROOT/13-jurado-card-expanded" \
         "$ROOT/14-tab-videos" "$ROOT/15-video-modal" "$ROOT/16-tab-pagos"
```

- [ ] **Levantar servidor local de la app legacy**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/FESTIVAL SISTEMA DE USUARIOS/"
"C:/laragon/bin/php/php-8.4.2-nts-Win32-vs17-x64/php.exe" -S 127.0.0.1:8080
```

> Aunque la app legacy no usa PHP, `php -S` sirve como static server con CORS razonable. Si no hay PHP disponible, usar `npx serve -p 8080`.

Background el comando.

- [ ] **Verificar que carga**

```bash
curl -s http://127.0.0.1:8080/index.html | grep "Mi Cuenta"
# Expected: línea con <title>Festival DanzArte 2026 — Mi Cuenta</title>
```

---

## Task 1: Login screen (empty)

Sección: `01-login`

- [ ] **Step 1: Navegar**

```
mcp__playwright__browser_navigate { url: "http://127.0.0.1:8080/" }
```

- [ ] **Step 2: Desktop screenshot**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/01-login/desktop.png",
  fullPage: false
}
```

- [ ] **Step 3: Mobile screenshot**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/01-login/mobile.png",
  fullPage: false
}
```

---

## Task 2: Login suggestions (autocomplete)

Sección: `02-login-suggestions`

- [ ] **Step 1: Reset desktop viewport y tipear**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_type {
  element: "Búsqueda de participante",
  ref: "#login-search",
  text: "PEDRO FLORES"
}
mcp__playwright__browser_wait_for { time: 1 }
```

- [ ] **Step 2: Desktop screenshot con autocomplete visible**

```
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/02-login-suggestions/desktop.png"
}
```

- [ ] **Step 3: Mobile equivalente**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/02-login-suggestions/mobile.png"
}
```

---

## Task 3: Login successful → app shell

Sección: `03-app-shell`

- [ ] **Step 1: Click suggestion → password → submit**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_navigate { url: "http://127.0.0.1:8080/" }
mcp__playwright__browser_type {
  element: "Búsqueda",
  ref: "#login-search",
  text: "PEDRO FLORES"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_click {
  element: "Sugerencia PEDRO FLORES",
  ref: ".login-suggestion-item"
}
mcp__playwright__browser_type {
  element: "Password",
  ref: "#login-password",
  text: "8989079"
}
mcp__playwright__browser_click {
  element: "Botón Ingresar",
  ref: "button.btn-primary"
}
mcp__playwright__browser_wait_for { time: 3 }
```

- [ ] **Step 2: Verificar dashboard cargado y capturar**

```
# Verificar URL/título cambió o app-screen.active está visible
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/03-app-shell/desktop.png",
  fullPage: false
}
```

- [ ] **Step 3: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/03-app-shell/mobile.png"
}
```

---

## Task 4: Tab Inscripciones 2026

Sección: `04-tab-inscripciones`

- [ ] **Step 1: Desktop**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Tab Inscripciones",
  ref: "button.tab-btn[data-tab='inscripciones']"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/04-tab-inscripciones/desktop.png",
  fullPage: true
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/04-tab-inscripciones/mobile.png",
  fullPage: true
}
```

> Si no hay inscripciones 2026 para Pedro Flores → cambiar año a 2025/2024 con la pill correspondiente antes del screenshot. Anotar en la entrega cuál año captura.

---

## Task 5: Inscripción card expanded — subtab Detalles

Sección: `05-insc-card-expanded`

- [ ] **Step 1: Click primera card para expandir**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Primera card de inscripción",
  ref: ".insc-card:first-of-type .insc-card-head"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/05-insc-card-expanded/desktop.png",
  fullPage: false
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/05-insc-card-expanded/mobile.png"
}
```

---

## Task 6: Subtab Calificación dentro de la card

Sección: `06-subtab-calificacion`

- [ ] **Step 1: Click subtab Calificación**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Subtab Calificación",
  ref: ".insc-card:first-of-type .subtab:nth-child(2)"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/06-subtab-calificacion/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/06-subtab-calificacion/mobile.png"
}
```

---

## Task 7: Subtab Video dentro de la card

Sección: `07-subtab-video`

- [ ] **Step 1: Click subtab Video**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Subtab Video",
  ref: ".insc-card:first-of-type .subtab:nth-child(3)"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/07-subtab-video/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/07-subtab-video/mobile.png"
}
```

---

## Task 8: Tab Kardex 2025

Sección: `08-tab-kardex`

- [ ] **Step 1: Click tab Kardex + año 2025**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Tab Kardex",
  ref: "button.tab-btn[data-tab='kardex']"
}
mcp__playwright__browser_wait_for { time: 2 }
# Click pill 2025
mcp__playwright__browser_click {
  element: "Pill año 2025",
  ref: "#year-filter-kardex .pill:nth-of-type(3)"
}
mcp__playwright__browser_wait_for { time: 2 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/08-tab-kardex/desktop.png",
  fullPage: true
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/08-tab-kardex/mobile.png",
  fullPage: true
}
```

---

## Task 9: Kardex group expanded

Sección: `09-kardex-group-expanded`

- [ ] **Step 1: Asegurar grupo expandido (clase `expanded` default)**

Los grupos vienen expandidos por default en kardex. Sólo capturar el primer grupo en focus.

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_evaluate {
  function: "() => { document.querySelector('.kardex-group')?.scrollIntoView({block:'start'}); }"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/09-kardex-group-expanded/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/09-kardex-group-expanded/mobile.png"
}
```

---

## Task 10: Kardex row expanded (integrante)

Sección: `10-kardex-row-expanded`

- [ ] **Step 1: Expandir primer integrante**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Header del primer integrante",
  ref: ".kardex-row:first-of-type .kardex-row-head"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/10-kardex-row-expanded/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/10-kardex-row-expanded/mobile.png"
}
```

---

## Task 11: Tab Calificaciones 2025

Sección: `11-tab-calificaciones`

- [ ] **Step 1: Click tab + año**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Tab Calificaciones",
  ref: "button.tab-btn[data-tab='calificaciones']"
}
mcp__playwright__browser_wait_for { time: 3 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/11-tab-calificaciones/desktop.png",
  fullPage: true
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/11-tab-calificaciones/mobile.png",
  fullPage: true
}
```

---

## Task 12: Card calificación expanded

Sección: `12-calif-card-expanded`

- [ ] **Step 1: Click primera card**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Primera card calif",
  ref: ".calif-card:first-of-type .calif-card-head"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/12-calif-card-expanded/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/12-calif-card-expanded/mobile.png"
}
```

---

## Task 13: Jurado card expanded (notas grid)

Sección: `13-jurado-card-expanded`

- [ ] **Step 1: Click primer jurado**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Primer jurado",
  ref: ".calif-card .jurado-card:first-of-type .jurado-head"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/13-jurado-card-expanded/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/13-jurado-card-expanded/mobile.png"
}
```

---

## Task 14: Tab Videos (grid)

Sección: `14-tab-videos`

- [ ] **Step 1: Click tab Videos**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Tab Videos",
  ref: "button.tab-btn[data-tab='videos']"
}
mcp__playwright__browser_wait_for { time: 3 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/14-tab-videos/desktop.png",
  fullPage: true
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/14-tab-videos/mobile.png",
  fullPage: true
}
```

---

## Task 15: Video modal

Sección: `15-video-modal`

- [ ] **Step 1: Click primer video card**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_click {
  element: "Primer video card",
  ref: ".vid-card:first-of-type"
}
mcp__playwright__browser_wait_for { time: 2 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/15-video-modal/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/15-video-modal/mobile.png"
}
```

Cerrar el modal después (Escape o click overlay) antes de seguir.

---

## Task 16: Tab Pagos (placeholder vacío)

Sección: `16-tab-pagos`

- [ ] **Step 1: Click tab Pagos**

```
mcp__playwright__browser_resize { width: 1440, height: 900 }
mcp__playwright__browser_press_key { key: "Escape" }
mcp__playwright__browser_click {
  element: "Tab Pagos",
  ref: "button.tab-btn[data-tab='pagos']"
}
mcp__playwright__browser_wait_for { time: 1 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/16-tab-pagos/desktop.png"
}
```

- [ ] **Step 2: Mobile**

```
mcp__playwright__browser_resize { width: 375, height: 812 }
mcp__playwright__browser_take_screenshot {
  filename: "<ROOT>/16-tab-pagos/mobile.png"
}
```

---

## Cleanup

- [ ] **Cerrar browser Playwright**

```
mcp__playwright__browser_close
```

- [ ] **Stop el server PHP del legacy**

Kill el background process.

- [ ] **Verificar inventario de PNGs (32 esperados)**

```bash
find "$ROOT" -name "*.png" | wc -l
# Expected: 32
```

---

## Self-review

- **Spec coverage**: 16 secciones documentadas en spec sección 11 Fase 1 todas presentes ✓
- **Placeholders**: ninguno. Selectores CSS pueden necesitar ajuste runtime si layouts cambiaron — el implementer debe usar `browser_snapshot` para descubrir refs reales.
- **Notas para implementer**: las refs (`#login-search`, `.insc-card`, etc.) están basadas en el HTML legacy. Si no funcionan: usar `browser_snapshot` primero para listar elementos reales.
