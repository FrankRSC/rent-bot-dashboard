/**
 * Helper de BD para pruebas de integración que necesitan sembrar estados que
 * no son alcanzables desde la UI (p.ej. REVIEW, que solo asigna el bot real —
 * ver rent-collector-sync.md 2026-08-04T20:20).
 *
 * El SQL se pasa por stdin (no como argumento -c) para evitar que las comillas
 * simples propias del SQL choquen con las comillas del shell que envuelven el
 * argumento — mismo tipo de bug que el de `$` en global-setup.ts, pero con `'`.
 */
import { execSync } from "child_process";

function psqlStdin(sql: string, extraFlags = ""): string {
  return execSync(`docker exec -i rent_collector_db psql -U admin -d rent_collector ${extraFlags}`, {
    input: sql,
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 15_000,
  }).toString();
}

/** Ejecuta SQL sin esperar un valor de retorno. */
export function dbExec(sql: string): void {
  psqlStdin(sql);
}

/** Ejecuta SQL que devuelve una sola columna/fila (p.ej. `SELECT id ...` o `INSERT ... RETURNING id`). */
export function dbQueryOne(sql: string): string {
  const out = psqlStdin(sql, "-t -A");
  const value = out.trim().split("\n")[0]?.trim();
  if (!value) throw new Error(`dbQueryOne: sin resultado para: ${sql}`);
  return value;
}
