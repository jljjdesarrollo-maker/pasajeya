export type RolOperativo = 'SECRETARIA' | 'GERENCIA' | 'AYUDANTE';

export type EstadoAsiento =
  | 'DISPONIBLE_WEB'
  | 'LOCKED_WEB'
  | 'VENDIDO_WEB'
  | 'DISPONIBLE_VENTANILLA'
  | 'VENDIDO_TAQUILLA';

export type EstadoAbordaje = 'PENDIENTE' | 'ABORDADO';

export type MetodoVerificacionAbordaje =
  | 'QR_HMAC_OFFLINE'
  | 'MANUAL_CEDULA_ASIENTO';

export type BancoConciliacion =
  | 'BANCO_DE_LOJA'
  | 'BANCO_PICHINCHA'
  | 'DEUNA_PICHINCHA'
  | 'EFECTIVO_TAQUILLA'
  | 'SALDO_A_FAVOR';

export type EstadoNotaCredito = 'ACTIVE' | 'USED' | 'EXPIRED';

export interface NotaCreditoSaldoRecord {
  id: string;
  tenantId: string;
  codigoNotaCredito: string; // Ej: "NC-SALDO-BL994812"
  cedulaRuc: string;
  pasajeroNombre: string;
  telefonoWhatsApp: string;
  bancoOrigen: BancoConciliacion;
  referenciaBancoOrigen: string;
  motivoOrigen:
    | 'PAGO_POST_T20_MIN'
    | 'PAGO_INCOMPLETO_NO_LIQUIDADO_T20';
  montoOriginalUSD: number;
  saldoDisponibleUSD: number;
  feeTecnologicoCobradoUSD: number; // Siempre $0.00 cuando no emitió boleto
  reembolsoEfectivoPermitido: false; // Invariante: 0 efectivo en ventanilla
  estado: EstadoNotaCredito; // ACTIVE | USED | EXPIRED (a los 30 días calendario)
  fechaEmision: string;
  fechaExpiracion: string; // +30 días calendario
  canjeadoEnBoletoId?: string;
  canjeadoAt?: string;
}

export interface AsientoBloqueWeb {
  numero: number; // 1 al 10
  estado: EstadoAsiento;
  lockedUntil?: string | null;
  boletoId?: string | null;
  pasajeroNombre?: string;
  cedulaRuc?: string;
}

export interface BoletoEmitido {
  id: string;
  transaccionId?: string;
  frecuenciaId: string;
  asientoNumero: number;
  numeroAsiento?: number; // Campo relacional 1-a-N
  codigoUnico?: string; // Código QR único individual por boleto
  cedulaRuc: string;
  pasajeroNombre: string;
  esMedioPasaje?: boolean;
  edadPasajero?: number;
  categoriaTarifaANT?: 'TARIFA_COMPLETA_100' | 'MEDIO_PASAJE_MENOR_18' | 'MEDIO_PASAJE_ADULTO_MAYOR_65';
  telefonoWhatsApp: string;
  correoSri?: string;
  origen: string;
  destino: string;
  montoUSD: number;
  feeTecnologicoUSD?: number;
  canalVenta: 'WEB' | 'TAQUILLA';
  banco: BancoConciliacion;
  referenciaBancaria: string;
  firmaHmac: string;
  firmaDigitalHmac?: string; // Firma criptográfica individual del QR
  sincronizadoSri: boolean;
  manifiestoImpreso?: boolean;
  estadoAbordaje?: EstadoAbordaje;
  abordadoAt?: string | null;
  metodoAbordaje?: MetodoVerificacionAbordaje;
  emitidoAt: string;
}

export interface PasajeroOfflineRecord {
  boletoId: string;
  frecuenciaId: string;
  codigoFrecuencia: string;
  asientoNumero: number;
  cedulaRuc: string;
  pasajeroNombre: string;
  origen: string;
  destino: string;
  montoUSD: number;
  canalVenta: 'WEB' | 'TAQUILLA';
  referenciaBancaria: string;
  firmaHmac: string;
  estadoAbordaje: EstadoAbordaje;
  abordadoAt?: string | null;
  metodoAbordaje?: MetodoVerificacionAbordaje;
  tramoAbordaje?: string;
  sincronizadoNube: boolean;
}

export interface EventoDeltaAbordaje {
  id: string;
  boletoId: string;
  frecuenciaId: string;
  asientoNumero: number;
  cedulaRuc: string;
  pasajeroNombre: string;
  estado: 'ABORDADO';
  metodo: MetodoVerificacionAbordaje;
  firmaHmacVerificada: string;
  tramoCarretera: string;
  marcadoOfflineAt: string;
  sincronizadoAt?: string | null;
  sincronizado: boolean;
}

export interface ResultadoSyncBoarding {
  endpoint: '/api/v1/tickets/sync-boarding';
  procesados: number;
  boletosActualizadosIds: string[];
  timestampServidor: string;
  latenciaMs: number;
  baseDatos: 'Neon PostgreSQL (Prisma ORM)';
}

