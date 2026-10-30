/**
 * PasajeYa — Motor del Módulo 3: Consola de Taquilla de Secretaría,
 * Pizarra de Turnos en Tiempo Real (Rojo Vinotinto #912D26 vs Gris Neutral),
 * Gestión Tricolor del Mapa de 45 Asientos (#912D26 Vendido, #2E7D32 Disponible, #F57C00 Reserva 15m),
 * Botones Independientes de Copiado 1-Clic al Sistema de Vilcabambaturis,
 * Control Estricto de Flota (Bloqueo EN_RUTA / DESPACHADO + Protocolo DESPACHADO_SIN_VENTAS_WEB)
 * y Control de Acceso por Roles RBAC (Secretaria Lectura/Escritura vs Tripulación/Ayudante Solo Lectura).
 */

import {
  BoletoEmitido,
  FilaSincronizacionSRI,
  FrecuenciaRuta,
  RolOperativo,
  UnidadFlota,
} from '../types/pasajeya';
import {
  FLOTA_UNIDADES,
  generarFirmaHmacQR,
  PIN_CORPORATIVO_OFICIAL,
} from './pasajeyaEngine';

export const COLOR_TRICOLOR_ROJO_VENDIDO = '#912D26';
export const COLOR_TRICOLOR_VERDE_DISPONIBLE = '#2E7D32';
export const COLOR_TRICOLOR_NARANJA_RESERVA = '#F57C00';
export const COLOR_PIZARRA_GRIS_NEUTRAL = '#64748B';

export const COLOR_TAQUILLA_VENDIDO_ROJO = '#912D26';
export const COLOR_TAQUILLA_DISPONIBLE_VERDE = '#2E7D32';
export const COLOR_TAQUILLA_RESERVA_NARANJA = '#F57C00';

/**
 * 1. PIZARRA DE TURNOS EN TIEMPO REAL Y DISTINCIÓN VISUAL
 * - Rojo Vinotinto (#912D26): Turnos con ventas web o reservas activas, mostrando el conteo exacto.
 * - Gris Neutral (#64748B): Turnos sin ventas en línea (0 ventas).
 */
export interface EstadoVisualTarjetaPizarra {
  frecuenciaId: string;
  codigoFrecuencia: string;
  tieneVentasOReservasWeb: boolean;
  colorDistintivoHex: '#912D26' | '#64748B';
  colorFondoHex: '#912D26' | '#64748B';
  varianteVisual:
    | 'ROJO_VINOTINTO_CON_VENTAS'
    | 'GRIS_NEUTRAL_SIN_VENTAS';
  conteoPasajesVendidosWeb: number;
  pasajesVendidosCount: number;
  conteoReservasPendientes15m: number;
  reservasActivasCount: number;
  conteoVendidosTaquilla: number;
  etiquetaResumenVentas: string;
  cierreAutomaticoT20Activo: boolean;
  puedeCerrarSinVentasWeb: boolean;
}

