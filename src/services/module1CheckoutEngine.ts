/**
 * PasajeYa — Motor del Módulo 1 (Completo + Complementario Definitivo):
 * - Interfaz Pública de Compra (Mobile-First, controles >= 48px, Brand Kit #912D26)
 * - Topología Vial (ADR-005) y 5 Paradas Urbanas Autorizadas ANT (Prohibición "La Bomba Quemada")
 * - Validación Algorítmica Módulo 10 de Cédula Ecuatoriana y Elegibilidad de Medios Pasajes (50% ANT: <18 o 65+ años)
 * - Temporizador Estándar (15:00), Temporizador Dinámico Abreviado y Cierre T-20 min
 * - Arquitectura Relacional 1 Transacción -> N Boletos QR Independientes (numeroAsiento, codigoUnico, firmaDigitalHmac)
 * - Operación en Papel sin Dependencia Tecnológica en Autobús (Manifiesto Físico Impreso T-20m + Copiar SRI 1-Clic; Escáner QR Opcional)
 */

import {
  BoletoEmitido,
  FrecuenciaRuta,
  NotaCreditoSaldoRecord,
} from '../types/pasajeya';
import {
  formatearTextoCopiadoSRI,
  generarFirmaHmacQR,
} from './pasajeyaEngine';
import {
  crearNotaCreditoSaldoAFavor,
  validarAceptacionTerminosModulo2,
} from './module2PaymentsEngine';

export const BRAND_COLOR_VINOTINTO = '#912D26';
export const SERVICIO_DIGITAL_QR_USD = 0.25;
export const CAPACIDAD_HINO_AK_TOTAL = 45;
export const BLOQUE_WEB_MAX_ASIENTO = 10;

/**
 * Paradas prohibidas por la Agencia Nacional de Tránsito (ANT)
 */
export const PARADAS_PROHIBIDAS_ANT = ['La Bomba Quemada', 'Bomba Quemada'];

/**
 * Catálogo Oficial Inmutable de Paradas Urbanas Autorizadas en Loja (5 paradas)
 */
export interface ParadaUrbanaLoja {
  id: string;
  orden: number;
  nombre: string;
  referencia: string;
  autorizadaANT: true;
}

export const PARADAS_URBANAS_LOJA_AUTORIZADAS: ParadaUrbanaLoja[] = [
  {
    id: 'parada-loja-01',
    orden: 1,
    nombre: 'Terminal Reina del Cisne (Andén Principal)',
    referencia: 'Andén Oficial Cooperativa Vilcabambaturis',
    autorizadaANT: true,
  },
  {
    id: 'parada-loja-02',
    orden: 2,
    nombre: 'Sueño Eterno',
    referencia: 'Av. Isidro Ayora — Paso Urbano Autorizado',
    autorizadaANT: true,
  },
  {
    id: 'parada-loja-03',
    orden: 3,
    nombre: 'Parada Coliseo (detrás del Coliseo)',
    referencia: 'Calle posterior Coliseo Ciudad de Loja',
    autorizadaANT: true,
  },
  {
    id: 'parada-loja-04',
    orden: 4,
    nombre: 'La Tebaida',
    referencia: 'Sector Sur-Occidental La Tebaida',
    autorizadaANT: true,
  },
  {
    id: 'parada-loja-05',
    orden: 5,
    nombre: 'UNL Argelia',
    referencia: 'Universidad Nacional de Loja — Salida Sur',
    autorizadaANT: true,
  },
];

/**
 * Discriminación Vial (ADR-005):
 * - TRONCAL_SUR: Loja ⇄ Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira
 * - RAMAL_NOROCCIDENTAL: Loja ⇄ Malacatos ⇄ El Tambo directo (SIN pasar por Vilcabamba)
 */
export type CorredorVialADR005 = 'TRONCAL_SUR' | 'RAMAL_NOROCCIDENTAL';

export interface DefinicionCorredorVial {
  id: CorredorVialADR005;
  nombre: string;
  descripcion: string;
  nodosOrdenados: string[];
  pasaPorVilcabamba: boolean;
}

export const CORREDORES_VIALES_ADR005: Record<
  CorredorVialADR005,
  DefinicionCorredorVial
> = {
  TRONCAL_SUR: {
    id: 'TRONCAL_SUR',
    nombre: 'Troncal Sur (Valle Sagrado)',
    descripcion:
      'Loja ⇄ Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira',
    nodosOrdenados: [
      'Loja',
      'Malacatos',
      'Vilcabamba',
      'Yangana',
      'Zahuayco',
      'La Elvira',
    ],
    pasaPorVilcabamba: true,
  },
  RAMAL_NOROCCIDENTAL: {
    id: 'RAMAL_NOROCCIDENTAL',
    nombre: 'Ramal Noroccidental (Directo El Tambo)',
    descripcion:
      'Loja ⇄ Malacatos ⇄ El Tambo directo (sin pasar por Vilcabamba)',
    nodosOrdenados: ['Loja', 'Malacatos', 'El Tambo'],
    pasaPorVilcabamba: false,
  },
};

/**
 * Valida que una parada urbana de Loja esté dentro del catálogo autorizado ANT
 * y bloquea explícitamente "La Bomba Quemada".
 */
