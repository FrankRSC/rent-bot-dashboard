# SAVE TIME by Shiftly — Especificación de Producto e Investigación

**Versión:** 1.0 | **Fecha:** 2026-05-17

---

## 1. Edge Cases a Manejar

### Validación de Pagos

**EC-PV-01: Retraso de propagación en CEP (ventana SPEI de 30–90 segundos)**
Banxico CEP puede tardar hasta 90 segundos en reflejar "Liquidado". Si el inquilino manda el comprobante segundos después de transferir, el bot responderá "No encontrado" aunque el pago sea válido. Solución: **cola de reintentos** — esperar 60 segundos y re-consultar antes de marcar como fallido.

**EC-PV-02: Devolución después de validación inicial**
Un pago puede validarse como "Liquidado" el Día 1 pero devolverse dentro de 72 horas. El bot solo marca en validación inicial. Se necesita un job que re-verifique pagos validados en las primeras 72 horas.

**EC-PV-03: Monto correcto pero cuenta destino incorrecta (intrabancaria)**
Para transferencias intrabancarias, el sistema valida solo los últimos 4 dígitos de la cuenta. Un inquilino podría enviar a una cuenta incorrecta que coincida en esos dígitos. Probabilidad baja (1:10,000) pero se debe validar también el monto cuando sea posible.

**EC-PV-04: Pago parcial enviado como pago completo**
Inquilino manda comprobante de $3,500 cuando la renta es $7,000. El CEP valida exitosamente (el pago existe) y el bot reporta "pago validado" — pero la renta está incompleta. El dashboard debe almacenar el monto esperado por inquilino y detectar pagos parciales.

**EC-PV-05: OCR mallee el monto por calidad de imagen**
OCR lee "$7,000" como "$1,000". La consulta CEP falla por monto incorrecto. Solución: si falla, reintentar con tolerancia ±10% en monto o con `monto=0.00` (Banxico lo acepta como comodín).

**EC-PV-06: Clave de rastreo de un mes anterior**
Inquilino manda screenshot de comprobante viejo. OCR extrae correctamente, CEP confirma "Liquidado" (porque SÍ fue un pago real, solo del mes pasado). La validación debe cruzar que la `fecha` caiga dentro del ciclo de cobranza actual (±5 días del día de pago).

**EC-PV-07: Comprobante de DiMo o CoDi en lugar de SPEI**
DiMo y CoDi NO generan registros en Banxico CEP. Si el inquilino paga con DiMo, el bot fallará validación siempre. Detectar keywords: "DiMo", "CoDi", "pago con QR", "cobro digital" → ruta a revisión manual.

**EC-PV-08: Comisión bancaria deducida — monto llega corto**
Algunos bancos cobran ~$8.70 MXN por SPEI saliente. El inquilino manda $7,000 pero el arrendador recibe $6,991.30. Definir una "tolerancia de comisión" configurable por propiedad (ej: hasta $20 de diferencia).

**EC-PV-09: Intrabancarias en fin de semana / día festivo**
Algunas transferencias intrabancarias se procesan en el siguiente día hábil aunque el comprobante diga sábado. El sistema debe entender el calendario bancario mexicano para calcular si el pago fue a tiempo.

**EC-PV-10: OCR confunde clave de rastreo con referencia (TODO en el código)**
El `tipoCriterio` se selecciona incorrectamente. Fix: una clave de rastreo SPEI siempre es alfanumérica de 10–30 chars; una referencia es numérica de 1–7 dígitos. Cualquier "clave" puramente numérica y ≤7 dígitos debe reclasificarse como referencia.

### Comportamiento del Inquilino

**EC-TB-01: Inquilino reenvía comprobante de otra persona**
Un inquilino reenvía el comprobante de su compañero de departamento como si fuera el suyo. El bot valida y acredita el pago dos veces. Solución: rastrear `claveRastreo` como globalmente única por periodo de cobro; rechazar duplicados independientemente del remitente.

**EC-TB-02: Screenshot de transferencia "en proceso"**
Apps como BBVA y Santander muestran pantalla de confirmación ANTES de que la transferencia ejecute. OCR extrae correctamente, CEP devuelve "No encontrado". El bot debe detectar keywords "en proceso", "en espera", "processing" y hacer un retry de 5 minutos.