export function evaluarTarjetaPizarraTurno(
  frecuencia: FrecuenciaRuta
): EstadoVisualTarjetaPizarra {
  const conteoPasajesVendidosWeb = frecuencia.asientosBloqueWeb.filter(
    (a) => a.estado === 'VENDIDO_WEB'
  ).length;

  const conteoReservasPendientes15m = frecuencia.asientosBloqueWeb.filter(
    (a) => a.estado === 'LOCKED_WEB'
  ).length;

  const conteoVendidosTaquilla =
    frecuencia.asientosBloqueWeb.filter((a) => a.estado === 'VENDIDO_TAQUILLA')
      .length + (frecuencia.asientosVendidosTaquilla11a45?.length || 0);

  const pasajesVendidosCount =
    conteoPasajesVendidosWeb + conteoVendidosTaquilla;

  const tieneVentasOReservasWeb =
    pasajesVendidosCount > 0 || conteoReservasPendientes15m > 0;

  const cierreAutomaticoT20Activo =
    frecuencia.ventaWebCongelada || frecuencia.minutosParaSalida <= 20;

  const colorHex = tieneVentasOReservasWeb
    ? COLOR_TRICOLOR_ROJO_VENDIDO
    : COLOR_PIZARRA_GRIS_NEUTRAL;

  return {
    frecuenciaId: frecuencia.id,
    codigoFrecuencia: frecuencia.codigoFrecuencia,
    tieneVentasOReservasWeb,
    colorDistintivoHex: colorHex,
    colorFondoHex: colorHex,
    varianteVisual: tieneVentasOReservasWeb
      ? 'ROJO_VINOTINTO_CON_VENTAS'
      : 'GRIS_NEUTRAL_SIN_VENTAS',
    conteoPasajesVendidosWeb,
    pasajesVendidosCount,
    conteoReservasPendientes15m,
    reservasActivasCount: conteoReservasPendientes15m,
    conteoVendidosTaquilla,
    etiquetaResumenVentas: tieneVentasOReservasWeb
      ? `${pasajesVendidosCount} Vendido(s)${
          conteoReservasPendientes15m > 0
            ? ` · ${conteoReservasPendientes15m} Reserva(s) 15m`
            : ''
        }`
      : '0 Ventas en Línea (Gris Neutral)',
    cierreAutomaticoT20Activo,
    puedeCerrarSinVentasWeb:
      !tieneVentasOReservasWeb &&
      frecuencia.estadoDespacho !== 'DESPACHADO_SIN_VENTAS_WEB',
  };
}

/**
 * 2. GESTIÓN TRICOLOR DEL MAPA DE ASIENTOS (45 ASIENTOS HINO AK)
 * - 🔴 Rojo Vinotinto (#912D26): Asiento Confirmado y Vendido (Web o Taquilla).
 * - 🟢 Verde Menta (#2E7D32): Asiento Disponible (Nativos de ventanilla 11-45 y Sobrantes del bloque web 1-10 liberados a T-20m).
 * - 🟡 Naranja / Ocre (#F57C00): Asiento en Reserva Pendiente / Confirmación de Pago (temporizador de 15m activo).
 *   Bloqueado para venta presencial hasta que se confirme o expire la reserva.
 */
export type CodigoColorTricolorAsiento =
  | 'VENDIDO_CONFIRMADO'
  | 'DISPONIBLE_TAQUILLA'
  | 'RESERVA_PENDIENTE_15M';

export interface AsientoMapaTricolor45 {
  numero: number; // 1 al 45
  esBloqueWeb: boolean;
  zonaBus: 'BLOQUE_WEB_1_10' | 'NATIVO_VENTANILLA_11_45';
  estadoTricolor: CodigoColorTricolorAsiento;
  colorHex: '#912D26' | '#2E7D32' | '#F57C00';
  etiquetaCorta: string;
  etiquetaEstado: string;
  puedeVenderseEnVentanilla: boolean;
  disponibleParaVentaPresencialTaquilla: boolean;
  liberadoDeWebAT20m: boolean;
  pasajeroNombre?: string;
  cedulaRuc?: string;
  lockedUntil?: string | null;
}

