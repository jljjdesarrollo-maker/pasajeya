# MEMORY.md — BITÁCORA DE ESTADO Y CONTINUIDAD (PASAJEYA)

## Estado General del Proyecto
- **Proyecto:** PasajeYa SaaS Multi-Tenant
- **Tenant Activo:** Vilcabambaturis Cía. Ltda. (RUC: `1191705482001` · Loja, Ecuador)
- **Brand Kit:** Rojo Vinotinto (`#912D26`) · Blanco Puro (`#FFFFFF`) · Accesibilidad Táctil $\ge 48\text{px}$
- **URL Producción:** https://pasajeya.vercel.app
- **Estado Global:** **PROYECTO 100% COMPLETO Y LISTO PARA PRODUCCIÓN (FASES 1 A 6 + MÓDULOS 1 AL 6 COMPLETOS)**

---

## Historial de Fases y Módulos Ejecutados

### ✅ Fase 1: Gobernanza, Esquema Prisma ORM y Despliegue Base (COMPLETADA)
- Arquitectura multi-tenant en PostgreSQL (Neon) y Prisma ORM.
- Topología vial discriminada (ADR-005):
  - **Troncal Sur:** Loja ⇄ Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira.
  - **Ramal Noroccidental:** Loja ⇄ Malacatos ⇄ El Tambo directo (sin pasar por Vilcabamba).

### ✅ Fase 2 / Módulo 2: Motor de Conciliación Bancaria, Pagos Multi-Banco y Política de Saldos con Caducidad a 30 Días (COMPLETADA Y REFACTORIZADA)
- **Canales Bancarios e Interfaz Doble de Pago:** Banco de Loja y Banco Pichincha / Deuna! (100% transferencias y QR sin comisiones de tarjeta), botones de copiado en 1-clic para Cuenta y RUC, visualización de códigos QR en pantalla y casilla obligatoria de Términos y Condiciones.
- **Conciliación Automática en Tiempo Real (`< 1.2s`):** Escucha directa vía Gmail API (OAuth2) + Google Cloud Pub/Sub Webhooks, extracción por Regex con fallback a Gemini NLP y control antiduplicados mediante clave única compuesta `[tenantId, referenciaBanco]`.
- **Política de No Cambios y Manifiesto 100% Limpio:** Boletos confirmados no admiten cambios ni devoluciones; Cero Cobro a Bordo y retención automática ante pagos incompletos antes de T-20 min.
- **Saldos a Favor y Notas de Crédito Digitales (`NotaCreditoSaldo` — Caducidad 30 Días):** Vigencia de 30 días calendario (`EXPIRED` tras 30 días), 0 reembolso en efectivo en ventanilla (`SALDO_A_FAVOR`) y `$0.00` de fee sobre transferencias que no emitieron boleto.
- **Especificación y Pruebas:** Documentado en `specs/module2-payments.md` y validado al 100% con `scripts/test-phase2-conciliacion.ts`.

### ✅ Fase 3 / Módulo 1: Interfaz Pública de Compra (Mobile-First), Medios Pasajes (Módulo 10), Manifiesto en Papel y Estructura QR 1-a-N (COMPLETADA Y ACTUALIZADA)
- **Paradas Urbanas Autorizadas en Loja (5 paradas):** Terminal Reina del Cisne (Andén Principal), Sueño Eterno, Parada Coliseo (detrás del Coliseo), La Tebaida y UNL Argelia. Prohibición absoluta de *"La Bomba Quemada"*.
- **Croquis Interactivo Hino AK (45 Pasajeros):** Bloque Web seleccionable (`1` al `10`) y Bloque Taquilla bloqueado visualmente (`11` al `45`).
- **Lógica y Validación de Medios Pasajes (50% Tarifa ANT):** $N$ Medios Pasajes = $N$ Cédulas validadas con Algoritmo Módulo 10 + elegibilidad por edad (`< 18` o `>= 65 años`) + fee fijo de `$0.25` por boleto emitido.
- **Arquitectura Relacional 1 Transacción $\rightarrow$ N Boletos QR:** Cada boleto posee `numeroAsiento`, `codigoUnico` y `firmaDigitalHmac` propios.
- **Especificación y Pruebas:** Documentado en `specs/module1-public.md` y validado al 100% con `scripts/test-phase3-checkout.ts`.

### ✅ Fase 4 / Módulo 3: Consola de Taquilla, Pizarra Tricolor, Botones de Copiado SRI/Vilcabambaturis y Control Estricto de Flota (COMPLETADA Y REFACTORIZADA)
- **Pizarra de Turnos en Tiempo Real:** Tarjeta en **Rojo Vinotinto (`#912D26`)** para turnos con ventas web o reservas activas (mostrando conteo exacto) y Tarjeta en **Gris Neutral (`#64748B`)** para turnos sin ventas en línea (`0 ventas`), con reloj de cuenta regresiva T-20 min.
- **Gestión Tricolor del Mapa de Asientos (45 Asientos Hino AK):**
  - 🔴 **Rojo Vinotinto (`#912D26`):** Asiento Confirmado y Vendido (Web o Taquilla).
  - 🟢 **Verde Menta (`#2E7D32`):** Asiento Disponible (Nativos de ventanilla `11–45` y Sobrantes del bloque web `1–10` liberados a T-20m).
  - 🟡 **Naranja / Ocre (`#F57C00`):** Asiento en **Reserva Pendiente / Confirmación de Pago** (temporizador de 15m activo), bloqueado para venta presencial en taquilla hasta que se confirme o expire.
