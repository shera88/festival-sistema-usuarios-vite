# Festival Sistema de Usuarios — VITE — Design Spec

**Fecha:** 2026-05-12
**Autor:** Shera Serrano (shera88) + Claude
**Estado:** Aprobado para implementación
**Proyecto fuente (legacy):** `d:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/FESTIVAL SISTEMA DE USUARIOS/` (HTML+CSS+JS vanilla con `service_role` hardcoded en cliente — vulnerabilidad a resolver)
**Proyecto destino:** `d:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/`
**Repo GitHub:** `shera88/festival-sistema-usuarios-vite` (privado, a crear)
**Deploy futuro:** `https://usuarios.festivaldanzarte.com` (subdominio SiteGround, parqueado hasta aprobación)

---

## 1. Resumen ejecutivo

Migrar el portal de participantes del Festival DanzArte 2026 (HTML+JS vanilla con service_role en cliente) a una SPA moderna Vite + React + TS + Tailwind 4 + shadcn, con backend PHP en SiteGround que guarda la service_role key y expone endpoints REST. El equipo trabaja en paralelo desde GitHub (con tracking real-time vía Issues + AVANCES.md). Paridad funcional 1:1 con la app original + polish visual (glassmorphism sutil, gradient borders, loading skeletons, animaciones suaves).

---

## 2. Stack

| Capa | Tecnología | Versión |
|---|---|---|
| Build | Vite | 8.x |
| Framework | React | 19.x |
| Lenguaje | TypeScript | 6.x |
| Routing | react-router-dom | 7.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes | shadcn/ui (base-ui/react) | 1.x |
| Estado servidor | TanStack Query | 5.x |
| Forms | react-hook-form + zod | 7.x / 4.x |
| Supabase client | @supabase/supabase-js | 2.x (uso opcional sólo para lecturas públicas) |
| Vimeo | @vimeo/player | 2.x |
| Toasts | sonner | 2.x |
| Iconos | lucide-react | 1.x |
| Tests | Vitest + Testing Library + Playwright | latest |
| Backend | PHP | 8.x (SiteGround) |
| DB | Supabase self-hosted | `supabase.imaginarte.cloud` (Coolify) |

Stack alineado con sibling `APP FESTIVAL DANZARTE 2026 - VITE` para reuso de patrones.

---

## 3. Arquitectura

```
┌─────────────────────────────────┐
│ React SPA (Vite build)          │
│ - Auth context (cookie sesión)  │
│ - TanStack Query                │
│ - shadcn + Tailwind             │
└──────────────┬──────────────────┘
               │ fetch /api/* (cookie)
               ▼
┌─────────────────────────────────┐
│ PHP backend (SiteGround)        │
│ - $_SESSION (httpOnly cookie)   │
│ - Wrap Supabase REST con        │
│   service_role key (secreto)    │
│ - Filtra por user actual        │
└──────────────┬──────────────────┘
               │ Bearer service_role
               ▼
┌─────────────────────────────────┐
│ Supabase (self-hosted Coolify)  │
│ - PostgREST + RPCs              │
│ - RLS: anon sin SELECT directo  │
│ - service_role: full            │
└─────────────────────────────────┘
```

**Separación de keys:**

| Layer | Key | Sensible | Ubicación |
|---|---|---|---|
| Frontend (`.env`) | `VITE_API_URL` (a PHP) | No | `.env.local` (gitignored) + GitHub Secret |
| Frontend (opcional) | `VITE_SUPABASE_ANON_KEY` (sólo lecturas públicas si las hay) | No | idem |
| PHP (`config.php`) | `service_role` JWT | **Sí** | `php-backend/config.php` (gitignored). Plantilla pública: `config.example.php` |

**Sesión PHP:** cookie httpOnly, SameSite=Lax, Secure (en prod), TTL 7 días sliding renew en cada request autenticado. Storage: `$_SESSION` server-side.

---

## 4. Folder layout del repo