export function construirMapaTricolor45Asientos(
  frecuencia: FrecuenciaRuta
): AsientoMapaTricolor45[] {
  const vendidosTaquillaNativos = new Set(
    frecuencia.asientosVendidosTaquilla11a45 || []
  );

  return Array.from({ length: 45 }, (_, idx) => {
    const numero = idx + 1;

    if (numero <= 10) {
      const asientoWeb = frecuencia.asientosBloqueWeb.find(
        (a) => a.numero === numero
      );
      const estado = asientoWeb?.estado || 'DISPONIBLE_WEB';

      if (estado === 'VENDIDO_WEB' || estado === 'VENDIDO_TAQUILLA') {
        const etiqueta =
          estado === 'VENDIDO_WEB' ? 'VENDIDO WEB' : 'VENDIDO TAQ';
        return {
          numero,
          esBloqueWeb: true,
          zonaBus: 'BLOQUE_WEB_1_10',
          estadoTricolor: 'VENDIDO_CONFIRMADO',
          colorHex: COLOR_TRICOLOR_ROJO_VENDIDO,
          etiquetaCorta: etiqueta,
          etiquetaEstado: etiqueta,
          puedeVenderseEnVentanilla: false,
          disponibleParaVentaPresencialTaquilla: false,
          liberadoDeWebAT20m: false,
          pasajeroNombre: asientoWeb?.pasajeroNombre,
          cedulaRuc: asientoWeb?.cedulaRuc,
        };
      }

      if (estado === 'LOCKED_WEB') {
        return {
          numero,
          esBloqueWeb: true,
          zonaBus: 'BLOQUE_WEB_1_10',
          estadoTricolor: 'RESERVA_PENDIENTE_15M',
          colorHex: COLOR_TRICOLOR_NARANJA_RESERVA,
          etiquetaCorta: 'RESERVA 15M',
          etiquetaEstado: 'Reserva Pendiente 15m (Bloqueado Taquilla)',
          puedeVenderseEnVentanilla: false,
          disponibleParaVentaPresencialTaquilla: false,
          liberadoDeWebAT20m: false,
          lockedUntil: asientoWeb?.lockedUntil || '15:00 min activo',
        };
      }

      const esLiberadoT20 = estado === 'DISPONIBLE_VENTANILLA';
      const etiqueta = esLiberadoT20 ? 'LIBERADO T-20M' : 'LIBRE (1-10)';
      return {
        numero,
        esBloqueWeb: true,
        zonaBus: 'BLOQUE_WEB_1_10',
        estadoTricolor: 'DISPONIBLE_TAQUILLA',
        colorHex: COLOR_TRICOLOR_VERDE_DISPONIBLE,
        etiquetaCorta: etiqueta,
        etiquetaEstado: etiqueta,
        puedeVenderseEnVentanilla: true,
        disponibleParaVentaPresencialTaquilla: true,
        liberadoDeWebAT20m: esLiberadoT20,
      };
    }

    // Asientos Nativos de Ventanilla 11 al 45
    const boletoTaquillaNativo = frecuencia.boletos.find(
      (b) => b.asientoNumero === numero
    );
    if (vendidosTaquillaNativos.has(numero) || boletoTaquillaNativo) {
      return {
        numero,
        esBloqueWeb: false,
        zonaBus: 'NATIVO_VENTANILLA_11_45',
        estadoTricolor: 'VENDIDO_CONFIRMADO',
        colorHex: COLOR_TRICOLOR_ROJO_VENDIDO,
        etiquetaCorta: 'VENDIDO TAQ',
        etiquetaEstado: 'Vendido Taquilla (11–45)',
        puedeVenderseEnVentanilla: false,
        disponibleParaVentaPresencialTaquilla: false,
        liberadoDeWebAT20m: false,
        pasajeroNombre:
          boletoTaquillaNativo?.pasajeroNombre || 'Pasajero Ventanilla',
        cedulaRuc: boletoTaquillaNativo?.cedulaRuc,
      };
    }

    return {
      numero,
      esBloqueWeb: false,
      zonaBus: 'NATIVO_VENTANILLA_11_45',
      estadoTricolor: 'DISPONIBLE_TAQUILLA',
      colorHex: COLOR_TRICOLOR_VERDE_DISPONIBLE,
      etiquetaCorta: 'LIBRE TAQ',
      etiquetaEstado: 'Disponible Ventanilla (11–45)',
      puedeVenderseEnVentanilla: true,
      disponibleParaVentaPresencialTaquilla: true,
      liberadoDeWebAT20m: false,
    };
  });
}

/**
 * 3. EXPORTACIÓN Y BOTONES INDEPENDIENTES DE COPIADO 1-CLIC AL SISTEMA DE VILCABAMBATURIS
 * - [Copiar Cédula / RUC]
 * - [Copiar # Comprobante / Referencia] (Extraído automáticamente vía Gmail API)
 * - [Copiar para Ventana Emergente de Depósito] (Mapeado exacto para el sistema de Vilcabambaturis)
 */
export interface PayloadsCopiadoVilcabambaturis {
  boletoId: string;
  asientoNumero: number;
  botonCopiarCedulaRuc: string;
  botonCopiarReferenciaComprobante: string;
  botonCopiarVentanaEmergenteDeposito: string;
}

