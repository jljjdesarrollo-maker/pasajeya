/**
 * Neon PostgreSQL Client & Service Integration
 * Conecta la aplicación PasajeYa directamente con el clúster de Neon PostgreSQL
 * utilizando @neondatabase/serverless.
 */

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED;

export function getNeonSql() {
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada en .env ni .env.local');
  }
  return neon(connectionString);
}

/**
 * Inicializa el esquema relacional en Neon PostgreSQL
 */
export async function initNeonSchema() {
  const sql = getNeonSql();

  // 1. Enum types
  await sql`
    DO $$ BEGIN
      CREATE TYPE "RolUsuario" AS ENUM ('SUPERADMIN', 'GERENCIA', 'SECRETARIA', 'PASAJERO_INVITADO');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'MONTO_INCOMPLETO', 'PAGO_EXTEMPORANEO', 'EXPIRADO', 'RECHAZADO');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE "EstadoBoleto" AS ENUM ('RESERVADO', 'CONFIRMADO', 'ABORDADO', 'CANCELADO');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  await sql`
    DO $$ BEGIN
      CREATE TYPE "BancoOperador" AS ENUM ('BANCO_DE_LOJA', 'BANCO_PICHINCHA');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `;

  // 2. Tablas Principales
  await sql`
    CREATE TABLE IF NOT EXISTS "Tenant" (
      "id" TEXT PRIMARY KEY,
      "slug" TEXT UNIQUE NOT NULL,
      "nombreComercial" TEXT NOT NULL,
      "ruc" TEXT UNIQUE NOT NULL,
      "whatsappSoporte" TEXT NOT NULL,
      "activo" BOOLEAN DEFAULT true,
      "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "TenantBankConfig" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "banco" "BancoOperador" NOT NULL,
      "numeroCuenta" TEXT NOT NULL,
      "tipoCuenta" TEXT NOT NULL,
      "titular" TEXT NOT NULL,
      "ruc" TEXT NOT NULL,
      "imagenQrUrl" TEXT,
      "activo" BOOLEAN DEFAULT true,
      UNIQUE ("tenantId", "banco")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Ruta" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "origen" TEXT NOT NULL,
      "destino" TEXT NOT NULL,
      "activa" BOOLEAN DEFAULT true
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "TramoTarifa" (
      "id" TEXT PRIMARY KEY,
      "rutaId" TEXT REFERENCES "Ruta"("id") ON DELETE CASCADE,
      "puntoDestino" TEXT NOT NULL,
      "tarifaNormal" DOUBLE PRECISION NOT NULL,
      "tarifaMedia" DOUBLE PRECISION NOT NULL,
      "esParadaUrbanaLoja" BOOLEAN DEFAULT false
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "UnidadBus" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "numeroDisco" TEXT NOT NULL,
      "placa" TEXT NOT NULL,
      "capacidadTotal" INTEGER DEFAULT 45
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Frecuencia" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "rutaId" TEXT REFERENCES "Ruta"("id") ON DELETE CASCADE,
      "horaSalidaProgramada" TEXT NOT NULL,
      "esFrecuenciaRigida" BOOLEAN DEFAULT true
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "ProgramacionTurno" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "frecuenciaId" TEXT REFERENCES "Frecuencia"("id") ON DELETE CASCADE,
      "busDiscoTeoricoId" TEXT REFERENCES "UnidadBus"("id"),
      "busDiscoRealId" TEXT REFERENCES "UnidadBus"("id"),
      "fecha" DATE NOT NULL,
      "asientosVendidosWeb" INTEGER[] DEFAULT '{}',
      "asientosBloqueadosTemp" JSONB,
      "ventaWebCongelada" BOOLEAN DEFAULT false
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "TransaccionPago" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "turnoId" TEXT REFERENCES "ProgramacionTurno"("id") ON DELETE CASCADE,
      "banco" "BancoOperador" NOT NULL,
      "referenciaBanco" TEXT NOT NULL,
      "montoEsperado" DOUBLE PRECISION NOT NULL,
      "montoRecibido" DOUBLE PRECISION,
      "feeServicioCalculado" DOUBLE PRECISION DEFAULT 0.25,
      "estado" "EstadoPago" DEFAULT 'PENDIENTE',
      "compradorCedula" TEXT NOT NULL,
      "compradorNombre" TEXT NOT NULL,
      "compradorCorreo" TEXT NOT NULL,
      "compradorWhatsApp" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("tenantId", "referenciaBanco")
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "Boleto" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "transaccionId" TEXT REFERENCES "TransaccionPago"("id") ON DELETE CASCADE,
      "turnoId" TEXT REFERENCES "ProgramacionTurno"("id") ON DELETE CASCADE,
      "numeroAsiento" INTEGER NOT NULL,
      "origen" TEXT NOT NULL,
      "destino" TEXT NOT NULL,
      "puntoAbordaje" TEXT NOT NULL,
      "codigoUnico" TEXT UNIQUE NOT NULL,
      "firmaDigitalHmac" TEXT NOT NULL,
      "estado" "EstadoBoleto" DEFAULT 'RESERVADO',
      "fechaAbordaje" TIMESTAMP(3)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "FacturacionMensualTenant" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "mesAno" TEXT NOT NULL,
      "totalBoletosVendidos" INTEGER NOT NULL,
      "montoTotalFeeSaaS" DOUBLE PRECISION NOT NULL,
      "pagado" BOOLEAN DEFAULT false
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "LogRespaldoBD" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT REFERENCES "Tenant"("id") ON DELETE CASCADE,
      "fechaRespaldo" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      "tamanoBytes" INTEGER NOT NULL,
      "enviadoCorreo" TEXT NOT NULL,
      "exitoso" BOOLEAN DEFAULT true
    );
  `;

  return { success: true, message: 'Esquema Neon PostgreSQL inicializado correctamente.' };
}

/**
 * Prueba de conexión y estado de salud
 */
export async function checkNeonHealth() {
  try {
    const sql = getNeonSql();
    const result = await sql`
      SELECT 
        current_database() as database,
        current_user as user,
        version() as version,
        NOW() as server_time
    `;
    return {
      connected: true,
      branch: process.env.NEON_BRANCH || 'production',
      data: result[0]
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message
    };
  }
}
