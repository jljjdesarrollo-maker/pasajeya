# ESPECIFICACIÓN TÉCNICA E INMUTABLE — MÓDULO 2: MOTOR DE CONCILIACIÓN BANCARIA, PAGOS MULTI-BANCO Y POLÍTICA DE SALDOS CON CADUCIDAD (30 DÍAS)
# PROYECTO: "PasajeYa" — CLIENTE PILOTO: Vilcabambaturis Cía. Ltda. (Loja, Ecuador)

## 1. Canales Bancarios y Pantalla de Checkout Flexible
- **Bancos Habilitados:** **Banco de Loja** y **Banco Pichincha / Deuna!** (100% transferencias bancarias y códigos QR, con **0% de comisión** de pasarela de tarjetas).
- **Interfaz Doble de Pago:**
  - Botones de copiado automático en 1-clic para **Número de Cuenta** (`2901485920` / `2100284910`) y **Cédula/RUC** (`1191705482001`).
  - Visualización directa en pantalla de los códigos QR oficiales (**Deuna! — Banco Pichincha** y **QR Banco de Loja**) para escaneo rápido desde app móvil.
- **Términos y Condiciones Obligatorios:** Casilla de verificación requerida previo al pago informando explícitamente la política de **"No Cambios / No Devoluciones"** y la **caducidad de Saldos a Favor a 30 días calendario**.

## 2. Conciliación Automática en Tiempo Real (`< 1.2s`)
- **Escucha Directa de Correos:** Integración mediante **Gmail API (OAuth2) + Google Cloud Pub/Sub Webhooks** para procesamiento e identificación instantánea en `< 1.2 segundos`.
- **Parsing e Idempotencia:** Extracción determinista por **Regex** (con fallback a **Gemini NLP**) de monto, referencia bancaria y fecha/hora.
- **Control Antiduplicados:** Clave única compuesta **`[tenantId, referenciaBanco]`** (`@@unique([tenantId, referenciaBanco])` en Prisma) para impedir cualquier intento de doble acreditación.

## 3. Política de No Cambios y Manifiesto 100% Limpio
- **Boletos Confirmados:** Una vez emitido el pase QR, no se permiten cambios de fecha, hora o asiento, ni devoluciones de dinero en efectivo.
- **Cero Cobro a Bordo:** El ayudante en autobús recibe exclusivamente pasajeros con boleto 100% pagado e impreso en el manifiesto físico.
- **Retención por Pago Incompleto:** Si se transfiere un monto menor al total (`$Tarifa + $0.25 fee`), el boleto no se emite y queda retenido hasta completar el saldo faltante exacto antes de T-20 min.

## 4. Saldos a Favor y Notas de Crédito Digitales (`NotaCreditoSaldo` — Caducidad 30 Días)
- **Registro en `NotaCreditoSaldo`:** Los pagos extemporáneos (posteriores a T-20 min) o pagos incompletos no liquidados al llegar T-20 min se registran automáticamente como un crédito digital vinculado a la Cédula/RUC y WhatsApp del comprador.
- **Caducidad a 30 Días Calendario:** Todo Saldo a Favor posee un campo `fechaExpiracion` a 30 días calendario. Si no es utilizado en ese lapso, el sistema lo marca automáticamente como `EXPIRED` (imputado a gastos administrativos).
- **Protección de Caja en Ventanilla (0 Efectivo en Taquilla):**
  - La secretaria **NO entrega dinero en efectivo en ventanilla bajo ningún concepto**.
  - En `/taquilla`, la secretaria puede emitir pasajes físicos seleccionando la forma de pago **`SALDO_A_FAVOR`**, utilizando el crédito digital vigente (`ACTIVE`) del cliente sin alterar su caja chica (`$0.00` afectación en efectivo).
- **Regla del Fee de `$0.25`:** El fee tecnológico de `$0.25` **NO se cobra** sobre transferencias que no emitieron boleto (`feeTecnologicoCobradoUSD = 0.00`).