export function generarPayloadsCopiadoSistemaVilcabambaturis(
  item: FilaSincronizacionSRI | BoletoEmitido,
  frecuencia: FrecuenciaRuta
): PayloadsCopiadoVilcabambaturis {
  const esFilaSri = 'identificacion' in item;
  const boletoId = esFilaSri ? item.boletoId : item.id;
  const asientoNumero = esFilaSri ? item.asiento : item.asientoNumero;
  const cedulaRuc = esFilaSri ? item.identificacion : item.cedulaRuc;
  const pasajeroNombre = esFilaSri
    ? item.razonSocialNombres
    : item.pasajeroNombre;
  const referenciaBancaria = esFilaSri
    ? item.referenciaPago
    : item.referenciaBancaria;
  const montoStr = esFilaSri ? item.totalUSD : item.montoUSD.toFixed(2);
  const bancoRaw = item.banco;

  const nombreBanco =
    bancoRaw === 'BANCO_DE_LOJA' || String(bancoRaw).includes('Loja')
      ? 'BANCO DE LOJA (CTA 2901485920)'
      : bancoRaw === 'DEUNA_PICHINCHA' || String(bancoRaw).includes('Deuna')
      ? 'DEUNA PICHINCHA (CTA 2100284910)'
      : bancoRaw === 'BANCO_PICHINCHA' || String(bancoRaw).includes('Pichincha')
      ? 'BANCO PICHINCHA (CTA 2100284910)'
      : 'SALDO A FAVOR / TAQUILLA';

  const botonCopiarVentanaEmergenteDeposito = [
    `BANCO: ${nombreBanco}`,
    `DOC_REF: ${referenciaBancaria}`,
    `MONTO_ANT_USD: $${montoStr}`,
    `CLIENTE_ID: ${cedulaRuc}`,
    `PASAJERO: ${pasajeroNombre}`,
    `FRECUENCIA: ${frecuencia.codigoFrecuencia} (${frecuencia.horaSalida})`,
    `ASIENTO: #${asientoNumero}`,
  ].join(' | ');

  return {
    boletoId,
    asientoNumero,
    botonCopiarCedulaRuc: cedulaRuc,
    botonCopiarReferenciaComprobante: referenciaBancaria,
    botonCopiarVentanaEmergenteDeposito,
  };
}

/**
 * Genera el Manifiesto Físico Impreso en papel con visualización explícita
 * de los asientos liberados de web (1–10) para entrega física al ayudante antes de la salida.
 */
export function generarManifiestoImpresoConAsientosLiberados(
  frecuencia: FrecuenciaRuta
): {
  asientosWebLiberadosParaTaquilla: number[];
  asientosConfirmadosWeb1a10: number[];
  textoImprimible: string;
} {
  const asientosWebLiberadosParaTaquilla = frecuencia.asientosBloqueWeb
    .filter(
      (a) =>
        a.estado === 'DISPONIBLE_VENTANILLA' || a.estado === 'DISPONIBLE_WEB'
    )
    .map((a) => a.numero);

  const asientosConfirmadosWeb1a10 = frecuencia.asientosBloqueWeb
    .filter(
      (a) => a.estado === 'VENDIDO_WEB' || a.estado === 'VENDIDO_TAQUILLA'
    )
    .map((a) => a.numero);

  const filasPasajeros =
    frecuencia.boletos.length === 0
      ? ['  (0 Ventas Web — Turno Despachado sin Pasajeros Web)']
      : frecuencia.boletos
          .slice()
          .sort((a, b) => a.asientoNumero - b.asientoNumero)
          .map(
            (b) =>
              `  [X] Asiento #${String(b.asientoNumero).padStart(
                2,
                '0'
              )} | C.I./RUC: ${b.cedulaRuc.padEnd(
                13,
                ' '
              )} | ${b.pasajeroNombre.padEnd(30, ' ')} | Ref: ${
                b.referenciaBancaria
              } | $${b.montoUSD.toFixed(2)}`
          );

  const textoImprimible = [
    '=========================================================================================',
    '          COOPERATIVA VILCABAMBATURIS CÍA. LTDA. — MANIFIESTO FÍSICO TAQUILLA (T-20M)    ',
    '=========================================================================================',
    `Turno: ${frecuencia.codigoFrecuencia} (${frecuencia.origen} -> ${frecuencia.destino}) | Salida: ${frecuencia.horaSalida}`,
    `Unidad Real en Andén: ${frecuencia.busDiscoReal} (${frecuencia.placaBusReal}) | Chofer: ${frecuencia.choferAsignado}`,
    '-----------------------------------------------------------------------------------------',
    `ASIENTOS DEL BLOQUE WEB (1 AL 10) CONFIRMADOS: ${
      asientosConfirmadosWeb1a10.length > 0
        ? '#' + asientosConfirmadosWeb1a10.join(', #')
        : 'Ninguno'
    }`,
    `ASIENTOS DEL BLOQUE WEB (1 AL 10) LIBERADOS PARA TAQUILLA: ${
      asientosWebLiberadosParaTaquilla.length > 0
        ? '#' + asientosWebLiberadosParaTaquilla.join(', #')
        : 'Ninguno (10/10 Vendidos)'
    }`,
    '-----------------------------------------------------------------------------------------',
    'LISTA DE PASAJEROS CONFIRMADOS (100% PAGADOS — CERO COBRO A BORDO):',
    ...filasPasajeros,
    '=========================================================================================',
  ].join('\n');

  return {
    asientosWebLiberadosParaTaquilla,
    asientosConfirmadosWeb1a10,
    textoImprimible,
  };
}

