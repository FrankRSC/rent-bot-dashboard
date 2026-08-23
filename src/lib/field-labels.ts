/**
 * Etiquetas legibles para los nombres de campo que manda el backend/bot.
 *
 * El arrendador nunca debe ver un identificador crudo (`cuentaDestinoLast4`,
 * `claveRastreo`…). Antes había tres mapas duplicados —en el detalle de pago y
 * en los dos diálogos de comprobante— que se habían desincronizado y que caían
 * en `?? key`, dejando el identificador a la vista. Este módulo es el único
 * lugar donde se traducen.
 *
 * Ver docs/PENDIENTES.md §"No mostrar nombres de campo en crudo al usuario".
 */

const FIELD_LABELS: Record<string, string> = {
  // ── Datos del comprobante (OCR / CEP) ──────────────────────────────────────
  monto:              "Monto",
  ocrMonto:           "Monto leído del comprobante",
  cepMonto:           "Monto verificado",
  // El evento `VERIFIED` de producción trae estos dos; sin entrada aquí el
  // respaldo `humanize()` los dejaba como "Expected amount" e "Is partial
  // payment" (sync 2026-08-23T13:40).
  expectedAmount:     "Monto esperado",
  isPartialPayment:   "Pago parcial",
  fecha:              "Fecha de la operación",
  fechaOperacion:     "Fecha de la operación",
  claveRastreo:       "Clave de rastreo / Referencia",
  referencia:         "Referencia",
  concepto:           "Concepto",
  sello:              "Sello digital",
  estado:             "Estado",
  // `estadoOperacion` solo lo produce el seed; producción manda `status`. Se
  // queda porque sigue habiendo filas viejas con esa llave.
  estadoOperacion:    "Estado",
  isIntrabancario:    "Tipo de transferencia",

  // ── Bancos y personas ──────────────────────────────────────────────────────
  banco:              "Banco",
  bancoEmisor:        "Banco emisor",
  bancoReceptor:      "Banco receptor",
  emisorNombre:       "Emisor",
  receptorNombre:     "Receptor",
  nombreOrdenante:    "Ordenante",
  nombreBeneficiario: "Beneficiario",

  // ── Cuenta destino ─────────────────────────────────────────────────────────
  cuentaDestino:      "Cuenta destino",
  ocrCuentaDestino:   "Cuenta destino (leída del comprobante)",
  // El bot pide estos cuando el comprobante enmascara la cuenta completa
  // (caso común BBVA/Dimo). Sin estas entradas se mostraba `cuentaDestinoLast4`.
  cuentaDestinoLast4: "Últimos 4 dígitos de la cuenta destino",
  ocrLast4Destino:    "Últimos 4 dígitos (leídos del comprobante)",
  last4:              "Últimos 4 dígitos",
  account:            "Cuenta verificada",
  expected:           "Últimos dígitos esperados",
  provided:           "Últimos dígitos del comprobante",

  // ── Eventos y revisión ─────────────────────────────────────────────────────
  reason:             "Motivo",
  field:              "Campo",
  value:              "Valor",
  status:             "Estado",
  error:              "Error",

  // ── Pago manual (§2.7 CONTRATOS_API.md) ────────────────────────────────────
  amount:             "Monto",
  paymentDate:        "Fecha de pago",
  billingPeriod:      "Periodo de renta",
  paymentMethod:      "Método de pago",
  note:               "Nota",
  source:             "Origen",
  tenantId:           "Inquilino",
};

/**
 * Red de seguridad para claves que el backend agregue y que aún no estén en el
 * mapa: `cuentaDestinoLast4` → "Cuenta destino last4". No es una traducción
 * ideal, pero nunca deja ver algo con forma de identificador.
 */
function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Etiqueta legible de un campo del backend.
 *
 * @param overrides etiquetas específicas de una pantalla (p. ej. los formularios
 *   usan "Monto (MXN)" para aclarar la moneda en el input).
 */
export function fieldLabel(key: string, overrides?: Record<string, string>): string {
  return overrides?.[key] ?? FIELD_LABELS[key] ?? humanize(key);
}
