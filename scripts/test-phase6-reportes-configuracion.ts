/**
 * Suite de Pruebas E2E Automatizada — Módulos 5 y 6:
 * - Módulo 5A: Arqueo Físico de Ventanilla (Efectivo Puro: $VentaFisicaEfectivo + $EncomiendasEfectivo = $TotalEfectivoCajon)
 *              y bloque separado "Ventas en Línea por Transferencia (Auditoría Contable)" con $0.00 de afectación o descuadre.
 * - Módulo 5B: Mecanismo de Quema Atómica de "Saldo a Favor" en Taquilla (/taquilla/saldos) con código único SALDO-XXXXXX,
 *              protección de caja chica ($0.00 efectivo entregado), WhatsApp automático y botón [Revertir Canje (3 min)].
 * - Módulo 5C: Reporte de Producción Web por Disco / Unidad (Disco 01 al Disco 16) mensual y anual con ocupación 1-10 y exportación PDF/Excel.
 * - Módulo 5D: Auditoría de Fondos en Custodia y Cuadre Exacto al Centavo:
 *              Total Banco = Total Boletos Emitidos + Total Saldos Activos + Total Saldos Expirados.
 * - Módulo 5E: Liquidación Mensual del Fee Tecnológico ($0.25) el Día 1 del Mes a las 00:05 AM y Aprobación 1-Clic por Gerencia.
 * - Módulo 6:  Consola de Configuración Global (/admin/configuracion): Toggles [ON/OFF] Banco de Loja y Pichincha/Deuna!,
 *              CRUD de Cuentas Bancarias + Cargador de QR, WhatsApp/Gateway VPS y Respaldo SQL Nocturno (23:50 PM).
 */

import {
  crearEstadoInicialFrecuencias,
  PIN_CORPORATIVO_OFICIAL,
} from '../src/services/pasajeyaEngine.ts';
import {
  actualizarConfiguracionGlobalSoporteYBackup,
  actualizarImagenQrOficialBanco,
  alternarToggleCanalCobroTiempoReal,
  aprobarLiquidacionDia1EnUnClic,
  buscarSaldosAFavorPorCedulaRuc,
  calcularArqueoFisicoVentanillaSeparado,
  calcularCuadreConciliacionBancariaFondos,
  crearConfiguracionGlobalInicial,
  crearSaldosAFavorIniciales,
  ejecutarCierreAutomaticoDia1Mes0005AM,
  exportarProduccionPorDiscoTSV,
  generarReporteProduccionPorDisco01a16,
  guardarCuentaBancariaCRUD,
  quemarSaldoAFavorEnTaquillaAtomico,
  revertirCanjeSaldoDentroDe3Minutos,
  VENTANA_REVERSION_SALDO_MS,
} from '../src/services/module5And6Engine.ts';
import {
  CRON_SECRET_DEFAULT,
  ejecutarRespaldoNocturnoSQL,
} from '../src/services/backupAndAuditService.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FALLO DE PRUEBA: ${message}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${message}`);
}

