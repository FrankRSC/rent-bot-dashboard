/**
 * Guardia de drift de contrato (Fase 3 — cierra parcialmente D7/G7).
 *
 * Cruza los tipos generados desde el OpenAPI del backend (`backend-schema.ts`,
 * regenerable con `npm run openapi:types` contra `/docs-json`) con los tipos
 * escritos a mano en `types.ts`. Si el backend cambia la forma de una entidad que
 * el UI consume y deja de proveer un campo que nuestros tipos exigen, este archivo
 * **deja de compilar** y `npm run build` (tsc) falla → el drift se detecta en build,
 * no en producción.
 *
 * No emite nada en runtime: son aserciones a nivel de tipo. Cuando migremos `types.ts`
 * a consumir el schema generado directamente (refactor mayor pendiente de D7), este
 * archivo se vuelve innecesario.
 *
 * ⚠️ Límite conocido: el OpenAPI declara los decimales (`monthlyAmount`,
 * `nextMonthlyAmount`) como `number`, pero TypeORM los serializa como `string` en
 * runtime. Esa diferencia schema↔runtime NO la detecta esta guardia; el UI ya la
 * absorbe coercionando con `Number(...)`.
 */
import type { components } from "./backend-schema";
import type { Tenant, Landlord, Property } from "./types";

type SchemaTenant = components["schemas"]["Tenant"];
type SchemaLandlord = components["schemas"]["Landlord"];
type SchemaProperty = components["schemas"]["Property"];

// Asignar la forma del backend a nuestra forma de UI: si el backend deja de proveer
// un campo que nuestro tipo declara como requerido, la asignación deja de compilar.
const _tenant: Tenant = null as unknown as SchemaTenant;
const _landlord: Landlord = null as unknown as SchemaLandlord;
const _property: Property = null as unknown as SchemaProperty;

void _tenant;
void _landlord;
void _property;