**EC-TB-03: Inquilino envía video en lugar de foto**
WhatsApp soporta video. Si el inquilino manda un video de su pantalla, el bot no lo maneja. Agregar soporte para mensajes tipo `video` con un mensaje de error apropiado.

**EC-TB-04: Inquilino envía PDF del comprobante**
BBVA, Banorte, HSBC permiten exportar comprobantes como PDF. El bot actualmente rechaza PDFs. Implementar conversión PDF→imagen antes del OCR.

**EC-TB-05: Inquilino cambia de número de teléfono**
El historial de pagos está ligado al número anterior. El bot trata el nuevo número como usuario desconocido. El dashboard debe soportar reasignación de número para un perfil de inquilino existente.

**EC-TB-06: Dos inquilinos en un mismo inmueble con pagos parciales**
Cuartos compartidos donde cada inquilino paga su parte. Deben rastrearse ambos pagos independientemente y marcar la propiedad como "pagada al 100%" solo cuando la suma iguale el monto esperado total.

**EC-TB-07: Inquilino escribe en inglés**
El bot solo entiende "ayuda", "paso", "estado". Agregar triggers en inglés: "help", "status", "step".

### Configuración del Arrendador

**EC-LC-01: CLABE registrada no coincide con el banco seleccionado**
`ownerBank` y la CLABE se guardan independientemente. Un arrendador puede configurar banco "BBVA" con una CLABE de HSBC, causando mala clasificación de intrabancarias. Al guardar la CLABE, validar su prefijo de 3 dígitos contra el banco seleccionado.

**EC-LC-02: Arrendador cambia cuenta beneficiaria a mitad de mes**
Inquilinos que pagaron antes del cambio pagaron correctamente; los de después deben pagar a la nueva cuenta. El sistema debe almacenar rangos de fechas efectivas para las cuentas beneficiarias, no solo el valor actual.

**EC-LC-03: Propiedad desactivada con inquilinos activos**
Si una propiedad se marca inactiva, el bot no la encuentra en DB y procede con el banco por defecto. Las propiedades inactivas deben responder con un mensaje claro al inquilino.

### Sistema / Técnico

**EC-ST-01: `conversationState` en memoria sin TTL**
El `Map` de conversaciones no tiene expiración. Inquilinos que inician flujo y no lo completan quedan en memoria indefinidamente. Implementar TTL de 30 minutos con Redis o `setTimeout`.

**EC-ST-02: Deduplicación basada en archivo local**
`processed_messages.json` no escala horizontalmente. Reemplazar con Redis `SETNX` o tabla de dedup en DB.

**EC-ST-03: Scraping de CEP de Banxico es frágil**
Si Banxico cambia su HTML, toda la validación falla silenciosamente. Necesario: (1) health-check al startup con una validación de prueba conocida, (2) alerta cuando la tasa de éxito cae debajo de un umbral.

**EC-ST-04: Nombre de modelo Gemini incorrecto**
El código usa `gemini-3.1-flash-lite` que no existe. El modelo correcto es `gemini-1.5-flash` o `gemini-2.0-flash`. Agregar validación del nombre del modelo al iniciar.

**EC-ST-05: Mensajes "stale" de más de 15 minutos se descartan silenciosamente**
Si el servidor reinicia mientras un inquilino manda un comprobante, el mensaje se descarta sin respuesta. Para mensajes de 15–60 minutos de antigüedad, enviar un "recibimos tu mensaje pero tuvimos un problema temporal".

**EC-ST-06: Sin verificación de firma del webhook de WhatsApp**
El endpoint `/whatsapp/webhook` no verifica el header `X-Hub-Signature-256` que Meta envía. Cualquiera que conozca la URL puede enviar payloads falsos. **Implementar antes de producción.**

### Sistema Bancario Mexicano

**EC-MX-01: "Pago Express" de BBVA (CoDi via QR)**
BBVA Mexico tiene transferencias rápidas via CoDi para montos <$8,000 que no pasan por CEP. Detectar keywords "Pago Express", "Cobro Express", "CoDi" → manejar por separado.

**EC-MX-02: Billeteras fintech como origen (Spin/OXXO, Mercado Pago, Kueski)**
Estas son originadoras válidas de SPEI pero sus comprobantes son de la app de la billetera. Mapear: Spin → STP, Mercado Pago → STP, etc.

