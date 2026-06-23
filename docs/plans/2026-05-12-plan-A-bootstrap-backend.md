# Plan A — Bootstrap + SQL Migrations + PHP Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el repo GitHub `shera88/festival-sistema-usuarios-vite` con scaffold Vite + React + TS + Tailwind 4 + shadcn, aplicar migrations SQL aditivas (RPCs `search_login_users` + `validate_login`), e implementar backend PHP completo en `php-backend/` con 10 endpoints REST funcionales (search-participants, login, logout, me, bootstrap, inscripciones, kardex, calificaciones, videos, pagos).

**Architecture:** Repo en GitHub privado bajo cuenta `shera88`. Backend PHP envuelve Supabase self-hosted (`supabase.imaginarte.cloud`) con service_role key (nunca expuesta al cliente). Sesión vía cookie httpOnly. RPCs `SECURITY DEFINER` en Postgres permiten que `anon` haga login lookup sin acceso directo a tablas. Frontend SPA (Plan C) consumirá `/api/*` con `credentials: 'include'`.

**Tech Stack:** Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn/ui (base-nova), TanStack Query 5, react-router-dom 7, supabase-js 2, zod 4, react-hook-form 7, PHP 8, Supabase self-hosted.

**Cuando terminar este plan:** `curl http://127.0.0.1:8001/login.php -X POST -d '{"id_contacto":"<id>","password":"<carnet>"}' -H "Content-Type: application/json" -c cookies.txt` retorna `{user: {...}}` y luego `curl http://127.0.0.1:8001/inscripciones.php?year=2026 -b cookies.txt` retorna inscripciones del usuario.

**Reglas activas durante ejecución (de memorias):**
- SQL destructivo Supabase → pedir OK + bajar CSV backup (este plan SOLO tiene SQL aditivo, sin riesgo)
- Tono español formal "usted" en UI/docs
- Verificar con screenshot tras cada cambio de UI (no aplica fase 0/2/3, sí en frontend)
- Skills UI/UX se invocan en Plan C

---

## Pre-flight checks

- [ ] **Verificar credenciales disponibles**

Confirmar que los siguientes ítems existen y están vigentes:

```bash
# GitHub PAT (desde mcp.json del proyecto legacy)
curl -s -H "Authorization: Bearer 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" https://api.github.com/user | grep login
# Expected: "login": "shera88"

# Supabase service_role
curl -s "https://supabase.imaginarte.cloud/rest/v1/instituciones?select=id_agrupacion&limit=1" \
  -H "apikey: __SUPABASE_SERVICE_ROLE_KEY__" \
  -H "Authorization: Bearer __SUPABASE_SERVICE_ROLE_KEY__"
# Expected: JSON array con 1 elemento (no 401, no 403)
```

Si alguno falla → STOP, avisar a YACU antes de continuar.

- [ ] **Verificar PHP local disponible**

```bash
"C:/laragon/bin/php/php-8.4.2-nts-Win32-vs17-x64/php.exe" --version
# Expected: PHP 8.4.2
```

Si no existe ese path, buscar `php.exe` en Laragon/XAMPP. Anotar el path real para usarlo en lugar del de abajo en todos los `php -S` comandos.

- [ ] **Verificar Node 20+ y npm disponibles**

```bash
node --version  # >= 20
npm --version
```

---

## Phase 0 — Bootstrap del proyecto

### Task 1: Crear carpeta del proyecto

**Files:**
- Create: `D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/` (carpeta raíz)

- [ ] **Step 1: Verificar que la carpeta no existe ya con contenido**

```bash
ls "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/" 2>&1
```

Si existen sólo `docs/specs/...` y `docs/plans/...` (creados durante brainstorming) → OK, continuar. Si hay package.json u otro contenido → STOP, avisar a YACU.

- [ ] **Step 2: Crear subcarpetas base**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
mkdir -p src/{routes/tabs,components/{auth,layout,filters,cards,media,shared,ui},hooks,lib/{api,supabase,utils,schemas},types,styles,assets}
mkdir -p php-backend/_lib
mkdir -p migrations
mkdir -p tests/{unit,e2e}
mkdir -p .github/{workflows,ISSUE_TEMPLATE}
mkdir -p public
```

Expected: comando sin errores.

### Task 2: Inicializar Vite scaffold (manual, no `create vite`)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`
- Create: `index.html`

> No usamos `npm create vite` porque añade boilerplate que no queremos. Escribimos los archivos directamente con la estructura final.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "festival-sistema-usuarios-vite",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:php": "php -S 127.0.0.1:8001 -t php-backend",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "@hookform/resolvers": "^5.2.2",
    "@supabase/supabase-js": "^2.104.1",
    "@tanstack/react-query": "^5.100.1",
    "@vimeo/player": "^2.30.4",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "react-hook-form": "^7.73.1",
    "react-router-dom": "^7.14.2",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "@playwright/test": "^1.49.0",
    "@tailwindcss/vite": "^4.2.4",
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/node": "^24.12.2",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.1",
    "@vitest/ui": "^4.1.5",
    "eslint": "^10.2.1",
    "eslint-plugin-react-hooks": "^7.1.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.5.0",
    "jsdom": "^29.0.2",
    "tailwindcss": "^4.2.4",
    "typescript": "~6.0.2",
    "typescript-eslint": "^8.58.2",
    "vite": "^8.0.10",
    "vitest": "^4.1.5"
  }
}
```

- [ ] **Step 2: Crear `tsconfig.json` (root)**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 3: Crear `tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Crear `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Crear `vite.config.ts`** (basado en sibling, ajustes a este proyecto)

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
```

- [ ] **Step 6: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#08051E" />
    <title>Festival DanzArte 2026 — Mi Cuenta</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Crear `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Crear `src/App.tsx` placeholder**

```tsx
export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center text-text-90">
      <h1 className="text-2xl">Festival DanzArte — Sistema de Usuarios</h1>
    </div>
  );
}
```

- [ ] **Step 9: Crear `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

### Task 3: Instalar dependencias

- [ ] **Step 1: `npm install`**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
npm install
```

Expected: exit 0, sin errores. Algunas warnings de peer deps son OK.

- [ ] **Step 2: Verificar `npm run typecheck`**

```bash
npm run typecheck
```

Expected: exit 0 (sin errores TS).

- [ ] **Step 3: Verificar `npm run build`**

```bash
npm run build
```

Expected: build OK, genera `dist/`.

- [ ] **Step 4: Commit checkpoint** (sólo si git ya está inicializado — si no, esperar a Task 17)

Skip — git init viene en Task 17.

### Task 4: Configurar Tailwind 4 + design tokens

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/globals.css`

- [ ] **Step 1: Crear `src/styles/tokens.css`**

```css
:root {
  --bg-base: #08051E;
  --bg-elev: #0f0a2d;
  --cyan: #00E5FF;
  --fuchsia: #FF1FA8;
  --gold: #E8D098;
  --text-90: rgba(255, 255, 255, 0.9);
  --text-45: rgba(255, 255, 255, 0.45);
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --gradient-cf: linear-gradient(135deg, var(--cyan), var(--fuchsia));
  --radius-card: 1rem;
  --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.4);
}

html, body {
  background-color: var(--bg-base);
  color: var(--text-90);
}
```

- [ ] **Step 2: Crear `src/styles/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./tokens.css";

@theme {
  --color-base: var(--bg-base);
  --color-elev: var(--bg-elev);
  --color-cyan: var(--cyan);
  --color-fuchsia: var(--fuchsia);
  --color-gold: var(--gold);
  --color-text-90: var(--text-90);
  --color-text-45: var(--text-45);
  --color-glass-bg: var(--glass-bg);
  --color-glass-border: var(--glass-border);
}

body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
```

- [ ] **Step 3: Verificar build con Tailwind activado**

```bash
npm run build
```

Expected: build OK, `dist/assets/*.css` contiene reglas Tailwind.

### Task 5: Configurar shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Crear `components.json`** (matchea sibling)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "rtl": false,
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 2: Crear `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Instalar componentes shadcn base**

```bash
npx shadcn@latest add button card input tabs dialog tooltip skeleton avatar badge sonner separator dropdown-menu sheet scroll-area
```

Si interactivo pregunta directorio → confirmar default. Espera ~30s.

Expected: archivos creados en `src/components/ui/`.

- [ ] **Step 4: Verificar typecheck post-shadcn**

```bash
npm run typecheck
```

Expected: exit 0.

### Task 6: Crear archivos de meta-repo (gitignore, env, editorconfig, nvmrc)

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `.editorconfig`
- Create: `.nvmrc`

- [ ] **Step 1: `.gitignore`**

```gitignore
# deps
node_modules
.pnpm-store

# build
dist
dist-ssr
*.local

# vite
.vite-cache
.vite

# env
.env
.env.local
.env.*.local
!.env.example

# logs
logs
*.log
npm-debug.log*

# os
.DS_Store
Thumbs.db

# editors
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea

# typescript
*.tsbuildinfo