export function validarParadaAutorizadaANT(nombreParada: string): {
  valida: boolean;
  motivo: string;
  paradaOficial?: ParadaUrbanaLoja;
} {
  const limpio = (nombreParada || '').trim().toLowerCase();
  if (!limpio || limpio.length < 3) {
    return {
      valida: false,
      motivo:
        'Debe seleccionar una parada urbana válida del Catálogo Oficial de 5 Paradas Autorizadas en Loja.',
    };
  }

  if (
    PARADAS_PROHIBIDAS_ANT.some((prohibida) =>
      limpio.includes(prohibida.toLowerCase())
    )
  ) {
    return {
      valida: false,
      motivo:
        'PROHIBICIÓN REGULATORIA ANT: La parada "La Bomba Quemada" está estrictamente prohibida para abordaje y desembarque por control de sanciones ANT.',
    };
  }

  const encontrada = PARADAS_URBANAS_LOJA_AUTORIZADAS.find(
    (p) =>
      p.nombre.toLowerCase() === limpio ||
      p.id.toLowerCase() === limpio ||
      p.nombre.toLowerCase().includes(limpio)
  );

  if (!encontrada) {
    return {
      valida: false,
      motivo: `La parada "${nombreParada}" no pertenece al Catálogo Oficial de 5 Paradas Urbanas Autorizadas en Loja.`,
    };
  }

  return {
    valida: true,
    motivo: 'Parada urbana autorizada por la ANT.',
    paradaOficial: encontrada,
  };
}

/**
 * Determina el corredor vial ADR-005 y valida que El Tambo no se mezcle con Vilcabamba
 */
export function resolverCorredorVialADR005(destino: string): {
  corredor: DefinicionCorredorVial;
  esRutaValida: boolean;
} {
  const destLimpio = destino.trim().toLowerCase();
  if (destLimpio === 'el tambo') {
    return {
      corredor: CORREDORES_VIALES_ADR005.RAMAL_NOROCCIDENTAL,
      esRutaValida: true,
    };
  }
  return {
    corredor: CORREDORES_VIALES_ADR005.TRONCAL_SUR,
    esRutaValida: true,
  };
}

/**
 * ============================================================================
 * 1. LÓGICA Y VALIDACIÓN DE MEDIOS PASAJES (50% TARIFA ANT) — MÓDULO 10 Y EDAD
 * ============================================================================
 */
export interface ResultadoValidacionCedulaModulo10 {
  valida: boolean;
  cedulaLimpia: string;
  codigoProvincia: number;
  tercerDigito: number;
  digitoVerificadorRecibido: number;
  digitoVerificadorCalculado: number;
  motivo: string;
}

/**
 * Valida matemáticamente una Cédula de Identidad ecuatoriana de 10 dígitos mediante el Algoritmo Módulo 10:
 * - Exactamente 10 dígitos numéricos (rechaza secuencias repetidas como 0000000000 o 2222222222).
 * - Código de provincia: primeros 2 dígitos entre 01 y 24.
 * - Tercer dígito: menor a 6 (0 a 5 para personas naturales).
 * - Dígito verificador (posición 10): calculado con coeficientes [2, 1, 2, 1, 2, 1, 2, 1, 2] en Módulo 10.
 */
export function validarCedulaEcuatorianaModulo10(
  cedulaInput: string
): ResultadoValidacionCedulaModulo10 {
  const cedula = (cedulaInput || '').trim();

  if (!/^\d{10}$/.test(cedula)) {
    return {
      valida: false,
      cedulaLimpia: cedula,
      codigoProvincia: 0,
      tercerDigito: -1,
      digitoVerificadorRecibido: -1,
      digitoVerificadorCalculado: -1,
      motivo:
        'La cédula ecuatoriana debe contener exactamente 10 dígitos numéricos.',
    };
  }

  // Rechazar números repetidos triviales (ej. 0000000000, 2222222222)
  if (/^(\d)\1{9}$/.test(cedula)) {
    return {
      valida: false,
      cedulaLimpia: cedula,
      codigoProvincia: 0,
      tercerDigito: -1,
      digitoVerificadorRecibido: -1,
      digitoVerificadorCalculado: -1,
      motivo: 'Número de cédula inválido (dígitos repetidos no permitidos).',
    };
  }

  const codigoProvincia = parseInt(cedula.slice(0, 2), 10);
  if (codigoProvincia < 1 || codigoProvincia > 24) {
    return {
      valida: false,
      cedulaLimpia: cedula,
      codigoProvincia,
      tercerDigito: -1,
      digitoVerificadorRecibido: -1,
      digitoVerificadorCalculado: -1,
      motivo: `Código de provincia inválido (${cedula.slice(
        0,
        2
      )}). Debe estar entre 01 y 24.`,
    };
  }

  const tercerDigito = parseInt(cedula[2], 10);
  if (tercerDigito < 0 || tercerDigito >= 6) {
    return {
      valida: false,
      cedulaLimpia: cedula,
      codigoProvincia,
      tercerDigito,
      digitoVerificadorRecibido: -1,
      digitoVerificadorCalculado: -1,
      motivo: `Tercer dígito inválido (${tercerDigito}). Para cédula de persona natural debe ser menor a 6 (0-5).`,
    };
  }

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(cedula[i], 10) * coeficientes[i];
    if (valor >= 10) {
      valor -= 9;
    }
    suma += valor;
  }

  const digitoVerificadorCalculado = (10 - (suma % 10)) % 10;
  const digitoVerificadorRecibido = parseInt(cedula[9], 10);

  if (digitoVerificadorCalculado !== digitoVerificadorRecibido) {
    return {
      valida: false,
      cedulaLimpia: cedula,
      codigoProvincia,
      tercerDigito,
      digitoVerificadorRecibido,
      digitoVerificadorCalculado,
      motivo: `Cédula inválida según Algoritmo Módulo 10 (dígito verificador recibido: ${digitoVerificadorRecibido}, esperado: ${digitoVerificadorCalculado}).`,
    };
  }

  return {
    valida: true,
    cedulaLimpia: cedula,
    codigoProvincia,
    tercerDigito,
    digitoVerificadorRecibido,
    digitoVerificadorCalculado,
    motivo: 'Cédula ecuatoriana válida (Algoritmo Módulo 10 verificado).',
  };
}

export interface BeneficiarioMedioPasajeInput {
  cedula: string;
  edad: number;
  nombreBeneficiario?: string;
}

