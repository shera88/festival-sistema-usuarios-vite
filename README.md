# Festival DanzArte 2026 — Sistema de Usuarios (Vite)

Portal web para participantes del Festival DanzArte 2026. Versión moderna en Vite + React + TypeScript.

## Quick start

```bash
# 1. Instalar deps
npm install

# 2. Copiar template de env
cp .env.example .env.local

# 3. Copiar template PHP config y rellenar service_role
cp php-backend/config.example.php php-backend/config.php
# Editar php-backend/config.php — SUPABASE_SERVICE_ROLE_KEY

# 4. Backend PHP (terminal 1)
npm run dev:php

# 5. Frontend (terminal 2)
npm run dev
```

Abrir http://127.0.0.1:5173/.

## Stack

Vite 8, React 19, TypeScript 6, Tailwind 4, shadcn/ui, TanStack Query, react-router 7, supabase-js, zod, react-hook-form. Backend: PHP 8 (SiteGround). DB: Supabase self-hosted en `supabase.imaginarte.cloud`.

## Estructura

- `src/` — SPA React/TS
- `php-backend/` — endpoints PHP (config.php gitignored)
- `migrations/` — SQL aplicado en Supabase
- `docs/specs/` — spec arquitectura
- `docs/plans/` — planes implementación

Arquitectura completa en `docs/specs/2026-05-12-festival-sistema-usuarios-vite-design.md`.

## Multi-dev workflow

Antes de tocar archivos: leer `AVANCES.md` sección "EN PROGRESO" y verificar issues con label `in-progress`. Reglas completas en `CLAUDE.md`.
