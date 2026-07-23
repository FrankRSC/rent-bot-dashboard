Corre los criterios de aceptación de la fase activa (según `PROGRESS.md`) definidos en `PLAN.md` §8.

1. Ejecuta lo que aplique de la fase: `npm run lint`, `npm run build` y, si la fase lo pide, `npm run test:e2e`.
2. Verifica los criterios de comportamiento de la fase (los "Criterios de aceptación" de esa fase en `PLAN.md`).
3. Reporta: qué pasó, qué falló y por qué.

- **Si todo pasa:** marca la fase como `completada` en `PROGRESS.md` con la fecha y una nota (qué se construyó, archivos tocados, resultado de lint/build/e2e, refs a `DECISIONS.md`). Haz commit (español imperativo, sin firma de Claude).
- **Si algo falla:** NO actualices `PROGRESS.md`; propón el fix más pequeño posible.
