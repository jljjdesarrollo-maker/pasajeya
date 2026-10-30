# ESPECIFICACIÓN TÉCNICA — MÓDULO 3: CONSOLA DE TAQUILLA, SINCRONIZACIÓN SRI Y CONTROL DE FLOTA

**Proyecto:** PasajeYa (https://pasajeya.vercel.app)  
**Cliente Piloto:** Cooperativa / Compañía Vilcabambaturis Cía. Ltda. (RUC: `1191705482001` · Loja, Ecuador)  
**Estado:** Implementado, Verificado y en Producción (100%)

---

## 1. Pizarra de Turnos en Tiempo Real y Distinción Visual (`evaluarTarjetaPizarraTurno`)
- **Resaltado Dinámico de Turnos:**
  - **Tarjeta en Rojo Vinotinto (`#912D26`):** Turnos con ventas web confirmadas o reservas temporales activas, mostrando el conteo exacto de pasajes vendidos y reservas en curso.
  - **Tarjeta en Gris Neutral (`#64748B`):** Turnos sin ventas en línea (`0 ventas`), permitiendo cierre limpio al momento de salida.
- **Reloj de Cuenta Regresiva T-20 min:** Cierre automático de ventas web (`ventaWebCongelada = true`) al llegar a los 20 minutos previos a la hora de salida programada.

---

## 2. Gestión Tricolor del Mapa de Asientos — 45 Asientos Hino AK (`construirMapaTricolor45Asientos`)
- 🔴 **Rojo Vinotinto (`#912D26` — `VENDIDO_CONFIRMADO`):** Asiento confirmado y vendido (ya sea en Web `1–10` o en Taquilla `1–45`).
- 🟢 **Verde Menta (`#2E7D32` — `DISPONIBLE_TAQUILLA`):** Asiento disponible para venta en ventanilla (asientos nativos de ventanilla `11–45` y asientos sobrantes del bloque web `1–10` liberados a T-20m).
- 🟡 **Naranja / Ocre (`#F57C00` — `RESERVA_PENDIENTE_15M`):** Asiento en **Reserva Pendiente / Confirmación de Pago** (temporizador de 15 minutos activo). Permanece **estrictamente bloqueado para venta presencial en taquilla** hasta que se confirme la transferencia o expire su reloj.

---

## 3. Exportación y Botones de Copiado al Sistema de Vilcabambaturis (`generarPayloadsCopiadoSistemaVilcabambaturis`)
- **Captura Automática de Referencia Bancaria:** Extracción automática del `# Documento / Referencia` del comprobante vía Gmail API (`BL-XXXXXX`, `BP-XXXXXX`, `DEUNA-XXXXXX`).
- **3 Botones Independientes de Copiado en 1-Clic por Comprador:**
  1. `[Copiar Cédula / RUC]`: Copia exclusivamente la identificación fiscal (`10` o `13` dígitos).
  2. `[Copiar # Comprobante / Referencia]`: Copia exclusivamente la referencia bancaria capturada vía Gmail API.
  3. `[Copiar para Ventana Emergente de Depósito]`: Copia la cadena estructurada mapeada al sistema contable de Vilcabambaturis (`BANCO | REF | MONTO | CEDULA_RUC | PASAJERO | ASIENTO`).
- **Manifiesto Físico Impreso (`generarManifiestoImpresoConAsientosLiberados`):** Impresión en papel con visualización explícita de los asientos del bloque web (`1–10`) liberados para taquilla vs vendidos en web, lista para entrega física al ayudante.

---

## 4. Asignación y Control Estricto de Flota (`obtenerUnidadesFlotaConBloqueoEnRuta` y `ejecutarProtocoloCeroVentasWeb`)
- **Bloqueo Estricto de Vehículos en Ruta:** Imposibilidad técnica y operativa de seleccionar como `busDiscoReal` un autobús cuyo estado sea `EN_RUTA` o `DESPACHADO` (ej. `Disco #22` y `Disco #25`).
- **Protocolo de 0 Ventas Web (`DESPACHADO_SIN_VENTAS_WEB`):** Cierre automático o en 1-clic cuando el autobús sale de la terminal sin haber registrado ventas en línea (`0 ventas`).
- **Notificación Masiva por WhatsApp:** Alerta automatizada vía Gateway VPS a todos los compradores confirmados informando el nuevo número de unidad (`busDiscoReal`) y placa sin alterar su número de asiento.

---

## 5. Acceso y Roles de Seguridad — RBAC (`obtenerPermisosRBACTaquilla`)
- **Autenticación por PIN de 4 Dígitos (`1191`):**
  - **Rol Secretaria (`SECRETARIA` — `LECTURA_ESCRITURA`):** Control total sobre ventas en ventanilla (`1–45`), reasignaciones de flota, canje de notas de crédito (`SALDO_A_FAVOR` con `$0.00` efectivo entregado) y cierres T-20m / `DESPACHADO_SIN_VENTAS_WEB`.
  - **Rol Tripulación / Ayudante (`AYUDANTE` — `SOLO_LECTURA`):** Acceso exclusivo de solo lectura para consultar desde su teléfono móvil la lista de pasajeros y el croquis tricolor de 45 asientos de su unidad asignada, con controles de escritura bloqueados.
