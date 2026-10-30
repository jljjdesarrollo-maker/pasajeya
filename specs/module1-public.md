# ESPECIFICACIÓN TÉCNICA E INMUTABLE — MÓDULO 1: INTERFAZ PÚBLICA DE COMPRA (MOBILE-FIRST), MEDIOS PASAJES (MÓDULO 10), MANIFIESTO EN PAPEL Y ESTRUCTURA QR 1-A-N
# PROYECTO: "PasajeYa" — CLIENTE PILOTO: Vilcabambaturis Cía. Ltda. (Loja, Ecuador)

## 1. Paradas Urbanas Autorizadas y Topología Vial (ADR-005)
- **Prohibición Absoluta ANT:** Queda estrictamente eliminada y prohibida la parada **"La Bomba Quemada"** (tanto para abordaje como para desembarque) en cumplimiento de las resoluciones de la Agencia Nacional de Tránsito (ANT).
- **Catálogo Oficial de 5 Paradas Urbanas Autorizadas en Loja:**
  1. `Terminal Reina del Cisne (Andén Principal)`
  2. `Sueño Eterno`
  3. `Parada Coliseo (detrás del Coliseo)`
  4. `La Tebaida`
  5. `UNL Argelia`
- **Discriminación Vial (ADR-005):**
  - **Troncal Sur:** `Loja ⇄ Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira`.
  - **Ramal Noroccidental:** `Loja ⇄ Malacatos ⇄ El Tambo` (directo sin pasar por Vilcabamba).

## 2. UI/UX Inclusiva, Accesibilidad y Brand Kit Vilcabambaturis
- **Accesibilidad Universal:**
  - Todos los botones, selectores de parada, tarjetas de frecuencia y asientos interactivos cuentan con un área táctil mínima de **`48px`** (`min-h-[48px]` a `min-h-[64px]`) para personas con baja visión o poca experiencia tecnológica.
  - Flujo ultrasimplificado de máximo **3 toques** (1. Ruta y Parada $\rightarrow$ 2. Asiento $\rightarrow$ 3. Confirmar Pago).
- **Brand Kit Oficial:**
  - **Color Primario:** Rojo Vinotinto (`#912D26`).
  - **Color Secundario / Superficies:** Blanco Puro (`#FFFFFF`) y Gris Claro de alto contraste.

## 3. Mapa de Asientos Hino AK (45 Pasajeros) y Bloque Web (1 al 10)
- **Carrocería Interactiva Hino AK (45 Pasajeros):** Representación visual con cabina frontal del conductor y puerta de abordaje.
- **Bloque Web Exclusivo (Asientos `1` al `10`):** El pasajero elige libremente su número exacto de asiento (individual o múltiple/familiar).
- **Bloque Taquilla (Asientos `11` al `45`):** Bloqueados visualmente y señalizados como *"Exclusivos de Taquilla Terminal"*.

## 4. Temporizadores y Regla de Congelamiento (T-20 Min)
- **Temporizador Estándar (`15:00` min):** Bloqueo temporal (*Seat Locking*) de 15 minutos contra colisiones.
- **Temporizador Dinámico Abreviado:** Si el usuario inicia la reserva faltando menos de 15 minutos para el corte T-20 min (ej. a T-25 min de la salida, restando 5 minutos antes del corte T-20), el reloj se ajusta dinámicamente al tiempo exacto restante (`05:00` min en alerta roja).
- **Cierre T-20 min (`ventaWebCongelada = true`):** Al faltar $\le 20\text{ minutos}$ para la salida, la venta web se congela automáticamente y deriva al pasajero a ventanilla física.

## 5. Lógica y Validación de Medios Pasajes (50% Tarifa ANT)
- **Múltiples Medios Pasajes = Múltiples Cédulas:** Si el comprador selecciona $N$ medios pasajes dentro de su compra, el formulario despliega dinámicamente $N$ campos obligatorios de Cédula de Identidad ecuatoriana única.
- **Validación Algorítmica Módulo 10:** Se valida matemáticamente cada cédula ecuatoriana de 10 dígitos en frontend y backend (código de provincia `01-24`, tercer dígito `< 6` y dígito verificador mediante coeficientes `[2, 1, 2, 1, 2, 1, 2, 1, 2]` en Módulo 10) para prevenir números falsos o inventados.
- **Validación de Elegibilidad por Edad:** Se valida que cada beneficiario corresponda a un **menor de edad (`< 18 años`)** o **adulto mayor (`>= 65 años`)** para autorizar la tarifa reducida del 50% regulada por la ANT.
- **Fee Tecnológico Fijo:** `$0.25 USD` fijo por cada boleto generado (sea tarifa completa 100% o medio pasaje 50% según el tramo ANT).

## 6. Operación en Papel sin Dependencia Tecnológica en Autobús
- **Desvinculación Obligatoria del Celular del Ayudante:** La operación a bordo no depende de smartphones ni de cobertura celular en carretera.
- **Cierre T-20 min y Exportación a Facturación:** A los T-20 minutos, la secretaria toma la lista congelada mediante `"Copiar para SRI (1-Clic)"` o descarga estructurada para ingresarla al sistema de facturación propio de la cooperativa.
- **Manifiesto Físico Impreso:** La secretaria imprime el **Manifiesto de Pasajeros en papel** desde su sistema y se lo entrega físicamente al ayudante antes de la salida.
- **Escáner QR Opcional:** El escaneo QR en la PWA del ayudante queda como una herramienta secundaria/opcional.

## 7. Arquitectura Relacional de Códigos QR (1 a N) y Reconciliación Inteligente
- **1 Transacción $\rightarrow$ N Boletos QR:** Cada pasaje reservado en una compra agrupada o familiar genera su propio registro `Boleto` independiente con su propio `numeroAsiento`, `codigoUnico` y `firmaDigitalHmac`. Cada boleto emitido lleva su propio código QR para identificación individual.
- **Casos de Borde:**
  1. *Pagos Tardíos antes de T-20 min (Asiento Libre):* Re-asigna automáticamente el asiento original elegido por el pasajero.
  2. *Pagos Tardíos antes de T-20 min (Asiento Ocupado):* Reubica automáticamente al siguiente asiento libre del bloque web (`1` al `10`) y notifica por WhatsApp.
  3. *Pagos Tardíos después de T-20 min:* Registra el monto como **Saldo a Favor** y envía alerta por WhatsApp para reubicar al siguiente turno o canjear en ventanilla.
  4. *Pagos Incompletos:* Congela la emisión y notifica por WhatsApp el saldo faltante exacto para completar antes de T-20 min.

## 8. Desglose Legal y Cumplimiento Regulatorio ANT
- **Desglose Transparente en Pantalla y Recibo:**
  - `Pasaje Oficial Regulado ANT: $X.XX`
  - `Servicio Digital y Emisión QR: $0.25` (por boleto)
  - `TOTAL A TRANSFERIR: $X.XX`
- **Protección Legal Tributaria:** El boleto contable/tributario emitido para la cooperativa refleja exclusivamente la tarifa oficial regulada por la ANT (100% o 50% en medios pasajes), evitando denuncias o sanciones por cobro adulterado.