```
festival-sistema-usuarios-vite/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                       # lint + typecheck + build (activo)
│   │   └── deploy.yml                   # SFTP a SiteGround (workflow_dispatch hasta aprobación)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.md
│   │   ├── feature.md
│   │   └── tarea.md
│   └── pull_request_template.md
├── src/
│   ├── main.tsx
│   ├── App.tsx                          # router root
│   ├── routes/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx            # AppShell + outlet
│   │   ├── tabs/
│   │   │   ├── InscripcionesTab.tsx
│   │   │   ├── KardexTab.tsx
│   │   │   ├── CalificacionesTab.tsx
│   │   │   ├── VideosTab.tsx
│   │   │   └── PagosTab.tsx
│   │   └── NotFoundPage.tsx
│   ├── components/
│   │   ├── auth/
│   │   │   ├── LoginCard.tsx
│   │   │   ├── LoginSuggestions.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── layout/
│   │   │   ├── AppHeader.tsx            # logo + sync + logout
│   │   │   ├── UserHero.tsx             # foto + nombre + rol
│   │   │   └── TabsNav.tsx
│   │   ├── filters/
│   │   │   ├── YearPills.tsx
│   │   │   └── SearchInput.tsx
│   │   ├── cards/
│   │   │   ├── InscripcionCard.tsx
│   │   │   ├── KardexGroup.tsx
│   │   │   ├── KardexRow.tsx
│   │   │   ├── CalificacionCard.tsx
│   │   │   ├── JuradoCard.tsx
│   │   │   └── VideoCard.tsx
│   │   ├── media/
│   │   │   ├── AudioPlayer.tsx
│   │   │   └── VideoModal.tsx
│   │   ├── shared/
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSkeleton.tsx
│   │   │   └── DayGroup.tsx
│   │   └── ui/                          # shadcn primitives
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useInscripciones.ts
│   │   ├── useKardex.ts
│   │   ├── useCalificaciones.ts
│   │   ├── useVideos.ts
│   │   └── usePagos.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                # fetch wrapper con credentials:'include'
│   │   │   ├── auth.ts
│   │   │   ├── inscripciones.ts
│   │   │   ├── kardex.ts
│   │   │   ├── calificaciones.ts
│   │   │   ├── videos.ts
│   │   │   └── pagos.ts
│   │   ├── supabase/client.ts           # @supabase/supabase-js (opcional, sólo lecturas anon)
│   │   ├── utils/
│   │   │   ├── cn.ts
│   │   │   ├── vimeo.ts
│   │   │   ├── appsheet.ts               # URL builders heredados
│   │   │   ├── scoring.ts                # calcularPromedio*
│   │   │   └── days.ts                   # dayOrderIndex
│   │   └── schemas/                     # zod schemas
│   ├── types/
│   │   ├── domain.ts                    # User, Inscripcion, Kardex, etc.
│   │   └── supabase.ts                  # (opcional) generado por supabase gen types
│   ├── styles/
│   │   ├── tokens.css                   # CSS vars (paleta DanzArte 2026)
│   │   └── globals.css                  # @import tailwind + tokens
│   └── assets/
│       └── logo-danzarte.png
├── php-backend/
│   ├── config.example.php
│   ├── config.php                       # gitignored
│   ├── _lib/
│   │   ├── supabase.php                 # cURL helpers
│   │   ├── session.php                  # start/destroy + cookie
│   │   ├── auth.php                     # requireAuth() middleware
│   │   └── context.php                  # buildContextFilter desde $_SESSION
│   ├── login.php
│   ├── logout.php
│   ├── me.php
│   ├── search-participants.php
│   ├── bootstrap.php                    # devuelve todo al loguear (precarga)
│   ├── inscripciones.php
│   ├── kardex.php
│   ├── calificaciones.php
│   ├── videos.php
│   ├── pagos.php
│   └── .htaccess                        # CORS + bloquea config.php
├── migrations/
│   ├── 001_login_rpcs.sql               # SECURITY DEFINER, aditivo
│   └── 002_revoke_anon.sql              # REVOKE SELECT, aditivo (no destruye data)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEPLOY.md
│   ├── PARITY-REPORT.md                 # comparativa visual vs original
│   └── specs/
│       └── 2026-05-12-festival-sistema-usuarios-vite-design.md  # este archivo
├── tests/
│   ├── unit/                            # vitest
│   └── e2e/                             # playwright
├── public/
│   └── favicon.ico
├── .env.example
├── .gitignore
├── .editorconfig
├── .nvmrc
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json                       # shadcn config
├── eslint.config.js
├── playwright.config.ts
├── vitest.config.ts
├── CLAUDE.md                             # contexto + reglas para agentes
├── AVANCES.md                            # log multi-dev
├── README.md
└── LICENSE
```