export interface ResultadoValidacionMedioPasajeIndividual {
  valido: boolean;
  cedula: string;
  edad: number;
  categoriaElegibilidad:
    | 'MEDIO_PASAJE_MENOR_18'
    | 'MEDIO_PASAJE_ADULTO_MAYOR_65'
    | 'NO_ELEGIBLE_EDAD'
    | 'CEDULA_INVALIDA';
  motivo: string;
}

/**
 * Valida un beneficiario individual de Medio Pasaje (50% Tarifa ANT):
 * 1. Cédula ecuatoriana válida por Algoritmo Módulo 10.
 * 2. Edad elegible por ley ANT: Menor de edad (<18 años) o Adulto Mayor (65+ años).
 */
export function validarBeneficiarioMedioPasaje(
  beneficiario: BeneficiarioMedioPasajeInput
): ResultadoValidacionMedioPasajeIndividual {
  const valCedula = validarCedulaEcuatorianaModulo10(beneficiario.cedula);
  if (!valCedula.valida) {
    return {
      valido: false,
      cedula: valCedula.cedulaLimpia,
      edad: beneficiario.edad,
      categoriaElegibilidad: 'CEDULA_INVALIDA',
      motivo: valCedula.motivo,
    };
  }

  const edad = Number(beneficiario.edad);
  if (!Number.isFinite(edad) || edad < 0 || edad > 120) {
    return {
      valido: false,
      cedula: valCedula.cedulaLimpia,
      edad,
      categoriaElegibilidad: 'NO_ELEGIBLE_EDAD',
      motivo: 'La edad ingresada para el beneficiario no es válida.',
    };
  }

  if (edad < 18) {
    return {
      valido: true,
      cedula: valCedula.cedulaLimpia,
      edad,
      categoriaElegibilidad: 'MEDIO_PASAJE_MENOR_18',
      motivo: `Menor de edad (${edad} años < 18) con Cédula Módulo 10 válida: autorizado para Medio Pasaje (50% Tarifa ANT).`,
    };
  }

  if (edad >= 65) {
    return {
      valido: true,
      cedula: valCedula.cedulaLimpia,
      edad,
      categoriaElegibilidad: 'MEDIO_PASAJE_ADULTO_MAYOR_65',
      motivo: `Adulto Mayor (${edad} años >= 65) con Cédula Módulo 10 válida: autorizado para Medio Pasaje (50% Tarifa ANT).`,
    };
  }

  return {
    valido: false,
    cedula: valCedula.cedulaLimpia,
    edad,
    categoriaElegibilidad: 'NO_ELEGIBLE_EDAD',
    motivo: `No aplica a Medio Pasaje ANT: la edad (${edad} años) debe corresponder a un menor de edad (<18 años) o adulto mayor (65+ años).`,
  };
}

/**
 * Regla Inmutable: Múltiples Medios Pasajes = Múltiples Cédulas Obligatorias.
 * Si el comprador selecciona N medios pasajes, exige exactamente N registros válidos y sin cédulas duplicadas.
 */
export function validarMultiplesMediosPasajes(
  cantidadMediosPasajesSolicitados: number,
  beneficiarios: BeneficiarioMedioPasajeInput[],
  totalAsientosSeleccionados: number
): {
  valido: boolean;
  motivo: string;
  resultadosIndividuales: ResultadoValidacionMedioPasajeIndividual[];
} {
  if (cantidadMediosPasajesSolicitados < 0) {
    return {
      valido: false,
      motivo: 'La cantidad de medios pasajes no puede ser negativa.',
      resultadosIndividuales: [],
    };
  }

  if (cantidadMediosPasajesSolicitados === 0) {
    return {
      valido: true,
      motivo: 'Sin medios pasajes solicitados (100% Tarifa Regular ANT).',
      resultadosIndividuales: [],
    };
  }

  if (cantidadMediosPasajesSolicitados > totalAsientosSeleccionados) {
    return {
      valido: false,
      motivo: `No puede solicitar ${cantidadMediosPasajesSolicitados} medio(s) pasaje(s) si solo ha seleccionado ${totalAsientosSeleccionados} asiento(s).`,
      resultadosIndividuales: [],
    };
  }

  if (beneficiarios.length !== cantidadMediosPasajesSolicitados) {
    return {
      valido: false,
      motivo: `Regla de Múltiples Medios Pasajes: seleccionó ${cantidadMediosPasajesSolicitados} medio(s) pasaje(s), por lo que debe ingresar obligatoriamente ${cantidadMediosPasajesSolicitados} cédula(s) de identidad ecuatoriana válidas (recibidas: ${beneficiarios.length}).`,
      resultadosIndividuales: [],
    };
  }

  const cedulasVistas = new Set<string>();
  const resultadosIndividuales: ResultadoValidacionMedioPasajeIndividual[] = [];

  for (let i = 0; i < beneficiarios.length; i++) {
    const res = validarBeneficiarioMedioPasaje(beneficiarios[i]);
    resultadosIndividuales.push(res);

    if (!res.valido) {
      return {
        valido: false,
        motivo: `Error en Medio Pasaje #${i + 1}: ${res.motivo}`,
        resultadosIndividuales,
      };
    }

    if (cedulasVistas.has(res.cedula)) {
      return {
        valido: false,
        motivo: `Error en Medio Pasaje #${i + 1}: La cédula ${
          res.cedula
        } está duplicada. Cada medio pasaje requiere la cédula única de su beneficiario.`,
        resultadosIndividuales,
      };
    }
    cedulasVistas.add(res.cedula);
  }

  return {
    valido: true,
    motivo: `Se validaron exitosamente los ${cantidadMediosPasajesSolicitados} beneficiarios de Medio Pasaje (Algoritmo Módulo 10 + Elegibilidad de Edad ANT).`,
    resultadosIndividuales,
  };
}