- **Exportación y 3 Botones Independientes de Copiado al Sistema de Vilcabambaturis:** Captura automática del `# Documento / Referencia` vía Gmail API y 3 botones en 1-clic (`[Copiar Cédula / RUC]`, `[Copiar # Comprobante / Referencia]`, `[Copiar para Ventana Emergente de Depósito]`), más impresión física del manifiesto mostrando claramente los asientos liberados de web.
- **Asignación y Control Estricto de Flota:** Bloqueo estricto de vehículos en estado `EN_RUTA` o `DESPACHADO`, protocolo de 0 ventas web (`DESPACHADO_SIN_VENTAS_WEB`) y notificación masiva por WhatsApp al reasignar `busDiscoReal`.
- **RBAC por PIN `1191`:** Rol `SECRETARIA` (`LECTURA_ESCRITURA`) con control total y Rol `AYUDANTE` / Tripulación (`SOLO_LECTURA`) para consulta móvil de lista de pasajeros y croquis tricolor.
- **Especificación y Pruebas:** Documentado en `specs/module3-taquilla.md` y validado al 100% con `scripts/test-phase4-taquilla.ts`.

### ✅ Fase 5 / Módulo 4: PWA Offline-First para Tripulación, Visor de Solo Consulta y Gestión de Flota (COMPLETADA Y REFACTORIZADA)
- **CRUD de Unidades y Gestión de Credenciales (`/admin/flota`):** Creación y edición de Discos/Placas/Chofer/PIN exclusiva de `GERENCIA`, con botón de auxilio rápido en 1-clic para restablecer el PIN de cualquier unidad habilitado para `GERENCIA` y `SECRETARIA`.
- **PWA Offline-First con Carga Previa en Terminal (`IndexedDB`):** Instalable en 1-clic sin App Store, sincronización automática en `< 1 segundo` al ingresar con `Disco + PIN` 5 minutos antes en la oficina terminal, botón prominente Verde (`[✓ MANIFIESTO ACTUALIZADO — Disco XX]`) / Rojo (`[⚠️ TOCAR AQUÍ PARA SINCRONIZAR MANIFIESTO]`) y validación criptográfica offline de pases QR (`HMAC-SHA256`) en `< 100ms`.
- **Visor de Solo Consulta y Distinción de Boletos Web:** Perfil de solo lectura sin obligación de check-in o clics por pasajero a bordo (`obligacionCheckInClicsABordo = false`), tarjetas de turno en **Rojo Vinotinto (`#912D26`)** con conteo exacto (`N BOLETOS WEB`) vs **Gris Neutral (`#64748B`)** (`0 Boletos Web`), y listado/croquis ordenado secuencialmente por asiento del `1` al `45`.
- **Protocolo de No-Show y Fajas Físicas `"RESERVADO WEB"`:** Entrega de fajas físicas `"RESERVADO WEB"` junto al manifiesto impreso para los asientos `1–10` vendidos online, protegidos hasta superar la parada límite **UNL Argelia** (20 min de recorrido urbano); tras superar **UNL Argelia**, si hay *No-Show*, el ayudante retira la faja física y libera el asiento en ruta.
- **Especificación y Pruebas:** Documentado en `specs/module4-pwa-ayudante.md` y validado al 100% con `scripts/test-phase5-pwa.ts` y `scripts/test-phase5-ayudante.ts`.

### ✅ Fase 6 / Módulos 5 y 6: Arqueo Separado, Quema de Saldos a Favor, Producción por Disco (01–16), Liquidación Día 1 y Configuración Global (COMPLETADA Y REFACTORIZADA)
- **Arqueo Físico de Ventanilla (`/admin/taquilla`):** Cálculo exclusivo del efectivo físico `($VentaFisicaEfectivo + $EncomiendasEfectivo = $TotalEfectivoCajon)` con `$0.00` de afectación o descuadre por ventas web, y bloque informativo separado `"Ventas en Línea por Transferencia (Auditoría Contable)"` descargable por la contadora.
- **Quema Atómica de "Saldo a Favor" en Taquilla (`/taquilla/saldos`):** Consulta por Cédula/RUC en `SaldoAFavor`, botón `[Canjear Saldo en Ventanilla]` que cambia el estado a `CONSUMIDO_EN_TAQUILLA`, genera código único `SALDO-XXXXXX`, exige `$0.00` de salida de efectivo físico, envía confirmación por WhatsApp y ofrece botón de auxilio `[Revertir Canje (3 min)]`.
- **Reporte de Producción Web por Disco (`/admin/reportes`):** Consolidado mensual y anual del **Disco 01 al Disco 16** (boletos web vendidos, recaudación bruta y % de ocupación del bloque web `1–10`) con descarga en PDF y Excel (TSV/CSV).
- **Auditoría de Fondos en Custodia y Liquidación Día 1 (00:05 AM):** Cuadre bancario al centavo (`Total Banco = Total Boletos Emitidos + Total Saldos Activos + Total Saldos Expirados`) y cierre automático el día 1 de cada mes a las 00:05 AM (`5 0 1 * *`) calculando exclusivamente boletos `CONFIRMADO` ($N \times \$0.25$) con botón `[Aprobar Liquidación]`.
- **Consola de Configuración Global (`/admin/configuracion`):** Toggles `[ON / OFF]` en tiempo real para Banco de Loja y Banco Pichincha / Deuna!, gestor CRUD de cuentas bancarias + cargador de imágenes QR, configuración de WhatsApp/Gateway VPS y respaldo SQL nocturno a las 23:50 PM (`50 23 * * *` hacia `/api/v1/cron/backup-db`) protegido con `CRON_SECRET`.
- **Especificación y Pruebas:** Documentado en `specs/module5-reports.md` y `specs/module6-settings.md`, y validado al 100% con `scripts/test-phase6-reportes-configuracion.ts` y `scripts/test-phase6-e2e-production.ts`.