# PHP backend secret
php-backend/config.php
php-backend/rate-limit-data
php-backend/stderr.log

# playwright
test-results
playwright-report
playwright/.cache

# coverage
coverage

# auto-verify-loop screenshots (kept locally, not in repo)
.claude/auto-verify-loop

# backups
backups/
```

- [ ] **Step 2: `.env.example`**

```bash
# Pasa al frontend en build (Vite expone solo VITE_*)
VITE_API_URL=/api
VITE_SUPABASE_URL=https://supabase.imaginarte.cloud
VITE_SUPABASE_ANON_KEY=__SUPABASE_ANON_KEY__
```

- [ ] **Step 3: `.editorconfig`**

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[*.php]
indent_size = 4
```

- [ ] **Step 4: `.nvmrc`**

```
22
```

### Task 7: Configurar ESLint

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Crear `eslint.config.js`**

```js
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "php-backend", "*.tsbuildinfo"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
);
```

- [ ] **Step 2: Verificar `npm run lint`**

```bash
npm run lint
```

Expected: exit 0 (sin errores). Si hay errores en `src/components/ui/*` shadcn-generated, agregar `src/components/ui` al `ignores` o ajustar reglas.

### Task 8: Crear archivos de documentación inicial

**Files:**
- Create: `README.md`
- Create: `CLAUDE.md`
- Create: `AVANCES.md`

- [ ] **Step 1: `README.md`**

```markdown
# Festival DanzArte 2026 — Sistema de Usuarios (Vite)

Portal web para participantes del Festival DanzArte 2026 — versión moderna en Vite + React + TypeScript.

## Quick start

```bash
# 1. Instalar deps
npm install

# 2. Copiar template de env
cp .env.example .env.local
# Editar .env.local si hace falta (defaults apuntan a /api proxy)

# 3. Copiar template PHP config
cp php-backend/config.example.php php-backend/config.php
# Llenar SUPABASE_SERVICE_ROLE_KEY en config.php

# 4. Arrancar backend PHP (terminal 1)
npm run dev:php
# (asume "C:/laragon/bin/php/.../php.exe" en PATH o ajustá el script)

# 5. Arrancar frontend (terminal 2)
npm run dev
```

Abrir http://127.0.0.1:5173/.

## Stack

Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn/ui, TanStack Query, react-router 7, supabase-js, zod, react-hook-form. Backend: PHP 8 (SiteGround). DB: Supabase self-hosted en `supabase.imaginarte.cloud`.

## Estructura

Ver `docs/specs/2026-05-12-festival-sistema-usuarios-vite-design.md` para arquitectura completa.

## Multi-dev workflow

Antes de tocar archivos: lee `AVANCES.md` sección "EN PROGRESO" y verifica issues con label `in-progress` en GitHub. Reglas completas en `CLAUDE.md`.
```

- [ ] **Step 2: `CLAUDE.md`**

```markdown
# CLAUDE.md — Festival Sistema Usuarios VITE

Este archivo guía a Claude Code (y a cualquier otro agente AI) cuando trabaja en este repo.

## Contexto

Portal de participantes del Festival DanzArte 2026, migrado desde HTML+JS+PHP vanilla a Vite+React+TS+Tailwind+shadcn con backend PHP en SiteGround y Supabase self-hosted.

URL prod (cuando active deploy): https://usuarios.festivaldanzarte.com

Spec arquitectura: `docs/specs/2026-05-12-festival-sistema-usuarios-vite-design.md`

## Reglas activas (CRÍTICAS)

### 1. Coordinación multi-dev (real-time)

**ANTES de tocar cualquier archivo**:
1. Lee `AVANCES.md` sección "EN PROGRESO"
2. Lista issues activos: `gh issue list --label in-progress --json number,title,assignees,labels`
3. Si tu cambio choca con archivos en uso por otro dev → coordina antes (comenta el issue o chat)
4. Reclamá el issue antes de codear:
   ```bash
   gh issue edit <n> --add-assignee @me --add-label in-progress
   gh issue comment <n> -b "🤖 Started by <dev> at $(date -u +%Y-%m-%dT%H:%MZ). Branch: feature/<branch>. Touching: <files>"
   ```
5. Trabajá en branch `feature/<dev>-<kebab>`, NUNCA push directo a main
6. Al cerrar: PR con `Closes #<n>` en body

### 2. Supabase SQL

**Ya autorizado** (correr sin pedir OK):
- CREATE FUNCTION / CREATE VIEW / ADD COLUMN / GRANT / REVOKE permisos

**Requiere OK explícito de YACU + CSV backup**:
- DROP COLUMN / DROP TABLE / DELETE rows / TRUNCATE / ALTER COLUMN TYPE con pérdida potencial
- ANTES de ejecutar: `curl ... -o backups/<fecha>/<tabla>.csv` con todas las filas

### 3. Service role key

- Vive sólo en `php-backend/config.php` (gitignored) y GitHub Secrets
- NUNCA en frontend, commits ni logs
- Si lo ves expuesto en el código fuente → STOP, alertar al user, rotar

### 4. Tono español formal

- Usar "usted" siempre en UI/copy/respuestas
- Evitar voseo ("vos/podés/tenés/querés")

### 5. Verificación visual

- Tras cualquier cambio de UI: invocar skill `auto-verify-loop` o Playwright manual
- Screenshots a `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS VITE/<pantalla>/`
- Antes de reportar "terminado" → screenshot confirmando el resultado

### 6. UI/UX