/**
 * Calcula el Temporizador de Seat Locking (Regla #4 Módulo 1):
 * - Estándar: 15:00 minutos (900 segundos) cuando faltan >= 35 min para la salida (>= 15 min antes de T-20).
 * - Dinámico Abreviado: Si faltan entre 21 y 34 minutos para la salida (menos de 15 min antes del corte T-20),
 *   el reloj se ajusta exactamente a `(minutosParaSalida - 20) * 60` segundos en estado de alerta roja.
 * - Congelado (00:00): Si `minutosParaSalida <= 20`, la venta web está cerrada.
 */
export function calcularTemporizadorReserva(minutosParaSalida: number): {
  permitidoReservar: boolean;
  minutosAsignados: number;
  segundosAsignados: number;
  formatoMMSS: string;
  esTemporizadorAbreviadoAlertaRoja: boolean;
  ventaWebCongelada: boolean;
  explicacion: string;
} {
  if (minutosParaSalida <= 20) {
    return {
      permitidoReservar: false,
      minutosAsignados: 0,
      segundosAsignados: 0,
      formatoMMSS: '00:00',
      esTemporizadorAbreviadoAlertaRoja: true,
      ventaWebCongelada: true,
      explicacion:
        'Venta web congelada (Regla T-20 min). El turno ha sido derivado a taquilla física y manifiesto impreso.',
    };
  }

  const minutosHastaCorteT20 = minutosParaSalida - 20;
  const minutosEfectivos = Math.min(15, minutosHastaCorteT20);
  const segundosAsignados = minutosEfectivos * 60;
  const esAbreviado = minutosHastaCorteT20 < 15;
  const mm = String(minutosEfectivos).padStart(2, '0');

  return {
    permitidoReservar: true,
    minutosAsignados: minutosEfectivos,
    segundosAsignados,
    formatoMMSS: `${mm}:00`,
    esTemporizadorAbreviadoAlertaRoja: esAbreviado,
    ventaWebCongelada: false,
    explicacion: esAbreviado
      ? `TEMPORIZADOR DINÁMICO ABREVIADO (${mm}:00 min): Quedan solo ${minutosHastaCorteT20} minutos antes del cierre web T-20m.`
      : `Temporizador estándar de Seat Locking activo (${mm}:00 min).`,
  };
}

/**
 * Calcula el Desglose Legal y Regulatorio ANT (Soporta Tarifas Completas 100% y Medios Pasajes 50% ANT):
 * - Pasaje Oficial Regulado ANT: suma de boletos al 100% + boletos al 50% (único valor reflejado en el boleto tributario SRI de la cooperativa)
 * - Servicio Digital y Emisión QR: $0.25 FIJO por cada boleto generado (sea 100% o 50% ANT)
 * - TOTAL A TRANSFERIR: suma transparente
 */
export interface DesgloseLegalANT {
  cantidadBoletos: number;
  cantidadPasajesCompletos: number;
  cantidadMediosPasajes: number;
  tarifaUnitariaReguladaANT: number;
  tarifaMedioPasajeUnitariaANT: number;
  subtotalPasajesCompletosUSD: number;
  subtotalMediosPasajesUSD: number;
  pasajeOficialReguladoTotalUSD: number;
  servicioDigitalUnitarioUSD: number;
  servicioDigitalTotalUSD: number;
  totalATransferirUSD: number;
  valorTributarioBoletoCooperativaUSD: number; // Estrictamente la tarifa ANT sin el fee digital
  lineasTextoRecibo: {
    lineaPasajeANT: string;
    lineaDetalleMediosPasajes?: string;
    lineaServicioDigital: string;
    lineaTotalTransferir: string;
  };
}

export function calcularDesgloseLegalANT(
  tarifaUnitariaANT: number,
  cantidadBoletos: number = 1,
  cantidadMediosPasajes: number = 0
): DesgloseLegalANT {
  const cantTotal = Math.max(1, cantidadBoletos);
  const cantMedios = Math.min(
    cantTotal,
    Math.max(0, Math.floor(cantidadMediosPasajes))
  );
  const cantCompletos = cantTotal - cantMedios;

  const tarifaCompletaUnit = Number(tarifaUnitariaANT.toFixed(2));
  const tarifaMedioUnit = Number((tarifaUnitariaANT * 0.5).toFixed(2));

  const subtotalPasajesCompletosUSD = Number(
    (cantCompletos * tarifaCompletaUnit).toFixed(2)
  );
  const subtotalMediosPasajesUSD = Number(
    (cantMedios * tarifaMedioUnit).toFixed(2)
  );

  const pasajeOficialReguladoTotalUSD = Number(
    (subtotalPasajesCompletosUSD + subtotalMediosPasajesUSD).toFixed(2)
  );

  // Fee Tecnológico Fijo: $0.25 por cada boleto generado (sea 100% o 50% según el tramo ANT)
  const servicioDigitalTotalUSD = Number(
    (SERVICIO_DIGITAL_QR_USD * cantTotal).toFixed(2)
  );
  const totalATransferirUSD = Number(
    (pasajeOficialReguladoTotalUSD + servicioDigitalTotalUSD).toFixed(2)
  );

  return {
    cantidadBoletos: cantTotal,
    cantidadPasajesCompletos: cantCompletos,
    cantidadMediosPasajes: cantMedios,
    tarifaUnitariaReguladaANT: tarifaCompletaUnit,
    tarifaMedioPasajeUnitariaANT: tarifaMedioUnit,
    subtotalPasajesCompletosUSD,
    subtotalMediosPasajesUSD,
    pasajeOficialReguladoTotalUSD,
    servicioDigitalUnitarioUSD: SERVICIO_DIGITAL_QR_USD,
    servicioDigitalTotalUSD,
    totalATransferirUSD,
    valorTributarioBoletoCooperativaUSD: pasajeOficialReguladoTotalUSD,
    lineasTextoRecibo: {
      lineaPasajeANT: `Pasaje Oficial Regulado ANT: $${pasajeOficialReguladoTotalUSD.toFixed(
        2
      )}`,
      lineaDetalleMediosPasajes:
        cantMedios > 0
          ? `${cantCompletos} Completo(s) ($${tarifaCompletaUnit.toFixed(
              2
            )}) + ${cantMedios} Medio(s) Pasaje(s) 50% ANT ($${tarifaMedioUnit.toFixed(
              2
            )})`
          : undefined,
      lineaServicioDigital: `Servicio Digital y Emisión QR: $${servicioDigitalTotalUSD.toFixed(
        2
      )}`,
      lineaTotalTransferir: `TOTAL A TRANSFERIR: $${totalATransferirUSD.toFixed(
        2
      )}`,
    },
  };
}

