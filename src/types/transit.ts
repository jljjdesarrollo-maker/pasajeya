/**
 * Tipos de datos relacionales basados estrictamente en el esquema Prisma del Sistema Web
 * Autónomo de Venta de Boletos en Línea (Versión 4.0 Multi-Tenant & Auto-Conciliación)
 */

export type RolUsuario = 'SUPERADMIN' | 'GERENCIA' | 'SECRETARIA' | 'PASAJERO_INVITADO';

export type EstadoPago = 
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'MONTO_INCOMPLETO'
  | 'PAGO_EXTEMPORANEO'
  | 'EXPIRADO'
  | 'RECHAZADO';

export type EstadoBoleto = 'RESERVADO' | 'CONFIRMADO' | 'ABORDADO' | 'CANCELADO';

export type BancoOperador = 'BANCO_DE_LOJA' | 'BANCO_PICHINCHA';

export interface TenantBankConfig {
  id: string;
  tenantId: string;
  banco: BancoOperador;
  numeroCuenta: string;
  tipoCuenta: string; // 'Corriente' | 'Ahorros'
  titular: string;
  ruc: string;
  imagenQrUrl: string;
  activo: boolean;
}

export interface TramoTarifa {
  id: string;
  rutaId: string;
  puntoDestino: string;
  tarifaNormal: number;
  tarifaMedia: number;
  esParadaUrbanaLoja: boolean;
}

export interface Ruta {
  id: string;
  tenantId: string;
  origen: string;
  destino: string;
  activa: boolean;
  tramos: TramoTarifa[];
}

export interface UnidadBus {
  id: string;
  tenantId: string;
  numeroDisco: string;
  placa: string;
  capacidadTotal: number;
  modelo?: string;
  chasis?: string;
}

export interface Frecuencia {
  id: string;
  tenantId: string;
  rutaId: string;
  horaSalidaProgramada: string;
  esFrecuenciaRigida: boolean;
}

export interface AsientoLockInfo {
  asiento: number;
  sessionId: string;
  lockedAt: number;
  expiresAt: number; // 15 minutos desde lockedAt
}

export interface ProgramacionTurno {
  id: string;
  tenantId: string;
  frecuenciaId: string;
  frecuenciaHora: string;
  origen: string;
  destino: string;
  destinoFinal: string; // 'Vilcabamba' | 'El Tambo' | 'Yangana' | 'La Elvira'
  paradasAtendidas: string[]; // Lista de paradas intermedias y finales atendidas
  busDiscoTeoricoId: string;
  busDiscoRealId: string | null;
  fecha: string; // ISO Date YYYY-MM-DD
  asientosVendidosWeb: number[];
  asientosBloqueadosTemp: Record<string, AsientoLockInfo>; // key: asiento
  ventaWebCongelada: boolean; // True si faltan <= 20 min para salida
}

export interface Boleto {
  id: string;
  tenantId: string;
  transaccionId: string;
  turnoId: string;
  numeroAsiento: number;
  origen: string;
  destino: string;
  puntoAbordaje: string;
  codigoUnico: string; // VILCA-2026-XXXX
  firmaDigitalHmac: string;
  estado: EstadoBoleto;
  fechaAbordaje: string | null;
  compradorCedula: string;
  compradorNombre: string;
}

export interface TransaccionPago {
  id: string;
  tenantId: string;
  turnoId: string;
  destinoBoleto?: string; // Destino específico seleccionado por el pasajero
  banco: BancoOperador;
  referenciaBanco: string;
  montoEsperado: number;
  montoRecibido: number | null;
  feeServicioCalculado: number; // $0.25 por boleto
  estado: EstadoPago;
  compradorCedula: string;
  compradorNombre: string;
  compradorCorreo: string;
  compradorWhatsApp: string;
  puntoAbordaje: string;
  asientos: number[];
  boletos?: Boleto[];
  createdAt: string;
  reconciledAt?: string;
  reconciliationMethod?: 'REGEX_FAST' | 'GEMINI_AI_NLP' | 'MANUAL';
  reconciliationLog?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  nombreComercial: string;
  ruc: string;
  whatsappSoporte: string;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  configBancos: TenantBankConfig[];
  rutas: Ruta[];
  unidades: UnidadBus[];
  frecuencias: Frecuencia[];
}

export interface FacturacionMensualTenant {
  id: string;
  tenantId: string;
  mesAno: string;
  totalBoletosVendidos: number;
  montoTotalFeeSaaS: number;
  pagado: boolean;
}

export interface LogRespaldoBD {
  id: string;
  tenantId: string;
  fechaRespaldo: string;
  tamanoBytes: number;
  enviadoCorreo: string;
  exitoso: boolean;
  sha256Checksum: string;
}

export interface NotificacionWhatsApp {
  id: string;
  tenantId: string;
  telefonoDestino: string;
  mensaje: string;
  tipo: 'BOLETO_CONFIRMADO' | 'REASIGNACION_DISCO' | 'RECORDATORIO_ABORDAJE';
  enviadoEn: string;
  estado: 'ENVIADO' | 'ENTREGADO' | 'LEIDO' | 'FALLIDO';
}

export interface ScannedQRVerificationResult {
  valid: boolean;
  reason?: string;
  boleto?: Boleto;
  turno?: ProgramacionTurno;
  passengerName?: string;
  asiento?: number;
  busDisco?: string;
  fechaSalida?: string;
  horaSalida?: string;
  alreadyBoarded?: boolean;
  boardedAt?: string;
}