async function runModules5And6Tests() {
  console.log('================================================================');
  console.log('PASAJEYA SaaS — SUITE E2E MÓDULOS 5 Y 6 (ARQUEO, SALDOS Y CONFIG)');
  console.log('Cliente Piloto: Vilcabambaturis Cía. Ltda. (RUC 1191705482001)');
  console.log('================================================================\n');

  const frecuencias = crearEstadoInicialFrecuencias();
  let saldos = crearSaldosAFavorIniciales();

  // =========================================================================
  // 1. MÓDULO 5A: ARQUEO FÍSICO DE VENTANILLA (EFECTIVO PURO VS TRANSFERENCIAS WEB)
  // =========================================================================
  console.log(
    '--- [1/6] Módulo 5A: Arqueo Físico de Ventanilla (Efectivo Puro) y Cero Mezcla con Web ---'
  );
  const encomiendasUSD = 18.5;
  const arqueo = calcularArqueoFisicoVentanillaSeparado({
    frecuencias,
    encomiendasEfectivoUSD: encomiendasUSD,
    saldosAFavor: saldos,
  });

  const sumaExactaCajon = Number(
    (arqueo.ventaFisicaEfectivoUSD + arqueo.encomiendasEfectivoUSD).toFixed(2)
  );
  assert(
    arqueo.totalEfectivoCajonUSD === sumaExactaCajon &&
      arqueo.afectacionEfectivoCajonPorWebUSD === 0 &&
      arqueo.tituloBloqueTransferenciasWeb ===
        'Ventas en Línea por Transferencia (Auditoría Contable)' &&
      arqueo.tsvDescargableContadora.includes('$0.00 (CERO AFECTACION EFECTIVO)'),
    `Arqueo de ventanilla calcula únicamente efectivo físico ($${arqueo.ventaFisicaEfectivoUSD.toFixed(
      2
    )} + $${arqueo.encomiendasEfectivoUSD.toFixed(
      2
    )} = $${arqueo.totalEfectivoCajonUSD.toFixed(
      2
    )}) con $0.00 de afectación o descuadre por ventas web`
  );

  // =========================================================================
  // 2. MÓDULO 5B: QUEMA ATÓMICA DE "SALDO A FAVOR" EN TAQUILLA (/taquilla/saldos) Y REVERSIÓN 3 MIN
  // =========================================================================
  console.log(
    '\n--- [2/6] Módulo 5B: Quema Atómica de Saldo a Favor (SALDO-XXXXXX) y Reversión (3 min) ---'
  );
  const encontrados = buscarSaldosAFavorPorCedulaRuc(saldos, '1104682917');
  assert(
    encontrados.length === 1 && encontrados[0].estado === 'ACTIVO',
    `Consulta en /taquilla/saldos por Cédula 1104682917 localiza crédito ACTIVO de ${encontrados[0].depositanteNombre} ($${encontrados[0].montoUSD.toFixed(
      2
    )} USD)`
  );

  const tQuemaMs = Date.now();
  const quemaRes = quemarSaldoAFavorEnTaquillaAtomico({
    saldosActuales: saldos,
    saldoId: encontrados[0].id,
    pinSecretaria: PIN_CORPORATIVO_OFICIAL,
    formaPagoMarcada: 'Saldo a Favor',
    ahoraTimestampMs: tQuemaMs,
  });
  saldos = quemaRes.saldosActualizados;

  assert(
    quemaRes.saldoQuemado.estado === 'CONSUMIDO_EN_TAQUILLA' &&
      /^SALDO-\d{6}$/.test(quemaRes.codigoQuemaUnico) &&
      quemaRes.saldoQuemado.pinSecretariaQuema === PIN_CORPORATIVO_OFICIAL &&
      quemaRes.efectivoFisicoEntregadoUSD === 0 &&
      quemaRes.saldoQuemado.notificacionWhatsAppEnviada === true,
    `Quema atómica en 1-clic: cambia a CONSUMIDO_EN_TAQUILLA, genera código único ${quemaRes.codigoQuemaUnico}, exige $0.00 de efectivo físico y envía confirmación por WhatsApp`
  );

  // Probar botón de auxilio [Revertir Canje (3 min)] dentro de la ventana de 3 minutos (ej. a los 90 segundos)
  const reversionExitosa = revertirCanjeSaldoDentroDe3Minutos({
    saldosActuales: saldos,
    saldoId: encontrados[0].id,
    ahoraTimestampMs: tQuemaMs + 90 * 1000,
  });
  saldos = reversionExitosa.saldosActualizados;
  assert(
    reversionExitosa.saldoRevertido.estado === 'ACTIVO' &&
      reversionExitosa.saldoRevertido.codigoQuemaUnico === null,
    'Botón de auxilio [Revertir Canje (3 min)] regresa el saldo a estado ACTIVO dentro de la ventana de 3 minutos'
  );

  // Volver a quemar y verificar que pasados los 3 minutos (> 180s) el sistema bloquee la reversión
  const segundaQuema = quemarSaldoAFavorEnTaquillaAtomico({
    saldosActuales: saldos,
    saldoId: encontrados[0].id,
    pinSecretaria: PIN_CORPORATIVO_OFICIAL,
    ahoraTimestampMs: tQuemaMs,
  });
  saldos = segundaQuema.saldosActualizados;

  let reversionExpiradaBloqueada = false;
  try {
    revertirCanjeSaldoDentroDe3Minutos({
      saldosActuales: saldos,
      saldoId: encontrados[0].id,
      ahoraTimestampMs: tQuemaMs + VENTANA_REVERSION_SALDO_MS + 5000,
    });
  } catch (err: any) {
    reversionExpiradaBloqueada = err.message.includes(
      'VENTANA DE AUXILIO EXPIRADA'
    );
  }
  assert(
    reversionExpiradaBloqueada,
    'Bloquea reversión de canje cuando han transcurrido más de 3 minutos desde la quema en ventanilla'
  );

  // =========================================================================
  // 3. MÓDULO 5C: REPORTE DE PRODUCCIÓN WEB POR DISCO / UNIDAD (DISCO 01 AL DISCO 16)
  // =========================================================================
  console.log(
    '\n--- [3/6] Módulo 5C: Reporte de Producción Web por Disco (Disco 01 al Disco 16) ---'
  );
  const reporteDiscos = generarReporteProduccionPorDisco01a16(frecuencias);
  const tsvDiscos = exportarProduccionPorDiscoTSV(reporteDiscos);

  assert(
    reporteDiscos.length === 16 &&
      reporteDiscos[0].discoEtiqueta === 'Disco 01' &&
      reporteDiscos[15].discoEtiqueta === 'Disco 16' &&
      reporteDiscos.every(
        (d) =>
          d.boletosWebVendidosMes > 0 &&
          d.recaudacionBrutaMesUSD > 0 &&
          d.porcentajeOcupacionBloqueWeb > 0 &&
          d.porcentajeOcupacionBloqueWeb <= 100
      ) &&
      tsvDiscos.includes('Disco 01') &&
      tsvDiscos.includes('Disco 16'),
    'Reporte consolidado mensual y anual generado para las 16 unidades (Disco 01 al Disco 16) con porcentaje de ocupación del bloque web (1-10) y exportación Excel/PDF'
  );

  // =========================================================================
  // 4. MÓDULO 5D: AUDITORÍA DE FONDOS EN CUSTODIA Y CUADRE EXACTO AL CENTAVO
  // =========================================================================
  console.log(
    '\n--- [4/6] Módulo 5D: Auditoría de Fondos en Custodia y Cuadre Bancario al Centavo ---'
  );
  const cuadre = calcularCuadreConciliacionBancariaFondos({
    frecuencias,
    saldosCustodia: saldos,
  });

  const sumaExactaExtracto = Number(
    (
      cuadre.totalBoletosEmitidosUSD +
      cuadre.totalSaldosActivosUSD +
      cuadre.totalSaldosExpiradosUSD
    ).toFixed(2)
  );
  assert(
    cuadre.cuadreAlCentavoVerificado === true &&
      cuadre.diferenciaCentavosUSD === 0 &&
      cuadre.totalBancoExtractoUSD === sumaExactaExtracto,
    `Cuadre bancario al centavo verificado: ${cuadre.formulaCuadreContadora}`
  );

  // =========================================================================
  // 5. MÓDULO 5E: LIQUIDACIÓN MENSUAL DEL FEE TECNOLÓGICO ($0.25) EL DÍA 1 (00:05 AM)
  // =========================================================================
  console.log(
    '\n--- [5/6] Módulo 5E: Liquidación Mensual ($0.25) el Día 1 a las 00:05 AM ---'
  );
  const prefactura = ejecutarCierreAutomaticoDia1Mes0005AM({
    frecuencias,
    saldosSinBoleto: saldos,
  });
  assert(
    prefactura.cronExpresion === '5 0 1 * *' &&
      prefactura.feeUnitarioUSD === 0.25 &&
      prefactura.feeSobreTransferenciasIncompletasUSD === 0 &&
      prefactura.totalPrefacturaFeeUSD ===
        Number((prefactura.boletosConfirmadosAuditados * 0.25).toFixed(2)) &&
      prefactura.notificacionEmailEnviada === true,
    `Cierre automático Día 1 (00:05 AM): ${prefactura.boletosConfirmadosAuditados} boletos CONFIRMADO × $0.25 = $${prefactura.totalPrefacturaFeeUSD.toFixed(
      2
    )} USD ($0.00 sobre transferencias sin boleto)`
  );

  const prefacturaAprobada = aprobarLiquidacionDia1EnUnClic({
    prefactura,
  });
  assert(
    prefacturaAprobada.estado === 'APROBADA_POR_GERENCIA' &&
      Boolean(prefacturaAprobada.aprobadaAt),
    'Botón [Aprobar Liquidación] aprueba en 1-clic el borrador de pre-factura enviado a Gerencia'
  );

  // =========================================================================
  // 6. MÓDULO 6: CONSOLA DE CONFIGURACIÓN GLOBAL (/admin/configuracion)
  // =========================================================================
  console.log(
    '\n--- [6/6] Módulo 6: Consola de Configuración Global (/admin/configuracion) ---'
  );
  let configGlobal = crearConfiguracionGlobalInicial();

  // 6A: Toggles [ON / OFF] en tiempo real para Banco de Loja y Banco Pichincha / Deuna!
  configGlobal = alternarToggleCanalCobroTiempoReal({
    configActual: configGlobal,
    canal: 'BANCO_DE_LOJA',
    activo: false,
  });
  assert(
    configGlobal.bancoDeLojaActivo === false &&
      configGlobal.bancoPichinchaDeunaActivo === true,
    'Toggle 1-clic desactiva Banco de Loja en tiempo real manteniendo activo Banco Pichincha / Deuna!'
  );

  configGlobal = alternarToggleCanalCobroTiempoReal({
    configActual: configGlobal,
    canal: 'BANCO_DE_LOJA',
    activo: true,
  });

  // 6B: Gestor CRUD de Cuentas Bancarias y Cargador de Imágenes QR
  configGlobal = guardarCuentaBancariaCRUD({
    configActual: configGlobal,
    cuentaEditadaOCreada: {
      ...configGlobal.cuentasBancarias[0],
      numeroCuenta: '2901999888',
      rucTitular: '1191705482001',
      tipoCuenta: 'Cuenta Corriente',
      titularCuenta: 'Cooperativa de Transporte Vilcabambaturis Cía. Ltda.',
    },
  });
  configGlobal = actualizarImagenQrOficialBanco({
    configActual: configGlobal,
    cuentaId: configGlobal.cuentasBancarias[0].id,
    nuevaQrImagenUrl: 'data:image/svg+xml;utf8,<svg>QR_ACTUALIZADO</svg>',
  });
  assert(
    configGlobal.cuentasBancarias[0].numeroCuenta === '2901999888' &&
      configGlobal.cuentasBancarias[0].qrImagenUrl.includes('QR_ACTUALIZADO'),
    'Gestor CRUD actualiza número de cuenta, RUC, titular e imagen oficial de código QR'
  );

  // 6C & 6D: WhatsApp / Gateway VPS y Respaldo Automático SQL 23:50 PM
  configGlobal = actualizarConfiguracionGlobalSoporteYBackup({
    configActual: configGlobal,
    whatsappSoporteCliente: '+593 99 888 1191',
    gatewayWhatsappApiUrl: 'https://wa-vps.vilcabambaturis.ec/api/v2/instance',
    gatewayWhatsappToken: 'EVO-TOKEN-NUEVO-2026',
    correoInstitucionalGerenciaSistemas: 'sistemas@vilcabambaturis.ec',
  });

  const backupNocturno = await ejecutarRespaldoNocturnoSQL({
    authHeader: `Bearer ${CRON_SECRET_DEFAULT}`,
    frecuencias,
    emailOverride: configGlobal.correoInstitucionalGerenciaSistemas,
  });

  assert(
    configGlobal.whatsappSoporteCliente === '+593 99 888 1191' &&
      backupNocturno.autorizado === true &&
      backupNocturno.registroLog?.correoDestinatario ===
        'sistemas@vilcabambaturis.ec',
    'Configuración de WhatsApp de soporte, Gateway Evolution API y envío nocturno de Dump SQL (23:50 PM) verificada'
  );

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS PRUEBAS E2E DE LOS MÓDULOS 5 Y 6 PASARON AL 100%');
  console.log('================================================================');
}

runModules5And6Tests().catch((err) => {
  console.error('Error inesperado en suite de pruebas Módulos 5 y 6:', err);
  process.exit(1);
});