/**
 * ============================================================================
 * 2. OPERACIÓN EN PAPEL SIN DEPENDENCIA TECNOLÓGICA EN AUTOBÚS (T-20 MIN)
 * ============================================================================
 * A los T-20 minutos:
 * - La secretaria copia en 1-clic la lista congelada para el sistema de facturación SRI de la cooperativa.
 * - La secretaria imprime el Manifiesto Físico de Pasajeros en papel y lo entrega al ayudante antes de salir.
 * - La operación en carretera NO depende del celular del ayudante ni de señal móvil (el escáner QR PWA es opcional).
 */
export interface ManifiestoFisicoPapelT20 {
  frecuenciaId: string;
  codigoFrecuencia: string;
  rutaCompleta: string;
  horaSalida: string;
  unidadDiscoReal: string;
  placaBusReal: string;
  choferAsignado: string;
  requiereCelularAyudanteEnRuta: false; // Invariante: 0 dependencia tecnológica obligatoria en autobús
  modoOperacionPrimario: 'MANIFIESTO_FISICO_IMPRESO_PAPEL';
  modoEscanerQrPwa: 'HERRAMIENTA_SECUNDARIA_OPCIONAL';
  totalBoletosWebCongelados: number;
  tsvFacturacionSri1Clic: string;
  documentoTextoImprimiblePapel: string;
}

export function generarManifiestoFisicoPapelT20(
  frecuencia: FrecuenciaRuta
): ManifiestoFisicoPapelT20 {
  const tsvFacturacionSri1Clic = formatearTextoCopiadoSRI(frecuencia);

  const lineasPasajeros =
    frecuencia.boletos.length === 0
      ? ['  (Sin boletos web emitidos en este turno)']
      : frecuencia.boletos
          .slice()
          .sort((a, b) => a.asientoNumero - b.asientoNumero)
          .map((b) => {
            const etiquetaTarifa = b.esMedioPasaje
              ? 'MEDIO PASAJE 50% ANT'
              : 'TARIFA COMPLETA 100%';
            const codUnico = b.codigoUnico || b.id;
            return `  [ ] Asiento #${String(b.asientoNumero).padStart(
              2,
              '0'
            )} | C.I.: ${b.cedulaRuc.padEnd(11, ' ')} | ${b.pasajeroNombre.padEnd(
              28,
              ' '
            )} | ${etiquetaTarifa} ($${b.montoUSD.toFixed(
              2
            )}) | Destino: ${b.destino} | QR: ${codUnico}`;
          });

  const documentoTextoImprimiblePapel = [
    '=========================================================================================',
    '            COOPERATIVA DE TRANSPORTE VILCABAMBATURIS CÍA. LTDA. (RUC: 1191705482001)    ',
    '                 MANIFIESTO FÍSICO IMPRESO EN PAPEL PARA EL AYUDANTE (T-20 MIN)          ',
    '     OPERACIÓN AUTÓNOMA EN PAPEL — SIN DEPENDENCIA DE CELULAR NI COBERTURA EN RUTA       ',
    '=========================================================================================',
    `Frecuencia: ${frecuencia.codigoFrecuencia} | Ruta: ${frecuencia.origen} -> ${frecuencia.destino} | Salida: ${frecuencia.horaSalida}`,
    `Unidad Asignada: ${frecuencia.busDiscoReal} (${frecuencia.placaBusReal}) | Conductor: ${frecuencia.choferAsignado}`,
    '-----------------------------------------------------------------------------------------',
    'LISTA DE PASAJEROS CONGELADA (MARCAR CON ESFERO AL ABORDAR EN PARADA AUTORIZADA ANT):',
    ...lineasPasajeros,
    '-----------------------------------------------------------------------------------------',
    'Nota Operativa: El control a bordo se realiza con este Manifiesto Físico en Papel.',
    'El escáner QR en la PWA del ayudante es únicamente una herramienta secundaria/opcional.',
    '=========================================================================================',
  ].join('\n');

  return {
    frecuenciaId: frecuencia.id,
    codigoFrecuencia: frecuencia.codigoFrecuencia,
    rutaCompleta: `${frecuencia.origen} ➔ ${frecuencia.destino}`,
    horaSalida: frecuencia.horaSalida,
    unidadDiscoReal: frecuencia.busDiscoReal,
    placaBusReal: frecuencia.placaBusReal,
    choferAsignado: frecuencia.choferAsignado,
    requiereCelularAyudanteEnRuta: false,
    modoOperacionPrimario: 'MANIFIESTO_FISICO_IMPRESO_PAPEL',
    modoEscanerQrPwa: 'HERRAMIENTA_SECUNDARIA_OPCIONAL',
    totalBoletosWebCongelados: frecuencia.boletos.length,
    tsvFacturacionSri1Clic,
    documentoTextoImprimiblePapel,
  };
}

/**
 * Motor de Reconciliación Inteligente, Validación de Medios Pasajes (Módulo 10)
 * y Emisión Relacional 1 Transacción -> N Boletos QR Independientes:
 */
export type TipoResolucionReconciliacion =
  | 'EMITIDO_ESTANDAR_O_MULTIPLE'
  | 'REASIGNADO_MISMO_ASIENTO_PRE_T20'
  | 'REUBICADO_SIGUIENTE_ASIENTO_LIBRE_PRE_T20'
  | 'SALDO_A_FAVOR_POST_T20'
  | 'RETENIDO_PAGO_INCOMPLETO';

