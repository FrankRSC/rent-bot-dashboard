@AGENTS.md

## Harness de trabajo por fases

- **Fuente de verdad:** `PLAN.md` (índice ligero) apunta a `docs/CONTRATOS_API.md` (contrato con el backend) y `docs/MEJORAS.md` (backlog). No improvises diseño ni contratos: lee la sección relevante primero.
- **Fase activa:** `PROGRESS.md` dice en qué fase estamos. Trabaja SOLO en la fase activa; no empieces trabajo de una fase futura sin confirmación.
- **Comandos:** `/fase N` arranca una fase (plan → confirmación → commit por tarea); `/validar` corre sus criterios de aceptación y actualiza `PROGRESS.md`.
- **Ambigüedad:** elige la opción más simple y anótala en `DECISIONS.md` (fecha + contexto + decisión).
- **UI:** los tokens de diseño están en `DESIGN.md` (canónicos en `src/app/globals.css`).
- Guardrails innegociables: `PLAN.md` §10 (reflejan `AGENTS.md`).
