/**
 * ============================================================================
 * PASAJEYA SaaS — SUITE MAESTRA DE QA (PRUEBAS UNITARIAS Y LÓGICAS INTEGRALES)
 * Cliente Piloto: Cooperativa Vilcabambaturis Cía. Ltda. (RUC 1191705482001)
 * Cobertura: Módulos 1, 2, 3, 4, 5 y 6 + Casos Borde, Límites, RBAC y Finanzas
 * ============================================================================
 */

import {
  aplicarCongelamientoT20,
  crearEstadoInicialFrecuencias,
  formatearTextoCopiadoSRI,
  generarFirmaHmacQR,
  obtenerManifiestoCongeladoSRI,
  PIN_CORPORATIVO_OFICIAL,
  reasignarBusRealYNotificarWhatsApp,
  TENANT_VILCABAMBATURIS,
  validarAccesoCorporativo,
  venderAsientoEnVentanilla,
} from '../src/services/pasajeyaEngine';

import {
  BLOQUE_WEB_MAX_ASIENTO,
  calcularDesgloseLegalANT,
  calcularTemporizadorReserva,
  CAPACIDAD_HINO_AK_TOTAL,
  generarManifiestoFisicoPapelT20,
  PARADAS_URBANAS_LOJA_AUTORIZADAS,
  procesarCheckoutYReconciliacionInteligente,
  resolverCorredorVialADR005,
  SERVICIO_DIGITAL_QR_USD,
  validarBeneficiarioMedioPasaje,
  validarCedulaEcuatorianaModulo10,
  validarMultiplesMediosPasajes,
  validarParadaAutorizadaANT,
} from '../src/services/module1CheckoutEngine';

import {
  CADUCIDAD_SALDO_FAVOR_DIAS,
  CANALES_BANCARIOS_OFICIALES,
  ConciliarWebhookBancarioIdempotente,
  crearNotaCreditoSaldoAFavor,
  emitirBoletoTaquillaConSaldoAFavor,
  intentarReembolsoEfectivoEnVentanilla,
  parsearCorreoNotificacionBancaria,
  reiniciarRegistroIdempotenciaBancaria,
  SLA_CONCILIACION_MAX_MS,
  solicitarCambioODevolucionBoleto,
  validarAceptacionTerminosModulo2,
  verificarManifiesto100PorCientoLimpio,
  verificarYExpirarSaldosVencidos,
} from '../src/services/module2PaymentsEngine';

import {
  COLOR_PIZARRA_GRIS_NEUTRAL,
  COLOR_TRICOLOR_NARANJA_RESERVA,
  COLOR_TRICOLOR_ROJO_VENDIDO,
  COLOR_TRICOLOR_VERDE_DISPONIBLE,
  construirMapaTricolor45Asientos,
  ejecutarProtocoloCeroVentasWeb,
  evaluarTarjetaPizarraTurno,
  generarManifiestoImpresoConAsientosLiberados,
  generarPayloadsCopiadoSistemaVilcabambaturis,
  obtenerPermisosRBACTaquilla,
  obtenerUnidadesFlotaConBloqueoEnRuta,
  venderAsientoTaquillaTricolorConRBAC,
} from '../src/services/module3TaquillaEngine';

import {
  autenticarYSincronizarEnTerminal5MinAntes,
  construirVisorSoloConsultaSecuencial1a45,
  crearCatalogoFlotaInicial,
  crearUnidadFlotaCRUD,
  editarUnidadFlotaCRUD,
  ejecutarRetiroFajaNoShowPasadaUNLArgelia,
  evaluarDistincionVisualTurnoPwa,
  generarKitFajasFisicasReservadoWeb,
  obtenerEstadoBotonSincronizacionManual,
  restablecerPinDiscoAuxilioRapido,
  verificarPaseQrCriptograficoOfflineSub100ms,
} from '../src/services/module4PwaEngine';

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
} from '../src/services/module5And6Engine';

import {
  calcularChecksumDumpSQL,
  calcularMetricasAuditoriaSaaS,
  CRON_SECRET_DEFAULT,
  ejecutarRespaldoNocturnoSQL,
  generarDumpSqlEstructurado,
} from '../src/services/backupAndAuditService';

interface QATestResult {
  modulo: string;
  codigo: string;
  descripcion: string;
  estado: 'PASS' | 'FAIL';
  detalleError?: string;
}

const resultadosQA: QATestResult[] = [];

function qaAssert(
  modulo: string,
  codigo: string,
  condicion: boolean,
  descripcion: string
): void {
  if (!condicion) {
    resultadosQA.push({
      modulo,
      codigo,
      descripcion,
      estado: 'FAIL',
      detalleError: `Fallo en aserción lógica: ${descripcion}`,
    });
    throw new Error(`[QA FAIL] [${modulo} - ${codigo}] ${descripcion}`);
  }
  resultadosQA.push({
    modulo,
    codigo,
    descripcion,
    estado: 'PASS',
  });
  console.log(`  ✅ [${codigo}] ${descripcion}`);
}

async function qaExpectThrow(
  modulo: string,
  codigo: string,
  fn: () => unknown | Promise<unknown>,
  subcadenaEsperada: string,
  descripcion: string
): Promise<void> {
  let lanzoError = false;
  let mensajeCapturado = '';
  try {
    await fn();
  } catch (err) {
    lanzoError = true;
    mensajeCapturado = err instanceof Error ? err.message : String(err);
  }
  const cumple =
    lanzoError &&
    mensajeCapturado.toLowerCase().includes(subcadenaEsperada.toLowerCase());
  if (!cumple) {
    resultadosQA.push({
      modulo,
      codigo,
      descripcion,
      estado: 'FAIL',
      detalleError: lanzoError
        ? `Lanzó error pero no contenía "${subcadenaEsperada}". Recibido: "${mensajeCapturado}"`
        : 'No lanzó excepción cuando debía bloquear la operación',
    });
    throw new Error(
      `[QA FAIL] [${modulo} - ${codigo}] ${descripcion} (Recibido: "${mensajeCapturado}")`
    );
  }
  resultadosQA.push({
    modulo,
    codigo,
    descripcion,
    estado: 'PASS',
  });
  console.log(`  ✅ [${codigo}] ${descripcion}`);
}