---

## 5. Auth + sesión

### 5.1 Flujo login

1. Frontend `<LoginPage>`: input de búsqueda con autocomplete + input password.
2. Usuario tipea (mín. 2 caracteres) → debounce 300ms → `GET /api/search-participants?q=` con cookie/cred.
3. PHP llama RPC `search_login_users(p_query)` → retorna [{id_contacto, nombre_y_apellido, telefono, foto, agrupacion, rol_primario}] (excluye `antecedentes='prospecto_no_participo'`, máx. 20).
4. Frontend muestra dropdown con foto + nombre + agrupación.
5. Usuario selecciona + ingresa password → `POST /api/login` body `{id_contacto, password}`.
6. PHP llama RPC `validate_login(p_id_contacto, p_password)` → retorna user completo o NULL.
7. Si OK: PHP guarda en `$_SESSION` ids relevantes (`id_contacto`, `id_agrupacion`, `id_original_representante`, `id_original_director`, `id_original_coreografo`) + datos display (nombre, foto, agrupacion, rol). Setea cookie httpOnly. Retorna user JSON.
8. Frontend guarda user en `useAuth` context → `<Navigate to="/dashboard" />`.

### 5.2 Endpoints PHP

| Endpoint | Método | Body / Query | Auth | Función |
|---|---|---|---|---|
| `/api/search-participants` | GET | `?q=` | No | Autocomplete (RPC pública con SECURITY DEFINER) |
| `/api/login` | POST | `{id_contacto, password}` | No | Valida + crea sesión |
| `/api/logout` | POST | — | Sí | Destruye sesión |
| `/api/me` | GET | — | Sí | User actual (boot SPA) |
| `/api/bootstrap` | GET | — | Sí | Precarga: user + institución + logosMap + videos all-years + calificaciones 2023-2025 |
| `/api/inscripciones` | GET | `?year=` | Sí | Inscripciones del año |
| `/api/kardex` | GET | `?year=` | Sí | Kardex del año |
| `/api/calificaciones` | GET | `?year=` | Sí | Notas + jurados del año |
| `/api/videos` | GET | — | Sí | Videos todos los años |
| `/api/pagos` | GET | `?year=` | Sí | Placeholder (vacío por ahora) |

### 5.3 Middleware PHP

```php
// php-backend/_lib/auth.php
function requireAuth() {
  startSecureSession();
  if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autenticado']);
    exit;
  }
  return $_SESSION['user_data'];
}
```

### 5.4 Reglas de filtrado server-side

PHP arma `buildContextFilter()` **siempre desde `$_SESSION`**, nunca desde query params del cliente. Garantiza que un user no puede pedir data de otro alterando la URL.

---

## 6. Data flow

### 6.1 Tablas tocadas (todas existentes, lectura)

| Tabla | Uso |
|---|---|
| `festival_contactos_global` | Login + perfil |
| `registro_de_inscripcion_2023..2026` | Inscripciones, Videos |
| `registro_kardex_2023..2026` | Kardex |
| `recepcion_notas_2023..2025` | Calificaciones |
| `jurados_consolidado` | Foto/nombre/géneros jurado |
| `instituciones` | Logos map |

### 6.2 RPCs nuevas (aditivas)