- Antes de tocar diseño/UI → invocar skill `ui-ux-pro-max`, `ui-styling`, `design-system` o `design`
- Glass + gradient borders (paleta cyan/fuchsia/gold sobre bg #08051E)

### 7. Skills al cerrar

- En el último mensaje de cada tarea: listar qué skills se usaron y para qué

## Comandos útiles

```bash
npm run dev           # frontend en :5173
npm run dev:php       # backend PHP en :8001
npm run typecheck     # tsc --noEmit
npm run lint
npm run build         # tsc + vite build
npm run test          # vitest
npm run test:e2e      # playwright
```

## Estructura clave

- `src/routes/` — páginas (LoginPage, DashboardPage, 5 tabs)
- `src/components/` — UI (cards, layout, filters, shared)
- `src/lib/api/` — clientes HTTP que hablan con `/api/*` PHP
- `src/hooks/` — TanStack Query hooks (useInscripciones, useKardex, ...)
- `php-backend/` — endpoints PHP
- `migrations/` — SQL aplicado en Supabase
- `docs/specs/` — spec arquitectura
- `docs/plans/` — planes de implementación

## NO hacer

- No commitear `php-backend/config.php`, `.env*`, ni screenshots de prod
- No hardcodear service_role en frontend (jamás)
- No push directo a `main`
- No usar `git --force` ni `reset --hard` para resolver conflictos
- No saltear hooks de git con `--no-verify`
```

- [ ] **Step 3: `AVANCES.md`**

```markdown
# AVANCES — Festival Sistema Usuarios VITE

> **Antes de empezar tu sesión:**
> 1. Leé "EN PROGRESO" abajo — si otro dev tiene tu archivo, coordiná primero
> 2. Verificá issues activos: `gh issue list --label in-progress`
> 3. Claim tu issue: `gh issue edit <n> --add-assignee @me --add-label in-progress`
> 4. Escribí tu entrada en "EN PROGRESO" en tu primer commit de la branch feature

## EN PROGRESO

| Dev | Branch | Inicio (UTC) | Archivos | Issue |
|---|---|---|---|---|
| _(vacío)_ | | | | |

## HISTORIAL

### 2026-05-12

- **shera88 (+ Claude)** — `main` — bootstrap inicial
  - Tocó: estructura completa fase 0 (configs, scaffold Vite, shadcn, ESLint, gitignore, docs)
  - Resultado: repo inicializado, primer commit listo para push
  - Siguiente: aplicar migrations SQL y backend PHP (Plan A fases 2-3)
  - PR: N/A (commit inicial directo a main, antes de protected branch)
```

### Task 9: Importar logo Festival DanzArte

**Files:**
- Create: `src/assets/logo-danzarte.png` (copiar desde legacy)
- Create: `public/favicon.png` (copiar desde legacy si existe, o derivar)

- [ ] **Step 1: Copiar logo**

```bash
cp "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/FESTIVAL SISTEMA DE USUARIOS/assets/logo-danzarte.png" \
   "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/src/assets/logo-danzarte.png"
```

- [ ] **Step 2: Copiar favicon (usar el mismo logo como favicon por ahora)**

```bash
cp "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/FESTIVAL SISTEMA DE USUARIOS/assets/logo-danzarte.png" \
   "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/public/favicon.png"
```

### Task 10: Crear placeholder router + smoke test

**Files:**
- Modify: `src/App.tsx`
- Create: `tests/unit/smoke.test.ts`
- Create: `vitest.config.ts`

- [ ] **Step 1: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 2: Crear `tests/unit/smoke.test.ts` (test simple para validar pipeline)**

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("2 + 2 = 4", () => {
    expect(2 + 2).toBe(4);
  });
});
```

- [ ] **Step 3: Correr test**

```bash
npm run test
```

Expected: 1 test passing.

### Task 11: Git init + primer commit

- [ ] **Step 1: `git init`**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
git init
git config user.name "shera88"
git config user.email "<email-de-shera88-aqui>"   # confirmar con YACU
```

> **Nota**: `gh api /user` no expone email si el user lo tiene privado. Usar el email visible en GitHub Settings → Emails, o `noreply` de GitHub: `71031682+shera88@users.noreply.github.com`.

- [ ] **Step 2: Crear branch `main`**

```bash
git checkout -b main
```

- [ ] **Step 3: Stage todo y commit**

```bash
git add .
git status   # verificar que .env.local NO está, que config.php NO está
git commit -m "chore: bootstrap Vite + React + TS + Tailwind 4 + shadcn

- Vite 8, React 19, TS 6, Tailwind 4
- shadcn/ui base-nova
- TanStack Query, react-router 7, supabase-js
- ESLint + Vitest + Playwright configurados
- Design tokens DanzArte 2026 (paleta cyan/fuchsia/gold sobre #08051E)
- CLAUDE.md + AVANCES.md + README"
```

Expected: commit exitoso.

### Task 12: Crear repo GitHub via API + push

- [ ] **Step 1: Crear repo via API**

```bash
GITHUB_PAT="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"

curl -X POST \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user/repos \
  -d '{
    "name": "festival-sistema-usuarios-vite",
    "description": "Portal web de participantes del Festival DanzArte 2026 — Vite + React + TS + Tailwind + Supabase",
    "private": true,
    "has_issues": true,
    "has_projects": true,
    "auto_init": false
  }'
```

Expected: respuesta JSON con `"full_name": "shera88/festival-sistema-usuarios-vite"`, `"html_url": "..."`.

- [ ] **Step 2: Configurar remote y push**

```bash
git remote add origin https://shera88:${GITHUB_PAT}@github.com/shera88/festival-sistema-usuarios-vite.git
git push -u origin main
```

Expected: push OK.

> **Nota seguridad**: el PAT queda en `.git/config` con el remote URL. Después del push, opcionalmente cambiar a SSH o usar credential helper. Por simplicidad de plan, dejarlo así por ahora. Anotar como tech debt.

- [ ] **Step 3: Verificar repo público en navegador**

Abrir `https://github.com/shera88/festival-sistema-usuarios-vite`. Confirmar archivos visibles.

### Task 13: Setup branch protection en main

- [ ] **Step 1: Habilitar branch protection vía API**

```bash
curl -X PUT \
  -H "Authorization: Bearer $GITHUB_PAT" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/shera88/festival-sistema-usuarios-vite/branches/main/protection \
  -d '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["lint", "typecheck", "build"]
    },
    "enforce_admins": false,
    "required_pull_request_reviews": {
      "required_approving_review_count": 1,
      "dismiss_stale_reviews": true,
      "require_code_owner_reviews": false
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false,
    "required_conversation_resolution": true
  }'
```

Expected: 200/201 con config retornada.

> **Nota**: `required_status_checks.contexts` requiere que el workflow CI haya corrido al menos una vez. Si falla en este paso por "Context 'lint' is not valid", primero crear CI workflow (Task 16), correrlo, y luego volver a Task 13.

### Task 14: Crear labels Issues

- [ ] **Step 1: Borrar labels default y crear las del proyecto**

```bash
# Borrar labels default que no usamos (opcional)
for L in "good first issue" "help wanted" "invalid" "wontfix" "duplicate" "question"; do
  curl -X DELETE \
    -H "Authorization: Bearer $GITHUB_PAT" \
    "https://api.github.com/repos/shera88/festival-sistema-usuarios-vite/labels/${L// /%20}"
done

# Crear labels del proyecto
declare -A LABELS=(
  ["frontend"]="3178c6:Frontend React/Vite"
  ["backend-php"]="777bb4:PHP backend"
  ["db"]="336791:Supabase / SQL"
  ["ui"]="ff1fa8:Diseño / UI"
  ["infra"]="6e7681:CI/CD / DevOps"
  ["in-progress"]="fbca04:Alguien lo está trabajando AHORA"
  ["bug"]="d73a4a:Bug"
  ["feat"]="00e5ff:Feature"
  ["docs"]="0075ca:Documentación"
  ["blocked"]="b60205:Bloqueado por algo externo"
)

for name in "${!LABELS[@]}"; do
  IFS=":" read -r color desc <<< "${LABELS[$name]}"
  curl -X POST \
    -H "Authorization: Bearer $GITHUB_PAT" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/repos/shera88/festival-sistema-usuarios-vite/labels \
    -d "{\"name\":\"$name\",\"color\":\"$color\",\"description\":\"$desc\"}"
done
```

Expected: 10 POSTs exitosos.

### Task 15: Crear issue templates + PR template

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug.md`
- Create: `.github/ISSUE_TEMPLATE/feature.md`
- Create: `.github/ISSUE_TEMPLATE/tarea.md`
- Create: `.github/pull_request_template.md`

- [ ] **Step 1: `.github/ISSUE_TEMPLATE/bug.md`**

```markdown
---
name: Bug
about: Reportar algo que no funciona
labels: bug
---

## Descripción
<!-- Qué pasó vs. qué esperabas -->

## Pasos para reproducir
1.
2.
3.

## Contexto
- Navegador / OS:
- URL afectada:
- Screenshot / logs:

## Severidad
- [ ] 🔴 Bloquea features clave (login, navegación)
- [ ] 🟠 Degrada UX (visual, performance)
- [ ] 🟡 Menor (typo, edge case raro)
```

- [ ] **Step 2: `.github/ISSUE_TEMPLATE/feature.md`**

```markdown
---
name: Feature
about: Proponer una funcionalidad nueva
labels: feat
---

## Necesidad
<!-- Qué problema resuelve / qué usuario lo necesita -->

## Propuesta
<!-- Cómo se vería implementado -->

## Criterios de aceptación
- [ ]
- [ ]

## Files afectados (estimado)
- `src/...`
- `php-backend/...`
```

- [ ] **Step 3: `.github/ISSUE_TEMPLATE/tarea.md`**

```markdown
---
name: Tarea
about: Trabajo técnico / refactor / chore
labels: ""
---

## Tarea
<!-- Descripción concreta -->

## Files
<!-- Lista para detectar colisiones con otros devs -->
- `src/...`

## Definition of done
- [ ]
- [ ]
```

- [ ] **Step 4: `.github/pull_request_template.md`**

```markdown
## Qué cambia
<!-- 1-3 bullets -->

## Closes
Closes #<issue-number>

## Test plan
- [ ] `npm run typecheck` pasa
- [ ] `npm run lint` pasa
- [ ] `npm run build` pasa
- [ ] `npm run test` pasa
- [ ] (UI) Screenshot adjunto comparando con original
- [ ] (Backend) Endpoint probado con curl

## Notas para reviewer
<!-- Cosas que dolieron, decisiones tomadas, deuda introducida -->
```

### Task 16: Crear workflows CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: `.github/workflows/ci.yml` (ACTIVO desde día 1)**

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"
      - run: npm ci
      - run: npm run typecheck

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - run: npm run test
```

- [ ] **Step 2: `.github/workflows/deploy.yml` (PARQUEADO, manual)**

```yaml
name: deploy

on:
  workflow_dispatch:
  # push:
  #   branches: [main]   # descomenta sólo cuando YACU autorice deploy

concurrency:
  group: deploy-production
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "npm"

      - name: Install deps
        run: npm ci

      - name: Build SPA
        env:
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: npm run build

      - name: Generate php-backend/config.php
        run: |
          cat > php-backend/config.php <<EOF
          <?php
          declare(strict_types=1);
          return [
              'supabase_url' => '${{ secrets.SUPABASE_URL }}',
              'supabase_service_role_key' => '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
              'session_name' => 'fdz_session',
              'session_lifetime' => 604800,
              'cookie_secure' => true,
              'cookie_samesite' => 'Lax',
              'cookie_domain' => 'usuarios.festivaldanzarte.com',
          ];
          EOF

      - name: Stage deploy package
        run: |
          mkdir -p deploy-package
          cp -r dist/* deploy-package/
          mkdir -p deploy-package/api
          cp -r php-backend/* deploy-package/api/

      - name: Deploy via SFTP
        uses: SamKirkland/FTP-Deploy-Action@v4.3.5
        with:
          server: ${{ secrets.SFTP_HOST }}
          username: ${{ secrets.SFTP_USER }}
          password: ${{ secrets.SFTP_PASSWORD }}
          server-dir: ${{ secrets.SFTP_REMOTE_PATH }}/
          local-dir: deploy-package/
          protocol: ftp

      - name: Smoke test
        run: |
          curl -fsS https://usuarios.festivaldanzarte.com/ | grep -q "Festival DanzArte"
```

- [ ] **Step 3: Commit + push CI workflows**

```bash
git add .github/
git commit -m "ci: add lint+typecheck+build workflow (deploy parked)"
git push origin main
```

- [ ] **Step 4: Verificar que CI corre verde**

Abrir `https://github.com/shera88/festival-sistema-usuarios-vite/actions` en navegador. Verificar workflow "ci" corriendo y verde tras ~2 min.

- [ ] **Step 5: Re-aplicar branch protection si Task 13 falló**

Si Task 13 falló por "Context not valid", re-ejecutar el mismo curl ahora que `lint`/`typecheck`/`build` aparecen como contextos válidos.

### Task 17: Crear Project board (manual)

> Este paso requiere UI (la API de Projects v2 es GraphQL y compleja para 1 board).

- [ ] **Step 1: Crear Project**

Navegar a `https://github.com/shera88?tab=projects` → "New project" → "Board" → nombre: "Festival Usuarios VITE" → Create.

- [ ] **Step 2: Conectar al repo**

En el board → ⚙️ Settings → "Manage access" → asociar el repo `festival-sistema-usuarios-vite`.

- [ ] **Step 3: Crear columnas**

Por defecto vienen "Todo / In Progress / Done". Renombrar/agregar para tener: `Backlog`, `In Progress`, `Review`, `Done`.

- [ ] **Step 4: Crear primer issue de seed**

```bash
gh issue create \
  --repo shera88/festival-sistema-usuarios-vite \
  --title "[seed] Aplicar migrations SQL en Supabase" \
  --label db \
  --body "Aplicar migrations/001_login_rpcs.sql y 002_revoke_anon.sql (ver Plan A fases 2). Ambas son aditivas (CREATE FUNCTION + REVOKE permisos), sin riesgo de pérdida de data."
```

> Si `gh` CLI no está autenticado: `gh auth login` con el PAT del repo.

Expected: issue #1 creado.

---

## Phase 2 — Migrations SQL

### Task 18: Auditar estado actual de RPCs en Supabase (read-only)

- [ ] **Step 1: Listar funciones existentes en schema public**

```bash
SUPABASE_URL="https://supabase.imaginarte.cloud"
SR_KEY="__SUPABASE_SERVICE_ROLE_KEY__"

# Via Supabase MCP es más cómodo; alternativa REST con query SQL:
# Tenés que crear una RPC `exec_sql` previa o usar Studio. Acá usamos Studio.
```

Abrir Supabase Studio: `https://supabase.imaginarte.cloud` → SQL Editor → correr:

```sql
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

Anotar si ya existe `search_login_users` o `validate_login`. Si existen → ver Task 19 paso 1 para CREATE OR REPLACE.

- [ ] **Step 2: Verificar acceso anon a tablas privadas (estado pre-migración)**

```bash
ANON_KEY="__SUPABASE_ANON_KEY__"

curl -s "$SUPABASE_URL/rest/v1/festival_contactos_global?select=id_contacto&limit=1" \
  -H "apikey: $ANON_KEY"
```

Anotar resultado (200 con data = anon TIENE acceso → revoke en Task 20 lo cortará; 403/empty = ya está protegido → skip Task 20).

### Task 19: Crear y aplicar `001_login_rpcs.sql`

**Files:**
- Create: `migrations/001_login_rpcs.sql`

- [ ] **Step 1: Crear archivo `migrations/001_login_rpcs.sql`**

```sql
-- migrations/001_login_rpcs.sql
-- ADITIVO: crea 2 funciones SECURITY DEFINER para login del portal de usuarios.
-- No toca data existente. Idempotente (CREATE OR REPLACE).

-- 1) Búsqueda de usuarios para autocomplete de login
--    Filtra por nombre/carnet/telefono/email
--    Excluye contactos con antecedentes='prospecto_no_participo'
--    SECURITY DEFINER → corre con privs del owner (puede leer la tabla
--    aunque anon no tenga SELECT directo)
CREATE OR REPLACE FUNCTION public.search_login_users(p_query text)
RETURNS TABLE (
  id_contacto text,
  numero_de_carnet text,
  nombre_y_apellido text,
  telefono text,
  correo_electronico text,
  ciudad text,
  imagen_contacto text,
  id_agrupacion text,
  nombre_agrupacion text,
  enlace_del_logo text,
  rol_primario text,
  es_representante boolean,
  es_director boolean,
  es_coreografo boolean,
  id_original_representante text,
  id_original_director text,
  id_original_coreografo text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id_contacto,
    numero_de_carnet,
    nombre_y_apellido,
    telefono,
    correo_electronico,
    ciudad,
    imagen_contacto,
    id_agrupacion,
    nombre_agrupacion,
    enlace_del_logo,
    rol_primario,
    es_representante,
    es_director,
    es_coreografo,
    id_original_representante,
    id_original_director,
    id_original_coreografo
  FROM festival_contactos_global
  WHERE (antecedentes IS NULL OR antecedentes <> 'prospecto_no_participo')
    AND length(coalesce(p_query, '')) >= 1
    AND (
      nombre_y_apellido ILIKE '%' || p_query || '%' OR
      numero_de_carnet ILIKE '%' || p_query || '%' OR
      telefono ILIKE '%' || p_query || '%' OR
      coalesce(correo_electronico, '') ILIKE '%' || p_query || '%'
    )
  ORDER BY nombre_y_apellido
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_login_users(text) TO anon, authenticated, service_role;

-- 2) Validación de login (carnet o telefono como password)
CREATE OR REPLACE FUNCTION public.validate_login(p_id_contacto text, p_password text)
RETURNS TABLE (
  id_contacto text,
  numero_de_carnet text,
  nombre_y_apellido text,
  telefono text,
  correo_electronico text,
  ciudad text,
  imagen_contacto text,
  id_agrupacion text,
  nombre_agrupacion text,
  enlace_del_logo text,
  rol_primario text,
  es_representante boolean,
  es_director boolean,
  es_coreografo boolean,
  id_original_representante text,
  id_original_director text,
  id_original_coreografo text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id_contacto,
    numero_de_carnet,
    nombre_y_apellido,
    telefono,
    correo_electronico,
    ciudad,
    imagen_contacto,
    id_agrupacion,
    nombre_agrupacion,
    enlace_del_logo,
    rol_primario,
    es_representante,
    es_director,
    es_coreografo,
    id_original_representante,
    id_original_director,
    id_original_coreografo
  FROM festival_contactos_global
  WHERE id_contacto = p_id_contacto
    AND (antecedentes IS NULL OR antecedentes <> 'prospecto_no_participo')
    AND (
      regexp_replace(coalesce(numero_de_carnet, ''), '\s', '', 'g') = regexp_replace(coalesce(p_password, ''), '\s', '', 'g')
      OR
      regexp_replace(coalesce(telefono, ''), '\D', '', 'g') = regexp_replace(coalesce(p_password, ''), '\D', '', 'g')
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_login(text, text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.search_login_users(text) IS
  'Autocomplete de usuarios para la pantalla de login del portal. Excluye prospectos. Pública (anon).';
COMMENT ON FUNCTION public.validate_login(text, text) IS
  'Valida login del portal usando id_contacto + (numero_de_carnet o telefono). Pública (anon). Devuelve fila completa o 0 filas.';
```

- [ ] **Step 2: Aplicar en Supabase Studio**

Copiar el contenido completo del archivo, pegar en SQL Editor de Supabase Studio, ejecutar.

Expected: 2 `CREATE FUNCTION` + 2 `GRANT` + 2 `COMMENT` exitosos.

- [ ] **Step 3: Probar `search_login_users` con anon key**

```bash
ANON_KEY="__SUPABASE_ANON_KEY__"

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/search_login_users" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_query":"a"}' | head -c 500
```

Expected: JSON array con hasta 20 elementos. Si retorna `[]` → la búsqueda no matchea (probar con `"q":"juan"` o algo más común). Si retorna `{"code":..., "message":"permission denied"}` → revisar GRANT.

- [ ] **Step 4: Probar `validate_login` con anon key (necesita un id_contacto + carnet real)**

> YACU debe proveer un par `(id_contacto, carnet o telefono)` válido. Mientras tanto:

```bash
# Tomar un id_contacto de la búsqueda anterior + su carnet (visible en el response)
ID="<id-de-contacto-del-paso-3>"
CARNET="<carnet-del-mismo-contacto-del-paso-3>"

curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/validate_login" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_id_contacto\":\"$ID\",\"p_password\":\"$CARNET\"}"
```

Expected: 1 fila con el contacto. Si retorna `[]` → revisar que el carnet matche normalizado (sin espacios) o probar con teléfono.

- [ ] **Step 5: Probar caso negativo (password incorrecto)**

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/validate_login" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_id_contacto\":\"$ID\",\"p_password\":\"wrong-password\"}"
```

Expected: `[]` (sin matches).

- [ ] **Step 6: Commit migration**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
git add migrations/001_login_rpcs.sql
git commit -m "db: add login RPCs (search_login_users + validate_login)

- Both SECURITY DEFINER, GRANT to anon/authenticated/service_role
- search_login_users: autocomplete por nombre/carnet/tel/email,
  excluye prospectos
- validate_login: matchea carnet O telefono (normalizado)
- Aplicado en Supabase Studio. Idempotente (CREATE OR REPLACE)."
```

### Task 20: Crear y aplicar `002_revoke_anon.sql` (CONDICIONAL)

> Esta migration revoca permisos del rol `anon` en tablas privadas. **NO destruye data** (REVOKE de permiso ≠ DROP), pero **puede romper apps existentes** (sibling, scripts, otros frontends que asuman acceso anon directo).

- [ ] **Step 1: Verificar si sibling u otros proyectos asumen anon SELECT en estas tablas**

```bash
# Buscar uso de anon key directamente con SELECT en tablas privadas
grep -ril "festival_contactos_global" "D:/Claude/APPS/APP FESTIVAL DANZARTE 2026 - VITE/src" 2>/dev/null
grep -ril "registro_de_inscripcion_" "D:/Claude/APPS/APP FESTIVAL DANZARTE 2026 - VITE/src" 2>/dev/null
```

- [ ] **Step 2: Decidir scope con YACU**

Antes de aplicar, **PARAR y consultar a YACU**:
- ¿Aplico revoke o lo dejo para una fase posterior?
- ¿Hay frontend(s) actualmente leyendo `festival_contactos_global` con anon que esto rompería?

Si YACU dice "aplicar ahora" → continuar. Si dice "deferred" → crear el archivo pero no aplicarlo, commitearlo y skip steps 4-7.

- [ ] **Step 3: Crear `migrations/002_revoke_anon.sql`**

```sql
-- migrations/002_revoke_anon.sql
-- ADITIVO en cuanto a data (no toca filas), pero RESTRICTIVO en permisos:
-- el rol anon pierde SELECT directo en tablas privadas. El portal de usuarios
-- accede vía RPCs SECURITY DEFINER (search_login_users, validate_login) y vía
-- PHP backend con service_role key.
--
-- ⚠️ Verificar antes que no haya consumidores anon legítimos leyendo estas
-- tablas directamente (ver Task 20 step 1).

-- Tablas privadas con PII / data del festival
REVOKE SELECT ON public.festival_contactos_global FROM anon;
REVOKE SELECT ON public.registro_de_inscripcion_2023 FROM anon;
REVOKE SELECT ON public.registro_de_inscripcion_2024 FROM anon;
REVOKE SELECT ON public.registro_de_inscripcion_2025 FROM anon;
REVOKE SELECT ON public.registro_de_inscripcion_2026 FROM anon;
REVOKE SELECT ON public.registro_kardex_2023 FROM anon;
REVOKE SELECT ON public.registro_kardex_2024 FROM anon;
REVOKE SELECT ON public.registro_kardex_2025 FROM anon;
REVOKE SELECT ON public.registro_kardex_2026 FROM anon;
REVOKE SELECT ON public.recepcion_notas_2023 FROM anon;
REVOKE SELECT ON public.recepcion_notas_2024 FROM anon;
REVOKE SELECT ON public.recepcion_notas_2025 FROM anon;

-- NOTAS:
-- - instituciones queda con SELECT anon (los logos públicos los lee el frontend).
-- - jurados_consolidado: si quieres también restringir, descomenta:
-- REVOKE SELECT ON public.jurados_consolidado FROM anon;

-- Para verificar después:
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_schema='public' AND table_name='festival_contactos_global';
```

- [ ] **Step 4: Aplicar (sólo con OK de YACU)**

Pegar en Supabase Studio SQL Editor → Run.

Expected: 12 `REVOKE` exitosos.

- [ ] **Step 5: Confirmar que anon ya no puede SELECT directo**

```bash
curl -s "$SUPABASE_URL/rest/v1/festival_contactos_global?select=id_contacto&limit=1" \
  -H "apikey: $ANON_KEY"
```

Expected: `{"code":"...", "message":"permission denied for table festival_contactos_global"}` o array vacío.

- [ ] **Step 6: Confirmar que RPC de login SÍ funciona (no rompió)**

Repetir Task 19 step 3. Debe seguir devolviendo resultados.

- [ ] **Step 7: Commit**

```bash
git add migrations/002_revoke_anon.sql
git commit -m "db: revoke anon SELECT on private tables

- festival_contactos_global, registro_de_inscripcion_*,
  registro_kardex_*, recepcion_notas_*
- instituciones y jurados_consolidado se mantienen lectura anon
- Acceso a estas tablas ahora exige:
  1) RPC SECURITY DEFINER (anon) — sólo search_login_users / validate_login
  2) service_role (backend PHP)
