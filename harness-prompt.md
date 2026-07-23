# Prompt: montar el harness de trabajo estilo ArbolApp

> Cómo usarlo: copia este archivo a la raíz de un repo nuevo (o pégalo como primer mensaje
> en Claude Code) y di: "sigue harness-prompt.md". Claude te hará las preguntas de la
> sección A y luego generará todos los archivos.

---

Eres Claude Code y vas a montar el **harness de desarrollo por fases** de este proyecto:
un conjunto de archivos que hace que cada sesión arranque con el contexto correcto sin
re-explicar nada, y que impide que el agente improvise diseño o se salte fases.

## A. Antes de escribir nada, pregunta al humano

1. **Nombre del proyecto** y descripción de una línea.
2. **Stacks/subdirectorios** (ej. `api/` NestJS, `mobile/` Flutter, `web/` Next.js). Cada uno tendrá su propio `CLAUDE.md`.
3. **¿Ya existe un plan técnico?** Si sí, se copia tal cual a `PLAN.md`. Si no, el primer trabajo será escribirlo juntos (no inventes uno tú solo).
4. **Constantes de negocio compartidas entre stacks** (puntos, límites, umbrales…): si existen, vivirán duplicadas en un archivo `rules` por stack con la regla "todo cambio se aplica en TODOS".
5. **Guardrails**: qué cosas están explícitamente prohibidas en v1 (features pospuestas, tablas append-only, librerías no permitidas…).
6. **Idioma de commits y de UI** (en ArbolApp: español, formato `fase-N: descripción corta`).

## B. Estructura a crear

```
<repo>/
├── CLAUDE.md                  # Memoria raíz (corta, ~40-60 líneas máx)
├── PLAN.md                    # Fuente de verdad: arquitectura, schema, contratos, reglas, fases
├── DESIGN.md                  # (si hay UI) Sistema de diseño: tokens, componentes, reglas visuales
├── DECISIONS.md               # Bitácora de decisiones ante ambigüedad
├── PROGRESS.md                # Checklist de fases: estado + fecha + notas
├── .claude/commands/
│   ├── fase.md                # /fase N — arranca una fase
│   └── validar.md             # /validar — corre los criterios de aceptación
└── <stack>/CLAUDE.md          # Uno por subdirectorio de stack
```

Claude Code carga siempre el `CLAUDE.md` raíz, y los anidados solo al trabajar dentro de
esa carpeta. Por eso la raíz se queda corta (reglas transversales) y lo específico de cada
stack vive en su carpeta.

## C. Contenido de cada archivo

### `CLAUDE.md` (raíz) — plantilla, rellena los <placeholders>

```markdown
# <NombreProyecto>

<Descripción de una línea: qué es y con qué stacks.>

## Fuente de verdad
- PLAN.md contiene TODA la arquitectura, schema, contratos de API, reglas de negocio y fases.
  Antes de implementar cualquier cosa, lee la sección relevante de PLAN.md. No improvises diseño.
- PROGRESS.md dice en qué fase estamos. Trabaja SOLO en la fase activa.

## Reglas de trabajo (IMPORTANTES)
- Una fase por sesión. NUNCA empieces trabajo de una fase futura.
- Al terminar una fase: corre sus criterios de aceptación (sección <N-fases> de PLAN.md),
  actualiza PROGRESS.md y detente. No continúes a la siguiente fase sin confirmación del humano.
- Ante ambigüedad: elige la opción más simple y anótala en DECISIONS.md (fecha + contexto + decisión).
- Los guardrails de la sección <N-guardrails> de PLAN.md son innegociables. En particular:
  <lista corta de los 2-4 guardrails más importantes, copiados literalmente>.
- Las constantes de negocio (<ejemplos>) viven en <ruta rules stack A> y <ruta rules stack B>.
  Todo cambio se aplica en TODOS esos archivos.

## Comandos
- <Stack A>: cd <dir> && <dev> | <test> | <migraciones u otro>
- <Stack B>: cd <dir> && <dev> | <test> | <lint>

## Estilo
- Commits en <idioma>, formato: "fase-N: descripción corta".
- Un commit por tarea completada, no commits gigantes al final.
- Tests primero en verde antes de marcar cualquier tarea como terminada.
```

### `<stack>/CLAUDE.md` — uno por stack, 8-12 líneas

Contenido: stack y librerías exactas permitidas; dónde vive cada cosa en PLAN.md
("el schema está en la sección 3: úsalo tal cual, no agregues campos"); las 3-5 reglas de
arquitectura del stack (ej. "validación de negocio en el servicio, nunca en el controller",
"los blocs nunca usan el cliente HTTP directo"); invariantes duros (append-only, formatos
de error); y la vara de calidad para cerrar tarea (analyze/lint sin warnings, tipos de tests
exigidos).