/**
 * 4. ASIGNACIÓN Y CONTROL ESTRICTO DE FLOTA:
 * - Bloqueo de Vehículos en Ruta (`EN_RUTA` / `DESPACHADO`).
 * - Protocolo de 0 Ventas Web (`DESPACHADO_SIN_VENTAS_WEB`) al llegar a T+0 o con 1 clic.
 */
export function obtenerUnidadesFlotaConBloqueoEnRuta(
  _busDiscoActual?: string
): Array<
  UnidadFlota & {
    seleccionableComoBusReal: boolean;
    motivoBloqueo?: string;
  }
> {
  return FLOTA_UNIDADES.map((u) => {
    const enRutaODespachado =
      u.estadoOperativo === 'EN_RUTA' || u.estadoOperativo === 'DESPACHADO';
    return {
      ...u,
      seleccionableComoBusReal: !enRutaODespachado,
      motivoBloqueo: enRutaODespachado
        ? `BLOQUEADO (${u.estadoOperativo}): ${
            u.rutaActual || 'Unidad fuera de terminal'
          }`
        : undefined,
    };
  });
}

export function ejecutarProtocoloCeroVentasWeb(
  frecuencia: FrecuenciaRuta
): {
  frecuenciaActualizada: FrecuenciaRuta;
  estadoAplicado: 'DESPACHADO_SIN_VENTAS_WEB';
  resumenOperativo: string;
} {
  const boletosWeb = frecuencia.boletos.filter((b) => b.canalVenta === 'WEB');
  if (boletosWeb.length > 0) {
    throw new Error(
      `El turno ${frecuencia.codigoFrecuencia} registra ${boletosWeb.length} boleto(s) web vendido(s). El protocolo DESPACHADO_SIN_VENTAS_WEB aplica únicamente a turnos con 0 ventas en línea.`
    );
  }

  const frecuenciaActualizada: FrecuenciaRuta = {
    ...frecuencia,
    minutosParaSalida: 0,
    ventaWebCongelada: true,
    congeladaAt: new Date().toISOString(),
    estadoDespacho: 'DESPACHADO_SIN_VENTAS_WEB',
    asientosBloqueWeb: frecuencia.asientosBloqueWeb.map((a) => ({
      ...a,
      estado: 'DISPONIBLE_VENTANILLA',
      lockedUntil: null,
    })),
  };

  return {
    frecuenciaActualizada,
    estadoAplicado: 'DESPACHADO_SIN_VENTAS_WEB',
    resumenOperativo: `Protocolo 0 Ventas Web ejecutado en 1 clic: Turno ${frecuencia.codigoFrecuencia} marcado como DESPACHADO_SIN_VENTAS_WEB (T+0).`,
  };
}