export interface AlertaWhatsAppLog {
  id: string;
  frecuenciaId: string;
  asientoNumero: number;
  pasajeroNombre: string;
  telefonoWhatsApp: string;
  busDiscoAnterior: string;
  busDiscoNuevo: string;
  motivo: string;
  mensaje: string;
  gatewayEndpoint: string;
  latenciaMs: number;
  estado: 'ENTREGADO_VPS';
  timestamp: string;
}

export interface UnidadFlota {
  disco: string;
  placa: string;
  chofer: string;
  capacidad: number;
  pinUnidad?: string; // PIN corporativo de 4 dígitos asignado al autobús (ej. "1191" o "1108")
  ultimoResetPinAt?: string | null;
  estadoOperativo:
    | 'ACTIVO'
    | 'RESERVA_ANDEN'
    | 'EN_RUTA'
    | 'DESPACHADO'
    | 'MANTENIMIENTO';
  rutaActual?: string;
}

export type EstadoDespachoFrecuencia =
  | 'PROGRAMADO'
  | 'CONGELADO_T20'
  | 'DESPACHADO_CON_PASAJEROS'
  | 'DESPACHADO_SIN_VENTAS_WEB';

export interface FrecuenciaRuta {
  id: string;
  codigoFrecuencia: string;
  origen: string;
  destino: string;
  paradasIntermedias: string[];
  horaSalida: string;
  minutosParaSalida: number;
  tarifaUSD: number;
  anden: string;
  busDiscoTeorico: string;
  busDiscoReal: string;
  placaBusReal: string;
  choferAsignado: string;
  ventaWebCongelada: boolean;
  congeladaAt?: string | null;
  estadoDespacho?: EstadoDespachoFrecuencia;
  asientosBloqueWeb: AsientoBloqueWeb[]; // Asientos 1 al 10
  asientosVendidosTaquilla11a45?: number[]; // Asientos nativos de taquilla (11 al 45) vendidos
  boletos: BoletoEmitido[];
}

export interface FilaSincronizacionSRI {
  boletoId: string;
  asiento: number;
  tipoIdentificacion: 'CEDULA' | 'RUC';
  identificacion: string;
  razonSocialNombres: string;
  telefono: string;
  origen: string;
  destino: string;
  conceptoSri: string;
  subtotal0: string;
  iva: string;
  totalUSD: string;
  referenciaPago: string;
  banco: string;
  sincronizadoSri: boolean;
}

export interface LogRespaldoBDRecord {
  id: string;
  tenantId: string;
  archivoNombre: string;
  tamanoBytes: number;
  tablasIncluidas: number;
  registrosTotales: number;
  correoDestinatario: string;
  checksumSha256: string;
  estado: 'EXITOSO' | 'ERROR';
  cronExpresion: string;
  sqlDumpPreview: string;
  ejecutadoAt: string;
}

export interface FacturacionMensualTenantRecord {
  id: string;
  tenantId: string;
  tenantNombre: string;
  tenantRuc: string;
  periodoMes: string; // Ej: "2026-10"
  etiquetaMes: string; // Ej: "Octubre 2026"
  boletosEmitidosTotal: number;
  recaudacionBrutaUSD: number;
  feeUnitarioUSD: number; // $0.25 por boleto
  feeTecnologicoTotalUSD: number;
  netoCooperativaUSD: number;
  estadoLiquidacion:
    | 'EN_CURSO'
    | 'BORRADOR_PREFACTURA_DIA_1'
    | 'APROBADA_POR_GERENCIA'
    | 'CONCILIADO_PAGADO'
    | 'PENDIENTE_PAGO';
  comprobanteLiquidacion?: string;
  updatedAt: string;
}

// ============================================================================
// MÓDULOS 5 Y 6: ARQUEO SEPARADO, QUEMA DE SALDOS A FAVOR, PRODUCCIÓN POR DISCO
// Y CONSOLA DE CONFIGURACIÓN GLOBAL (/admin/configuracion)
// ============================================================================

export type EstadoSaldoAFavor =
  | 'ACTIVO'
  | 'CONSUMIDO_EN_TAQUILLA'
  | 'EXPIRADO';

export interface SaldoAFavorRecord {
  id: string;
  tenantId: string;
  cedulaRuc: string;
  depositanteNombre: string;
  telefonoWhatsApp: string;
  banco: BancoConciliacion;
  referenciaBancaria: string;
  montoUSD: number;
  estado: EstadoSaldoAFavor;
  codigoQuemaUnico?: string | null; // Ej: "SALDO-849201"
  pinSecretariaQuema?: string | null;
  consumidoAt?: string | null;
  reversibleHasta?: string | null; // +3 minutos para [Revertir Canje (3 min)]
  formaPagoRegistradaTaquilla?: 'Saldo a Favor' | 'Transferencia' | null;
  efectivoEntregadoUSD: 0; // Invariante: $0.00 de entrega o salida de efectivo físico
  feeTecnologicoUSD: 0; // $0.00 sobre transferencias que no emitieron boleto
  notificacionWhatsAppEnviada?: boolean;
  fechaHoraDeposito: string;
  fechaExpiracion: string;
}

