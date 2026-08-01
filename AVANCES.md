# AVANCES — Festival Sistema Usuarios VITE

> **Antes de empezar tu sesión:**
> 1. Leer "EN PROGRESO" abajo — si otro dev tiene tu archivo, coordinar primero
> 2. Verificar issues activos: `gh issue list --label in-progress`
> 3. Claim issue: `gh issue edit <n> --add-assignee @me --add-label in-progress`
> 4. Escribir tu entrada en "EN PROGRESO" en tu primer commit de la branch feature
> 5. Al cerrar PR: mover entrada a "HISTORIAL"

## EN PROGRESO

| Dev | Branch | Inicio (UTC) | Archivos | Issue |
|---|---|---|---|---|
| _(vacío)_ | | | | |

## HISTORIAL

### 2026-08-01

- **shera88 (+ Claude)** — `feature/programa-horarios-admin` — horarios del admin, duración en el PDF y rehabilitar multimedia
  - Tocó: `src/routes/tabs/ProgramaTab.tsx`, `src/components/cards/InscripcionCard.tsx`, `src/lib/api/multimedia.ts`, `php-backend/_lib/auth.php`, `php-backend/inscripcion-revertir-multimedia.php`, `vite.config.ts`, `.env.production`
  - Resultado: el programa y sus PDF siguen la hora que fija el admin en la app de jurados; el PDF lleva la duración de cada baile; el super admin puede rehabilitar la carga de multimedia ya confirmada, también mientras supervisa a otra persona
  - Siguiente: —
  - PR: #2

### 2026-05-12

- **shera88 (+ Claude)** — `main` — bootstrap inicial
  - Tocó: estructura completa Plan A chunk 1 (scaffold Vite + Tailwind 4 + shadcn + ESLint + Vitest)
  - Resultado: repo local funcionando, primer commit pendiente push
  - Siguiente: chunk A.2 (crear repo GitHub + branch protection + CI + project board)
  - PR: N/A (commit inicial directo a main, antes de protected branch)
