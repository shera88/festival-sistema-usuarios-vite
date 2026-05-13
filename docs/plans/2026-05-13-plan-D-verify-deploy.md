# Plan D — Verificación E2E + Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans o auto-verify-loop. Steps con checkbox.

**Goal:** Verificar paridad funcional + visual del frontend nuevo vs la app legacy (16 secciones × 2 viewports), generar `docs/PARITY-REPORT.md`, hacer smoke test E2E (login → 5 tabs → modal video → logout), y desbloquear deploy a SiteGround subdominio `usuarios.festivaldanzarte.com`.

**Precondiciones:**
- ✅ Plan A completo (repo + backend PHP funcional + RPCs Supabase)
- ✅ Plan B completo (32 screenshots legacy en `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS ORIGINAL/`)
- ✅ Plan C completo (frontend SPA con 5 tabs)
- ⚠️ `npm install --legacy-peer-deps` ejecutado localmente
- ⚠️ `php-backend/config.php` con service_role real
- ⚠️ Test login: PEDRO FLORES BANEGAS — id `7d46f854-01bd-4ace-bb3a-f900e55eba9a` — password `8989079` (carnet) o `69166318` (tel)

---

## Phase 1 — Smoke test backend PHP local

### Task 1: Levantar PHP + frontend dev en paralelo

- [ ] **Terminal 1: backend PHP**

```bash
cd "D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE"
"C:/laragon/bin/php/php-8.4.2-nts-Win32-vs17-x64/php.exe" -S 127.0.0.1:8001 \
  -t php-backend \
  -d upload_max_filesize=200M -d post_max_size=220M -d memory_limit=512M
```

- [ ] **Terminal 2: frontend Vite**

```bash
npm run dev
```

Expected: Vite arranca en http://127.0.0.1:5173/. Proxy `/api/*` redirige a 8001.

### Task 2: Smoke test endpoints PHP via curl

- [ ] **2.1 search-participants sin sesión (público)**

```bash
curl -s "http://127.0.0.1:8001/search-participants.php?q=PEDRO" -H "Origin: http://127.0.0.1:5173" | head -c 400
```

Expected: array con Pedro Flores Banegas.

- [ ] **2.2 /me sin sesión → 401**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8001/me.php"
```

Expected: `401`.

- [ ] **2.3 login + sesión cookie**

```bash
rm -f cookies.txt
curl -s -X POST "http://127.0.0.1:8001/login.php" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"id_contacto":"7d46f854-01bd-4ace-bb3a-f900e55eba9a","password":"8989079"}' | head -c 300
```

Expected: `{"user":{"nombre_y_apellido":"PEDRO FLORES BANEGAS",...}}`. Cookie `fdz_session` en cookies.txt.

- [ ] **2.4 /me con sesión → 200**

```bash
curl -s "http://127.0.0.1:8001/me.php" -b cookies.txt | head -c 200
```

Expected: user data.

- [ ] **2.5 /bootstrap**

```bash
curl -s "http://127.0.0.1:8001/bootstrap.php" -b cookies.txt | head -c 400
```

Expected: `{"user":{...},"institucion":{...},"logosMap":{...}}`.

- [ ] **2.6 Cada tab endpoint (con cookie)**

```bash
for ENDPOINT in "inscripciones.php?year=2025" "kardex.php?year=2025" "calificaciones.php?year=2025" "videos.php" "pagos.php?year=2026"; do
  echo "=== $ENDPOINT ==="
  curl -s "http://127.0.0.1:8001/$ENDPOINT" -b cookies.txt | head -c 200
  echo