- Aplicado en Supabase Studio (post-aprobación YACU)."
```

---

## Phase 3 — PHP Backend

### Task 21: `php-backend/config.example.php` y `config.php` local

**Files:**
- Create: `php-backend/config.example.php`
- Create: `php-backend/config.php` (LOCAL ONLY, gitignored)

- [ ] **Step 1: `php-backend/config.example.php`**

```php
<?php
declare(strict_types=1);

/**
 * Plantilla pública. Copiar a config.php y rellenar SUPABASE_SERVICE_ROLE_KEY.
 * config.php está en .gitignore.
 */
return [
    // Supabase
    'supabase_url'              => 'https://supabase.imaginarte.cloud',
    'supabase_service_role_key' => 'REPLACE_ME_WITH_REAL_JWT',

    // Sesión
    'session_name'     => 'fdz_session',
    'session_lifetime' => 60 * 60 * 24 * 7,        // 7 días
    'cookie_secure'    => false,                    // true en prod (HTTPS)
    'cookie_samesite'  => 'Lax',
    'cookie_domain'    => '',                       // '' en dev local; 'usuarios.festivaldanzarte.com' en prod

    // CORS
    'cors_origin' => 'http://127.0.0.1:5173',       // ajustar por entorno

    // Debug
    'debug' => true,                                 // false en prod
];
```

- [ ] **Step 2: Copiar a `config.php` local y rellenar**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
cp php-backend/config.example.php php-backend/config.php
```