```sql
-- migrations/001_login_rpcs.sql

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
  rol_primario text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id_contacto, numero_de_carnet, nombre_y_apellido, telefono,
    correo_electronico, ciudad, imagen_contacto, id_agrupacion,
    nombre_agrupacion, enlace_del_logo, rol_primario
  FROM festival_contactos_global
  WHERE (antecedentes IS NULL OR antecedentes <> 'prospecto_no_participo')
    AND (
      nombre_y_apellido ILIKE '%' || p_query || '%' OR
      numero_de_carnet ILIKE '%' || p_query || '%' OR
      telefono ILIKE '%' || p_query || '%' OR
      correo_electronico ILIKE '%' || p_query || '%'
    )
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_login_users(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_login(p_id_contacto text, p_password text)
RETURNS public.festival_contactos_global
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT *
  FROM festival_contactos_global
  WHERE id_contacto = p_id_contacto
    AND (antecedentes IS NULL OR antecedentes <> 'prospecto_no_participo')
    AND (
      numero_de_carnet = p_password OR
      telefono = p_password
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_login(text, text) TO anon, authenticated;
```

### 6.3 RLS (aditivo, no destruye data)

```sql
-- migrations/002_revoke_anon.sql
-- Sólo revoca lectura directa anon en tablas privadas. No toca data.
REVOKE SELECT ON public.festival_contactos_global FROM anon;
REVOKE SELECT ON public.registro_de_inscripcion_2023 FROM anon;
-- ... (idem para 2024, 2025, 2026, kardex_*, recepcion_notas_*)
-- jurados_consolidado e instituciones se mantienen lectura anon si ya están públicas
```

> ⚠️ Antes de ejecutar `002_revoke_anon.sql` verificar si ya está aplicado en proyectos sibling (APP FESTIVAL 2026 - VITE). Si está, omitir aquí.

### 6.4 Caching cliente

- TanStack Query: `staleTime: 30s`, `gcTime: 5min`
- Botón "Sincronizar" → `queryClient.invalidateQueries()` + animación spinner 9s (matchea UX original)
- Bootstrap eager al login: 1 sola request a `/api/bootstrap` evita 5 fetches en serie

---

## 7. UI / Design system

### 7.1 Design tokens

`src/styles/tokens.css`:
```css
:root {
  --bg-base: #08051E;
  --bg-elev: #0f0a2d;
  --cyan: #00E5FF;
  --fuchsia: #FF1FA8;
  --gold: #E8D098;
  --text-90: rgba(255,255,255,0.9);
  --text-45: rgba(255,255,255,0.45);
  --glass-bg: rgba(255,255,255,0.04);
  --glass-border: rgba(255,255,255,0.08);
  --gradient-cf: linear-gradient(135deg, var(--cyan), var(--fuchsia));
  --radius-card: 1rem;
  --shadow-glass: 0 8px 32px rgba(0,0,0,0.4);
}
```

Mapeo a Tailwind 4 vía `@theme` en `globals.css`.

### 7.2 Dirección visual (aprobada)

**Glassmorphism sutil + cards con borde gradiente.** Detalles:

- Cards: `bg-glass-bg backdrop-blur-md border border-glass-border rounded-2xl shadow-glass`
- Hover: borde gradiente cyan→fuchsia (técnica `padding + mask` o `border-image`), leve `translate-y-[-2px]`, transition 200ms ease-out
- Tabs activas: underline 3px con `linear-gradient(90deg, cyan, fuchsia)`
- Avatares fallback: gradient cyan→fuchsia con inicial blanca centrada
- Loading: skeletons shimmer con `bg-glass-bg`
- Empty states: ilustración SVG minimal + texto `text-45`

### 7.3 Componentes shadcn instalados

Button, Card, Input, Tabs, Dialog, Sheet, Tooltip, Skeleton, Avatar, Badge, ScrollArea, Sonner, Separator, DropdownMenu.

### 7.4 Responsive