/**
 * 5. ACCESO Y ROLES DE SEGURIDAD (RBAC — PIN 4 DÍGITOS)
 * - Rol SECRETARIA (o GERENCIA): Lectura y Escritura total (ventas, reasignaciones, notas de crédito y cierres).
 * - Rol AYUDANTE (Tripulación): Solo Lectura (consultar lista de pasajeros e inspeccionar croquis tricolor de su unidad desde móvil).
 */
export interface PermisosRBACTaquilla {
  rol: RolOperativo;
  modoAcceso: 'LECTURA_ESCRITURA' | 'SOLO_LECTURA';
  etiquetaModo: string;
  descripcionAlcance: string;
  puedeLeerManifiestoYCroquis: boolean;
  puedeVenderEnTaquilla: boolean;
  puedeReasignarFlota: boolean;
  puedeCanjearNotasCredito: boolean;
  puedeCerrarTurnos: boolean;
}

export function obtenerPermisosRBACTaquilla(
  rolOrPin: RolOperativo | string,
  rolOptional?: RolOperativo
): PermisosRBACTaquilla {
  const rol: RolOperativo =
    rolOptional ||
    (rolOrPin === 'AYUDANTE' ||
    rolOrPin === 'SECRETARIA' ||
    rolOrPin === 'GERENCIA'
      ? rolOrPin
      : 'SECRETARIA');

  if (rol === 'AYUDANTE') {
    return {
      rol: 'AYUDANTE',
      modoAcceso: 'SOLO_LECTURA',
      etiquetaModo: 'ROL TRIPULACIÓN / AYUDANTE — MODO SOLO LECTURA',
      descripcionAlcance:
        'Acceso exclusivo de lectura para consultar la lista de pasajeros y el croquis tricolor de 45 asientos desde el teléfono móvil. Ventas y cierres bloqueados.',
      puedeLeerManifiestoYCroquis: true,
      puedeVenderEnTaquilla: false,
      puedeReasignarFlota: false,
      puedeCanjearNotasCredito: false,
      puedeCerrarTurnos: false,
    };
  }

  return {
    rol,
    modoAcceso: 'LECTURA_ESCRITURA',
    etiquetaModo:
      rol === 'SECRETARIA'
        ? 'ROL SECRETARIA TAQUILLA — CONTROL TOTAL (LECTURA / ESCRITURA)'
        : 'ROL GERENCIA / SUPERADMIN — CONTROL TOTAL (LECTURA / ESCRITURA)',
    descripcionAlcance:
      'Control total sobre ventas en ventanilla (asientos 1–45), reasignación de flota, canje de Notas de Crédito (SALDO_A_FAVOR) y cierres T-20m.',
    puedeLeerManifiestoYCroquis: true,
    puedeVenderEnTaquilla: true,
    puedeReasignarFlota: true,
    puedeCanjearNotasCredito: true,
    puedeCerrarTurnos: true,
  };
}

/**
 * Emisión en Taquilla validada con RBAC y Regla Tricolor:
 * - Impide que el rol Tripulación/Ayudante venda o modifique asientos (Solo Lectura).
 * - Impide vender un asiento en estado Naranja/Ocre (#F57C00 — LOCKED_WEB con temporizador 15m activo).
 * - Permite a la Secretaria vender cualquier asiento Verde Menta (#2E7D32) del 1 al 45.
 */