Editar `php-backend/config.php` y reemplazar `REPLACE_ME_WITH_REAL_JWT` por:
```
__SUPABASE_SERVICE_ROLE_KEY__
```

- [ ] **Step 3: Verificar que `config.php` NO está stageado**

```bash
git status php-backend/
```

Expected: `config.example.php` listado como untracked, `config.php` NO aparece. Si aparece → revisar `.gitignore`.

### Task 22: `php-backend/_lib/supabase.php` (cURL wrapper)

**Files:**
- Create: `php-backend/_lib/supabase.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
/**
 * Cliente cURL minimal para Supabase PostgREST.
 * Service role JWT inyectado en cada request.
 * NUNCA se llama desde el navegador — sólo PHP server-side.
 */
declare(strict_types=1);

class SupabaseClient
{
    public function __construct(
        private string $url,
        private string $serviceKey
    ) {}

    /** Headers comunes para PostgREST. */
    private function headers(array $extra = []): array
    {
        return array_merge([
            'Authorization: Bearer ' . $this->serviceKey,
            'apikey: ' . $this->serviceKey,
            'Content-Type: application/json',
        ], $extra);
    }

    private function request(string $method, string $url, ?string $body, array $headers, int $timeout = 30): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_HTTPHEADER     => $headers,
        ]);
        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        $resp = curl_exec($ch);
        $http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            error_log("[supabase] cURL $method $url failed: $err");
            return [0, null];
        }
        $decoded = ($resp === '' || $resp === null) ? null : json_decode($resp, true);
        return [$http, $decoded ?? $resp];
    }

    /** GET /rest/v1/{table}?{querystring}. Retorna array (vacío si error). */
    public function select(string $table, array $query): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . http_build_query($query);
        [$status, $body] = $this->request('GET', $url, null, $this->headers());
        if ($status >= 200 && $status < 300 && is_array($body)) return $body;
        error_log("[supabase] select $table failed: HTTP $status — " . json_encode($body));
        return [];
    }

    /** GET con string raw de filtros tipo PostgREST OR (sin http_build_query). */
    public function selectRaw(string $table, string $rawQs): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/$table?" . $rawQs;
        [$status, $body] = $this->request('GET', $url, null, $this->headers());
        if ($status >= 200 && $status < 300 && is_array($body)) return $body;
        error_log("[supabase] selectRaw $table failed: HTTP $status — " . json_encode($body));
        return [];
    }

    /** POST /rest/v1/rpc/{fn}. */
    public function rpc(string $fn, array $args): array
    {
        $url = rtrim($this->url, '/') . "/rest/v1/rpc/$fn";
        [$status, $body] = $this->request(
            'POST',
            $url,
            json_encode($args, JSON_UNESCAPED_UNICODE),
            $this->headers()
        );
        if ($status >= 200 && $status < 300) return is_array($body) ? $body : [];
        error_log("[supabase] rpc $fn failed: HTTP $status — " . json_encode($body));
        return [];
    }
}

function supabase(): SupabaseClient
{
    static $client = null;
    if ($client === null) {
        $cfg = require __DIR__ . '/../config.php';
        $client = new SupabaseClient($cfg['supabase_url'], $cfg['supabase_service_role_key']);
    }
    return $client;
}
```