**EC-MX-03: Comprobantes de Nu (Nubank México)**
Nu está creciendo rápido. Sus comprobantes tienen formato visual único. El banco "NU" o "NUBANK" debe normalizarse al código Banxico correcto (institución 706).

**EC-MX-04: Transferencias desde USA vía remesas (Bitso, Wise, Remitly)**
Llegan via SPEI pero el banco de origen aparece como "BITSO" o "WISE". Mapear proveedores de remesas a sus códigos de participante SPEI.

---

## 2. Funcionalidades Adicionales Útiles

| # | Función | Prioridad | Complejidad |
|---|---------|-----------|-------------|
| 1 | Recordatorio automático de renta via WhatsApp (X días antes) | Alta | Fácil |
| 2 | Generación automática de Recibo de Arrendamiento PDF | Alta | Media |
| 3 | Calculadora automática de moratorio (días de atraso × %) | Alta | Fácil |
| 4 | Vista de calendario de pagos por mes | Alta | Media |
| 5 | Múltiples cuentas beneficiarias por propiedad | Alta | Media |
| 6 | Historial de pagos y score de puntualidad por inquilino | Alta | Fácil |
| 7 | Integración CFDI 4.0 via PAC (Facturapi, CFDI4) | Alta | Difícil |
| 8 | Notificaciones WhatsApp al arrendador cuando un inquilino paga | Media | Fácil |
| 9 | Gestión de aumentos de renta con ajuste INPC | Media | Fácil |
| 10 | Generador de QR / liga de pago SPEI con datos prellenados | Media | Media |
| 11 | Agrupación de propiedades por persona física vs empresa | Media | Media |
| 12 | Registro manual de pagos (efectivo, depósito OXXO) con auditoría | Media | Fácil |
| 13 | Feed automático de tasa INPC desde Banxico/INEGI | Media | Fácil |
| 14 | Flujo de onboarding automático para nuevos inquilinos via WhatsApp | Media | Fácil |
| 15 | Proyección de flujo de caja (3 meses) basada en histórico | Baja | Media |

---

## 3. Contexto del Mercado Mexicano

### Patrones de Pago
- La mayoría de contratos especifican pago del 1° al 5° del mes
- En la práctica, 60–70% de inquilinos en CDMX pagan entre el 2° y 5°
- Diciembre es el peor mes de cobranza (aguinaldo + gastos navideños)
- Agosto/Septiembre sufren baja por regreso a clases

### Distribución de métodos de pago (estimado 2025)
- SPEI interbancario: ~50%
- BBVA intrabancario: ~20% (mayor participación de mercado)
- Santander intrabancario: ~10%
- Efectivo: ~15% (en declive)
- CoDi/DiMo: ~5% (en crecimiento rápido)

### Bancos más usados por inquilinos
BBVA México (~37M cuentas), Banamex/Citibanamex (~21M), Banorte (~17M), Banco Azteca (~17M), HSBC (~10M), Santander (~9M), Nu México (~5M y creciendo), Hey Banco/Banregio (~2M), Mercado Pago/Spin (informalidad).

### Requisitos legales — Recibo de Arrendamiento
- Desde enero 2022, SAT requiere **CFDI 4.0** para ingresos por arrendamiento
- Arrendamientos residenciales: **exentos de IVA** (Art. 9 LIVA)
- Arrendamientos comerciales: sujetos a **16% IVA**
- Retención de ISR 10% solo cuando el inquilino es persona moral pagando a persona física
- Sin CFDI, el SAT puede detectar ingresos no declarados cruzando datos CNBV

### Fraudes comunes en arrendamiento mexicano
1. **Comprobante falso** — el mayor vector; generadores disponibles en Telegram/Facebook. La defensa es la validación CEP (solo para interbancarias)
2. **Reciclaje de comprobante** — reusar comprobante del mes anterior
3. **"Stuck in CEP" social engineering** — el inquilino fraudulento alega que "ya lo mandó" y presiona al arrendador a validar manualmente
4. **Suplantación entre inquilinos** — un inquilino comparte comprobante con otro

---

## 4. Mejoras al Flujo Conversacional del Bot