export interface ArqueoVentanillaSeparadoResult {
  fechaOperativa: string;
  secretariaNombre: string;
  // Bloque 1: Cierre Exclusivo de Efectivo Físico en Ventanilla
  ventaFisicaEfectivoUSD: number;
  encomiendasEfectivoUSD: number;
  totalEfectivoCajonUSD: number; // $VentaFisicaEfectivo + $EncomiendasEfectivo = $TotalEfectivoCajon
  formulaArqueoEfectivo: string;
  // Bloque 2: Bloque Informativo Separado (Cero Mezcla con Dinero Web)
  tituloBloqueTransferenciasWeb: 'Ventas en Línea por Transferencia (Auditoría Contable)';
  boletosWebTransferenciaCount: number;
  totalVentasWebTransferenciaUSD: number;
  saldosAFavorCanjeadosCount: number;
  totalSaldosAFavorCanjeadosUSD: number;
  afectacionEfectivoCajonPorWebUSD: 0; // Invariante: $0.00 dólares de afectación o descuadre
  tsvDescargableContadora: string;
}

export interface ProduccionDiscoRow {
  numeroDisco: number; // 1 al 16
  discoEtiqueta: string; // "Disco 01" ... "Disco 16"
  placa: string;
  choferTitular: string;
  boletosWebVendidosMes: number;
  recaudacionBrutaMesUSD: number;
  boletosWebVendidosAnual: number;
  recaudacionBrutaAnualUSD: number;
  turnosOperadosMes: number;
  capacidadBloqueWebTotal: number; // turnosOperadosMes * 10 asientos web
  porcentajeOcupacionBloqueWeb: number; // 0 a 100% sobre asientos 1 al 10
}

export interface CuadreConciliacionBancariaFondos {
  totalBoletosEmitidosUSD: number;
  totalSaldosActivosUSD: number;
  totalSaldosConsumidosTaquillaUSD: number;
  totalSaldosExpiradosUSD: number;
  totalBancoExtractoUSD: number; // Total Banco = Total Boletos Emitidos + Total Saldos Activos + Total Saldos Expirados
  cuadreAlCentavoVerificado: boolean;
  diferenciaCentavosUSD: number;
  formulaCuadreContadora: string;
  registrosSaldosCustodia: SaldoAFavorRecord[];
}

export interface LiquidacionDia1Prefactura {
  id: string;
  periodoLiquidado: string; // Ej: "2026-10 (Octubre 2026)"
  fechaEjecucionAutomatica: string; // Ej: "2026-11-01 00:05:00 AM"
  cronExpresion: '5 0 1 * *';
  boletosConfirmadosAuditados: number;
  transferenciasSinBoletoExcluidas: number;
  feeUnitarioUSD: 0.25;
  totalPrefacturaFeeUSD: number; // N boletos CONFIRMADO * $0.25
  feeSobreTransferenciasIncompletasUSD: 0;
  correoGerenciaDestino: string;
  notificacionEmailEnviada: boolean;
  estado: 'BORRADOR_PREFACTURA' | 'APROBADA_POR_GERENCIA';
  aprobadaAt?: string | null;
  aprobadaPor?: string | null;
}

export interface CuentaBancariaConfigurable {
  id: string;
  banco: 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA';
  nombreMostrar: string;
  tipoCuenta: 'Cuenta Corriente' | 'Cuenta de Ahorros';
  numeroCuenta: string;
  rucTitular: string;
  titularCuenta: string;
  qrImagenUrl: string;
  habilitadaCheckout: boolean;
}

export interface ConfiguracionGlobalSistema {
  tenantId: string;
  // A. Control de Canales de Cobro (Toggles en 1-Clic)
  bancoDeLojaActivo: boolean;
  bancoPichinchaDeunaActivo: boolean;
  // B. Gestor de Cuentas Bancarias y Códigos QR
  cuentasBancarias: CuentaBancariaConfigurable[];
  // C. Configuración de WhatsApp y Soporte
  whatsappSoporteCliente: string;
  gatewayWhatsappApiUrl: string;
  gatewayWhatsappToken: string;
  // D. Respaldo Automático de Base de Datos (Backup SQL 23:50 PM)
  correoInstitucionalGerenciaSistemas: string;
  cronBackupHorarioNocturno: '23:50 PM (50 23 * * *)';
  encriptacionDumpSql: 'AES-256-GCM + GZIP (PostgreSQL)';
  updatedAt: string;
}

