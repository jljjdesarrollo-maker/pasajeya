/**
 * Suite de Pruebas Automatizada — Módulo 2 / Fase 2 Refactorizada:
 * Motor de Conciliación Bancaria en Tiempo Real (<1.2s), Pagos Multi-Banco (Banco de Loja,
 * Banco Pichincha, Deuna! QR), Política Estricta de "No Cambios / No Devoluciones",
 * Cero Cobro a Bordo y Notas de Crédito Digitales (`NotaCreditoSaldo`) con Caducidad a 30 Días Calendario.
 */

import { crearEstadoInicialFrecuencias } from '../src/services/pasajeyaEngine.ts';
import { procesarCheckoutYReconciliacionInteligente } from '../src/services/module1CheckoutEngine.ts';
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
} from '../src/services/module2PaymentsEngine.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FALLO MÓDULO 2: ${message}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${message}`);
}

async function runModule2ConciliacionTests() {
  console.log('================================================================');
  console.log('PASAJEYA SaaS — SUITE DE VALIDACIÓN MÓDULO 2 (PAGOS Y SALDOS 30D)');
  console.log('Cliente Piloto: Vilcabambaturis Cía. Ltda. (RUC 1191705482001)');
  console.log('================================================================\n');

  reiniciarRegistroIdempotenciaBancaria();

  // 1. Canales Bancarios Habilitados, Interfaz Doble (Cuenta 1-Clic + QR) y Casilla T&C Obligatoria
  console.log('--- [1/6] Canales Bancarios (Loja / Pichincha / Deuna QR) y T&C ---');
  assert(
    CANALES_BANCARIOS_OFICIALES.BANCO_DE_LOJA.comisionPasarelaUSD === 0 &&
      CANALES_BANCARIOS_OFICIALES.BANCO_PICHINCHA.comisionPasarelaUSD === 0 &&
      CANALES_BANCARIOS_OFICIALES.DEUNA_PICHINCHA.comisionPasarelaUSD === 0 &&
      CANALES_BANCARIOS_OFICIALES.BANCO_DE_LOJA.rucTitular === '1191705482001' &&
      CANALES_BANCARIOS_OFICIALES.DEUNA_PICHINCHA.qrPayloadOficial.includes('DEUNA_QR'),
    'Canales Banco de Loja y Banco Pichincha / Deuna! habilitados con 0% comisión, copiado 1-clic y QR en pantalla'
  );

  const checkTerminosNoMarcados = validarAceptacionTerminosModulo2(false);
  const checkTerminosMarcados = validarAceptacionTerminosModulo2(true);
  assert(
    checkTerminosNoMarcados.valido === false &&
      checkTerminosMarcados.valido === true,
    'Exige casilla obligatoria de Términos y Condiciones ("No Cambios/No Devoluciones" + caducidad de saldos a 30 días)'
  );

  const frecuencias = crearEstadoInicialFrecuencias();
  const freqActiva = frecuencias[1]; // Loja -> Yangana ($2.50)

  let bloqueoSinTerminos = false;
  try {
    procesarCheckoutYReconciliacionInteligente({
      frecuencia: freqActiva,
      asientosSeleccionados: [5],
      cedulaRuc: '1104680135',
      pasajeroNombre: 'Viajero Sin Terminos',
      telefonoWhatsApp: '+593 99 000 1111',
      paradaAbordajeLoja: 'Sueño Eterno',
      destinoFinal: 'Yangana',
      banco: 'DEUNA_PICHINCHA',
      referenciaBancaria: 'DEUNA-001',
      montoTransferidoUSD: 2.75,
      aceptoTerminosModulo2: false,
    });
  } catch {
    bloqueoSinTerminos = true;
  }
  assert(
    bloqueoSinTerminos === true,
    'El motor de checkout rechaza la transacción si el usuario no acepta la casilla de Términos y Condiciones'
  );

  // 2. Conciliación Automática en Tiempo Real (< 1.2s): Gmail API + Pub/Sub, Regex + Fallback Gemini NLP
  console.log('\n--- [2/6] Conciliación en Tiempo Real (<1.2s): Regex + Gemini NLP ---');
  const correoBancoLojaRegex = {
    remitente: 'notificaciones@bancodeloja.fin.ec',
    asunto: 'Transferencia Acreditada Banco de Loja',
    cuerpoTexto:
      'Estimado cliente VILCABAMBATURIS CIA LTDA, se ha acreditado una transferencia por USD 2.75 con Comprobante: BL-90011223 el 2026-10-29 10:14:00.',
  };

  const conciliacion1 = ConciliarWebhookBancarioIdempotente({
    correo: correoBancoLojaRegex,
  });

  assert(
    conciliacion1.conciliado === true &&
      conciliacion1.datosExtraidos.metodoExtraccion === 'REGEX_DETERMINISTA' &&
      conciliacion1.datosExtraidos.montoUSD === 2.75 &&
      conciliacion1.datosExtraidos.referenciaBanco === 'BL-90011223' &&
      conciliacion1.datosExtraidos.latenciaMs < SLA_CONCILIACION_MAX_MS,
    `Conciliación instantánea por Regex en ${conciliacion1.datosExtraidos.latenciaMs}ms (< ${SLA_CONCILIACION_MAX_MS}ms SLA)`
  );

  // Fallback Gemini NLP para texto no estructurado
  const correoDeunaNoEstructurado = {
    remitente: 'alertas@deuna.pichincha.com',
    asunto: 'Recibiste un pago con QR Deuna!',
    cuerpoTexto:
      'Hola Vilcabambaturis, te enviaron 4.00 dolares desde la billetera móvil. Código de operación DN99887766.',
  };

  const parseoFallback = parsearCorreoNotificacionBancaria(
    correoDeunaNoEstructurado
  );
  assert(
    parseoFallback.exito === true &&
      parseoFallback.metodoExtraccion === 'GEMINI_NLP_FALLBACK' &&
      parseoFallback.bancoDetectado === 'DEUNA_PICHINCHA' &&
      parseoFallback.montoUSD === 4.0 &&
      parseoFallback.referenciaBanco === 'DN99887766' &&
      parseoFallback.latenciaMs < SLA_CONCILIACION_MAX_MS,
    `Fallback Gemini NLP extrae monto ($4.00) y referencia (DN99887766) en ${parseoFallback.latenciaMs}ms (< 1.2s)`
  );

  // 3. Control Antiduplicados: Clave Única Compuesta [tenantId, referenciaBanco]
  console.log('\n--- [3/6] Control Antiduplicados: Clave Compuesta [tenantId, referenciaBanco] ---');
  let duplicadoBloqueado = false;
  try {
    ConciliarWebhookBancarioIdempotente({
      correo: correoBancoLojaRegex, // Mismo comprobante BL-90011223 para el mismo tenant
    });
  } catch (err: any) {
    duplicadoBloqueado = err.message.includes('IDEMPOTENCIA ESTRICTA');
  }
  assert(
    duplicadoBloqueado === true,
    'Clave única compuesta [tenantId, referenciaBanco] impide doble acreditación del mismo comprobante bancario'
  );

  // 4. Política de No Cambios / No Devoluciones, Cero Cobro a Bordo y Retención por Pago Incompleto
  console.log('\n--- [4/6] Política No Cambios / No Devoluciones y Cero Cobro a Bordo ---');
  const boletoConfirmado = freqActiva.boletos[0];
  const intentoCambio = solicitarCambioODevolucionBoleto({
    boleto: boletoConfirmado,
    tipoSolicitud: 'CAMBIO_FECHA_HORA',
  });
  const intentoDevolucion = solicitarCambioODevolucionBoleto({
    boleto: boletoConfirmado,
    tipoSolicitud: 'DEVOLUCION_DINERO',
  });

  assert(
    intentoCambio.autorizado === false &&
      intentoDevolucion.autorizado === false &&
      intentoDevolucion.codigoPolitica === 'POLITICA_NO_CAMBIOS_NO_DEVOLUCIONES',
    'Una vez emitido el pase QR, bloquea estrictamente cambios de fecha/hora/asiento y devoluciones de dinero'
  );

  const checkManifiestoLimpio = verificarManifiesto100PorCientoLimpio(freqActiva);
  assert(
    checkManifiestoLimpio.manifiestoLimpio === true &&
      checkManifiestoLimpio.cobroABordoPermitido === false,
    'Cero Cobro a Bordo: el ayudante solo recibe pasajeros con boleto 100% pagado e impreso en el manifiesto'
  );

  const pagoIncompleto = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqActiva,
    asientosSeleccionados: [6],
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Viajero Abono Parcial',
    telefonoWhatsApp: '+593 99 222 3333',
    paradaAbordajeLoja: 'La Tebaida',
    destinoFinal: 'Yangana',
    banco: 'BANCO_DE_LOJA',
    referenciaBancaria: 'BL-INCOMP-66',
    montoTransferidoUSD: 2.0, // Faltan $0.75 para llegar a $2.75 ($2.50 + $0.25)
  });

  assert(
    pagoIncompleto.exitoEmision === false &&
      pagoIncompleto.tipoResolucion === 'RETENIDO_PAGO_INCOMPLETO' &&
      pagoIncompleto.saldoFaltanteUSD === 0.75 &&
      pagoIncompleto.feeTecnologicoCobradoTotalUSD === 0.0,
    'Retención por Pago Incompleto: no emite boleto hasta completar el saldo antes de T-20m y NO cobra el fee de $0.25'
  );

  // 5. Saldos a Favor (`NotaCreditoSaldo`), Regla de $0.00 Fee y Caducidad a 30 Días Calendario
  console.log('\n--- [5/6] Saldos a Favor (`NotaCreditoSaldo`), $0.00 Fee y Caducidad a 30 Días ---');
  const pagoExtemporaneoPostT20 = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqActiva,
    asientosSeleccionados: [7],
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Rosa Elvira Burneo',
    telefonoWhatsApp: '+593 99 418 2290',
    paradaAbordajeLoja: 'Terminal Reina del Cisne (Andén Principal)',
    destinoFinal: 'Yangana',
    banco: 'DEUNA_PICHINCHA',
    referenciaBancaria: 'DEUNA-POST-77',
    montoTransferidoUSD: 2.75,
    pagoIngresadoDespuesDeT20: true,
  });

  const notaGenerada = pagoExtemporaneoPostT20.notaCreditoGenerada!;
  const diasVigenciaCalculados = Math.round(
    (new Date(notaGenerada.fechaExpiracion).getTime() -
      new Date(notaGenerada.fechaEmision).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  assert(
    pagoExtemporaneoPostT20.exitoEmision === false &&
      pagoExtemporaneoPostT20.tipoResolucion === 'SALDO_A_FAVOR_POST_T20' &&
      Boolean(notaGenerada) &&
      notaGenerada.estado === 'ACTIVE' &&
      notaGenerada.saldoDisponibleUSD === 2.75 &&
      notaGenerada.feeTecnologicoCobradoUSD === 0.0 &&
      diasVigenciaCalculados === CADUCIDAD_SALDO_FAVOR_DIAS,
    `Crea NotaCreditoSaldo (${notaGenerada.codigoNotaCredito}) con vigencia exacta de ${diasVigenciaCalculados} días calendario y $0.00 de fee cobrado`
  );

  // Simular paso de 31 días calendario -> Debe marcarse como EXPIRED (gastos administrativos)
  const fecha31DiasDespues = new Date(
    new Date(notaGenerada.fechaEmision).getTime() + 31 * 24 * 60 * 60 * 1000
  );
  const evaluacionCaducidad = verificarYExpirarSaldosVencidos(
    [notaGenerada],
    fecha31DiasDespues
  );

  assert(
    evaluacionCaducidad.expiradasCount === 1 &&
      evaluacionCaducidad.notasActualizadas[0].estado === 'EXPIRED' &&
      evaluacionCaducidad.montoImputadoGastosAdministrativosUSD === 2.75,
    'Al superar los 30 días calendario sin utilizarse, el sistema marca automáticamente el Saldo a Favor como EXPIRED (gastos administrativos)'
  );

  // 6. Protección de Caja en Ventanilla (0 Efectivo en Taquilla) y Canje con Forma de Pago `SALDO_A_FAVOR`
  console.log('\n--- [6/6] Protección de Caja en Ventanilla (0 Efectivo) y Canje SALDO_A_FAVOR ---');
  const intentoEfectivo = intentarReembolsoEfectivoEnVentanilla(notaGenerada);
  assert(
    intentoEfectivo.permitido === false &&
      intentoEfectivo.motivoProhibicion.includes('0 EFECTIVO'),
    'La secretaria tiene estrictamente bloqueado entregar dinero en efectivo en ventanilla por un Saldo a Favor'
  );

  const notaVigenteParaCanje = crearNotaCreditoSaldoAFavor({
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Rosa Elvira Burneo',
    telefonoWhatsApp: '+593 99 418 2290',
    bancoOrigen: 'BANCO_DE_LOJA',
    referenciaBancoOrigen: 'BL-CANJE-99',
    montoTransferidoUSD: 2.5,
    motivoOrigen: 'PAGO_POST_T20_MIN',
  });

  const freqCongeladaTaquilla = frecuencias[0]; // Frecuencia en T-18m con asientos liberados a DISPONIBLE_VENTANILLA (tarifa $1.75)
  const canjeVentanilla = emitirBoletoTaquillaConSaldoAFavor({
    frecuencia: freqCongeladaTaquilla,
    asientoNumero: 4, // Asiento libre en ventanilla
    notaCredito: notaVigenteParaCanje,
  });

  assert(
    canjeVentanilla.boletoEmitido.banco === 'SALDO_A_FAVOR' &&
      canjeVentanilla.boletoEmitido.canalVenta === 'TAQUILLA' &&
      canjeVentanilla.notaCreditoActualizada.estado === 'USED' &&
      canjeVentanilla.afectoCajaChicaEfectivoUSD === 0,
    'En ventanilla, la secretaria emite pasaje físico con forma de pago SALDO_A_FAVOR sin alterar su caja chica ($0.00 efectivo)'
  );

  console.log('\n================================================================');
  console.log(
    '🎉 TODAS LAS PRUEBAS DEL MÓDULO 2 (CONCILIACIÓN Y SALDOS 30D) PASARON AL 100%'
  );
  console.log('================================================================');
}

runModule2ConciliacionTests().catch((err) => {
  console.error('Error inesperado en suite de pruebas Módulo 2:', err);
  process.exit(1);
});
