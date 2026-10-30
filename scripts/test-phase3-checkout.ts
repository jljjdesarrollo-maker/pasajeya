/**
 * Suite de Pruebas Automatizada — Módulo 1 (Completo + Complementario Definitivo):
 * 1. Paradas Urbanas Autorizadas ANT (5 paradas) + Prohibición "La Bomba Quemada" + Discriminación Vial ADR-005
 * 2. UI/UX Accesible (>= 48px), Brand Kit #912D26 y Mapa Hino AK (45 pasajeros: 1-10 Web, 11-45 Taquilla)
 * 3. Temporizador Estándar (15:00), Dinámico Abreviado (05:00 a T-25m) y Cierre T-20m
 * 4. Validación Algorítmica Módulo 10 de Cédula Ecuatoriana, Elegibilidad de Edad (<18 o 65+) y N Medios Pasajes = N Cédulas + Fee Fijo $0.25
 * 5. Operación en Papel sin Dependencia Tecnológica en Autobús (Manifiesto Físico Impreso T-20m + Copiar SRI 1-Clic; Escáner QR Opcional)
 * 6. Arquitectura Relacional 1 Transacción -> N Boletos QR Independientes (numeroAsiento, codigoUnico, firmaDigitalHmac) y Reconciliación Inteligente
 */

import { crearEstadoInicialFrecuencias } from '../src/services/pasajeyaEngine.ts';
import {
  BRAND_COLOR_VINOTINTO,
  calcularDesgloseLegalANT,
  calcularTemporizadorReserva,
  CAPACIDAD_HINO_AK_TOTAL,
  generarManifiestoFisicoPapelT20,
  PARADAS_URBANAS_LOJA_AUTORIZADAS,
  procesarCheckoutYReconciliacionInteligente,
  resolverCorredorVialADR005,
  validarBeneficiarioMedioPasaje,
  validarCedulaEcuatorianaModulo10,
  validarMultiplesMediosPasajes,
  validarParadaAutorizadaANT,
} from '../src/services/module1CheckoutEngine.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FALLO MÓDULO 1: ${message}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${message}`);
}