- [ ] **Step 2: Smoke test del wrapper**

Crear archivo temporal `php-backend/_smoke.php`:

```php
<?php
declare(strict_types=1);
require __DIR__ . '/_lib/supabase.php';

$rows = supabase()->select('instituciones', [
    'select' => 'id_agrupacion,nombre_agrupacion',
    'limit'  => 3,
]);
header('Content-Type: application/json');
echo json_encode($rows, JSON_PRETTY_PRINT);
```

Arrancar PHP server (terminal aparte):

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
"C:/laragon/bin/php/php-8.4.2-nts-Win32-vs17-x64/php.exe" -S 127.0.0.1:8001 -t php-backend
```

Otro terminal:
```bash
curl -s http://127.0.0.1:8001/_smoke.php | head -c 300
```

Expected: 3 instituciones JSON.

- [ ] **Step 3: Borrar `_smoke.php`**

```bash
rm php-backend/_smoke.php
```

### Task 23: `php-backend/_lib/session.php`

**Files:**
- Create: `php-backend/_lib/session.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

function startSecureSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $cfg = require __DIR__ . '/../config.php';
    session_name($cfg['session_name']);
    session_set_cookie_params([
        'lifetime' => $cfg['session_lifetime'],
        'path'     => '/',
        'domain'   => $cfg['cookie_domain'],
        'secure'   => $cfg['cookie_secure'],
        'httponly' => true,
        'samesite' => $cfg['cookie_samesite'],
    ]);
    session_start();

    // Sliding renew: cada request autenticado extiende la cookie
    if (!empty($_SESSION['user_id'])) {
        setcookie(
            session_name(),
            session_id(),
            [
                'expires'  => time() + $cfg['session_lifetime'],
                'path'     => '/',
                'domain'   => $cfg['cookie_domain'],
                'secure'   => $cfg['cookie_secure'],
                'httponly' => true,
                'samesite' => $cfg['cookie_samesite'],
            ]
        );
    }
}

function destroySession(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) startSecureSession();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(
            session_name(),
            '',
            time() - 42000,
            $params['path'],
            $params['domain'],
            $params['secure'],
            $params['httponly']
        );
    }
    session_destroy();
}
```

### Task 24: `php-backend/_lib/auth.php`

**Files:**
- Create: `php-backend/_lib/auth.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require_once __DIR__ . '/session.php';

function sendJson($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    $cfg = require __DIR__ . '/../config.php';
    $origin = $cfg['cors_origin'];
    header("Access-Control-Allow-Origin: $origin");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

function handlePreflight(): void
{
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        sendJson(null, 204);
        exit;
    }
}

function requireAuth(): array
{
    startSecureSession();
    if (empty($_SESSION['user_id']) || empty($_SESSION['user_data'])) {
        sendJson(['error' => 'No autenticado'], 401);
        exit;
    }
    return $_SESSION['user_data'];
}

function requireMethod(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
        sendJson(['error' => 'Método no permitido'], 405);
        exit;
    }
}

function jsonBody(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
```

### Task 25: `php-backend/_lib/context.php`

**Files:**
- Create: `php-backend/_lib/context.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

/**
 * Construye filtro PostgREST OR a partir de los ids del usuario en sesión.
 * Replicación exacta del buildContextFilter() del frontend legacy, pero ARMADO
 * 100% server-side desde $_SESSION (el cliente no puede inyectar otros ids).
 *
 * Devuelve string tipo `or=(id_agrupacion.eq."xxx",id_encargado.eq."yyy")`
 * o `null` si el usuario no tiene ids vinculados (caso anómalo).
 */
function buildContextFilter(array $user): ?string
{
    $conditions = [];

    foreach (parseIdCsv($user['id_agrupacion'] ?? '') as $id) {
        $conditions[] = 'id_agrupacion.eq.' . quoteIfNeeded($id);
    }
    if (!empty($user['id_original_representante'])) {
        $conditions[] = 'id_encargado.eq.' . quoteIfNeeded($user['id_original_representante']);
    }
    if (!empty($user['id_original_director'])) {
        $conditions[] = 'id_director.eq.' . quoteIfNeeded($user['id_original_director']);
    }
    if (!empty($user['id_original_coreografo'])) {
        $conditions[] = 'id_coreografo.eq.' . quoteIfNeeded($user['id_original_coreografo']);
    }

    if (count($conditions) === 0) return null;
    return 'or=(' . implode(',', $conditions) . ')';
}

function parseIdCsv($value): array
{
    if (!$value) return [];
    return array_values(array_filter(array_map('trim', explode(',', (string)$value))));
}

function quoteIfNeeded(string $value): string
{
    if (preg_match('/[=, ]/', $value)) return '"' . $value . '"';
    return $value;
}

function buildInFilter(string $column, array $ids): ?string
{
    if (count($ids) === 0) return null;
    $list = implode(',', array_map(fn($id) => '"' . $id . '"', $ids));
    return "$column=in.($list)";
}
```

### Task 26: Endpoint `search-participants.php`

**Files:**
- Create: `php-backend/search-participants.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('GET');

$q = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
if (strlen($q) < 1) {
    sendJson([]);
    exit;
}

$rows = supabase()->rpc('search_login_users', ['p_query' => $q]);

// Normalizar al formato esperado por el frontend (matchea el legacy)
$normalized = array_map(function ($c) {
    return [
        'id'                          => $c['id_contacto'] ?? null,
        'id_contacto'                 => $c['id_contacto'] ?? null,
        'nombre'                      => $c['nombre_y_apellido'] ?? null,
        'carnet'                      => $c['numero_de_carnet'] ?? null,
        'telefono'                    => $c['telefono'] ?? null,
        'email'                       => $c['correo_electronico'] ?? null,
        'ciudad'                      => $c['ciudad'] ?? null,
        'rol'                         => $c['rol_primario'] ?? null,
        'foto'                        => $c['imagen_contacto'] ?? null,
        'id_agrupacion'               => $c['id_agrupacion'] ?? null,
        'nombre_agrupacion'           => $c['nombre_agrupacion'] ?? null,
        'enlace_del_logo'             => $c['enlace_del_logo'] ?? null,
        'es_representante'            => $c['es_representante'] ?? false,
        'es_director'                 => $c['es_director'] ?? false,
        'es_coreografo'               => $c['es_coreografo'] ?? false,
        'id_original_representante'   => $c['id_original_representante'] ?? null,
        'id_original_director'        => $c['id_original_director'] ?? null,
        'id_original_coreografo'      => $c['id_original_coreografo'] ?? null,
    ];
}, $rows);

sendJson($normalized);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/search-participants.php?q=a" -H "Origin: http://127.0.0.1:5173" | head -c 500
```

Expected: JSON array de hasta 20 resultados.

### Task 27: Endpoint `login.php`

**Files:**
- Create: `php-backend/login.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';

handlePreflight();
requireMethod('POST');

$body = jsonBody();
$id   = trim((string)($body['id_contacto'] ?? ''));
$pwd  = trim((string)($body['password']    ?? ''));

if ($id === '' || $pwd === '') {
    sendJson(['error' => 'Faltan campos'], 400);
    exit;
}

$rows = supabase()->rpc('validate_login', [
    'p_id_contacto' => $id,
    'p_password'    => $pwd,
]);

if (empty($rows[0])) {
    sendJson(['error' => 'Carnet o contraseña incorrectos'], 401);
    exit;
}

$user = $rows[0];

startSecureSession();
session_regenerate_id(true);
$_SESSION['user_id']   = $user['id_contacto'];
$_SESSION['user_data'] = [
    'id_contacto'                 => $user['id_contacto'] ?? null,
    'numero_de_carnet'            => $user['numero_de_carnet'] ?? null,
    'nombre_y_apellido'           => $user['nombre_y_apellido'] ?? null,
    'telefono'                    => $user['telefono'] ?? null,
    'correo_electronico'          => $user['correo_electronico'] ?? null,
    'ciudad'                      => $user['ciudad'] ?? null,
    'imagen_contacto'             => $user['imagen_contacto'] ?? null,
    'id_agrupacion'               => $user['id_agrupacion'] ?? null,
    'nombre_agrupacion'           => $user['nombre_agrupacion'] ?? null,
    'enlace_del_logo'             => $user['enlace_del_logo'] ?? null,
    'rol_primario'                => $user['rol_primario'] ?? null,
    'es_representante'            => $user['es_representante'] ?? false,
    'es_director'                 => $user['es_director'] ?? false,
    'es_coreografo'               => $user['es_coreografo'] ?? false,
    'id_original_representante'   => $user['id_original_representante'] ?? null,
    'id_original_director'        => $user['id_original_director'] ?? null,
    'id_original_coreografo'      => $user['id_original_coreografo'] ?? null,
];

sendJson(['user' => $_SESSION['user_data']]);
```

- [ ] **Step 2: Smoke test login (necesita id_contacto + carnet real de YACU)**

```bash
ID="<id-real>"
PW="<carnet-o-tel-real>"

curl -s -X POST "http://127.0.0.1:8001/login.php" \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:5173" \
  -c cookies.txt \
  -d "{\"id_contacto\":\"$ID\",\"password\":\"$PW\"}"
```

Expected: `{"user": {...}}` con datos del usuario. Verificar que `cookies.txt` tiene una entrada `fdz_session`.

- [ ] **Step 3: Smoke test login fallido**

```bash
curl -s -X POST "http://127.0.0.1:8001/login.php" \
  -H "Content-Type: application/json" \
  -d "{\"id_contacto\":\"$ID\",\"password\":\"wrong\"}"
```

Expected: `{"error":"Carnet o contraseña incorrectos"}` con HTTP 401.

### Task 28: Endpoint `logout.php`

**Files:**
- Create: `php-backend/logout.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';

handlePreflight();
requireMethod('POST');

destroySession();
sendJson(['ok' => true]);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s -X POST "http://127.0.0.1:8001/logout.php" -b cookies.txt -c cookies.txt
```

Expected: `{"ok":true}`. Verificar que `cookies.txt` ya no tiene sesión activa (líneas tienen `0` en expiry o vacías).

### Task 29: Endpoint `me.php`

**Files:**
- Create: `php-backend/me.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
sendJson(['user' => $user]);
```

- [ ] **Step 2: Smoke test sin sesión**

```bash
curl -s "http://127.0.0.1:8001/me.php"
```

Expected: `{"error":"No autenticado"}` HTTP 401.

- [ ] **Step 3: Smoke test con sesión (re-login primero)**

```bash
curl -s -X POST "http://127.0.0.1:8001/login.php" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"id_contacto\":\"$ID\",\"password\":\"$PW\"}"

curl -s "http://127.0.0.1:8001/me.php" -b cookies.txt
```

Expected: `{"user": {...}}` con datos del usuario.

### Task 30: Endpoint `inscripciones.php`

**Files:**
- Create: `php-backend/inscripciones.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if (!in_array($year, ['2023', '2024', '2025', '2026'], true)) {
    sendJson(['error' => 'Año inválido'], 400);
    exit;
}

$filter = buildContextFilter($user);
if (!$filter) {
    sendJson([$year => []]);
    exit;
}

$select = '*';
$qs = $filter . "&select=$select&limit=200";
$rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);

sendJson([$year => $rows]);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/inscripciones.php?year=2026" -b cookies.txt | head -c 500
```

Expected: `{"2026":[ ... ]}` con inscripciones del usuario (puede ser array vacío si no tiene en 2026).

### Task 31: Endpoint `kardex.php`

**Files:**
- Create: `php-backend/kardex.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));
if (!in_array($year, ['2023', '2024', '2025', '2026'], true)) {
    sendJson(['error' => 'Año inválido'], 400);
    exit;
}

