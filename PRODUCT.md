# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Arrendadores mexicanos de cualquier escala — persona física con 1–10 inmuebles, propietario mediano con 10–50 propiedades, o administrador profesional de bienes raíces de terceros — que necesitan cobrar rentas de manera sistemática y confiable sin dedicar tiempo manual a recordatorios, verificación de pagos o emisión de facturas.

El perfil técnico varía: desde el arrendador que prefiere el celular hasta el administrador que trabaja desde escritorio. El producto debe funcionar bien en ambos contextos.

## Product Purpose

Rent Collector Dashboard centraliza el ciclo completo de cobranza de rentas: el bot de WhatsApp recibe los comprobantes de pago de los inquilinos, los verifica automáticamente via OCR y consulta al CEP del Banco de México, y el dashboard le presenta al arrendador el estado real de cada pago sin intervención manual. El arrendador ve de un vistazo quién pagó, quién debe, y puede emitir facturas SAT reales desde la misma interfaz.

El éxito es cuando el arrendador cierra el mes de cobranza sin haber perseguido a ningún inquilino por WhatsApp y sin haber transcrito ningún dato de comprobante a mano.

## Positioning

El diferenciador es el ciclo automatizado completo: **recordatorio automático por WhatsApp → inquilino envía comprobante por WhatsApp → bot verifica con OCR + CEP → dashboard actualiza el estado** — sin que el arrendador toque nada. Ninguna hoja de cálculo ni sistema genérico de cobranza cierra ese ciclo; la mayoría requiere que el arrendador valide cada pago a mano.

## Operating Context

- El arrendador típicamente revisa el dashboard una o dos veces por semana, no en tiempo real.
- Los inquilinos interactúan exclusivamente a través del bot de WhatsApp; nunca ven el dashboard.
- El arrendador puede recibir notificaciones de pago y revisar comprobantes desde cualquier dispositivo.
- La emisión de facturas SAT es parte del flujo mensual para inquilinos con necesidad fiscal.
- El backend (NestJS, `rent-collector bot`) corre en un servidor aparte; el dashboard es solo el frontend.

## Capabilities and Constraints

**Funcionalidades confirmadas:**
- Gestión de propiedades e inquilinos
- Registro y verificación de pagos (OCR de comprobante + consulta CEP/Banco de México)
- Historial de intentos de pago por inquilino
- Emisión de facturas SAT reales
- Recordatorios automáticos de pago por WhatsApp (vía bot)
- Configuración de notificaciones y preferencias del arrendador
- Reportes de cobranza mensuales
- Autenticación con BFF y cookie httpOnly (multi-arrendador)
- Vista superadmin con impersonación de arrendadores

**Restricciones técnicas:**
- Fetch nativo únicamente; ninguna librería de fetching externa (SWR, React Query, etc.)
- Stack fijo: Next.js 16.2.6 + React 19 + Zustand 5 + Tailwind 4 + TypeScript estricto
- El frontend llama siempre a `/api/...` (rewrite a `BACKEND_URL`); jamás hardcodea `localhost:3001`

**Decisiones abiertas:**
- Nivel de accesibilidad requerido más allá de contraste básico (WCAG AA no confirmado formalmente)
- Roles de arrendador distintos (p. ej. propietario vs. gestor delegado) — no implementados aún

## Brand Commitments

- Idioma: español (es-MX) exclusivamente. Sin internacionalización.
- Tono de UI: profesional y conciso. Sin lenguaje informal, coloquial, ni frases de IA conversacional.
- Paleta: azul `#2952F3` como acción principal, tinta `#0B1426` para textos de jerarquía alta, grises slate para secundarios.

## Evidence on Hand

- Implementación funcional completa con datos reales de arrendadores en desarrollo
- Integración real con CEP del Banco de México para verificación de transferencias
- Generación de facturas SAT a través del backend
- Bot de WhatsApp operativo que recibe y pre-procesa comprobantes
- Ausencia confirmada: no hay testimonios, benchmarks, ni activos de marca formales (logo, tipografía corporativa)

## Product Principles

1. **El ciclo cierra solo.** Cada flujo — recordatorio, comprobante, verificación, registro — debe completarse sin intervención manual del arrendador. Si el arrendador tiene que tocar algo para que el dato quede registrado, el producto no cumplió su promesa.
2. **Honestidad sobre el estado real.** Nunca mostrar como "guardado", "enviado" o "verificado" algo que no persiste en el backend. Los estados del sistema reflejan la realidad, no el optimismo de la UI.
3. **Los datos fiscales son intocables.** RFC, CFDI, montos y fechas deben representarse con precisión exacta. La conveniencia de UI no justifica ambigüedad en datos que tienen consecuencias legales.
4. **Claridad operativa sobre expresividad.** El arrendador necesita saber qué pasó y qué falta, no admirar la interfaz. El diseño sirve a la tarea; no compite con ella.
5. **El inquilino no existe en el dashboard.** Todo lo que ve el inquilino pasa por WhatsApp. El dashboard es exclusivamente para el arrendador.