- Breakpoints Tailwind default: `sm 640`, `md 768`, `lg 1024`, `xl 1280`
- `<sm` (mobile): tabs scrollables horizontal con shadow indicador overflow; header colapsa botón sync a icon-only; videos 1col
- `sm-md` (tablet): videos 2col
- `>md` (desktop): videos 3col; layout completo

### 7.5 Accesibilidad mínima fase 1

- `focus-visible` outline cyan en todos los interactivos
- `aria-label` en botones icon-only
- Contraste WCAG AA en texto sobre glass (verificar text-90 sobre bg-glass-bg)
- Click targets ≥44×44px en mobile

### 7.6 Animaciones

`tw-animate-css` para colapsables (slide+fade 200ms). framer-motion descartado (overkill para fase 1).

---

## 8. Multi-dev workflow + tracking real-time

### 8.1 Branching

- `main`: protegido. PR required + 1 review + status checks.
- `feature/<dev>-<kebab>`: nuevas features
- `fix/<dev>-<kebab>`: bugs
- Sin develop/release branches.

### 8.2 Permisos

Colaboradores invitados como **Admin** (request del owner). Backups automáticos del repo via GitHub Actions weekly (opcional, deferred).

### 8.3 Tracking real-time vía GitHub Issues

**Cada tarea = 1 GitHub Issue**. Project board "Festival Usuarios VITE" con columnas:

- `Backlog` (no asignado)
- `In Progress` (alguien lo está trabajando AHORA — label `in-progress` + assignee)
- `Review` (PR abierto)
- `Done` (merged)

**Protocolo al iniciar sesión de un agente Claude**:

1. `gh issue list --label in-progress --json number,title,assignees,labels` → mostrar al user qué hay activo
2. Detectar si los archivos a tocar chocan con un issue activo de otro dev. Si chocan → coordinar antes (chat / comentar en el issue).
3. Claim del issue:
   ```bash
   gh issue edit <n> --add-assignee @me --add-label in-progress
   gh issue comment <n> -b "🤖 Started by <dev> at $(date -u +%Y-%m-%dT%H:%MZ). Branch: feature/<branch>. Touching: <files>"
   ```
4. Codear en `feature/<dev>-<kebab>`.
5. Al cerrar → PR con `Closes #<n>` en body → al mergear se cierra issue automático, label se quita.

### 8.4 AVANCES.md (log histórico complementario)

`AVANCES.md` en root del repo, comiteable. Estructura:

```markdown
# AVANCES — Festival Sistema Usuarios VITE

## EN PROGRESO

| Dev | Branch | Inicio (UTC) | Archivos | Issue |
|---|---|---|---|---|

## HISTORIAL

### YYYY-MM-DD
- **<dev>** — `<branch>` — HH:MM → HH:MM UTC
  - Tocó: archivos
  - Resultado: descripción
  - Siguiente: próximo paso
  - PR: #N (merged)
```

Reglas en `CLAUDE.md` del nuevo repo:
1. Antes de tocar archivos → leer "EN PROGRESO"
2. Al iniciar → escribir entrada en "EN PROGRESO" (push a la branch feature, no a main)
3. Al cerrar PR → mover entrada a "HISTORIAL" en el commit final
4. Conflictos → rebase + diálogo, nunca `--force` ni `reset --hard`

### 8.5 Commits

Conventional Commits, mensaje en español:
- `feat:` nueva feature
- `fix:` bug
- `refactor:` refactor sin cambio de comportamiento
- `docs:` documentación
- `style:` formato (lint, espacios)
- `chore:` build/deps/config
- `test:` tests

---

## 9. CI/CD

### 9.1 `.github/workflows/ci.yml` (ACTIVO desde día 1)

Triggers: PRs a main + push a main.

Jobs (matrix node 22):
- `lint`: `npm ci && npm run lint`
- `typecheck`: `npm run typecheck` (tsc --noEmit)
- `build`: `npm run build`
- `test`: `npm run test` (vitest)

Falla cualquier job → PR no mergea.

### 9.2 `.github/workflows/deploy.yml` (PARQUEADO)