### Cuando el OCR falla
1. "No pude leer bien tu comprobante. Puede ser por imagen borrosa, brillo, o recorte."
2. Ofrecer alternativa de texto: "También puedes escribirme: MONTO: $X, BANCO: [banco], FECHA: DD/MM/AAAA, CLAVE: [clave]"
3. Si falla por segunda vez: notificar al arrendador para revisión manual

### Cuando la validación CEP falla
1. Primera falla: "No encontré tu pago aún — puede tardar hasta 2 minutos. Revisaré de nuevo."
2. Retry automático en 90 segundos
3. Si sigue fallando: confirmar datos con el inquilino
4. Escalar a arrendador con datos OCR adjuntos. Nunca usar la palabra "fraude".

### Pago parcial detectado
"Recibí tu pago de $3,500. Tu renta mensual es de $7,000. ¿Es un pago parcial?"
→ Acumular pagos del periodo; marcar como pagado completo solo cuando total ≥ monto esperado.

### Pago duplicado
"Este comprobante ya fue registrado para este mes — tu renta está al corriente."
→ No revalidar; registrar intento de duplicado en log.

---

## 5. Edge Cases del Dashboard

### 50+ propiedades
- Search por dirección, nombre de inquilino o estado (al corriente / pendiente / vencido)
- Agrupar por colonia/ciudad/etiquetas personalizadas
- Header de resumen: "42/50 propiedades al corriente | 5 pendientes | 3 vencidas"
- Botón de "Enviar recordatorio a todos los pendientes" masivo

### Mismo inquilino en dos unidades
- Quitar constraint `UNIQUE` de `phone` en la entidad Tenant; hacer compuesto `(phone, propertyId)`
- El bot debe preguntar: "¿Este pago es para [Depto 101] o para [Depto 305]?"

### Día de pago en fin de semana o día festivo
**Días festivos oficiales México (LFT):** 1 enero, 3er lunes febrero, 21 marzo, 1 mayo, 16 sept, 3er lunes noviembre, 20 noviembre, 25 diciembre.
- Si día de pago cae en domingo → mover al lunes siguiente
- Si cae en festivo → mover al siguiente día hábil
- Mostrar en dashboard: "Día de pago: Lunes 2 de enero (el 1ero cae en domingo)"
- Guardar `payment_day` (configurado) y `effective_payment_date` (calculado) separados

### Aumentos de renta
- Nuevos campos necesarios: `rentAmount`, `effectiveDate`, `increaseHistory[]`
- Wizard: "Programar aumento" → fecha efectiva, nuevo monto, opción de notificar al inquilino via WhatsApp
- Si el inquilino disputa: flag `increaseDisputed: boolean`, no aplicar automáticamente, mostrar alerta al arrendador

---

## Prioridades de Implementación

### Inmediato (bloquea seguridad en producción)
- EC-ST-06: Verificación de firma X-Hub-Signature-256 del webhook WhatsApp
- EC-ST-04: Corregir nombre del modelo Gemini
- EC-PV-10: Fix de clasificación `tipoCriterio` (el TODO en banxico.service.ts)
- EC-ST-01: TTL en `conversationState` (Redis o timeout)
- EC-ST-02: Reemplazar deduplicación por archivo con Redis SETNX

### Corto plazo (primer mes post-lanzamiento)
- EC-PV-01: Cola de reintentos de 90 segundos para propagación CEP
- EC-TB-01: Deduplicación global de `claveRastreo` por periodo
- EC-PV-07: Detección de recibos DiMo/CoDi → revisión manual
- EC-ST-03: Health-check de integración CEP con alertas
- Feature 1: Recordatorios automáticos WhatsApp (mayor ROI para arrendadores)

### Mediano plazo (Q2 post-lanzamiento)
- Feature 4: Vista de calendario en dashboard
- Feature 2: Generación de recibo PDF
- Feature 6: Historial y score de puntualidad del inquilino
- EC-LC-01: Validación de prefijo CLABE vs banco seleccionado
- Lógica de días de pago + calendario de festivos

### Largo plazo (tier premium)
- Feature 7: Integración CFDI 4.0 via PAC
- Feature 11: Agrupación multi-entidad de portafolio
- Feature 13: Feed de tasa INPC de Banxico/INEGI
- Feature 10: Generador de liga/QR de pago SPEI