$filter = buildContextFilter($user);
if (!$filter) { sendJson([$year => []]); exit; }

// 1) Inscripciones para obtener nombres/ids/logos de agrupación
$insc = supabase()->selectRaw(
    "registro_de_inscripcion_$year",
    $filter . "&select=agrupacion,id_agrupacion,enlace_del_logo&limit=200"
);

$agrupNames = array_values(array_unique(array_filter(array_column($insc, 'agrupacion'))));
$agrupIds   = array_values(array_unique(array_filter(array_column($insc, 'id_agrupacion'))));

if (count($agrupNames) === 0 && count($agrupIds) === 0) {
    sendJson([$year => []]);
    exit;
}

// Indexar logos por nombre normalizado
$logoByName = [];
foreach ($insc as $i) {
    $key = mb_strtolower(trim($i['agrupacion'] ?? ''));
    if ($key !== '' && !empty($i['enlace_del_logo']) && empty($logoByName[$key])) {
        $logoByName[$key] = $i['enlace_del_logo'];
    }
}

// 2) Kardex por nombre o id de agrupación
$conditions = [];
foreach ($agrupNames as $n) $conditions[] = 'agrupacion.eq.' . quoteIfNeeded($n);
foreach ($agrupIds as $id)  $conditions[] = 'id_agrupacion.eq.' . quoteIfNeeded($id);
$kardexFilter = 'or=(' . implode(',', $conditions) . ')';

$kardex = supabase()->selectRaw(
    "registro_kardex_$year",
    "$kardexFilter&select=*&limit=1000"
);

// 3) Enriquecer kardex con logo
$enriched = array_map(function ($k) use ($logoByName) {
    $key = mb_strtolower(trim($k['agrupacion'] ?? ''));
    $k['enlace_del_logo'] = $logoByName[$key] ?? null;
    return $k;
}, $kardex);

sendJson([$year => $enriched]);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/kardex.php?year=2026" -b cookies.txt | head -c 500
```

Expected: `{"2026":[...]}` con integrantes.

### Task 32: Endpoint `calificaciones.php`

**Files:**
- Create: `php-backend/calificaciones.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2025'));
if (!in_array($year, ['2023', '2024', '2025'], true)) {
    sendJson([$year => []]);
    exit;
}

$filter = buildContextFilter($user);
if (!$filter) { sendJson([$year => []]); exit; }

// 1) Inscripciones del usuario en el año
$insc = supabase()->selectRaw(
    "registro_de_inscripcion_$year",
    $filter . "&select=id_inscripcion,agrupacion,enlace_del_logo,id_agrupacion,dia,orden,nombre_de_la_obra&limit=200"
);

$idsInsc = array_values(array_filter(array_column($insc, 'id_inscripcion')));
if (count($idsInsc) === 0) { sendJson([$year => []]); exit; }

$inscMap = [];
foreach ($insc as $i) $inscMap[$i['id_inscripcion']] = $i;

// 2) Notas de esas inscripciones
$inFilter = buildInFilter('id_inscripcion', $idsInsc);
$notas = supabase()->selectRaw("recepcion_notas_$year", "$inFilter&select=*&limit=2000");
if (count($notas) === 0) { sendJson([$year => []]); exit; }

// 3) Jurados
$idsJurado = array_values(array_unique(array_filter(array_column($notas, 'id_jurado'))));
$jurados = [];
if (count($idsJurado) > 0) {
    $jFilter = buildInFilter('id_jurado', $idsJurado);
    $jurados = supabase()->selectRaw(
        "jurados_consolidado",
        "$jFilter&select=id_jurado,nombre_y_apellido,foto,genero_a_calificar&limit=100"
    );
}
$juradosMap = [];
foreach ($jurados as $j) $juradosMap[$j['id_jurado']] = $j;

// 4) Enriquecer
$enriched = array_map(function ($n) use ($inscMap, $juradosMap) {
    $i = $inscMap[$n['id_inscripcion']] ?? [];
    $j = $juradosMap[$n['id_jurado'] ?? ''] ?? [];
    return array_merge($n, [
        'jurado_foto'     => $j['foto'] ?? null,
        'jurado_nombre'   => $j['nombre_y_apellido'] ?? ($n['jurado'] ?? 'Jurado'),
        'jurado_generos'  => $j['genero_a_calificar'] ?? null,
        'inst_logo'       => $i['enlace_del_logo'] ?? null,
        'inst_nombre'     => $i['agrupacion'] ?? ($n['agrupacion'] ?? null),
        'insc_dia'        => $i['dia'] ?? ($n['dia'] ?? null),
        'insc_orden'      => $i['orden'] ?? null,
        'insc_obra'       => $i['nombre_de_la_obra'] ?? null,
    ]);
}, $notas);

sendJson([$year => $enriched]);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/calificaciones.php?year=2025" -b cookies.txt | head -c 500
```

Expected: `{"2025":[...]}` con notas enriquecidas con jurado.

### Task 33: Endpoint `videos.php`

**Files:**
- Create: `php-backend/videos.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();
$filter = buildContextFilter($user);
if (!$filter) { sendJson(new stdClass()); exit; }

$years = ['2023', '2024', '2025', '2026'];
$select = 'id_inscripcion,orden,dia,agrupacion,enlace_del_logo,nombre_de_la_obra,url_video,categoria,division,subdivision,modalidad,coreografo,director,bloque,genero';

$results = [];
foreach ($years as $year) {
    $qs = $filter . "&url_video=not.is.null&select=$select&limit=200";
    $rows = supabase()->selectRaw("registro_de_inscripcion_$year", $qs);
    if (count($rows) > 0) $results[$year] = $rows;
}

sendJson($results ?: new stdClass());
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/videos.php" -b cookies.txt | head -c 500
```

Expected: `{"2023":[...], "2024":[...], ...}` o `{}` si no hay videos.

### Task 34: Endpoint `pagos.php` (placeholder)

**Files:**
- Create: `php-backend/pagos.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';