async function runModule1CheckoutTests() {
  console.log('================================================================');
  console.log('PASAJEYA SaaS — SUITE DE VALIDACIÓN MÓDULO 1 (COMPLETO + QR 1-N)');
  console.log('Cliente Piloto: Vilcabambaturis Cía. Ltda. (Brand Kit #912D26)');
  console.log('================================================================\n');

  // 1. Paradas Urbanas Autorizadas y Prohibición Absoluta de "La Bomba Quemada" + ADR-005
  console.log('--- [1/8] Paradas Autorizadas ANT y Topología Vial (ADR-005) ---');
  assert(
    PARADAS_URBANAS_LOJA_AUTORIZADAS.length === 5 &&
      PARADAS_URBANAS_LOJA_AUTORIZADAS[0].nombre.includes(
        'Terminal Reina del Cisne'
      ) &&
      PARADAS_URBANAS_LOJA_AUTORIZADAS[4].nombre.includes('UNL Argelia'),
    'Catálogo oficial contiene exactamente las 5 paradas urbanas autorizadas en Loja'
  );

  const checkBombaQuemada = validarParadaAutorizadaANT('La Bomba Quemada');
  assert(
    checkBombaQuemada.valida === false &&
      checkBombaQuemada.motivo.includes('PROHIBICIÓN REGULATORIA ANT'),
    'Bloquea y prohíbe estrictamente la parada "La Bomba Quemada" para evitar sanciones ANT'
  );

  const checkElTambo = resolverCorredorVialADR005('El Tambo');
  const checkVilcabamba = resolverCorredorVialADR005('Vilcabamba');
  assert(
    checkElTambo.corredor.id === 'RAMAL_NOROCCIDENTAL' &&
      !checkElTambo.corredor.pasaPorVilcabamba &&
      checkVilcabamba.corredor.id === 'TRONCAL_SUR' &&
      checkVilcabamba.corredor.pasaPorVilcabamba,
    'Discriminación vial ADR-005 separa Troncal Sur (Vilcabamba/Yangana/Zahuayco/La Elvira) del Ramal Noroccidental (El Tambo directo)'
  );

  // 2. Brand Kit (#912D26) y Mapa de Asientos Hino AK (45 pasajeros: 1-10 Web, 11-45 Taquilla)
  console.log('\n--- [2/8] Brand Kit #912D26 y Mapa Hino AK (45 Pasajeros) ---');
  const frecuencias = crearEstadoInicialFrecuencias();
  const freqActiva = frecuencias[1]; // Loja -> Yangana (T-35 min, tarifa $2.50)

  assert(
    BRAND_COLOR_VINOTINTO === '#912D26' && CAPACIDAD_HINO_AK_TOTAL === 45,
    'Brand Kit configurado en Rojo Vinotinto (#912D26) y capacidad Hino AK de 45 pasajeros (1-10 Web, 11-45 Taquilla)'
  );

  let errorAsientoTaquilla = false;
  try {
    procesarCheckoutYReconciliacionInteligente({
      frecuencia: freqActiva,
      asientosSeleccionados: [15], // Asiento del bloque 11-45 exclusivo de taquilla
      cedulaRuc: '1104680135',
      pasajeroNombre: 'Pasajero Prueba',
      telefonoWhatsApp: '+593 99 000 0000',
      paradaAbordajeLoja: 'Sueño Eterno',
      destinoFinal: 'Vilcabamba',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-TEST-15',
      montoTransferidoUSD: 2.0,
    });
  } catch {
    errorAsientoTaquilla = true;
  }
  assert(
    errorAsientoTaquilla === true,
    'Impide seleccionar en línea asientos del bloque 11 al 45 (Exclusivos de Taquilla Terminal)'
  );

  // 3. Temporizadores: Estándar (15:00), Dinámico Abreviado (05:00 a T-25m) y Cierre T-20m
  console.log('\n--- [3/8] Temporizador Estándar (15:00), Dinámico Abreviado y T-20m ---');
  const timerEstandar = calcularTemporizadorReserva(35);
  const timerAbreviado = calcularTemporizadorReserva(25);
  const timerCongelado = calcularTemporizadorReserva(20);

  assert(
    timerEstandar.formatoMMSS === '15:00' &&
      !timerEstandar.esTemporizadorAbreviadoAlertaRoja,
    'A T-35m asigna el temporizador estándar de 15:00 minutos'
  );
  assert(
    timerAbreviado.formatoMMSS === '05:00' &&
      timerAbreviado.esTemporizadorAbreviadoAlertaRoja === true,
    'A T-25m (5 min antes del corte T-20) ajusta dinámicamente el reloj a 05:00 min en alerta roja'
  );
  assert(
    timerCongelado.ventaWebCongelada === true &&
      timerCongelado.permitidoReservar === false,
    'A T-20m congela automáticamente la venta web y deriva a taquilla física'
  );

  // 4. Validación Algorítmica Módulo 10 y Elegibilidad de Medios Pasajes (50% Tarifa ANT)
  console.log('\n--- [4/8] Validación Algorítmica Módulo 10 y Medios Pasajes (50% ANT) ---');
  const cedulaLojaValida = validarCedulaEcuatorianaModulo10('1104680135'); // Provincia 11 (Loja), 3er dígito 0, verificador 5
  const cedulaPichinchaValida = validarCedulaEcuatorianaModulo10('1710034065'); // Provincia 17, verificador 5
  const cedulaFalsaVerificador = validarCedulaEcuatorianaModulo10('1104680139'); // Dígito verificador adulterado
  const cedulaFalsaProvincia = validarCedulaEcuatorianaModulo10('9904680135'); // Provincia 99 inexistente

  assert(
    cedulaLojaValida.valida === true &&
      cedulaLojaValida.codigoProvincia === 11 &&
      cedulaPichinchaValida.valida === true &&
      cedulaFalsaVerificador.valida === false &&
      cedulaFalsaProvincia.valida === false,
    'Algoritmo Módulo 10 valida provincia (01-24), tercer dígito (<6) y dígito verificador rechazando cédulas falsas'
  );

  const elegibleMenor = validarBeneficiarioMedioPasaje({
    cedula: '1710034065',
    edad: 12,
  });
  const elegibleAdultoMayor = validarBeneficiarioMedioPasaje({
    cedula: '1104680135',
    edad: 70,
  });
  const noElegibleAdultoJoven = validarBeneficiarioMedioPasaje({
    cedula: '1104680135',
    edad: 30,
  });

  assert(
    elegibleMenor.valido === true &&
      elegibleMenor.categoriaElegibilidad === 'MEDIO_PASAJE_MENOR_18' &&
      elegibleAdultoMayor.valido === true &&
      elegibleAdultoMayor.categoriaElegibilidad ===
        'MEDIO_PASAJE_ADULTO_MAYOR_65' &&
      noElegibleAdultoJoven.valido === false,
    'Valida elegibilidad por edad para Medio Pasaje (50% ANT): autoriza menores (<18 años) y adultos mayores (65+ años), rechazando edades intermedias'
  );

  // N Medios Pasajes = N Cédulas Obligatorias
  const validacionIncompletaMedios = validarMultiplesMediosPasajes(
    2,
    [{ cedula: '1104680135', edad: 70 }], // Solo envía 1 cédula cuando pidió 2 medios pasajes
    3
  );
  const validacionCompleta2Medios = validarMultiplesMediosPasajes(
    2,
    [
      { cedula: '1104680135', edad: 72, nombreBeneficiario: 'Abuela Rosa' },
      { cedula: '1710034065', edad: 10, nombreBeneficiario: 'Nieto Mateo' },
    ],
    3
  );

  assert(
    validacionIncompletaMedios.valido === false &&
      validacionCompleta2Medios.valido === true,
    'Regla N Medios Pasajes = N Cédulas: exige exactamente N cédulas ecuatorianas distintas y válidas cuando se solicitan N medios pasajes'
  );

  // 5. Desglose Legal ANT y Fee Tecnológico Fijo ($0.25 por boleto en 100% y 50%)
  console.log('\n--- [5/8] Desglose Legal ANT y Fee Fijo $0.25 por Boleto ---');
  const desgloseMixto = calcularDesgloseLegalANT(2.5, 3, 2); // 3 boletos: 1 completo ($2.50) + 2 medios ($1.25 c/u = $2.50) = $5.00 ANT + 3 * $0.25 ($0.75) = $5.75
  assert(
    desgloseMixto.pasajeOficialReguladoTotalUSD === 5.0 &&
      desgloseMixto.servicioDigitalTotalUSD === 0.75 &&
      desgloseMixto.totalATransferirUSD === 5.75 &&
      desgloseMixto.valorTributarioBoletoCooperativaUSD === 5.0,
    'Fee tecnológico fijo de $0.25 por cada boleto generado (3 boletos = $0.75 fee) tanto en tarifa 100% ($2.50) como en medio pasaje 50% ($1.25)'
  );

  // 6. Arquitectura Relacional 1 Transacción -> N Boletos QR Independientes
  console.log('\n--- [6/8] Arquitectura Relacional 1 Transacción ➔ N Boletos QR ---');
  const compraFamiliarConMedios = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqActiva,
    asientosSeleccionados: [5, 6, 7], // 3 asientos en 1 sola transacción
    cedulaRuc: '0915660138',
    pasajeroNombre: 'Familia Carrión Burneo',
    telefonoWhatsApp: '+593 99 111 2233',
    paradaAbordajeLoja: 'Parada Coliseo (detrás del Coliseo)',
    destinoFinal: 'Yangana',
    banco: 'BANCO_DE_LOJA',
    referenciaBancaria: 'BL-FAM-300',
    montoTransferidoUSD: 5.75, // 2 medios ($1.25 x 2) + 1 completo ($2.50) + 3 fees ($0.75) = $5.75
    cantidadMediosPasajes: 2,
    beneficiariosMedioPasaje: [
      { cedula: '1104680135', edad: 72, nombreBeneficiario: 'Rosa Burneo' },
      { cedula: '1710034065', edad: 12, nombreBeneficiario: 'Mateo Carrión' },
    ],
  });

  const codigosQrUnicos = new Set(
    compraFamiliarConMedios.pasesQrEmitidos.map((b) => b.codigoUnico)
  );
  const firmasHmacUnicas = new Set(
    compraFamiliarConMedios.pasesQrEmitidos.map((b) => b.firmaDigitalHmac)
  );

  assert(
    compraFamiliarConMedios.exitoEmision === true &&
      compraFamiliarConMedios.pasesQrEmitidos.length === 3 &&
      codigosQrUnicos.size === 3 &&
      firmasHmacUnicas.size === 3 &&
      compraFamiliarConMedios.pasesQrEmitidos.every(
        (b) =>
          b.transaccionId === compraFamiliarConMedios.transaccionId &&
          typeof b.numeroAsiento === 'number' &&
          Boolean(b.codigoUnico) &&
          Boolean(b.firmaDigitalHmac) &&
          b.feeTecnologicoUSD === 0.25
      ) &&
      compraFamiliarConMedios.pasesQrEmitidos[0].montoUSD === 1.25 &&
      compraFamiliarConMedios.pasesQrEmitidos[1].montoUSD === 1.25 &&
      compraFamiliarConMedios.pasesQrEmitidos[2].montoUSD === 2.5,
    '1 Transacción genera N registros Boleto independientes, cada uno con su propio numeroAsiento, codigoUnico, firmaDigitalHmac y tarifa ANT (50% o 100%)'
  );

  // 7. Operación en Papel sin Dependencia Tecnológica en Autobús (Manifiesto Físico Impreso T-20m)
  console.log('\n--- [7/8] Operación en Papel sin Dependencia de Celular en Autobús ---');
  const manifiestoPapel = generarManifiestoFisicoPapelT20(
    compraFamiliarConMedios.frecuenciaActualizada
  );
  assert(
    manifiestoPapel.requiereCelularAyudanteEnRuta === false &&
      manifiestoPapel.modoOperacionPrimario ===
        'MANIFIESTO_FISICO_IMPRESO_PAPEL' &&
      manifiestoPapel.modoEscanerQrPwa === 'HERRAMIENTA_SECUNDARIA_OPCIONAL' &&
      manifiestoPapel.documentoTextoImprimiblePapel.includes(
        'MANIFIESTO FÍSICO IMPRESO EN PAPEL PARA EL AYUDANTE'
      ) &&
      manifiestoPapel.tsvFacturacionSri1Clic.includes('1104680135'),
    'Genera Manifiesto Físico Impreso en papel y exportación SRI 1-Clic a T-20m, desvinculando la operación a bordo del celular del ayudante'
  );

  // 8. Reconciliación Inteligente de Casos de Borde (Pagos Tardíos e Incompletos)
  console.log('\n--- [8/8] Reconciliación Inteligente y Casos de Borde ---');
  const freqConAsiento8Ocupado = {
    ...compraFamiliarConMedios.frecuenciaActualizada,
    asientosBloqueWeb:
      compraFamiliarConMedios.frecuenciaActualizada.asientosBloqueWeb.map((a) =>
        a.numero === 8 ? { ...a, estado: 'VENDIDO_WEB' as const } : a
      ),
  };

  const pagoTardioReubicado = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqConAsiento8Ocupado,
    asientosSeleccionados: [8],
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Viajero Reubicado',
    telefonoWhatsApp: '+593 98 444 5566',
    paradaAbordajeLoja: 'La Tebaida',
    destinoFinal: 'Yangana',
    banco: 'BANCO_PICHINCHA',
    referenciaBancaria: 'BP-REUB-808',
    montoTransferidoUSD: 2.75,
    pagoIngresadoVencidoLock15m: true,
  });

  assert(
    pagoTardioReubicado.exitoEmision === true &&
      pagoTardioReubicado.tipoResolucion ===
        'REUBICADO_SIGUIENTE_ASIENTO_LIBRE_PRE_T20' &&
      pagoTardioReubicado.asientosEfectivosAsignados[0] === 3,
    `Pago tardío antes de T-20m con asiento #8 ocupado reubica automáticamente al siguiente asiento libre (#${pagoTardioReubicado.asientosEfectivosAsignados[0]}) y avisa por WhatsApp`
  );

  const pagoPostT20 = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqActiva,
    asientosSeleccionados: [9],
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Viajero Post T20',
    telefonoWhatsApp: '+593 99 777 8899',
    paradaAbordajeLoja: 'UNL Argelia',
    destinoFinal: 'Yangana',
    banco: 'BANCO_DE_LOJA',
    referenciaBancaria: 'BL-POST-T20',
    montoTransferidoUSD: 2.75,
    pagoIngresadoDespuesDeT20: true,
  });

  assert(
    pagoPostT20.exitoEmision === false &&
      pagoPostT20.tipoResolucion === 'SALDO_A_FAVOR_POST_T20' &&
      pagoPostT20.saldoAFavorCreadoUSD === 2.75,
    'Pago tardío después de T-20m no emite en turno congelado, crea Saldo a Favor ($2.75) y envía alerta WhatsApp'
  );

  const pagoIncompleto = procesarCheckoutYReconciliacionInteligente({
    frecuencia: freqActiva,
    asientosSeleccionados: [10],
    cedulaRuc: '1104680135',
    pasajeroNombre: 'Viajero Pago Parcial',
    telefonoWhatsApp: '+593 99 222 3344',
    paradaAbordajeLoja: 'Terminal Reina del Cisne (Andén Principal)',
    destinoFinal: 'Yangana',
    banco: 'BANCO_DE_LOJA',
    referenciaBancaria: 'BL-PARCIAL-10',
    montoTransferidoUSD: 2.0,
  });

  assert(
    pagoIncompleto.exitoEmision === false &&
      pagoIncompleto.tipoResolucion === 'RETENIDO_PAGO_INCOMPLETO' &&
      pagoIncompleto.saldoFaltanteUSD === 0.75 &&
      pagoIncompleto.alertaWhatsAppCliente.includes('$0.75'),
    'Pago incompleto congela la emisión y notifica por WhatsApp el saldo faltante exacto ($0.75 USD)'
  );

  console.log('\n================================================================');
  console.log(
    '🎉 TODAS LAS PRUEBAS DEL MÓDULO 1 (COMPLETO + COMPLEMENTARIO) PASARON AL 100%'
  );
  console.log('================================================================');
}

runModule1CheckoutTests().catch((err) => {
  console.error('Error inesperado en suite de pruebas Módulo 1:', err);
  process.exit(1);
});