export interface ResultadoReconciliacionCheckout {
  exitoEmision: boolean;
  transaccionId: string;
  tipoResolucion: TipoResolucionReconciliacion;
  asientosSolicitados: number[];
  asientosEfectivosAsignados: number[];
  pasesQrEmitidos: BoletoEmitido[];
  desgloseANT: DesgloseLegalANT;
  montoRecibidoUSD: number;
  saldoFaltanteUSD: number;
  saldoAFavorCreadoUSD: number;
  feeTecnologicoCobradoTotalUSD: number; // $0.00 si no emitió boleto (Invariante Módulo 2)
  codigoSaldoAFavor?: string;
  notaCreditoGenerada?: NotaCreditoSaldoRecord;
  alertaWhatsAppCliente: string;
  frecuenciaActualizada: FrecuenciaRuta;
}

export function procesarCheckoutYReconciliacionInteligente(params: {
  frecuencia: FrecuenciaRuta;
  asientosSeleccionados: number[]; // 1 o varios asientos (Compras familiares/múltiples: 1 Transacción -> N Boletos QR)
  cedulaRuc: string;
  pasajeroNombre: string;
  telefonoWhatsApp: string;
  paradaAbordajeLoja: string;
  destinoFinal: string;
  banco: 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA' | 'DEUNA_PICHINCHA';
  referenciaBancaria: string;
  montoTransferidoUSD: number;
  cantidadMediosPasajes?: number;
  beneficiariosMedioPasaje?: BeneficiarioMedioPasajeInput[];
  aceptoTerminosModulo2?: boolean;
  pagoIngresadoVencidoLock15m?: boolean;
  pagoIngresadoDespuesDeT20?: boolean;
}): ResultadoReconciliacionCheckout {
  const {
    frecuencia,
    asientosSeleccionados,
    cedulaRuc,
    pasajeroNombre,
    telefonoWhatsApp,
    paradaAbordajeLoja,
    destinoFinal,
    banco,
    referenciaBancaria,
    montoTransferidoUSD,
    cantidadMediosPasajes = 0,
    beneficiariosMedioPasaje = [],
    aceptoTerminosModulo2 = true,
    pagoIngresadoVencidoLock15m = false,
    pagoIngresadoDespuesDeT20 = false,
  } = params;

  // 0. Validar Casilla Obligatoria de Términos y Condiciones (Módulo 2: No Cambios / No Devoluciones + Caducidad 30 días)
  const validacionTerminos = validarAceptacionTerminosModulo2(
    aceptoTerminosModulo2
  );
  if (!validacionTerminos.valido) {
    throw new Error(validacionTerminos.mensajeLegal);
  }

  // 1. Validar que la parada de abordaje no sea prohibida por la ANT
  const validacionParada = validarParadaAutorizadaANT(paradaAbordajeLoja);
  if (!validacionParada.valida) {
    throw new Error(validacionParada.motivo);
  }

  // 2. Validar que exista al menos 1 asiento, sin duplicados, y dentro del Bloque Web (1 al 10)
  if (!Array.isArray(asientosSeleccionados) || asientosSeleccionados.length === 0) {
    throw new Error('Debe seleccionar al menos 1 asiento del Bloque Web (1 al 10).');
  }
  const asientosUnicos = new Set(asientosSeleccionados);
  if (asientosUnicos.size !== asientosSeleccionados.length) {
    throw new Error('No se permiten números de asiento duplicados en una misma transacción.');
  }
  for (const num of asientosSeleccionados) {
    if (!Number.isInteger(num) || num < 1 || num > BLOQUE_WEB_MAX_ASIENTO) {
      throw new Error(
        `El asiento #${num} pertenece al Bloque Exclusivo de Taquilla Terminal (11 al 45). En línea solo se habilitan los asientos 1 al 10.`
      );
    }
  }

  // 3. Validar Medios Pasajes (50% Tarifa ANT): N Medios Pasajes = N Cédulas Módulo 10 + Elegibilidad de Edad (<18 o >=65)
  const validacionMedios = validarMultiplesMediosPasajes(
    cantidadMediosPasajes,
    beneficiariosMedioPasaje,
    asientosSeleccionados.length
  );
  if (!validacionMedios.valido) {
    throw new Error(validacionMedios.motivo);
  }

  const transaccionId = `TX-${referenciaBancaria.trim().toUpperCase()}-${
    asientosSeleccionados.length
  }QR`;

  const desgloseANT = calcularDesgloseLegalANT(
    frecuencia.tarifaUSD,
    asientosSeleccionados.length,
    cantidadMediosPasajes
  );
  const montoRecibidoRedondeado = Number(montoTransferidoUSD.toFixed(2));

  // CASO BORDE A: Pago Incompleto (Monto transferido menor al Total a Transferir)
  if (montoRecibidoRedondeado < desgloseANT.totalATransferirUSD) {
    const faltante = Number(
      (desgloseANT.totalATransferirUSD - montoRecibidoRedondeado).toFixed(2)
    );
    return {
      exitoEmision: false,
      transaccionId,
      tipoResolucion: 'RETENIDO_PAGO_INCOMPLETO',
      asientosSolicitados: asientosSeleccionados,
      asientosEfectivosAsignados: [],
      pasesQrEmitidos: [],
      desgloseANT,
      montoRecibidoUSD: montoRecibidoRedondeado,
      saldoFaltanteUSD: faltante,
      saldoAFavorCreadoUSD: 0,
      feeTecnologicoCobradoTotalUSD: 0.0, // No se cobra el fee de $0.25 porque no emitió boleto
      alertaWhatsAppCliente: `[Vilcabambaturis - PasajeYa] Hola ${pasajeroNombre}, recibimos su transferencia parcial de $${montoRecibidoRedondeado.toFixed(
        2
      )} (Ref: ${referenciaBancaria}). Su emisión está congelada: por favor transfiera el saldo faltante exacto de $${faltante.toFixed(
        2
      )} USD antes del corte T-20 min para liberar sus ${
        asientosSeleccionados.length
      } pase(s) QR. Si llega T-20 min sin completarse, se generará un Saldo a Favor (vigencia 30 días).`,
      frecuenciaActualizada: frecuencia,
    };
  }

  // CASO BORDE B: Pago Tardío después del congelamiento T-20 min -> Crea NotaCreditoSaldo con caducidad a 30 días y $0.00 fee
  if (
    pagoIngresadoDespuesDeT20 ||
    frecuencia.ventaWebCongelada ||
    frecuencia.minutosParaSalida <= 20
  ) {
    const notaCredito = crearNotaCreditoSaldoAFavor({
      cedulaRuc,
      pasajeroNombre,
      telefonoWhatsApp,
      bancoOrigen: banco,
      referenciaBancoOrigen: referenciaBancaria,
      montoTransferidoUSD: montoRecibidoRedondeado,
      motivoOrigen: 'PAGO_POST_T20_MIN',
    });
    return {
      exitoEmision: false,
      transaccionId,
      tipoResolucion: 'SALDO_A_FAVOR_POST_T20',
      asientosSolicitados: asientosSeleccionados,
      asientosEfectivosAsignados: [],
      pasesQrEmitidos: [],
      desgloseANT,
      montoRecibidoUSD: montoRecibidoRedondeado,
      saldoFaltanteUSD: 0,
      saldoAFavorCreadoUSD: montoRecibidoRedondeado,
      feeTecnologicoCobradoTotalUSD: 0.0, // Invariante: $0.00 fee cuando no se emitió boleto
      codigoSaldoAFavor: notaCredito.codigoNotaCredito,
      notaCreditoGenerada: notaCredito,
      alertaWhatsAppCliente: `[Vilcabambaturis - PasajeYa] Hola ${pasajeroNombre}, su pago de $${montoRecibidoRedondeado.toFixed(
        2
      )} ingresó después del cierre T-20 min del turno ${
        frecuencia.horaSalida
      }. Hemos registrado un SALDO A FAVOR (${
        notaCredito.codigoNotaCredito
      }) íntegro por $${montoRecibidoRedondeado.toFixed(
        2
      )} USD (sin recargo de $0.25, vigente por 30 días calendario hasta ${new Date(
        notaCredito.fechaExpiracion
      ).toLocaleDateString(
        'es-EC'
      )}) para reubicarlo en el siguiente turno o canjearlo por un pasaje en ventanilla (no reembolsable en efectivo).`,
      frecuenciaActualizada: frecuencia,
    };
  }

  // Resolver asignación de asientos (Estándar vs Pago Tardío antes de T-20 min)
  const asientosEfectivos: number[] = [];
  let huboReubicacion = false;

  const ocupadosActuales = new Set(
    frecuencia.asientosBloqueWeb
      .filter(
        (a) =>
          a.estado === 'VENDIDO_WEB' || a.estado === 'VENDIDO_TAQUILLA'
      )
      .map((a) => a.numero)
  );

  for (const solicitado of asientosSeleccionados) {
    if (!ocupadosActuales.has(solicitado)) {
      asientosEfectivos.push(solicitado);
      ocupadosActuales.add(solicitado);
    } else {
      // Buscar automáticamente el siguiente asiento libre dentro del bloque web (1 al 10)
      let reubicado: number | null = null;
      for (let candidato = 1; candidato <= BLOQUE_WEB_MAX_ASIENTO; candidato++) {
        if (!ocupadosActuales.has(candidato)) {
          reubicado = candidato;
          break;
        }
      }
      if (!reubicado) {
        throw new Error(
          'Todos los asientos del Bloque Web (1 al 10) se agotaron antes de ingresar el pago tardío.'
        );
      }
      asientosEfectivos.push(reubicado);
      ocupadosActuales.add(reubicado);
      huboReubicacion = true;
    }
  }

  // ARQUITECTURA RELACIONAL 1 A N:
  // 1 Transacción Bancaria -> N registros `Boleto` independientes, cada uno con su propio:
  // - `numeroAsiento` / `asientoNumero`
  // - `codigoUnico` (identificador individual del código QR)
  // - `firmaDigitalHmac` / `firmaHmac` (firma criptográfica HMAC-SHA256 individual)
  // - `feeTecnologicoUSD`: $0.25 fijo por cada boleto generado (sea 100% o 50% ANT)
  const timestamp = new Date().toISOString();
  const pasesQrEmitidos: BoletoEmitido[] = asientosEfectivos.map(
    (asientoNum, idx) => {
      const esBoletoMedioPasaje = idx < cantidadMediosPasajes;
      const datosBeneficiarioMedio = esBoletoMedioPasaje
        ? beneficiariosMedioPasaje[idx]
        : undefined;
      const validacionIndMedio = esBoletoMedioPasaje
        ? validacionMedios.resultadosIndividuales[idx]
        : undefined;

      const cedulaEfectivaBoleto = datosBeneficiarioMedio
        ? datosBeneficiarioMedio.cedula.trim()
        : cedulaRuc;

      const nombreEfectivoBoleto = datosBeneficiarioMedio?.nombreBeneficiario
        ? `${datosBeneficiarioMedio.nombreBeneficiario} (Medio Pasaje 50% ANT)`
        : asientosEfectivos.length > 1
        ? `${pasajeroNombre} (Pase ${idx + 1}/${asientosEfectivos.length}${
            esBoletoMedioPasaje ? ' · Medio Pasaje 50%' : ''
          })`
        : pasajeroNombre;

      const montoOficialBoletoANT = esBoletoMedioPasaje
        ? desgloseANT.tarifaMedioPasajeUnitariaANT
        : desgloseANT.tarifaUnitariaReguladaANT;

      const refIndividual =
        asientosEfectivos.length > 1
          ? `${referenciaBancaria.toUpperCase()}-P${idx + 1}`
          : referenciaBancaria.toUpperCase();

      const codigoUnicoQR = `QR-${frecuencia.codigoFrecuencia}-AS${String(
        asientoNum
      ).padStart(2, '0')}-${refIndividual}`;

      const firmaHmac = generarFirmaHmacQR({
        frecuenciaId: frecuencia.id,
        asientoNumero: asientoNum,
        cedulaRuc: cedulaEfectivaBoleto,
        referenciaBancaria: `${refIndividual}:${codigoUnicoQR}`,
      });

      return {
        id: `bol-web-${Date.now()}-${asientoNum}-${idx + 1}`,
        transaccionId,
        frecuenciaId: frecuencia.id,
        asientoNumero: asientoNum,
        numeroAsiento: asientoNum,
        codigoUnico: codigoUnicoQR,
        cedulaRuc: cedulaEfectivaBoleto,
        pasajeroNombre: nombreEfectivoBoleto,
        esMedioPasaje: esBoletoMedioPasaje,
        edadPasajero: datosBeneficiarioMedio?.edad,
        categoriaTarifaANT: validacionIndMedio
          ? (validacionIndMedio.categoriaElegibilidad as
              | 'MEDIO_PASAJE_MENOR_18'
              | 'MEDIO_PASAJE_ADULTO_MAYOR_65')
          : 'TARIFA_COMPLETA_100',
        telefonoWhatsApp,
        origen: `${frecuencia.origen} (${paradaAbordajeLoja})`,
        destino: destinoFinal || frecuencia.destino,
        // PROTECCIÓN LEGAL ANT: El boleto tributario refleja estrictamente la tarifa oficial regulada ANT (100% o 50%)
        montoUSD: montoOficialBoletoANT,
        // Fee Tecnológico Fijo: $0.25 por cada boleto generado
        feeTecnologicoUSD: SERVICIO_DIGITAL_QR_USD,
        canalVenta: 'WEB',
        banco,
        referenciaBancaria: refIndividual,
        firmaHmac,
        firmaDigitalHmac: firmaHmac,
        sincronizadoSri: false,
        manifiestoImpreso: false,
        estadoAbordaje: 'PENDIENTE',
        emitidoAt: timestamp,
      };
    }
  );

  const nuevosAsientos = frecuencia.asientosBloqueWeb.map((a) => {
    const boletoDeEsteAsiento = pasesQrEmitidos.find(
      (b) => b.asientoNumero === a.numero
    );
    if (boletoDeEsteAsiento) {
      return {
        ...a,
        estado: 'VENDIDO_WEB' as const,
        lockedUntil: null,
        boletoId: boletoDeEsteAsiento.id,
        pasajeroNombre: boletoDeEsteAsiento.pasajeroNombre,
        cedulaRuc: boletoDeEsteAsiento.cedulaRuc,
      };
    }
    return a;
  });

  const frecuenciaActualizada: FrecuenciaRuta = {
    ...frecuencia,
    asientosBloqueWeb: nuevosAsientos,
    boletos: [...frecuencia.boletos, ...pasesQrEmitidos],
  };

  let tipoResolucion: TipoResolucionReconciliacion =
    'EMITIDO_ESTANDAR_O_MULTIPLE';
  if (pagoIngresadoVencidoLock15m) {
    tipoResolucion = huboReubicacion
      ? 'REUBICADO_SIGUIENTE_ASIENTO_LIBRE_PRE_T20'
      : 'REASIGNADO_MISMO_ASIENTO_PRE_T20';
  } else if (huboReubicacion) {
    tipoResolucion = 'REUBICADO_SIGUIENTE_ASIENTO_LIBRE_PRE_T20';
  }

  const mensajeWhatsApp =
    tipoResolucion === 'REUBICADO_SIGUIENTE_ASIENTO_LIBRE_PRE_T20'
      ? `[Vilcabambaturis - PasajeYa] Hola ${pasajeroNombre}, su pago ingresó vencidos los 15 min de reserva pero antes del corte T-20m. Como el asiento #${asientosSeleccionados.join(
          ','
        )} fue ocupado, le asignamos automáticamente el Asiento #${asientosEfectivos.join(
          ','
        )} en ${frecuencia.busDiscoReal}. Pases QR adjuntos: ${pasesQrEmitidos.length}.`
      : tipoResolucion === 'REASIGNADO_MISMO_ASIENTO_PRE_T20'
      ? `[Vilcabambaturis - PasajeYa] Hola ${pasajeroNombre}, su pago tardío ingresó antes de T-20m y su Asiento original #${asientosEfectivos.join(
          ','
        )} seguía disponible. ¡Re-asignado con éxito! Pases QR emitidos: ${
          pasesQrEmitidos.length
        }.`
      : `[Vilcabambaturis - PasajeYa] Hola ${pasajeroNombre}, pago conciliado ($${montoRecibidoRedondeado.toFixed(
          2
        )} USD). Enviamos en este mensaje sus ${
          pasesQrEmitidos.length
        } Pase(s) Digital(es) QR independientes para Asiento(s) #${asientosEfectivos.join(
          ', #'
        )} | Abordaje: ${paradaAbordajeLoja} ➔ ${destinoFinal}.`;

  return {
    exitoEmision: true,
    transaccionId,
    tipoResolucion,
    asientosSolicitados: asientosSeleccionados,
    asientosEfectivosAsignados: asientosEfectivos,
    pasesQrEmitidos,
    desgloseANT,
    montoRecibidoUSD: montoRecibidoRedondeado,
    saldoFaltanteUSD: 0,
    saldoAFavorCreadoUSD: 0,
    feeTecnologicoCobradoTotalUSD: desgloseANT.servicioDigitalTotalUSD,
    alertaWhatsAppCliente: mensajeWhatsApp,
    frecuenciaActualizada,
  };
}
