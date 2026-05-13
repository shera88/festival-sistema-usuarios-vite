# CLAUDE.md — Festival Sistema Usuarios VITE

Guía para Claude Code y cualquier otro agente AI que trabaje en este repo.

## Contexto

Portal de participantes del Festival DanzArte 2026, migrado desde HTML+JS+PHP vanilla a Vite+React+TS+Tailwind+shadcn con backend PHP en SiteGround y Supabase self-hosted.

URL prod (cuando active deploy): https://usuarios.festivaldanzarte.com

Spec arquitectura: `docs/specs/2026-05-12-festival-sistema-usuarios-vite-design.md`
Plan ejecución: `docs/plans/2026-05-12-plan-A-bootstrap-backend.md`

## Reglas activas (CRÍTICAS)

### 1. Coordinación multi-dev (real-time)

**ANTES de tocar cualquier archivo**:

1. Leer `AVANCES.md` sección "EN PROGRESO"
2. Listar issues activos: `gh issue list --label in-progress --json number,title,assignees,labels`
3. Si tu cambio choca con archivos en uso → coordinar antes (comentar el issue o chat)
4. Reclamar el issue antes de codear:
   ```bash
   gh issue edit <n> --add-assignee @me --add-label in-progress
   gh issue comment <n> -b "🤖 Started by <dev> at $(date -u +%Y-%m-%dT%H:%MZ). Branch: feature/<branch>. Touching: <files>"
   ```
5. Trabajar en branch `feature/<dev>-<kebab>`. NUNCA push directo a main.
6. Al cerrar: PR con `Closes #<n>` en body.

### 2. Supabase SQL

**Ya autorizado** (correr sin pedir OK):
- CREATE FUNCTION / CREATE VIEW / ADD COLUMN / GRANT / REVOKE permisos

**Requiere OK explícito del owner + CSV backup**:
- DROP COLUMN / DROP TABLE / DELETE rows / TRUNCATE / ALTER COLUMN TYPE con pérdida potencial
- ANTES de ejecutar: descargar `<tabla>.csv` con todas las filas a `backups/<fecha>/<tabla>.csv`

### 3. Service role key

- Vive sólo en `php-backend/config.php` (gitignored) y GitHub Secrets
- NUNCA en frontend, commits ni logs
- Si lo ves expuesto en código → STOP, alertar al owner, rotar

### 4. Tono español formal

- Usar "usted" en UI/copy/respuestas
- Evitar voseo ("vos/podés/tenés/querés")

### 5. Verificación visual

- Tras cualquier cambio de UI: invocar skill `auto-verify-loop` o Playwright manual
- Screenshots a `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS VITE/<pantalla>/`
- Reference visual de la app legacy: `.claude/auto-verify-loop/demo-screenshots/SISTEMA DE USUARIOS ORIGINAL/`
- Antes de reportar "terminado" → screenshot confirmando

### 6. UI/UX

- Antes de tocar diseño/UI → invocar skill `ui-ux-pro-max`, `ui-styling`, `design-system` o `design`
- Glass + gradient borders (paleta cyan/fuchsia/gold sobre bg #08051E)

### 7. Skills report

- Último mensaje de cada tarea: listar qué skills se usaron y para qué

## Comandos

```bash
npm run dev           # frontend :5173
npm run dev:php       # backend PHP :8001
npm run typecheck
npm run lint
npm run build
npm run test          # vitest
npm run test:e2e      # playwright
```

## NO hacer

- No commitear `php-backend/config.php`, `.env*`, screenshots privadas
- No hardcodear service_role en frontend
- No push directo a `main`
- No usar `git --force` ni `reset --hard` para resolver conflictos
- No saltear hooks con `--no-verify`