```yaml
on:
  workflow_dispatch:                # manual trigger; cambiar a push:branches:[main] cuando autorice owner
```

Pasos cuando se active:
1. Checkout
2. `npm ci`
3. `npm run build`
4. Generar `php-backend/config.php` desde Secret
5. Empaquetar `dist/` + `php-backend/`
6. SFTP via `SamKirkland/FTP-Deploy-Action@v4.3.5`
7. Target: `/festivaldanzarte.com/public_html/usuarios.festivaldanzarte.com/`
8. Smoke test: curl al subdominio, verificar 200 OK + título HTML correcto

### 9.3 Secrets de repo

| Secret | Valor |
|---|---|
| `SFTP_HOST` | `ftp.festivaldanzarte.com` |
| `SFTP_USER` | `deploy@festivaldanzarte.com` |
| `SFTP_PASSWORD` | (rotar antes de prod) |
| `SFTP_REMOTE_PATH` | `/festivaldanzarte.com/public_html/usuarios.festivaldanzarte.com` |
| `SUPABASE_URL` | `https://supabase.imaginarte.cloud` |
| `SUPABASE_SERVICE_ROLE_KEY` | (JWT service_role) |
| `VITE_SUPABASE_ANON_KEY` | (JWT anon, opcional) |
| `VITE_API_URL` | `https://usuarios.festivaldanzarte.com/api` |

### 9.4 Vercel (deferred)

Token Vercel guardado para futura activación de preview deployments por PR. No usado en fase 1.

---

## 10. Reglas de seguridad y operación

### 10.1 Migrations SQL en Supabase

**REGLA CRÍTICA (de YACU, 2026-05-12)**:

- DDL aditivo (CREATE FUNCTION, CREATE VIEW, ADD COLUMN, GRANT/REVOKE permisos) → ejecutable sin aviso previo, ya autorizado.
- DDL/DML destructivo (DROP COLUMN, DROP TABLE, DELETE, TRUNCATE, ALTER COLUMN TYPE con pérdida potencial) → **PARAR**, avisar a YACU, esperar OK, descargar CSV de la tabla afectada a `backups/<fecha>/<tabla>.csv` ANTES de ejecutar.
- Aplica a TODOS los proyectos del Festival.
- En este proyecto las migrations diseñadas (001_login_rpcs, 002_revoke_anon) son **100% aditivas** — cero riesgo de pérdida de data.

### 10.2 Service role key

- Vive sólo en `php-backend/config.php` (gitignored) y en GitHub Secrets.
- Nunca en frontend, nunca en commits, nunca en logs.
- `.gitignore` debe incluir: `config.php`, `.env*` (excepto `.env.example`), `*.local`.

### 10.3 Anon key

- Pública por diseño de Supabase. OK en `.env.local` del frontend.
- RLS protege qué puede ver. Las RPCs `SECURITY DEFINER` son las únicas accesibles para anon.

---

## 11. Fases de implementación

### Fase 0 — Bootstrap
- Scaffold del proyecto en `D:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS - VITE/`
- Crear repo GitHub `shera88/festival-sistema-usuarios-vite` (privado) via API
- Push initial: configs, CLAUDE.md, AVANCES.md, .gitignore, .env.example, README, este spec
- Crear labels Issues (`frontend`, `backend-php`, `db`, `ui`, `infra`, `in-progress`, `bug`, `feat`)
- Setup branch protection en main
- Crear Project board "Festival Usuarios VITE"
- Activar workflow `ci.yml`

### Fase 1 — Screenshots referencia
- Levantar app legacy en `php -S 127.0.0.1:8000 -t "FESTIVAL SISTEMA DE USUARIOS"`
- Auto-verify-loop captura cada pantalla (mobile 375 + desktop 1440):
  - `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS ORIGINAL/01-login/`
  - 02-login-suggestions, 03-user-hero, 04-tab-inscripciones, 05-insc-card-expanded, 06-subtab-calificacion, 07-tab-kardex, 08-kardex-row-expanded, 09-tab-calificaciones, 10-jurado-card, 11-tab-videos, 12-video-modal, 13-tab-pagos
