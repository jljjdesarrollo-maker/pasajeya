# ESPECIFICACIÓN TÉCNICA E INMUTABLE — MÓDULO 5: ARQUEO SEPARADO, PRODUCCIÓN POR DISCO, AUDITORÍA DE SALDOS Y LIQUIDACIÓN EL DÍA 1
**Proyecto:** PasajeYa (SaaS Multi-Tenant de Transporte Interparroquial e Intraprovincial)  
**Cliente Piloto (Tenant #1):** Cooperativa / Compañía Vilcabambaturis Cía. Ltda. (`RUC: 1191705482001` · Loja, Ecuador)  
**Estado:** 100% IMPLEMENTADO, VERIFICADO E INMUTABLE EN PRODUCCIÓN

---

## A. Arqueo Físico de Ventanilla (Efectivo Puro para la Secretaria — `/admin/taquilla`)
- **Cálculo Exclusivo de Efectivo:** El cierre diario de la secretaria calcula ÚNICAMENTE el dinero físico recaudado en ventanilla (`calcularArqueoFisicoVentanillaSeparado`):
  $$\$VentaFisicaEfectivo + \$EncomiendasEfectivo = \$TotalEfectivoCajon$$
- **Cero Mezcla con Dinero Web:** Las ventas web por transferencia no se arquean en la caja chica de la secretaria. Se presentan en un bloque informativo independiente titulado **"Ventas en Línea por Transferencia (Auditoría Contable)"** para descarga directa por parte de la contadora (`tsvDescargableContadora`), con **`$0.00` dólares de afectación o descuadre** (`afectacionEfectivoCajonPorWebUSD = 0`) en el efectivo físico de la taquilla.

---

## B. Mecanismo de Quema de "Saldo a Favor" en Taquilla (`/taquilla/saldos`)
- **Consulta por Cédula/RUC:** La secretaria busca por identificación del cliente (`buscarSaldosAFavorPorCedulaRuc`) los créditos en custodia registrados en la tabla `SaldoAFavor`.
- **Quema Atómica en 1-Clic:** El botón **`[Canjear Saldo en Ventanilla]`** (`quemarSaldoAFavorEnTaquillaAtomico`) cambia instantáneamente el estado del crédito a `CONSUMIDO_EN_TAQUILLA`, asigna el PIN de la secretaria (`1191`), registra fecha/hora (`consumidoAt`), genera un código de quema único (`SALDO-XXXXXX`) y dispara una notificación automática por WhatsApp de confirmación al pasajero.
- **Protección Absoluta de Caja Chica:** El canje registra la forma de pago como `Saldo a Favor` o `Transferencia`, exigiendo **`$0.00` de entrega o salida de efectivo físico** (`efectivoEntregadoUSD = 0`).
- **Botón de Auxilio:** La opción **`[Revertir Canje (3 min)]`** (`revertirCanjeSaldoDentroDe3Minutos`) permite regresar el saldo a estado `ACTIVO` dentro de los primeros 3 minutos si por algún imprevisto no se llegó a emitir el boleto físico en el sistema de la cooperativa.

---

## C. Reporte de Producción Web por Disco / Unidad (`/admin/reportes`)
- **Consolidado por Autobús:** Reporte mensual y anual por unidad (**Disco 01 al Disco 16**, `generarReporteProduccionPorDisco01a16`) detallando:
  - Número de boletos web vendidos por unidad (`boletosWebVendidosMes`, `boletosWebVendidosAnual`).
  - Recaudación bruta generada por disco (`recaudacionBrutaMesUSD`, `recaudacionBrutaAnualUSD`).
  - Porcentaje de ocupación del bloque web (asientos `1` al `10`, `porcentajeOcupacionBloqueWeb`).
- **Exportación:** Descarga en formato **PDF** y **Excel (TSV/CSV)** (`exportarProduccionPorDiscoTSV`) para informes de junta de socios y contabilidad.

---

## D. Auditoría de Fondos en Custodia y Saldos Pendientes
- **Panel de Conciliación Bancaria:** Desglose detallado de todas las transferencias recibidas en las cuentas de la cooperativa que no emitieron boleto.
- **Detalle de Registros:** Cédula/RUC, Nombre del depositante, Fecha/Hora, Banco, `# Referencia Bancaria`, Monto (`$`) y Estado (`ACTIVO`, `CONSUMIDO_EN_TAQUILLA`, `EXPIRADO`).
- **Cuadre Exacto:** Permite a la contadora cuadrar el extracto bancario al centavo (`calcularCuadreConciliacionBancariaFondos`):
  $$\text{Total Banco} = \text{Total Boletos Emitidos} + \text{Total Saldos Activos} + \text{Total Saldos Expirados}$$

---

## E. Liquidación Mensual del Fee Tecnológico (`$0.25`) el Día 1 del Mes
- **Cierre Automático el Día 1:** Proceso automatizado el día 1 del mes siguiente a las **00:05 AM** (`"5 0 1 * *"` en `vercel.json` hacia `/api/v1/cron/liquidacion-dia1`, `ejecutarCierreAutomaticoDia1Mes0005AM`).
- **Auditoría de Boletos Confirmados:** Genera un borrador de pre-factura calculando exclusivamente los boletos en estado `CONFIRMADO` ($N \text{ boletos} \times \$0.25$). No aplica sobre transferencias incompletas o sin boleto (`$0.00`).
- **Envío a Gerencia:** Notificación por correo electrónico a Gerencia con el informe consolidado y botón de aprobación en 1-clic (**`[Aprobar Liquidación]`**, `aprobarLiquidacionDia1EnUnClic`).