done
```

Expected: cada uno retorna JSON con la estructura `{[year]: rows}` o `{}`.

- [ ] **2.7 Logout invalida sesión**

```bash
curl -s -X POST "http://127.0.0.1:8001/logout.php" -b cookies.txt -c cookies.txt
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8001/me.php" -b cookies.txt
```

Expected: `{"ok":true}` luego `401`.

---

## Phase 2 — Smoke test frontend en navegador (manual)

### Task 3: Login flow

- [ ] Abrir http://127.0.0.1:5173/ → redirige a `/login`
- [ ] Tipear "PEDRO FLORES" → aparece dropdown con sugerencia
- [ ] Click sugerencia → input se llena, input password recibe focus
- [ ] Ingresar `8989079` → submit
- [ ] Redirige a `/inscripciones` con header + UserHero

### Task 4: Cada tab

- [ ] **Inscripciones**: lista cards 2025 (Pedro Flores tiene data 2025). Click pill 2024/2023/2026 → cambia data. Buscador filtra por obra/agrupación. Card expande mostrando subtabs Detalles/Calificación/Video.
- [ ] **Kardex**: lista grupos por institución. Click grupo colapsa/expande. Click integrante muestra datos completos + WhatsApp + Credencial/Certificado.
- [ ] **Calificaciones**: cards agrupadas por día, ordenadas por orden. Click card → expande jurados con notas grid.
- [ ] **Videos**: grid de thumbnails Vimeo. Click → modal con embed + metadata. Escape o click outside cierra modal.
- [ ] **Pagos**: empty state "Próximamente".

### Task 5: Sync + logout

- [ ] Botón "Sincronizar" en header → spinner gira 1.5s, queries invalidadas → re-fetch.
- [ ] Botón "Salir" → confirm → sesión termina → redirige a `/login`.

---

## Phase 3 — Parity visual vs legacy

### Task 6: Capturar screenshots del nuevo Vite app

Mismo set que Plan B pero del nuevo frontend en localhost.

Carpeta destino: `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS VITE/<NN-seccion>/<viewport>.png`

Las 16 secciones (idénticas a legacy):
01-login, 02-login-suggestions, 03-app-shell, 04-tab-inscripciones, 05-insc-card-expanded, 06-subtab-calificacion, 07-subtab-video, 08-tab-kardex, 09-kardex-group-expanded, 10-kardex-row-expanded, 11-tab-calificaciones, 12-calif-card-expanded, 13-jurado-card-expanded, 14-tab-videos, 15-video-modal, 16-tab-pagos.

Usar Playwright MCP. Mismo protocolo que Plan B (mobile 375×812 + desktop 1440×900).

### Task 7: Generar PARITY-REPORT.md

**Files:**
- Create: `docs/PARITY-REPORT.md`

Para cada sección 01-16 incluir:
- Side-by-side legacy vs vite (paths a ambos PNGs)
- Score subjetivo de paridad: ✅ excelente / 🟡 acceptable / ❌ regresión visible
- Notas: qué cambió, qué se mantuvo, decisiones de polish

Plantilla por sección:

```markdown
### 01-login (empty)

| Legacy | Vite |
|---|---|
| ![legacy](../.claude/auto-verify-loop/demo-screenshots/SISTEMA%20DE%20USUARIOS%20ORIGINAL/01-login/desktop.png) | ![vite](../.claude/auto-verify-loop/demo-screenshots/SISTEMA%20DE%20USUARIOS%20VITE/01-login/desktop.png) |

**Score:** ✅
**Cambios:** Mantiene paleta + logo + glass card. Inputs ahora con focus ring cyan visible. Botón gradient cyan→fuchsia.
**Mobile:** ambos OK
```

### Task 8: Fix de regresiones detectadas

Iterar hasta que todas las 16 secciones tengan paridad ✅ o 🟡 (acceptable con justificación documentada).

---

## Phase 4 — E2E tests automatizados (Playwright)

### Task 9: `playwright.config.ts`

**Files:**
- Create: `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev:php',
      port: 8001,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile',  use: { ...devices['Pixel 7'] } },
  ],
});
```

### Task 10: `tests/e2e/login.spec.ts`

**Files:**
- Create: `tests/e2e/login.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('login completo Pedro Flores', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/Festival DanzArte/);

  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.locator('.login-suggestion-item, button:has-text("PEDRO FLORES BANEGAS")').first().click();

  await page.getByPlaceholder('Su número de carnet').fill('8989079');
  await page.getByRole('button', { name: /Ingresar/i }).click();

  await expect(page).toHaveURL(/\/inscripciones/, { timeout: 10_000 });
  await expect(page.getByText('PEDRO FLORES BANEGAS')).toBeVisible();
});

test('login con password incorrecto muestra error', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.locator('button:has-text("PEDRO FLORES BANEGAS")').first().click();
  await page.getByPlaceholder('Su número de carnet').fill('WRONG');
  await page.getByRole('button', { name: /Ingresar/i }).click();
  await expect(page.getByText(/Carnet o contraseña incorrectos/i)).toBeVisible();
});

test('rutas protegidas redirigen sin sesión', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/inscripciones');
  await expect(page).toHaveURL(/\/login/);
});
```

### Task 11: `tests/e2e/tabs.spec.ts`

**Files:**
- Create: `tests/e2e/tabs.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder(/Busque su nombre/).fill('PEDRO FLORES');
  await page.locator('button:has-text("PEDRO FLORES BANEGAS")').first().click();
  await page.getByPlaceholder('Su número de carnet').fill('8989079');
  await page.getByRole('button', { name: /Ingresar/i }).click();
  await page.waitForURL(/\/inscripciones/);
});

test('navegar entre las 5 tabs', async ({ page }) => {
  for (const tab of ['Inscripciones', 'Kardex', 'Calificaciones', 'Videos', 'Pagos']) {
    await page.getByRole('link', { name: tab }).click();
    await expect(page).toHaveURL(new RegExp(`/${tab.toLowerCase()}`));
  }
});