export function venderAsientoTaquillaTricolorConRBAC(params: {
  frecuencia: FrecuenciaRuta;
  rol?: RolOperativo;
  rolOperador?: RolOperativo;
  asientoNumero: number; // 1 al 45
  cedulaRuc: string;
  pasajeroNombre: string;
  telefonoWhatsApp: string;
  destinoParada?: string;
}): {
  frecuenciaActualizada: FrecuenciaRuta;
  boletoEmitido: BoletoEmitido;
} {
  const {
    frecuencia,
    rol,
    rolOperador,
    asientoNumero,
    cedulaRuc,
    pasajeroNombre,
    telefonoWhatsApp,
    destinoParada,
  } = params;

  const rolEfectivo = rol || rolOperador || 'SECRETARIA';
  const permisos = obtenerPermisosRBACTaquilla(
    PIN_CORPORATIVO_OFICIAL,
    rolEfectivo
  );
  if (!permisos.puedeVenderEnTaquilla) {
    throw new Error(
      `ACCESO DENEGADO RBAC (${permisos.etiquetaModo}): El rol Tripulación / Ayudante tiene permiso exclusivo de SOLO LECTURA para consultar la lista de pasajeros y el croquis de la unidad.`
    );
  }

  const mapa45 = construirMapaTricolor45Asientos(frecuencia);
  const asientoInfo = mapa45.find((a) => a.numero === asientoNumero);
  if (!asientoInfo) {
    throw new Error(
      `El asiento #${asientoNumero} no existe en la unidad Hino AK (1 al 45).`
    );
  }

  if (asientoInfo.estadoTricolor === 'RESERVA_PENDIENTE_15M') {
    throw new Error(
      `BLOQUEO TRICOLOR (#F57C00 NARANJA/OCRE): El asiento #${asientoNumero} se encuentra en Reserva Pendiente / Confirmación de Pago (temporizador 15m activo) y está bloqueado para venta presencial hasta que se confirme o expire.`
    );
  }

  if (!asientoInfo.puedeVenderseEnVentanilla) {
    throw new Error(
      `El asiento #${asientoNumero} ya se encuentra Confirmado y Vendido (#912D26 Rojo Vinotinto).`
    );
  }

  const referenciaBancaria = `TAQ-${
    frecuencia.codigoFrecuencia
  }-AS${asientoNumero}-${Date.now().toString().slice(-5)}`;
  const codigoUnico = `QR-TAQ-${frecuencia.codigoFrecuencia}-AS${asientoNumero}`;
  const firmaHmac = generarFirmaHmacQR({
    frecuenciaId: frecuencia.id,
    asientoNumero,
    cedulaRuc,
    referenciaBancaria,
  });

  const boletoEmitido: BoletoEmitido = {
    id: `bol-taq-${Date.now()}-${asientoNumero}`,
    frecuenciaId: frecuencia.id,
    asientoNumero,
    numeroAsiento: asientoNumero,
    codigoUnico,
    cedulaRuc,
    pasajeroNombre,
    telefonoWhatsApp: telefonoWhatsApp || '+593 99 000 0000',
    origen: frecuencia.origen,
    destino: destinoParada || frecuencia.destino,
    montoUSD: frecuencia.tarifaUSD,
    feeTecnologicoUSD: 0.25,
    canalVenta: 'TAQUILLA',
    banco: 'EFECTIVO_TAQUILLA',
    referenciaBancaria,
    firmaHmac,
    firmaDigitalHmac: firmaHmac,
    sincronizadoSri: true,
    manifiestoImpreso: true,
    estadoAbordaje: 'PENDIENTE',
    emitidoAt: new Date().toISOString(),
  };

  if (asientoNumero <= 10) {
    const nuevosAsientosWeb = frecuencia.asientosBloqueWeb.map((a) =>
      a.numero === asientoNumero
        ? {
            ...a,
            estado: 'VENDIDO_TAQUILLA' as const,
            boletoId: boletoEmitido.id,
            pasajeroNombre: boletoEmitido.pasajeroNombre,
            cedulaRuc: boletoEmitido.cedulaRuc,
          }
        : a
    );
    return {
      frecuenciaActualizada: {
        ...frecuencia,
        asientosBloqueWeb: nuevosAsientosWeb,
        boletos: [...frecuencia.boletos, boletoEmitido],
      },
      boletoEmitido,
    };
  }

  // Asiento nativo de ventanilla (11 al 45)
  const vendidos11a45 = Array.from(
    new Set([
      ...(frecuencia.asientosVendidosTaquilla11a45 || []),
      asientoNumero,
    ])
  );

  return {
    frecuenciaActualizada: {
      ...frecuencia,
      asientosVendidosTaquilla11a45: vendidos11a45,
      boletos: [...frecuencia.boletos, boletoEmitido],
    },
    boletoEmitido,
  };
}