### `PLAN.md` — el documento maestro

Si el humano ya tiene un plan, cópialo tal cual. Si no, escríbelo con él usando esta
estructura de secciones numeradas (los números importan: CLAUDE.md y los comandos slash
las referencian por número):

- **§0 Decisiones cerradas (no negociables)** — stack, servicios, alcance v1.
- **§1 Estructura del proyecto y configuración para Claude Code** — exactamente la sección B de este prompt, adaptada.
- **§2 Arquitectura general** — diagrama de cajas.
- **§3 Modelo de datos** — schema completo, listo para copiar.
- **§4 Contratos del API** — cada endpoint con request/response y códigos de error.
- **§5-7** — lo que el proyecto necesite (workers/crons, reglas de negocio "implementar exactamente así", pantallas y flujos de UI).
- **§8 Fases de ejecución para el agente** — cada fase con: alcance, tareas y **criterios de aceptación verificables** (comandos concretos que pasan/fallan).
- **§9 Variables de entorno** — `.env.example` completo.
- **§10 Guardrails (qué NO hacer)** — lista explícita de prohibiciones.

### `PROGRESS.md`

```markdown
# Progreso de fases — <NombreProyecto>

| Fase | Descripción | Estado | Fecha | Notas |
|---|---|---|---|---|
| 0 | <descripción> | pendiente | | |
| 1 | <descripción> | pendiente | | |
```

Estados: `pendiente | en curso | completada`. Las notas de una fase completada resumen
QUÉ se construyó, archivos/módulos tocados, resultado de los tests, y referencias a
DECISIONS.md — es el contexto que la siguiente sesión leerá en vez del historial.

### `DECISIONS.md`

```markdown
# Bitácora de decisiones (<NombreProyecto>)

Registro de decisiones tomadas ante ambigüedad no cubierta por PLAN.md. Formato: fecha + contexto + decisión.

## <YYYY-MM-DD> — <título corto>
**Contexto:** <qué ambigüedad o hueco apareció>
**Decisión:** <qué se eligió y por qué es la opción más simple>
```

### `.claude/commands/fase.md`

```markdown
Vas a trabajar en la Fase $ARGUMENTS de <NombreProyecto>.
1. Lee PROGRESS.md y confirma que las fases anteriores están completas. Si no, detente y repórtalo.
2. Lee la Fase $ARGUMENTS en la sección <N-fases> de PLAN.md y las secciones de PLAN.md que referencia.
3. Presenta un plan de implementación breve (lista de tareas en orden) y espera confirmación antes de escribir código.
4. Implementa tarea por tarea, con commit por tarea.
```

### `.claude/commands/validar.md`

```markdown
Corre los criterios de aceptación de la fase activa (según PROGRESS.md) definidos en la sección <N-fases> de PLAN.md.
Ejecuta los tests correspondientes y reporta: qué pasó, qué falló y por qué.
Si todo pasa: actualiza PROGRESS.md marcando la fase como completada con la fecha, y haz commit "fase-N: completada".
Si algo falla: NO actualices PROGRESS.md; propone el fix más pequeño posible.
```

### `DESIGN.md` (solo si hay UI)

Tokens de color con nombre, tipografía, componentes y reglas visuales. Regla acompañante en
el `CLAUDE.md` del stack de UI: nunca colores/estilos inline en widgets — todo sale del
archivo de tema generado desde DESIGN.md.

## D. Reglas de operación del harness (explícalas al humano al terminar)

1. **Flujo por fase:** abrir Claude Code en la raíz → `/fase N` → revisar y aprobar el plan (modo plan para fases grandes) → al terminar `/validar` → solo avanzar cuando PROGRESS.md marque la fase completa.
2. **Sesión nueva por fase.** No encadenar fases en una conversación larga: el contexto se degrada y el agente empieza a improvisar.
3. **Toda ambigüedad deja rastro** en DECISIONS.md. Si la decisión cambia algo estructural, PLAN.md se actualiza en el mismo commit.
4. **Regla de mantenimiento de memoria:** si corriges al agente dos veces por el mismo motivo, esa corrección se vuelve una línea nueva del `CLAUDE.md` correspondiente (raíz si es transversal, el del stack si no). Si la raíz supera ~60 líneas, mueve detalle a los CLAUDE.md anidados.
5. **Constantes compartidas:** todo cambio a un archivo `rules` se replica en sus espejos de los demás stacks en el mismo commit.

## E. Al terminar

Genera todos los archivos, haz un único commit inicial (`fase-0: harness de Claude Code`
o el formato que el humano haya elegido) y detente. No empieces la Fase 0 del proyecto
sin confirmación del humano.