test('expandir card de inscripción muestra subtabs', async ({ page }) => {
  // pill 2025 (más data)
  await page.getByRole('button', { name: '2025' }).click();
  await page.locator('.insc-card-head, button:has(.text-text-90)').first().click();
  await expect(page.getByText(/Detalles/i)).toBeVisible();
  await expect(page.getByText(/Calificación/i)).toBeVisible();
  await expect(page.getByText(/Video/i)).toBeVisible();
});

test('logout cierra sesión', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Salir/i }).click();
  await expect(page).toHaveURL(/\/login/);
});
```

### Task 12: Correr e2e local + CI

- [ ] **Local**

```bash
npx playwright install chromium
npm run test:e2e
```

Expected: 6+ tests passing.

- [ ] **Agregar a CI workflow**

Editar `.github/workflows/ci.yml`, agregar job `e2e`:

```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
    - uses: shivammathur/setup-php@v2
      with:
        php-version: '8.4'
    - run: npm install --legacy-peer-deps --no-audit --no-fund
    - run: npx playwright install --with-deps chromium
    - name: Setup PHP config from secrets
      run: |
        cat > php-backend/config.php <<EOF
        <?php
        return [
            'supabase_url' => '${{ secrets.SUPABASE_URL }}',
            'supabase_service_role_key' => '${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}',
            'session_name' => 'fdz_session',
            'session_lifetime' => 604800,
            'cookie_secure' => false,
            'cookie_samesite' => 'Lax',
            'cookie_domain' => '',
            'cors_origin' => 'http://127.0.0.1:5173',
            'debug' => false,
        ];
        EOF
    - run: npm run test:e2e
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

Requiere Secrets en repo: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Phase 5 — Deploy a SiteGround (CONGELADO hasta aprobación)

> ⛔ **STOP**: este phase NO se ejecuta sin aprobación explícita de YACU.

### Task 13: Pre-deploy checklist (sólo lectura)

- [ ] CI verde en main (lint + typecheck + build + test + e2e)
- [ ] PARITY-REPORT.md ≥ 90% secciones en ✅ o 🟡
- [ ] Smoke test local manual completo
- [ ] Service role NO en código frontend (`grep -r service_role src/` debe ser vacío)
- [ ] `.env.local` y `config.php` NO en commits (`git log --all --full-history -- config.php` vacío)

### Task 14: Crear subdominio en SiteGround

Manual en Site Tools → Domain → Subdomain → `usuarios.festivaldanzarte.com` → apuntar a carpeta nueva.

### Task 15: Configurar GitHub Secrets

En repo Settings → Secrets and variables → Actions:

| Secret | Valor |
|---|---|
| `SFTP_HOST` | `ftp.festivaldanzarte.com` |
| `SFTP_USER` | `deploy@festivaldanzarte.com` |
| `SFTP_PASSWORD` | (rotar al de prod, NO el dev) |
| `SFTP_REMOTE_PATH` | `/festivaldanzarte.com/public_html/usuarios.festivaldanzarte.com` |
| `SUPABASE_URL` | `https://supabase.imaginarte.cloud` |
| `SUPABASE_SERVICE_ROLE_KEY` | JWT service_role |
| `VITE_SUPABASE_URL` | `https://supabase.imaginarte.cloud` |
| `VITE_SUPABASE_ANON_KEY` | JWT anon |
| `VITE_API_URL` | `/api` |

### Task 16: Activar deploy workflow

Editar `.github/workflows/deploy.yml`, descomentar trigger:

```yaml
on:
  workflow_dispatch:
  push:
    branches: [main]   # ← descomentar
```

Push a main → CI corre → si verde → deploy job → SFTP → smoke test.

### Task 17: Verificación post-deploy

- [ ] Abrir `https://usuarios.festivaldanzarte.com/` → carga LoginPage
- [ ] Login Pedro Flores → funciona
- [ ] Cada tab carga data → OK
- [ ] HTTPS sin warnings (SSL SiteGround)
- [ ] Network tab: `/api/*` retorna JSON, NO 404/500
- [ ] DevTools Console: sin errores rojos

### Task 18: Update CLAUDE.md con URLs prod

```markdown
URL prod: https://usuarios.festivaldanzarte.com/
API base: https://usuarios.festivaldanzarte.com/api/
```

Commit + push.

---

## Self-review

- **Spec coverage**: cubre Fases 6 (verificación) y 7 (deploy) del spec ✓
- **Placeholders**: ninguno bloqueante. Selectores en e2e tests pueden requerir ajustes runtime si los componentes finales difieren — implementer debe iterar.
- **Dependencias claras**: Phase 1 requiere npm install + config.php; Phase 4 requiere @playwright/test instalado; Phase 5 requiere aprobación + secrets en GitHub.
- **Reversibilidad**: deploy congelado por default. CI sin push trigger. Sin riesgo de deploy accidental.