handlePreflight();
requireMethod('GET');

requireAuth();
$year = preg_replace('/\D/', '', (string)($_GET['year'] ?? '2026'));

// Tabla de pagos aún no existe en el schema. Devolver placeholder.
sendJson([$year => []]);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/pagos.php?year=2026" -b cookies.txt
```

Expected: `{"2026":[]}`.

### Task 35: Endpoint `bootstrap.php` (precarga al login)

**Files:**
- Create: `php-backend/bootstrap.php`

- [ ] **Step 1: Crear archivo**

```php
<?php
declare(strict_types=1);

require __DIR__ . '/_lib/auth.php';
require __DIR__ . '/_lib/supabase.php';
require __DIR__ . '/_lib/context.php';

handlePreflight();
requireMethod('GET');

$user = requireAuth();

// Logos map (público, todas las instituciones con logo)
$logos = supabase()->selectRaw(
    'instituciones',
    'enlace_del_logo=not.is.null&select=nombre_agrupacion,enlace_del_logo&limit=1000'
);
$logosMap = [];
foreach ($logos as $i) {
    $key = mb_strtolower(trim($i['nombre_agrupacion'] ?? ''));
    if ($key !== '' && !empty($i['enlace_del_logo']) && empty($logosMap[$key])) {
        $logosMap[$key] = $i['enlace_del_logo'];
    }
}

// Institución del usuario
$institucion = null;
$ids = parseIdCsv($user['id_agrupacion'] ?? '');
if (count($ids) > 0) {
    $row = supabase()->select('instituciones', [
        'id_agrupacion' => 'eq.' . $ids[0],
        'select'        => '*',
        'limit'         => 1,
    ]);
    $institucion = $row[0] ?? null;
}

sendJson([
    'user'        => $user,
    'institucion' => $institucion,
    'logosMap'    => $logosMap,
]);
```

- [ ] **Step 2: Smoke test**

```bash
curl -s "http://127.0.0.1:8001/bootstrap.php" -b cookies.txt | head -c 500
```

Expected: `{"user":{...},"institucion":{...},"logosMap":{...}}`.

### Task 36: `php-backend/.htaccess`

**Files:**
- Create: `php-backend/.htaccess`

- [ ] **Step 1: Crear archivo**

```apache
# Bloqueo de archivos sensibles
<FilesMatch "config\.php|\.example\.php$">
    Require all denied
</FilesMatch>

<FilesMatch "^\.">
    Require all denied
</FilesMatch>

# Disallow direct access a _lib/
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^_lib/ - [F,L]
</IfModule>

# CORS handled in PHP code, but headers básicos como defensa adicional
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "SAMEORIGIN"
Header set Referrer-Policy "strict-origin-when-cross-origin"

# Cache control
<FilesMatch "\.(php)$">
    Header set Cache-Control "no-store, no-cache, must-revalidate, max-age=0"
</FilesMatch>
```

### Task 37: Test end-to-end del backend completo

- [ ] **Step 1: Levantar PHP server**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/"
"C:/laragon/bin/php/php-8.4.2-nts-Win32-vs17-x64/php.exe" -S 127.0.0.1:8001 -t php-backend
```

- [ ] **Step 2: Correr secuencia completa**

En otra terminal:

```bash
# 1) Búsqueda inicial (sin sesión)
curl -s "http://127.0.0.1:8001/search-participants.php?q=juan" | head -c 300

# 2) /me sin sesión → 401
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:8001/me.php"

# 3) Login con creds reales (YACU provee)
ID="<id-real>"
PW="<carnet-o-tel-real>"

rm -f cookies.txt
curl -s -X POST "http://127.0.0.1:8001/login.php" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d "{\"id_contacto\":\"$ID\",\"password\":\"$PW\"}"

# 4) /me con sesión → 200
curl -s "http://127.0.0.1:8001/me.php" -b cookies.txt | head -c 300

# 5) Bootstrap
curl -s "http://127.0.0.1:8001/bootstrap.php" -b cookies.txt | head -c 500

# 6) Inscripciones 2026
curl -s "http://127.0.0.1:8001/inscripciones.php?year=2026" -b cookies.txt | head -c 500

# 7) Kardex 2025
curl -s "http://127.0.0.1:8001/kardex.php?year=2025" -b cookies.txt | head -c 500

# 8) Calificaciones 2025
curl -s "http://127.0.0.1:8001/calificaciones.php?year=2025" -b cookies.txt | head -c 500

# 9) Videos (todos los años)
curl -s "http://127.0.0.1:8001/videos.php" -b cookies.txt | head -c 500

# 10) Pagos 2026 (placeholder)
curl -s "http://127.0.0.1:8001/pagos.php?year=2026" -b cookies.txt

# 11) Logout
curl -s -X POST "http://127.0.0.1:8001/logout.php" -b cookies.txt -c cookies.txt

# 12) /me post-logout → 401
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:8001/me.php" -b cookies.txt
```

Expected:
- Step 2: `HTTP 401`
- Step 3: `{"user": {...}}` con nombre del usuario
- Step 4-10: JSON con data
- Step 12: `HTTP 401`

Si todo OK → Plan A completo. ✅

### Task 38: Commit backend completo

- [ ] **Step 1: Stage + commit**

```bash
git add php-backend/
git status   # verificar config.php NO listado
git commit -m "feat(backend): PHP endpoints completos

- _lib/supabase.php (cURL PostgREST wrapper)
- _lib/session.php (cookie httpOnly + sliding renew)
- _lib/auth.php (CORS + requireAuth middleware)
- _lib/context.php (buildContextFilter desde \$_SESSION)
- Endpoints: search-participants, login, logout, me, bootstrap,
  inscripciones, kardex, calificaciones, videos, pagos
- .htaccess: bloquea config.php + _lib/, headers de seguridad
- Smoke test end-to-end pasa (login → bootstrap → 5 tabs → logout)"
git push origin main
```

- [ ] **Step 2: Verificar CI verde**

Abrir `https://github.com/shera88/festival-sistema-usuarios-vite/actions`. Workflow `ci` debe correr verde tras ~2 min.

- [ ] **Step 3: Cerrar issue seed #1**

```bash
gh issue close 1 -c "Migrations aplicadas (001_login_rpcs + 002_revoke_anon condicional). RPCs verificadas. Backend PHP completo y probado end-to-end."
```

- [ ] **Step 4: Actualizar AVANCES.md**

Editar `AVANCES.md` agregando entrada en HISTORIAL con la fecha real y descripción del trabajo completado. Commitear como `docs: avances Plan A completo`.

```bash
git add AVANCES.md
git commit -m "docs: avances Plan A completo (bootstrap + SQL + PHP backend)"
git push origin main
```

---

## Resumen final del Plan A

Al cerrar este plan deberías tener:

- ✅ Repo `https://github.com/shera88/festival-sistema-usuarios-vite` activo
- ✅ Scaffold Vite + React + TS + Tailwind 4 + shadcn funcional (`npm run dev` arranca, build pasa)
- ✅ Branch protection en main + issues+labels+templates+project board
- ✅ CI workflow verde, deploy workflow parqueado
- ✅ 2 RPCs Supabase aplicadas (`search_login_users`, `validate_login`)
- ✅ (Opcional, con OK de YACU) revoke anon en tablas privadas
- ✅ Backend PHP con 10 endpoints funcionales (probados con curl end-to-end)
- ✅ Sesión PHP funcionando (cookie httpOnly, login + logout + me)
- ✅ Documentación: CLAUDE.md, AVANCES.md, README.md, spec, este plan

**Próximo plan**: Plan B (Screenshots de la app original) en paralelo, Plan C (Frontend SPA) consume estos endpoints.

---

## Self-review

- **Spec coverage**:
  - Stack (sección 2 spec) → Tasks 1-7 ✓
  - Folder layout (sección 4) → Tasks 1, 22-36 ✓
  - Auth (sección 5) → Tasks 19, 23-29 ✓
  - Data flow + RPCs (sección 6) → Tasks 19, 30-35 ✓
  - UI tokens (sección 7) → Task 4 ✓ (UI completa va a Plan C)
  - Multi-dev workflow (sección 8) → Tasks 8, 13-15, 17 ✓
  - CI/CD (sección 9) → Task 16 ✓
  - Reglas seguridad (sección 10) → Tasks 6, 21, 36 + CLAUDE.md ✓
  - Fases 0/2/3 (sección 11) → todo Plan A ✓

- **Placeholders**: ninguno detectado. Las referencias a `<id-real>`, `<carnet-real>`, `<email-de-shera88>` son inputs que YACU debe proveer en ejecución; explícitamente marcados.

- **Type consistency**:
  - `search_login_users` retorna mismas columnas que `validate_login` ✓
  - PHP endpoints retornan estructuras consistentes (`{[year]: rows}` para tabs con año, `{user, institucion, logosMap}` para bootstrap) ✓
  - Cookie name `fdz_session` consistente entre `config.example.php` y `session.php` ✓