- Necesita carnet+tel de un participante con data histórica (YACU provee)

### Fase 2 — Migrations SQL
- Aplicar `001_login_rpcs.sql` en Supabase Studio
- Aplicar `002_revoke_anon.sql` (validar antes que no rompa el sibling)
- Probar RPCs vía REST con anon key

### Fase 3 — Backend PHP
- Implementar `_lib/` (supabase, session, auth, context)
- Implementar endpoints
- Tests con curl + cookies
- Local dev: `php -S 127.0.0.1:8001 -t php-backend`

### Fase 4 — Frontend SPA
- Routing + AuthGuard
- LoginCard + autocomplete
- AppShell + 5 tabs
- Cada tab: hook query + components cards
- Auto-verify-loop tras cada pantalla comparando con screenshot original

### Fase 5 — Polish + responsive
- Glass + gradient borders, animaciones, skeletons, empty states
- Audit mobile
- Audit accesibilidad básica

### Fase 6 — Verificación E2E + sign-off
- Playwright e2e: login → bootstrap → tabs → modal → logout
- Generar `docs/PARITY-REPORT.md` con screenshots lado a lado
- Review humano (YACU)

### Fase 7 — Deploy (sólo con aprobación explícita)
- YACU crea subdominio `usuarios.festivaldanzarte.com` en Site Tools
- Cambiar `deploy.yml` trigger a `push: branches: [main]`
- Push de prueba → smoke test
- Update CLAUDE.md con URLs prod

---

## 12. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| RPC `validate_login` con password = teléfono permite enumeración de carnets/tels existentes | Documentar limitación; en fase 2 considerar OTP WhatsApp como sucesor |
| `service_role` filtrado por error en `php-backend/config.php` | `.gitignore` estricto, `.htaccess` bloquea acceso público a config.php, secret scanning en GitHub |
| Dos devs tocan el mismo archivo | Issue label `in-progress` + assignee visible en GitHub UI + protocolo de claim |
| Cambio en schema legacy (columna renombrada) rompe el frontend | TS types desde Supabase + tests e2e en CI |
| Deploy accidental sin aprobación | `deploy.yml` trigger `workflow_dispatch` hasta que YACU autorice |
| `staleTime` corto rate-limitea Supabase | 30s es conservador; ajustar si vemos hits altos |

---

## 13. Open questions (a resolver antes de Fase 4)

- ¿`SiteGround` corre PHP 8.1+? (verificar para sintaxis match expressions, etc.)
- ¿`session.cookie_secure` requiere HTTPS forzado a nivel hosting? (debería estar OK con SiteGround SSL)
- ¿Hay rate-limit en Coolify/Kong sobre `/rest/v1/` que pueda morder en bootstrap eager?
- ¿Subdominio `usuarios.festivaldanzarte.com` ya existe o hay que crearlo? (presumimos crear en fase 7)

---

## 14. Referencias

- App legacy: `d:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/FESTIVAL SISTEMA DE USUARIOS/`
- Sibling Vite reference: `d:/Claude/APPS/APP FESTIVAL DANZARTE 2026 - VITE/`
- Supabase self-hosted: `https://supabase.imaginarte.cloud`
- Manual de marca Festival DanzArte 2026: `d:/Claude/APPS/APP FESTIVAL DANZARTE SISTEMA DE USUARIOS/MANUAL DE MARCA/`
- Memorias relevantes:
  - `feedback_proyecto_canonico_vite.md`
  - `feedback_tono_formal.md`
  - `feedback_verificar_con_screenshot.md`
  - `feedback_screenshot_location.md`
  - `feedback_ui_design_skills.md`
  - `feedback_supabase_sql_permissions.md`
  - `feedback_supabase_no_destructive_sin_aviso.md`
  - `project_foto_logo_source_of_truth.md`
  - `project_admin_app.md`
