# AGENTS.md — GUARDARRAÍLES E INVARIANTES DEL SISTEMA "PASAJEYA"
# ESTADO GLOBAL: PROYECTO 100% COMPLETO Y LISTO PARA PRODUCCIÓN (FASES 1 A 6 + MÓDULOS 1 AL 6 DEFINITIVOS)

## 1. Misión del Sistema
**PasajeYa** es un SaaS multi-tenant de venta de boletos de transporte interparroquial e intraprovincial en Ecuador.
- **Cliente Piloto (Tenant #1):** Cooperativa / Compañía **Vilcabambaturis Cía. Ltda.** (RUC `1191705482001` · Loja, Ecuador).
- **Brand Kit Oficial:** Rojo Vinotinto (`#912D26`), Blanco Puro (`#FFFFFF`) y controles accesibles $\ge 48\text{px}$.
- **Estado Operativo:** **PROYECTO 100% COMPLETO Y LISTO PARA PRODUCCIÓN**.

## 2. Reglas Inmutables de Negocio (Invariantes Globales)
1. **Paradas Urbanas Autorizadas en Loja y Prohibición ANT (Módulo 1):**
   - **PROHIBICIÓN ABSOLUTA:** Queda estrictamente prohibida la parada **"La Bomba Quemada"** (abordaje y desembarque) para evitar sanciones de la Agencia Nacional de Tránsito (ANT).
   - **Catálogo Oficial de 5 Paradas en Loja:** (1) Terminal Reina del Cisne (Andén Principal), (2) Sueño Eterno, (3) Parada Coliseo (detrás del Coliseo), (4) La Tebaida, (5) UNL Argelia.
   - **Discriminación Vial (ADR-005):** Troncal Sur (`Loja ⇄ Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira`) separada del Ramal Noroccidental (`Loja ⇄ Malacatos ⇄ El Tambo` directo sin pasar por Vilcabamba).
2. **Mapa de Asientos Hino AK (45 Pasajeros) y Bloque Web (1 al 10):**
   - Croquis interactivo mobile-first de autobús Hino AK de 45 pasajeros con cabina frontal.
   - La venta en línea asigna exclusivamente los asientos numerados del `1` al `10`.
   - Los asientos del `11` al `45` están bloqueados visualmente en la web como *"Exclusivos de Taquilla Terminal"*.
3. **Temporizador Estándar (15:00), Temporizador Dinámico Abreviado y Congelamiento T-20 Minutos:**
   - Reserva temporal estándar (*Seat Locking*) de `15:00 minutos`.
   - Si el pasajero inicia reserva faltando menos de 15 minutos para el corte T-20 min (ej. a T-25 min de la salida), el reloj se ajusta dinámicamente al tiempo restante exacto (`05:00` min en alerta roja).
   - Al faltar **20 minutos o menos** (`<= 20 min`) para la salida, la venta web se congela automáticamente (`ventaWebCongelada = true`) y los asientos sobrantes del bloque `1` al `10` pasan a `DISPONIBLE_VENTANILLA` en `/taquilla`.
4. **Lógica y Validación de Medios Pasajes (50% Tarifa ANT) y Estructura QR 1-a-N:**
   - **Múltiples Medios Pasajes = Múltiples Cédulas:** Si el comprador selecciona $N$ medios pasajes, el formulario despliega $N$ campos obligatorios de Cédula de Identidad ecuatoriana única.
   - **Validación Algorítmica Módulo 10 y Elegibilidad por Edad:** Validación matemática Módulo 10 (provincia `01-24`, tercer dígito `< 6`, dígito verificador) y verificación de menor de edad (`< 18 años`) o adulto mayor (`>= 65 años`).
   - **1 Transacción $\rightarrow$ N Boletos QR:** Cada pasaje reservado genera su propio registro `Boleto` independiente con `numeroAsiento`, `codigoUnico` y `firmaDigitalHmac`.
5. **Canales Bancarios Multi-Banco, Conciliación `< 1.2s` y Política de Saldos con Caducidad (30 Días — Módulo 2):**
   - **Bancos Habilitados e Interfaz Doble:** Banco de Loja y Banco Pichincha / Deuna! (100% transferencias y QR, 0% comisión de tarjeta), con copiado 1-clic de Cuenta y RUC, visualización de QR en pantalla y casilla obligatoria de Términos y Condiciones.
   - **Conciliación `< 1.2s` e Idempotencia Compuesta:** Escucha vía Gmail API (OAuth2) + Google Cloud Pub/Sub Webhooks, extracción por Regex con fallback a Gemini NLP y clave única compuesta **`[tenantId, referenciaBanco]`**.
   - **No Cambios / No Devoluciones y Cero Cobro a Bordo:** Boletos confirmados no admiten cambios ni devoluciones. El ayudante solo recibe pasajeros con boleto 100% pagado e impreso en el manifiesto físico.
   - **Notas de Crédito Digitales (`NotaCreditoSaldo` / `SaldoAFavor` — Caducidad 30 Días):** Pagos post T-20 min o incompletos no liquidados a T-20 min crean crédito en custodia con `fechaExpiracion` a **30 días calendario** (pasa a `EXPIRED` / `EXPIRADO` tras 30 días). El fee de `$0.25` **NO se cobra** sobre transferencias que no emitieron boleto.
6. **Consola de Taquilla Tricolor, 3 Botones de Copiado SRI/Vilcabambaturis, Flota y RBAC (Módulo 3):**
   - **Pizarra de Turnos:** Tarjeta en **Rojo Vinotinto (`#912D26`)** con conteo exacto para turnos con ventas/reservas activas y Tarjeta en **Gris Neutral (`#64748B`)** para turnos con `0 ventas`.
   - **Mapa Tricolor de 45 Asientos en Taquilla:** 🔴 `#912D26` Vendido Confirmado (Web o Taquilla), 🟢 `#2E7D32` Disponible (`11–45` nativos y `1–10` liberados a T-20m) y 🟡 `#F57C00` Reserva Pendiente 15m (bloqueado para venta presencial hasta confirmarse o expirar).
   - **3 Botones Independientes de Copiado en 1-Clic y Manifiesto Impreso:** `[Copiar Cédula / RUC]`, `[Copiar # Comprobante / Referencia]` (capturado vía Gmail API) y `[Copiar para Ventana Emergente de Depósito]`, más impresión física del manifiesto destacando los asientos liberados de web.
   - **Control Estricto de Flota y RBAC (PIN `1191`):** Prohibición de asignar como `busDiscoReal` vehículos en `EN_RUTA` o `DESPACHADO`, cierre `DESPACHADO_SIN_VENTAS_WEB`, alertas masivas por WhatsApp, Rol `SECRETARIA` (Lectura/Escritura) y Rol `AYUDANTE` / Tripulación (Solo Lectura).
7. **PWA Offline-First para Tripulación, Visor de Solo Consulta y Fajas Físicas `"RESERVADO WEB"` (Módulo 4):**
   - **CRUD de Flota (`/admin/flota`):** Creación y edición de unidades (Discos/Placas/Chofer/PIN) exclusiva de `GERENCIA`, y botón de auxilio rápido en 1-clic para restablecer PIN habilitado para `GERENCIA` y `SECRETARIA`.
   - **PWA Offline-First (`IndexedDB`):** Instalable en 1-clic sin App Store, carga en `< 1s` al ingresar con `Disco + PIN` 5 min antes en oficina, botón prominente Verde (`[✓ MANIFIESTO ACTUALIZADO — Disco XX]`) / Rojo (`[⚠️ TOCAR AQUÍ PARA SINCRONIZAR MANIFIESTO]`), y validación QR offline en `< 100ms`.
   - **Visor de Solo Consulta (Orden Secuencial `1` al `45`) y Protocolo No-Show (`UNL Argelia`):** Cero obligación de check-in o clics por pasajero a bordo, distinción visual `#912D26` (`N BOLETOS WEB`) vs Gris Neutral (`0 Boletos Web`), listado ordenado del `1` al `45` y fajas físicas `"RESERVADO WEB"` protegidas hasta la parada límite **UNL Argelia** (20 min).
8. **Arqueo Separado, Quema Atómica de Saldos, Producción por Disco (01–16) y Liquidación Día 1 (Módulo 5):**
   - **Arqueo Físico de Ventanilla (`/admin/taquilla`):** Calcula únicamente efectivo físico `($VentaFisicaEfectivo + $EncomiendasEfectivo = $TotalEfectivoCajon)` con **$0.00 de afectación o descuadre** por ventas web, y bloque informativo separado `"Ventas en Línea por Transferencia (Auditoría Contable)"` descargable por la contadora.
   - **Quema Atómica de Saldo a Favor (`/taquilla/saldos`):** Consulta por Cédula/RUC en `SaldoAFavor`, botón `[Canjear Saldo en Ventanilla]` que pasa a `CONSUMIDO_EN_TAQUILLA` con código único `SALDO-XXXXXX`, PIN de secretaria, notificación WhatsApp, **$0.00 de salida de efectivo** y botón de auxilio `[Revertir Canje (3 min)]`.
   - **Producción Web por Disco (`/admin/reportes`):** Consolidado mensual y anual del **Disco 01 al Disco 16** (boletos web, recaudación bruta y % ocupación bloque web `1–10`) con exportación PDF y Excel (TSV/CSV).
   - **Cuadre Bancario al Centavo y Liquidación Día 1 (00:05 AM):** `Total Banco = Total Boletos Emitidos + Total Saldos Activos + Total Saldos Expirados`, y cierre automático el día 1 de cada mes a las 00:05 AM (`5 0 1 * *`) calculando exclusivamente boletos `CONFIRMADO` ($N \times \$0.25$) con aprobación en 1-clic (`[Aprobar Liquidación]`).
9. **Consola de Configuración Global y Respaldo Nocturno SQL 23:50 PM (Módulo 6):**
   - **Toggles de Canales de Cobro en 1-Clic (`/admin/configuracion`):** Interruptores `[ON / OFF]` en tiempo real para Banco de Loja y Banco Pichincha / Deuna! en el checkout público, gestor CRUD de cuentas bancarias + cargador de imágenes QR, configuración de WhatsApp/Gateway VPS y respaldo SQL nocturno a las 23:50 PM (`50 23 * * *` hacia `/api/v1/cron/backup-db`) protegido por `CRON_SECRET`.