async function ejecutarSuiteMaestraQA() {
  console.log('============================================================================');
  console.log('🧪 PASAJEYA SaaS — AUDITORÍA QA: PRUEBAS LÓGICAS Y UNITARIAS EXHAUSTIVAS');
  console.log(`Cliente Piloto: ${TENANT_VILCABAMBATURIS.nombre} (RUC: ${TENANT_VILCABAMBATURIS.ruc})`);
  console.log('============================================================================\n');

  // ==========================================================================
  // BLOQUE 1: MÓDULO 1 — PARADAS ANT, RUTAS ADR-005, MÓDULO 10, TIMERS Y 1-A-N QR
  // ==========================================================================
  console.log('--- [BLOQUE 1] MÓDULO 1: TOPOLOGÍA ANT, ALGORITMO MÓDULO 10, TIMERS Y CHECKOUT ---');

  // 1.1 Prohibición absoluta de "La Bomba Quemada" y validación de paradas vacías/falsas
  qaAssert(
    'Módulo 1',
    'M1-UT-01',
    PARADAS_URBANAS_LOJA_AUTORIZADAS.length === 5,
    'Catálogo oficial de Loja contiene exactamente las 5 paradas urbanas autorizadas por la ANT'
  );

  const paradaProhibida1 = validarParadaAutorizadaANT('La Bomba Quemada');
  const paradaProhibida2 = validarParadaAutorizadaANT('sector bomba quemada sur');
  const paradaVacia = validarParadaAutorizadaANT('   ');
  const paradaInexistente = validarParadaAutorizadaANT('Parque Infantil');
  const paradaValidaUNL = validarParadaAutorizadaANT('UNL Argelia');

  qaAssert(
    'Módulo 1',
    'M1-UT-02',
    !paradaProhibida1.valida &&
      paradaProhibida1.motivo.includes('PROHIBICIÓN REGULATORIA ANT') &&
      !paradaProhibida2.valida,
    'Bloquea estrictamente "La Bomba Quemada" en cualquier variante de texto (mayúsculas/minúsculas)'
  );

  qaAssert(
    'Módulo 1',
    'M1-UT-03',
    !paradaVacia.valida && !paradaInexistente.valida && paradaValidaUNL.valida,
    'Rechaza cadenas vacías o paradas no autorizadas y aprueba "UNL Argelia" como parada oficial #5'
  );

  // 1.2 Discriminación Vial ADR-005
  const rutaVilca = resolverCorredorVialADR005('Vilcabamba');
  const rutaYangana = resolverCorredorVialADR005('Yangana');
  const rutaElTambo = resolverCorredorVialADR005('El Tambo');

  qaAssert(
    'Módulo 1',
    'M1-UT-04',
    rutaVilca.corredor.id === 'TRONCAL_SUR' &&
      rutaVilca.corredor.pasaPorVilcabamba === true &&
      rutaYangana.corredor.id === 'TRONCAL_SUR' &&
      rutaElTambo.corredor.id === 'RAMAL_NOROCCIDENTAL' &&
      rutaElTambo.corredor.pasaPorVilcabamba === false &&
      !rutaElTambo.corredor.nodosOrdenados.includes('Vilcabamba'),
    'Discriminación Vial ADR-005: Separa Troncal Sur (Vilcabamba/Yangana) del Ramal Noroccidental (El Tambo sin Vilcabamba)'
  );

  // 1.3 Algoritmo Módulo 10 para Cédula Ecuatoriana (Casos positivos, negativos y bordes)
  const cedulaValidaLoja = validarCedulaEcuatorianaModulo10('1104680135');
  const cedulaValidaPichincha = validarCedulaEcuatorianaModulo10('1710034065');
  const cedulaRepetida = validarCedulaEcuatorianaModulo10('2222222222');
  const cedulaProvinciaInvalida = validarCedulaEcuatorianaModulo10('2910034065'); // Prov 29 > 24
  const cedulaTercerDigitoInvalido = validarCedulaEcuatorianaModulo10('1164680135'); // 3er dígito = 6
  const cedulaDigitoVerificadorMalo = validarCedulaEcuatorianaModulo10('1104680139'); // Verificador alterado
  const cedulaLongitudMala = validarCedulaEcuatorianaModulo10('110468013'); // 9 dígitos

  qaAssert(
    'Módulo 1',
    'M1-UT-05',
    cedulaValidaLoja.valida &&
      cedulaValidaLoja.codigoProvincia === 11 &&
      cedulaValidaPichincha.valida &&
      cedulaValidaPichincha.codigoProvincia === 17,
    'Algoritmo Módulo 10 valida correctamente cédulas reales de Loja (11) y Pichincha (17)'
  );

  qaAssert(
    'Módulo 1',
    'M1-UT-06',
    !cedulaRepetida.valida &&
      !cedulaProvinciaInvalida.valida &&
      !cedulaTercerDigitoInvalido.valida &&
      !cedulaDigitoVerificadorMalo.valida &&
      !cedulaLongitudMala.valida,
    'Algoritmo Módulo 10 rechaza dígitos repetidos (2222222222), provincias fuera de 01-24, 3er dígito >= 6 y verificador corrupto'
  );

  // 1.4 Elegibilidad por Edad para Medios Pasajes (50% Tarifa ANT: <18 o >=65) y Múltiples Cédulas
  const menor17 = validarBeneficiarioMedioPasaje({ cedula: '1104680135', edad: 17 });
  const adulto18NoElegible = validarBeneficiarioMedioPasaje({ cedula: '1104680135', edad: 18 });
  const adulto64NoElegible = validarBeneficiarioMedioPasaje({ cedula: '1710034065', edad: 64 });
  const adultoMayor65 = validarBeneficiarioMedioPasaje({ cedula: '1710034065', edad: 65 });

  qaAssert(
    'Módulo 1',
    'M1-UT-07',
    menor17.valido &&
      menor17.categoriaElegibilidad === 'MEDIO_PASAJE_MENOR_18' &&
      !adulto18NoElegible.valido &&
      !adulto64NoElegible.valido &&
      adultoMayor65.valido &&
      adultoMayor65.categoriaElegibilidad === 'MEDIO_PASAJE_ADULTO_MAYOR_65',
    'Frontera exacta de Edad ANT: autoriza 17 años (<18) y 65 años (>=65), pero rechaza 18 y 64 años'
  );

  const mediosDuplicados = validarMultiplesMediosPasajes(
    2,
    [
      { cedula: '1104680135', edad: 12 },
      { cedula: '1104680135', edad: 70 },
    ],
    2
  );
  const mediosIncompletos = validarMultiplesMediosPasajes(
    2,
    [{ cedula: '1104680135', edad: 12 }],
    2
  );
  const mediosValidos = validarMultiplesMediosPasajes(
    2,
    [
      { cedula: '1104680135', edad: 12 },
      { cedula: '1710034065', edad: 70 },
    ],
    3
  );

  qaAssert(
    'Módulo 1',
    'M1-UT-08',
    !mediosDuplicados.valido && !mediosIncompletos.valido && mediosValidos.valido,
    'Regla N Medios Pasajes = N Cédulas Únicas: rechaza cédulas repetidas o faltantes y aprueba N cédulas distintas'
  );

  // 1.5 Temporizador Estándar (15:00), Dinámico Abreviado (<15m para T-20) y Cierre T-20m
  const timerEstandar = calcularTemporizadorReserva(40); // T-40m -> 15:00
  const timerAbreviado = calcularTemporizadorReserva(25); // T-25m -> 05:00 alerta roja
  const timerFrontera21 = calcularTemporizadorReserva(21); // T-21m -> 01:00 alerta roja
  const timerCongelado20 = calcularTemporizadorReserva(20); // T-20m -> 00:00 congelado
  const timerCongelado15 = calcularTemporizadorReserva(15); // T-15m -> 00:00 congelado

  qaAssert(
    'Módulo 1',
    'M1-UT-09',
    timerEstandar.permitidoReservar &&
      timerEstandar.formatoMMSS === '15:00' &&
      !timerEstandar.esTemporizadorAbreviadoAlertaRoja &&
      timerAbreviado.permitidoReservar &&
      timerAbreviado.formatoMMSS === '05:00' &&
      timerAbreviado.esTemporizadorAbreviadoAlertaRoja &&
      timerFrontera21.formatoMMSS === '01:00' &&
      !timerCongelado20.permitidoReservar &&
      timerCongelado20.ventaWebCongelada &&
      !timerCongelado15.permitidoReservar,
    'Temporizador calcula 15:00 estándar (>=35m), dinámico abreviado en alerta roja (21m-34m) y congela en <=20m'
  );

  // 1.6 Desglose Legal ANT y Fee Tecnológico Fijo ($0.25 por boleto sea 100% o 50%)
  const desgloseMixto = calcularDesgloseLegalANT(2.0, 3, 1); // 2 completos ($4.00) + 1 medio ($1.00) = $5.00 ANT + 3*$0.25 ($0.75) = $5.75
  qaAssert(
    'Módulo 1',
    'M1-UT-10',
    desgloseMixto.pasajeOficialReguladoTotalUSD === 5.0 &&
      desgloseMixto.valorTributarioBoletoCooperativaUSD === 5.0 &&
      desgloseMixto.servicioDigitalTotalUSD === 0.75 &&
      desgloseMixto.totalATransferirUSD === 5.75 &&
      CAPACIDAD_HINO_AK_TOTAL === 45 &&
      BLOQUE_WEB_MAX_ASIENTO === 10 &&
      SERVICIO_DIGITAL_QR_USD === 0.25,
    'Desglose Legal ANT separa estrictamente la tarifa tributaria ($5.00) del Servicio Digital QR ($0.25 × 3 = $0.75)'
  );

  // 1.7 Emisión Relacional 1 Transacción -> N Boletos QR Independientes y Bloqueos de Checkout
  const [freqCongelada, freqActiva] = crearEstadoInicialFrecuencias();

  await qaExpectThrow(
    'Módulo 1',
    'M1-UT-11',
    () =>
      procesarCheckoutYReconciliacionInteligente({
        frecuencia: freqActiva,
        asientosSeleccionados: [12], // Bloqueado (11-45 exclusivo taquilla)
        cedulaRuc: '1104680135',
        pasajeroNombre: 'Cliente Prueba',
        telefonoWhatsApp: '+593 99 000 0000',
        paradaAbordajeLoja: 'UNL Argelia',
        destinoFinal: 'Yangana',
        banco: 'BANCO_DE_LOJA',
        referenciaBancaria: 'BL-TEST-12',
        montoTransferidoUSD: 2.75,
      }),
    'Bloque Exclusivo de Taquilla Terminal (11 al 45)',
    'Bloquea intento de comprar en línea asientos del bloque 11 al 45'
  );

  await qaExpectThrow(
    'Módulo 1',
    'M1-UT-12',
    () =>
      procesarCheckoutYReconciliacionInteligente({
        frecuencia: freqActiva,
        asientosSeleccionados: [5, 5], // Asientos duplicados
        cedulaRuc: '1104680135',
        pasajeroNombre: 'Cliente Prueba',
        telefonoWhatsApp: '+593 99 000 0000',
        paradaAbordajeLoja: 'UNL Argelia',
        destinoFinal: 'Yangana',
        banco: 'BANCO_DE_LOJA',
        referenciaBancaria: 'BL-TEST-DUP',
        montoTransferidoUSD: 5.5,
      }),
    'duplicados',
    'Bloquea transacción cuando se envían números de asiento duplicados ([5, 5])'
  );

  const compraFamiliar3Boletos = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqActiva,
    asientosSeleccionados: [5, 6, 7],
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Familia Burneo Loja',
    telefonoWhatsApp: '+593 99 111 2233',
    paradaAbordajeLoja: 'La Tebaida',
    destinoFinal: 'Yangana',
    banco: 'BANCO_DE_LOJA',
    referenciaBancaria: 'BL-FAM-777',
    montoTransferidoUSD: 6.25 + 0.75, // 2 completos ($5.00) + 1 medio ($1.25) + 3 fees ($0.75) = $7.00
    cantidadMediosPasajes: 1,
    beneficiariosMedioPasaje: [
      { cedula: '1710034065', edad: 10, nombreBeneficiario: 'Mateo Burneo' },
    ],
  });

  const codigosQrUnicos = new Set(
    compraFamiliar3Boletos.pasesQrEmitidos.map((b) => b.codigoUnico)
  );
  const firmasHmacUnicas = new Set(
    compraFamiliar3Boletos.pasesQrEmitidos.map((b) => b.firmaDigitalHmac)
  );

  qaAssert(
    'Módulo 1',
    'M1-UT-13',
    compraFamiliar3Boletos.exitoEmision &&
      compraFamiliar3Boletos.pasesQrEmitidos.length === 3 &&
      codigosQrUnicos.size === 3 &&
      firmasHmacUnicas.size === 3 &&
      compraFamiliar3Boletos.feeTecnologicoCobradoTotalUSD === 0.75,
    'Relación 1-a-N: 1 transacción familiar emite 3 Boletos QR independientes con codigoUnico y firmaDigitalHmac distintos'
  );

  // Manifiesto físico en papel sin dependencia tecnológica en autobús
  const manifiestoPapel = generarManifiestoFisicoPapelT20(freqCongelada);
  qaAssert(
    'Módulo 1',
    'M1-UT-14',
    manifiestoPapel.requiereCelularAyudanteEnRuta === false &&
      manifiestoPapel.modoOperacionPrimario === 'MANIFIESTO_FISICO_IMPRESO_PAPEL' &&
      manifiestoPapel.modoEscanerQrPwa === 'HERRAMIENTA_SECUNDARIA_OPCIONAL',
    'Garantiza operación primaria en Manifiesto Físico en Papel (0 dependencia obligatoria de celular a bordo)'
  );

  // ==========================================================================
  // BLOQUE 2: MÓDULO 2 — CONCILIACIÓN <1.2S, IDEMPOTENCIA Y NOTAS DE CRÉDITO 30D
  // ==========================================================================
  console.log('\n--- [BLOQUE 2] MÓDULO 2: CONCILIACIÓN BANCARIA (<1.2S), IDEMPOTENCIA Y SALDOS 30 DÍAS ---');

  reiniciarRegistroIdempotenciaBancaria();

  // 2.1 Canales bancarios 0% comisión y Términos obligatorios
  qaAssert(
    'Módulo 2',
    'M2-UT-01',
    CANALES_BANCARIOS_OFICIALES.BANCO_DE_LOJA.comisionPasarelaUSD === 0 &&
      CANALES_BANCARIOS_OFICIALES.BANCO_PICHINCHA.comisionPasarelaUSD === 0 &&
      CANALES_BANCARIOS_OFICIALES.DEUNA_PICHINCHA.comisionPasarelaUSD === 0 &&
      !validarAceptacionTerminosModulo2(false).valido &&
      validarAceptacionTerminosModulo2(true).valido,
    'Canales bancarios operan con 0% comisión de tarjeta y exigen aceptación explícita de Términos y Condiciones'
  );

  // 2.2 Extracción Regex determinista vs Fallback Gemini NLP (< 1.2s SLA)
  const correoRegex = parsearCorreoNotificacionBancaria({
    remitente: 'notificaciones@bancodeloja.fin.ec',
    asunto: 'Transferencia Acreditada Banco de Loja',
    cuerpoTexto: 'Se acreditó USD 2.00 con Comprobante: BL-90012345 en cuenta 2901485920.',
  });

  const correoFallbackNlp = parsearCorreoNotificacionBancaria({
    remitente: 'alertas@pichincha.com',
    asunto: 'Aviso Deuna!',
    cuerpoTexto: 'Recibiste un pago rápido por 3,75 dólares en tu billetera móvil código 884920192.',
  });

  qaAssert(
    'Módulo 2',
    'M2-UT-02',
    correoRegex.metodoExtraccion === 'REGEX_DETERMINISTA' &&
      correoRegex.montoUSD === 2.0 &&
      correoRegex.referenciaBanco === 'BL-90012345' &&
      correoRegex.latenciaMs < SLA_CONCILIACION_MAX_MS &&
      correoFallbackNlp.metodoExtraccion === 'GEMINI_NLP_FALLBACK' &&
      correoFallbackNlp.bancoDetectado === 'DEUNA_PICHINCHA' &&
      correoFallbackNlp.montoUSD === 3.75 &&
      correoFallbackNlp.latenciaMs < SLA_CONCILIACION_MAX_MS,
    'Motor de extracción procesa correos estándar por Regex (420ms) y correos libres por Fallback NLP (860ms), ambos < 1.2s'
  );

  // 2.3 Idempotencia compuesta [tenantId, referenciaBanco]
  const conc1 = ConciliarWebhookBancarioIdempotente({
    tenantId: 'tenant-vilcabambaturis-01',
    correo: {
      remitente: 'notificaciones@bancodeloja.fin.ec',
      asunto: 'Transferencia',
      cuerpoTexto: 'Comprobante: BL-IDEMP-001 por USD 2.00',
    },
  });

  qaAssert(
    'Módulo 2',
    'M2-UT-03',
    conc1.conciliado && conc1.cumpleSlaSub1200ms,
    'Primera notificación bancaria con referencia BL-IDEMP-001 se concilia en < 1.2s'
  );

  await qaExpectThrow(
    'Módulo 2',
    'M2-UT-04',
    () =>
      ConciliarWebhookBancarioIdempotente({
        tenantId: 'tenant-vilcabambaturis-01',
        correo: {
          remitente: 'notificaciones@bancodeloja.fin.ec',
          asunto: 'Reenvío Transferencia',
          cuerpoTexto: 'Comprobante: BL-IDEMP-001 por USD 2.00',
        },
      }),
    'IDEMPOTENCIA ESTRICTA [tenantId, referenciaBanco]',
    'Bloquea doble acreditación cuando se repite la misma clave compuesta [tenantId, referenciaBanco]'
  );

  // Pero si otro tenant recibe el mismo número de referencia de otro banco, la clave compuesta lo permite:
  const concOtroTenant = ConciliarWebhookBancarioIdempotente({
    tenantId: 'tenant-otro-operador-02',
    correo: {
      remitente: 'notificaciones@bancodeloja.fin.ec',
      asunto: 'Transferencia',
      cuerpoTexto: 'Comprobante: BL-IDEMP-001 por USD 2.00',
    },
  });
  qaAssert(
    'Módulo 2',
    'M2-UT-05',
    concOtroTenant.conciliado,
    'Aislamiento Multi-Tenant: clave compuesta [tenantId, referenciaBanco] permite igual referencia en distinto tenantId'
  );

  // 2.4 Política de No Cambios / No Devoluciones y Cero Cobro a Bordo
  const rechazoDevolucion = solicitarCambioODevolucionBoleto({
    boleto: freqCongelada.boletos[0],
    tipoSolicitud: 'DEVOLUCION_DINERO',
  });
  const manifiestoLimpio = verificarManifiesto100PorCientoLimpio(freqCongelada);

  qaAssert(
    'Módulo 2',
    'M2-UT-06',
    rechazoDevolucion.autorizado === false &&
      rechazoDevolucion.codigoPolitica === 'POLITICA_NO_CAMBIOS_NO_DEVOLUCIONES' &&
      manifiestoLimpio.manifiestoLimpio === true &&
      manifiestoLimpio.cobroABordoPermitido === false,
    'Aplica política inmutable de No Cambios / No Devoluciones y prohibición de cobro a bordo'
  );

  // 2.5 Notas de Crédito Digitales (30 días exactos, $0.00 fee en pagos sin boleto, 0 reembolso en efectivo)
  const fechaBase = new Date('2026-10-01T12:00:00Z');
  const nota30d = crearNotaCreditoSaldoAFavor({
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Rosa Elvira Burneo',
    telefonoWhatsApp: '+593 99 418 2290',
    bancoOrigen: 'BANCO_DE_LOJA',
    referenciaBancoOrigen: 'BL-POST20-991',
    montoTransferidoUSD: 2.0,
    motivoOrigen: 'PAGO_POST_T20_MIN',
    fechaEmisionBase: fechaBase,
  });

  const diasDiferencia =
    (new Date(nota30d.fechaExpiracion).getTime() -
      new Date(nota30d.fechaEmision).getTime()) /
    (1000 * 60 * 60 * 24);

  const intentoEfectivo = intentarReembolsoEfectivoEnVentanilla(nota30d);
  const evalDia29 = verificarYExpirarSaldosVencidos(
    [nota30d],
    new Date('2026-10-30T12:00:00Z')
  );
  const evalDia31 = verificarYExpirarSaldosVencidos(
    [nota30d],
    new Date('2026-11-01T12:00:00Z')
  );

  qaAssert(
    'Módulo 2',
    'M2-UT-07',
    diasDiferencia === CADUCIDAD_SALDO_FAVOR_DIAS &&
      nota30d.feeTecnologicoCobradoUSD === 0 &&
      nota30d.reembolsoEfectivoPermitido === false &&
      intentoEfectivo.permitido === false &&
      evalDia29.expiradasCount === 0 &&
      evalDia31.expiradasCount === 1 &&
      evalDia31.notasActualizadas[0].estado === 'EXPIRED' &&
      evalDia31.montoImputadoGastosAdministrativosUSD === 2.0,
    'NotaCreditoSaldo tiene vigencia exacta de 30 días, cobra $0.00 de fee tecnológico, prohíbe efectivo y pasa a EXPIRED al día 31'
  );

  const canjeTaquilla = emitirBoletoTaquillaConSaldoAFavor({
    frecuencia: freqCongelada,
    asientoNumero: 4, // Libre en ventanilla tras T-20m
    notaCredito: nota30d,
    fechaActual: new Date('2026-10-15T10:00:00Z'),
  });

  qaAssert(
    'Módulo 2',
    'M2-UT-08',
    canjeTaquilla.afectoCajaChicaEfectivoUSD === 0 &&
      canjeTaquilla.notaCreditoActualizada.estado === 'USED' &&
      canjeTaquilla.boletoEmitido.banco === 'SALDO_A_FAVOR',
    'Canje de NotaCreditoSaldo en taquilla emite boleto con $0.00 de afectación a caja chica y marca el crédito como USED'
  );

  // ==========================================================================
  // BLOQUE 3: MÓDULO 3 — PIZARRA TRICOLOR, MAPA 45 ASIENTOS, SRI Y RBAC
  // ==========================================================================
  console.log('\n--- [BLOQUE 3] MÓDULO 3: CONSOLA DE TAQUILLA, MAPA TRICOLOR (45), COPIADO SRI Y RBAC ---');

  const [, , , freqSinVentas] = crearEstadoInicialFrecuencias();

  // 3.1 Pizarra de turnos: Rojo Vinotinto (#912D26) vs Gris Neutral (#64748B)
  const tarjetaConVentas = evaluarTarjetaPizarraTurno(freqActiva);
  const tarjetaSinVentas = evaluarTarjetaPizarraTurno(freqSinVentas);

  qaAssert(
    'Módulo 3',
    'M3-UT-01',
    tarjetaConVentas.colorDistintivoHex === COLOR_TRICOLOR_ROJO_VENDIDO &&
      tarjetaConVentas.tieneVentasOReservasWeb === true &&
      tarjetaSinVentas.colorDistintivoHex === COLOR_PIZARRA_GRIS_NEUTRAL &&
      tarjetaSinVentas.tieneVentasOReservasWeb === false &&
      tarjetaSinVentas.puedeCerrarSinVentasWeb === true,
    'Pizarra resalta en Rojo Vinotinto (#912D26) turnos con ventas/reservas y en Gris Neutral (#64748B) turnos con 0 ventas'
  );

  // 3.2 Mapa Tricolor de 45 asientos Hino AK
  const mapa45 = construirMapaTricolor45Asientos(freqActiva);
  const asiento1Vendido = mapa45.find((a) => a.numero === 1)!;
  const asiento3Reserva15m = mapa45.find((a) => a.numero === 3)!;
  const asiento5Disponible = mapa45.find((a) => a.numero === 5)!;
  const asiento25NativoTaq = mapa45.find((a) => a.numero === 25)!;

  qaAssert(
    'Módulo 3',
    'M3-UT-02',
    mapa45.length === 45 &&
      asiento1Vendido.colorHex === COLOR_TRICOLOR_ROJO_VENDIDO &&
      !asiento1Vendido.puedeVenderseEnVentanilla &&
      asiento3Reserva15m.colorHex === COLOR_TRICOLOR_NARANJA_RESERVA &&
      !asiento3Reserva15m.puedeVenderseEnVentanilla &&
      asiento5Disponible.colorHex === COLOR_TRICOLOR_VERDE_DISPONIBLE &&
      asiento5Disponible.puedeVenderseEnVentanilla &&
      asiento25NativoTaq.colorHex === COLOR_TRICOLOR_VERDE_DISPONIBLE &&
      asiento25NativoTaq.zonaBus === 'NATIVO_VENTANILLA_11_45',
    'Mapa Tricolor (45 asientos): Rojo (#912D26) vendido, Naranja (#F57C00) reserva 15m bloqueada y Verde (#2E7D32) libre'
  );

  // 3.3 Los 3 botones independientes de copiado en 1 clic
  const payloadsCopiado = generarPayloadsCopiadoSistemaVilcabambaturis(
    freqActiva.boletos[0],
    freqActiva
  );
  qaAssert(
    'Módulo 3',
    'M3-UT-03',
    payloadsCopiado.botonCopiarCedulaRuc === '1104019283' &&
      payloadsCopiado.botonCopiarReferenciaComprobante === 'BL-99483100' &&
      payloadsCopiado.botonCopiarVentanaEmergenteDeposito.includes('DOC_REF: BL-99483100') &&
      payloadsCopiado.botonCopiarVentanaEmergenteDeposito.includes('MONTO_ANT_USD: $2.50'),
    'Genera los 3 payloads independientes en 1-clic: [Cédula/RUC], [# Comprobante] y [Ventana Emergente de Depósito]'
  );

  // 3.4 Control estricto de flota (Bloqueo EN_RUTA / DESPACHADO) y Protocolo 0 Ventas Web
  await qaExpectThrow(
    'Módulo 3',
    'M3-UT-04',
    () => reasignarBusRealYNotificarWhatsApp(freqActiva, 'Disco #22', 'Cambio en andén'),
    'CONTROL ESTRICTO DE FLOTA',
    'Impide asignar como busDiscoReal al Disco #22 porque se encuentra EN_RUTA'
  );

  await qaExpectThrow(
    'Módulo 3',
    'M3-UT-05',
    () => ejecutarProtocoloCeroVentasWeb(freqActiva),
    '0 ventas en línea',
    'Impide cerrar como DESPACHADO_SIN_VENTAS_WEB un turno que sí tiene boletos web vendidos'
  );

  const cierreCeroVentas = ejecutarProtocoloCeroVentasWeb(freqSinVentas);
  qaAssert(
    'Módulo 3',
    'M3-UT-06',
    cierreCeroVentas.estadoAplicado === 'DESPACHADO_SIN_VENTAS_WEB' &&
      cierreCeroVentas.frecuenciaActualizada.ventaWebCongelada === true,
    'Ejecuta protocolo DESPACHADO_SIN_VENTAS_WEB en 1-clic sobre turno con 0 ventas web'
  );

  // 3.5 RBAC en Taquilla: Secretaria (Lectura/Escritura) vs Ayudante (Solo Lectura)
  const permisosAyudante = obtenerPermisosRBACTaquilla('AYUDANTE');
  const permisosSecretaria = obtenerPermisosRBACTaquilla('SECRETARIA');

  qaAssert(
    'Módulo 3',
    'M3-UT-07',
    permisosAyudante.modoAcceso === 'SOLO_LECTURA' &&
      !permisosAyudante.puedeVenderEnTaquilla &&
      permisosSecretaria.modoAcceso === 'LECTURA_ESCRITURA' &&
      permisosSecretaria.puedeVenderEnTaquilla,
    'RBAC Taquilla: restringe a AYUDANTE a SOLO_LECTURA y otorga a SECRETARIA LECTURA_ESCRITURA'
  );

  await qaExpectThrow(
    'Módulo 3',
    'M3-UT-08',
    () =>
      venderAsientoTaquillaTricolorConRBAC({
        frecuencia: freqActiva,
        rol: 'AYUDANTE',
        asientoNumero: 15,
        cedulaRuc: '1104680135',
        pasajeroNombre: 'Intento Ayudante',
        telefonoWhatsApp: '+593 99 000 0000',
      }),
    'ACCESO DENEGADO RBAC',
    'Bloquea venta presencial cuando el operador tiene rol AYUDANTE (Solo Lectura)'
  );

  await qaExpectThrow(
    'Módulo 3',
    'M3-UT-09',
    () =>
      venderAsientoTaquillaTricolorConRBAC({
        frecuencia: freqActiva,
        rol: 'SECRETARIA',
        asientoNumero: 3, // Asiento #3 está en LOCKED_WEB (Naranja #F57C00)
        cedulaRuc: '1104680135',
        pasajeroNombre: 'Intento Sobre Reserva',
        telefonoWhatsApp: '+593 99 000 0000',
      }),
    'BLOQUEO TRICOLOR (#F57C00 NARANJA/OCRE)',
    'Bloquea en ventanilla la venta del Asiento #3 mientras su temporizador web de 15m (#F57C00) sigue activo'
  );

  // ==========================================================================
  // BLOQUE 4: MÓDULO 4 — PWA OFFLINE-FIRST, CRUD FLOTA, QR <100MS Y NO-SHOW
  // ==========================================================================
  console.log('\n--- [BLOQUE 4] MÓDULO 4: PWA OFFLINE-FIRST, CRUD FLOTA (/admin/flota) Y FAJAS NO-SHOW ---');

  const catalogoInicial = crearCatalogoFlotaInicial();

  // 4.1 CRUD de Flota exclusivo de GERENCIA vs Reset de PIN por GERENCIA o SECRETARIA
  await qaExpectThrow(
    'Módulo 4',
    'M4-UT-01',
    () =>
      crearUnidadFlotaCRUD({
        catalogoActual: catalogoInicial,
        rolOperador: 'SECRETARIA',
        disco: 'Disco #40',
        placa: 'LAA-4040',
        chofer: 'Chofer Prueba',
      }),
    'exclusiva de GERENCIA',
    'Impide a SECRETARIA o AYUDANTE crear nuevas unidades en /admin/flota'
  );

  const unidadCreada = crearUnidadFlotaCRUD({
    catalogoActual: catalogoInicial,
    rolOperador: 'GERENCIA',
    disco: 'Disco #40',
    placa: 'LAA-4040',
    chofer: 'Chofer Titular 40',
    pinUnidad: '8899',
  });

  const resetPorSecretaria = restablecerPinDiscoAuxilioRapido({
    catalogoActual: unidadCreada.catalogoActualizado,
    rolOperador: 'SECRETARIA',
    disco: 'Disco #40',
  });

  qaAssert(
    'Módulo 4',
    'M4-UT-02',
    unidadCreada.unidadCreada.pinUnidad === '8899' &&
      resetPorSecretaria.unidadActualizada.pinUnidad === PIN_CORPORATIVO_OFICIAL,
    'GERENCIA crea unidad con PIN propio y SECRETARIA ejecuta botón de auxilio rápido restableciendo PIN a 1191'
  );

  // 4.2 Sincronización en terminal (<1s), botón Verde/Rojo y validación QR offline (<100ms)
  const btnRojo = obtenerEstadoBotonSincronizacionManual({
    sincronizado: false,
    disco: 'Disco #08',
  });
  const syncResult = await autenticarYSincronizarEnTerminal5MinAntes({
    catalogoFlota: catalogoInicial,
    frecuencia: freqCongelada,
    discoSeleccionado: 'Disco #08',
    pinIngresado: '1191',
  });

  qaAssert(
    'Módulo 4',
    'M4-UT-03',
    btnRojo.colorFondoHex === '#912D26' &&
      syncResult.autenticado &&
      syncResult.cumpleSlaSub1Segundo &&
      syncResult.botonSincronizacion.colorFondoHex === '#2E7D32' &&
      syncResult.totalPasajerosIndexedDB === freqCongelada.boletos.length,
    'Sincronización 5 min antes en terminal descarga manifiesto a IndexedDB en < 1s y cambia botón de Rojo a Verde'
  );

  const boletoPruebaQr = freqCongelada.boletos[0];
  const payloadQrValido = JSON.stringify({
    frecuenciaId: boletoPruebaQr.frecuenciaId,
    asientoNumero: boletoPruebaQr.asientoNumero,
    cedulaRuc: boletoPruebaQr.cedulaRuc,
    referenciaBancaria: boletoPruebaQr.referenciaBancaria,
    firmaHmac: boletoPruebaQr.firmaHmac,
  });
  const payloadQrAdulterado = JSON.stringify({
    frecuenciaId: boletoPruebaQr.frecuenciaId,
    asientoNumero: boletoPruebaQr.asientoNumero,
    cedulaRuc: boletoPruebaQr.cedulaRuc,
    referenciaBancaria: boletoPruebaQr.referenciaBancaria,
    firmaHmac: 'HMAC256-FALSIFICADO0000000000',
  });

  const qrValidoRes = await verificarPaseQrCriptograficoOfflineSub100ms(
    payloadQrValido,
    freqCongelada.id
  );
  const qrFalsoRes = await verificarPaseQrCriptograficoOfflineSub100ms(
    payloadQrAdulterado,
    freqCongelada.id
  );

  qaAssert(
    'Módulo 4',
    'M4-UT-04',
    qrValidoRes.valido &&
      qrValidoRes.cumpleSlaSub100ms &&
      !qrFalsoRes.valido &&
      qrFalsoRes.cumpleSlaSub100ms,
    'Validador QR Offline en IndexedDB aprueba firma legítima y bloquea QR adulterado en < 100ms sin Internet'
  );

  // 4.3 Visor de Solo Consulta (1 al 45) y Protocolo No-Show en UNL Argelia
  const visorConsulta = await construirVisorSoloConsultaSecuencial1a45({
    frecuencia: freqCongelada,
  });
  qaAssert(
    'Módulo 4',
    'M4-UT-05',
    visorConsulta.obligacionCheckInClicsABordo === false &&
      visorConsulta.croquisSecuencial45Asientos.length === 45 &&
      visorConsulta.croquisSecuencial45Asientos[0].numeroAsiento === 1 &&
      visorConsulta.croquisSecuencial45Asientos[44].numeroAsiento === 45,
    'Visor de Tripulación mantiene 0 obligación de clics a bordo y ordena secuencialmente los asientos del 1 al 45'
  );

  await qaExpectThrow(
    'Módulo 4',
    'M4-UT-06',
    () =>
      ejecutarRetiroFajaNoShowPasadaUNLArgelia({
        frecuencia: freqCongelada,
        asientoNumero: 1,
        yaPasoParadaUNLArgelia: false,
      }),
    'UNL Argelia',
    'Protege la faja física "RESERVADO WEB" e impide retirarla antes de pasar la parada límite UNL Argelia (20 min)'
  );

  const retiroNoShowOk = ejecutarRetiroFajaNoShowPasadaUNLArgelia({
    frecuencia: freqCongelada,
    asientoNumero: 1,
    yaPasoParadaUNLArgelia: true,
  });
  qaAssert(
    'Módulo 4',
    'M4-UT-07',
    retiroNoShowOk.exito &&
      retiroNoShowOk.fajaRetirada &&
      retiroNoShowOk.reembolsoEfectivoPermitido === false,
    'Pasada UNL Argelia, autoriza retirar la faja física "RESERVADO WEB" por No-Show y libera el asiento para ruta'
  );

  // ==========================================================================
  // BLOQUE 5: MÓDULO 5 — ARQUEO SEPARADO, QUEMA DE SALDOS, 16 DISCOS Y DÍA 1
  // ==========================================================================
  console.log('\n--- [BLOQUE 5] MÓDULO 5: ARQUEO PURO EFECTIVO, QUEMA SALDOS, 16 DISCOS Y LIQUIDACIÓN DÍA 1 ---');

  // 5.1 Arqueo Físico de Ventanilla: Efectivo Puro sin mezclar ventas web
  const ventaVentanillaEfectivo = venderAsientoTaquillaTricolorConRBAC({
    frecuencia: freqCongelada,
    rol: 'SECRETARIA',
    asientoNumero: 12,
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Pasajero Efectivo Ventanilla',
    telefonoWhatsApp: '+593 99 000 1111',
  });

  const arqueo = calcularArqueoFisicoVentanillaSeparado({
    frecuencias: [ventaVentanillaEfectivo.frecuenciaActualizada, freqActiva],
    encomiendasEfectivoUSD: 14.25,
  });

  qaAssert(
    'Módulo 5',
    'M5-UT-01',
    arqueo.ventaFisicaEfectivoUSD === 1.75 &&
      arqueo.encomiendasEfectivoUSD === 14.25 &&
      arqueo.totalEfectivoCajonUSD === 16.0 &&
      arqueo.afectacionEfectivoCajonPorWebUSD === 0 &&
      arqueo.totalVentasWebTransferenciaUSD > 0,
    'Arqueo de Ventanilla: ($1.75 Efectivo + $14.25 Encomiendas = $16.00 Cajón) con $0.00 de mezcla por transferencias web'
  );

  // 5.2 Quema atómica de Saldo a Favor (SALDO-XXXXXX), bloqueo de expirados y ventana de reversión de 3 minutos
  const saldosIniciales = crearSaldosAFavorIniciales();
  const instanteQuema = 1761800000000;

  await qaExpectThrow(
    'Módulo 5',
    'M5-UT-02',
    () =>
      quemarSaldoAFavorEnTaquillaAtomico({
        saldosActuales: saldosIniciales,
        saldoId: 'saf-01',
        pinSecretaria: '0000', // PIN incorrecto
      }),
    'PIN de secretaria inválido',
    'Bloquea quema de Saldo a Favor en ventanilla si el PIN de secretaria no es 1191'
  );

  await qaExpectThrow(
    'Módulo 5',
    'M5-UT-03',
    () =>
      quemarSaldoAFavorEnTaquillaAtomico({
        saldosActuales: saldosIniciales,
        saldoId: 'saf-03', // Saldo en estado EXPIRADO (>30 días)
        pinSecretaria: '1191',
      }),
    'SALDO EXPIRADO (30 Días)',
    'Bloquea quema en ventanilla de un Saldo a Favor que superó los 30 días de vigencia (EXPIRADO)'
  );

  const quemaOk = quemarSaldoAFavorEnTaquillaAtomico({
    saldosActuales: saldosIniciales,
    saldoId: 'saf-01',
    pinSecretaria: '1191',
    formaPagoMarcada: 'Saldo a Favor',
    ahoraTimestampMs: instanteQuema,
  });

  qaAssert(
    'Módulo 5',
    'M5-UT-04',
    quemaOk.saldoQuemado.estado === 'CONSUMIDO_EN_TAQUILLA' &&
      /^SALDO-\d{6}$/.test(quemaOk.codigoQuemaUnico) &&
      quemaOk.efectivoFisicoEntregadoUSD === 0 &&
      quemaOk.saldoQuemado.notificacionWhatsAppEnviada === true,
    'Quema atómica cambia estado a CONSUMIDO_EN_TAQUILLA, genera código SALDO-XXXXXX, entrega $0.00 efectivo y notifica WhatsApp'
  );

  // Doble quema bloqueada
  await qaExpectThrow(
    'Módulo 5',
    'M5-UT-05',
    () =>
      quemarSaldoAFavorEnTaquillaAtomico({
        saldosActuales: quemaOk.saldosActualizados,
        saldoId: 'saf-01',
        pinSecretaria: '1191',
      }),
    'ya fue quemado previamente',
    'Impide quemar por segunda vez un Saldo a Favor que ya está en estado CONSUMIDO_EN_TAQUILLA'
  );

  // Reversión en el límite exacto de 3 minutos (180,000 ms) vs 3 min + 1 ms
  await qaExpectThrow(
    'Módulo 5',
    'M5-UT-06',
    () =>
      revertirCanjeSaldoDentroDe3Minutos({
        saldosActuales: quemaOk.saldosActualizados,
        saldoId: 'saf-01',
        ahoraTimestampMs: instanteQuema + VENTANA_REVERSION_SALDO_MS + 1,
      }),
    'VENTANA DE AUXILIO EXPIRADA (> 3 minutos)',
    'Bloquea el botón [Revertir Canje (3 min)] en el milisegundo 180,001 (> 3 minutos)'
  );

  const reversionEnLimite = revertirCanjeSaldoDentroDe3Minutos({
    saldosActuales: quemaOk.saldosActualizados,
    saldoId: 'saf-01',
    ahoraTimestampMs: instanteQuema + VENTANA_REVERSION_SALDO_MS, // Exactamente a los 3:00 min
  });

  qaAssert(
    'Módulo 5',
    'M5-UT-07',
    reversionEnLimite.saldoRevertido.estado === 'ACTIVO' &&
      reversionEnLimite.saldoRevertido.codigoQuemaUnico === null,
    'Permite revertir el canje dentro de los 3 minutos exactos (<= 180,000 ms), restaurando el saldo a ACTIVO'
  );

  // 5.3 Producción Web por Disco (Disco 01 al Disco 16)
  const reporte16Discos = generarReporteProduccionPorDisco01a16([
    freqCongelada,
    freqActiva,
  ]);
  const tsv16Discos = exportarProduccionPorDiscoTSV(reporte16Discos);

  qaAssert(
    'Módulo 5',
    'M5-UT-08',
    reporte16Discos.length === 16 &&
      reporte16Discos[0].discoEtiqueta === 'Disco 01' &&
      reporte16Discos[15].discoEtiqueta === 'Disco 16' &&
      tsv16Discos.split('\n').length === 17,
    'Reporte de Producción consolida las 16 unidades (Disco 01 al Disco 16) con métricas mensuales, anuales y % ocupación 1-10'
  );

  // 5.4 Cuadre Bancario Exacto al Centavo y Liquidación Día 1 (00:05 AM)
  const cuadre = calcularCuadreConciliacionBancariaFondos({
    frecuencias: [freqCongelada, freqActiva],
    saldosCustodia: quemaOk.saldosActualizados,
  });

  qaAssert(
    'Módulo 5',
    'M5-UT-09',
    cuadre.cuadreAlCentavoVerificado &&
      cuadre.diferenciaCentavosUSD === 0 &&
      cuadre.totalBancoExtractoUSD ===
        Number(
          (
            cuadre.totalBoletosEmitidosUSD +
            cuadre.totalSaldosActivosUSD +
            cuadre.totalSaldosExpiradosUSD
          ).toFixed(2)
        ),
    'Cuadre Bancario al Centavo: Total Banco = Total Boletos Emitidos + Total Saldos Activos + Total Saldos Expirados'
  );

  const prefacturaDia1 = ejecutarCierreAutomaticoDia1Mes0005AM({
    frecuencias: [freqCongelada, freqActiva],
    saldosSinBoleto: saldosIniciales,
  });
  const prefacturaAprobada = aprobarLiquidacionDia1EnUnClic({
    prefactura: prefacturaDia1,
  });

  qaAssert(
    'Módulo 5',
    'M5-UT-10',
    prefacturaDia1.cronExpresion === '5 0 1 * *' &&
      prefacturaDia1.feeSobreTransferenciasIncompletasUSD === 0 &&
      prefacturaDia1.totalPrefacturaFeeUSD ===
        Number((prefacturaDia1.boletosConfirmadosAuditados * 0.25).toFixed(2)) &&
      prefacturaAprobada.estado === 'APROBADA_POR_GERENCIA',
    'Liquidación Día 1 (00:05 AM) multiplica solo boletos CONFIRMADO × $0.25 ($0.00 en saldos sin boleto) y aprueba en 1-clic'
  );

  // ==========================================================================
  // BLOQUE 6: MÓDULO 6 — CONFIGURACIÓN GLOBAL, TOGGLES Y CRON SQL 23:50 PM
  // ==========================================================================
  console.log('\n--- [BLOQUE 6] MÓDULO 6: CONSOLA DE CONFIGURACIÓN GLOBAL Y RESPALDO SQL (23:50 PM) ---');

  let configGlobal = crearConfiguracionGlobalInicial();

  // 6.1 Toggles [ON/OFF] en 1-clic y validaciones de CRUD bancario
  configGlobal = alternarToggleCanalCobroTiempoReal({
    configActual: configGlobal,
    canal: 'BANCO_DE_LOJA',
    activo: false,
  });

  await qaExpectThrow(
    'Módulo 6',
    'M6-UT-01',
    () =>
      guardarCuentaBancariaCRUD({
        configActual: configGlobal,
        cuentaEditadaOCreada: {
          id: 'cta-invalida',
          banco: 'BANCO_DE_LOJA',
          nombreMostrar: 'Cuenta Vacía',
          tipoCuenta: 'Cuenta Corriente',
          numeroCuenta: '   ', // Vacío
          rucTitular: '1191705482001',
          titularCuenta: 'Vilcabambaturis',
          habilitadaCheckout: true,
        },
      }),
    'obligatorios',
    'CRUD de Cuentas Bancarias rechaza guardar cuentas con número de cuenta, RUC o titular vacíos'
  );

  await qaExpectThrow(
    'Módulo 6',
    'M6-UT-02',
    () =>
      actualizarImagenQrOficialBanco({
        configActual: configGlobal,
        cuentaId: 'cta-bancaria-01',
        nuevaQrImagenUrl: '   ',
      }),
    'imagen QR válida',
    'Cargador de QR rechaza actualizar una cuenta bancaria con URL/URI de imagen vacía'
  );

  configGlobal = actualizarConfiguracionGlobalSoporteYBackup({
    configActual: configGlobal,
    whatsappSoporteCliente: '+593 99 555 1191',
    correoInstitucionalGerenciaSistemas: 'sistemas@vilcabambaturis.ec',
  });

  qaAssert(
    'Módulo 6',
    'M6-UT-03',
    configGlobal.bancoDeLojaActivo === false &&
      configGlobal.bancoPichinchaDeunaActivo === true &&
      configGlobal.whatsappSoporteCliente === '+593 99 555 1191' &&
      configGlobal.correoInstitucionalGerenciaSistemas ===
        'sistemas@vilcabambaturis.ec',
    'Toggles de canales de cobro en 1-clic y parámetros globales (WhatsApp / Email Backup) se actualizan en tiempo real'
  );

  // 6.2 Cron Job de Respaldo SQL Nocturno (23:50 PM — 50 23 * * *) protegido por CRON_SECRET
  const backupSinToken = await ejecutarRespaldoNocturnoSQL({
    authHeader: 'Bearer TOKEN_INTRUSO',
  });
  const backupConToken = await ejecutarRespaldoNocturnoSQL({
    authHeader: `Bearer ${CRON_SECRET_DEFAULT}`,
    emailOverride: configGlobal.correoInstitucionalGerenciaSistemas,
  });

  qaAssert(
    'Módulo 6',
    'M6-UT-04',
    backupSinToken.autorizado === false &&
      backupSinToken.statusHttp === 401 &&
      backupConToken.autorizado === true &&
      backupConToken.statusHttp === 200 &&
      backupConToken.registroLog?.cronExpresion === '50 23 * * *' &&
      backupConToken.registroLog?.correoDestinatario ===
        'sistemas@vilcabambaturis.ec' &&
      backupConToken.sqlDumpCompleto!.includes('BEGIN TRANSACTION;') &&
      backupConToken.sqlDumpCompleto!.includes('COMMIT;'),
    'Endpoint /api/v1/cron/backup-db (23:50 PM) bloquea peticiones sin CRON_SECRET (401) y despacha Dump SQL íntegro (200)'
  );

  console.log('\n============================================================================');
  console.log(
    `🏆 RESUMEN QA: ${resultadosQA.length}/${resultadosQA.length} PRUEBAS UNITARIAS Y LÓGICAS PASARON AL 100% (0 FALLOS)`
  );
  console.log('============================================================================');
}

ejecutarSuiteMaestraQA().catch((err) => {
  console.error('\n❌ FALLO CRÍTICO EN SUITE DE QA:', err);
  process.exit(1);
});
