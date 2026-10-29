/**
 * Prisma Database Seeder para "PasajeYa" (https://pasajeya.vercel.app)
 * Cliente Piloto: Vilcabambaturis Cía. Ltda. (Loja, Ecuador)
 *
 * Inicializa:
 * - Tenant base
 * - Cuentas bancarias de prueba (Banco de Loja & Banco Pichincha)
 * - Flota de autobuses (Discos 04, 12, 18, 25)
 * - Rutas bifurcadas oficiales:
 *     1. Troncal Sur: Loja ⇄ Malacatos ⇄ Vilcabamba ⇄ Yangana ⇄ Zahuayco ⇄ La Elvira
 *     2. Ramal Noroccidente: Loja ⇄ Malacatos ⇄ El Tambo
 * - Frecuencias y Programación de Turnos con bloqueo exclusivo de asientos 1-10
 */

import { PrismaClient, BancoOperador } from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_DATA = {
  tenant: {
    slug: 'vilcabambaturis',
    nombreComercial: 'Vilcabambaturis Cía. Ltda.',
    ruc: '1191728394001',
    whatsappSoporte: '+593987654321',
    activo: true,
  },
  bancos: [
    {
      banco: BancoOperador.BANCO_DE_LOJA,
      numeroCuenta: '2901234567',
      tipoCuenta: 'Corriente',
      titular: 'Vilcabambaturis Cía. Ltda.',
      ruc: '1191728394001',
      imagenQrUrl: '/qr/banco-loja.png',
      activo: true,
    },
    {
      banco: BancoOperador.BANCO_PICHINCHA,
      numeroCuenta: '3109876543',
      tipoCuenta: 'Corriente',
      titular: 'Vilcabambaturis Cía. Ltda.',
      ruc: '1191728394001',
      imagenQrUrl: '/qr/deuna-pichincha.png',
      activo: true,
    },
  ],
  unidades: [
    { numeroDisco: '04', placa: 'LBA-2564', capacidadTotal: 45 },
    { numeroDisco: '12', placa: 'LBA-3190', capacidadTotal: 45 },
    { numeroDisco: '18', placa: 'LBA-1845', capacidadTotal: 45 },
    { numeroDisco: '25', placa: 'LBA-4012', capacidadTotal: 45 },
  ],
  rutas: [
    {
      origen: 'Loja (Terminal Reina del Cisne)',
      destino: 'Vilcabamba (Valle de la Longevidad)',
      activa: true,
      tramos: [
        { puntoDestino: 'Malacatos (Parque Central)', tarifaNormal: 1.50, tarifaMedia: 0.75, esParadaUrbanaLoja: false },
        { puntoDestino: 'Vilcabamba (Terminal Principal)', tarifaNormal: 2.00, tarifaMedia: 1.00, esParadaUrbanaLoja: false },
        { puntoDestino: 'Yangana (Centro)', tarifaNormal: 3.00, tarifaMedia: 1.50, esParadaUrbanaLoja: false },
        { puntoDestino: 'Zahuayco', tarifaNormal: 3.25, tarifaMedia: 1.60, esParadaUrbanaLoja: false },
        { puntoDestino: 'La Elvira', tarifaNormal: 3.50, tarifaMedia: 1.75, esParadaUrbanaLoja: false },
      ],
      frecuencias: ['06:00', '07:15', '10:00', '11:30', '13:00', '14:30', '16:00', '19:00'],
    },
    {
      origen: 'Loja (Terminal Reina del Cisne)',
      destino: 'El Tambo (Intersección Noroccidente)',
      activa: true,
      tramos: [
        { puntoDestino: 'Malacatos (Parque Central)', tarifaNormal: 1.50, tarifaMedia: 0.75, esParadaUrbanaLoja: false },
        { puntoDestino: 'El Tambo (Intersección)', tarifaNormal: 2.50, tarifaMedia: 1.25, esParadaUrbanaLoja: false },
      ],
      frecuencias: ['08:30', '17:30'],
    },
  ],
};

async function main() {
  console.log('🌱 [PasajeYa] Iniciando seed en Neon PostgreSQL con Prisma ORM...');

  // 1. Upsert Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: SEED_DATA.tenant.slug },
    update: {
      nombreComercial: SEED_DATA.tenant.nombreComercial,
      ruc: SEED_DATA.tenant.ruc,
      whatsappSoporte: SEED_DATA.tenant.whatsappSoporte,
      activo: true,
    },
    create: {
      slug: SEED_DATA.tenant.slug,
      nombreComercial: SEED_DATA.tenant.nombreComercial,
      ruc: SEED_DATA.tenant.ruc,
      whatsappSoporte: SEED_DATA.tenant.whatsappSoporte,
      activo: true,
    },
  });
  console.log(`✅ Tenant configurado: ${tenant.nombreComercial} (ID: ${tenant.id})`);

  // 2. Cuentas Bancarias
  for (const b of SEED_DATA.bancos) {
    await prisma.tenantBankConfig.upsert({
      where: {
        tenantId_banco: {
          tenantId: tenant.id,
          banco: b.banco,
        },
      },
      update: {
        numeroCuenta: b.numeroCuenta,
        tipoCuenta: b.tipoCuenta,
        titular: b.titular,
        ruc: b.ruc,
        imagenQrUrl: b.imagenQrUrl,
        activo: true,
      },
      create: {
        tenantId: tenant.id,
        banco: b.banco,
        numeroCuenta: b.numeroCuenta,
        tipoCuenta: b.tipoCuenta,
        titular: b.titular,
        ruc: b.ruc,
        imagenQrUrl: b.imagenQrUrl,
        activo: true,
      },
    });
  }
  console.log(`✅ Cuentas bancarias configuradas (${SEED_DATA.bancos.length})`);

  // 3. Unidades de Autobús
  const createdBuses = [];
  for (const u of SEED_DATA.unidades) {
    const existing = await prisma.unidadBus.findFirst({
      where: { tenantId: tenant.id, numeroDisco: u.numeroDisco },
    });
    if (existing) {
      const updated = await prisma.unidadBus.update({
        where: { id: existing.id },
        data: { placa: u.placa, capacidadTotal: u.capacidadTotal },
      });
      createdBuses.push(updated);
    } else {
      const created = await prisma.unidadBus.create({
        data: {
          tenantId: tenant.id,
          numeroDisco: u.numeroDisco,
          placa: u.placa,
          capacidadTotal: u.capacidadTotal,
        },
      });
      createdBuses.push(created);
    }
  }
  console.log(`✅ ${createdBuses.length} Unidades de autobús registradas (Discos 04, 12, 18, 25).`);

  // 4. Rutas, Tramos y Frecuencias
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  let busIndex = 0;
  for (const r of SEED_DATA.rutas) {
    let ruta = await prisma.ruta.findFirst({
      where: { tenantId: tenant.id, origen: r.origen, destino: r.destino },
    });

    if (!ruta) {
      ruta = await prisma.ruta.create({
        data: {
          tenantId: tenant.id,
          origen: r.origen,
          destino: r.destino,
          activa: r.activa,
        },
      });
    }

    // Tramos
    for (const t of r.tramos) {
      const existingTramo = await prisma.tramoTarifa.findFirst({
        where: { rutaId: ruta.id, puntoDestino: t.puntoDestino },
      });
      if (!existingTramo) {
        await prisma.tramoTarifa.create({
          data: {
            rutaId: ruta.id,
            puntoDestino: t.puntoDestino,
            tarifaNormal: t.tarifaNormal,
            tarifaMedia: t.tarifaMedia,
            esParadaUrbanaLoja: t.esParadaUrbanaLoja,
          },
        });
      }
    }

    // Frecuencias y Turnos de Hoy
    for (const hora of r.frecuencias) {
      let freq = await prisma.frecuencia.findFirst({
        where: { tenantId: tenant.id, rutaId: ruta.id, horaSalidaProgramada: hora },
      });
      if (!freq) {
        freq = await prisma.frecuencia.create({
          data: {
            tenantId: tenant.id,
            rutaId: ruta.id,
            horaSalidaProgramada: hora,
            esFrecuenciaRigida: true,
          },
        });
      }

      // Turno programado para hoy
      const busAsignado = createdBuses[busIndex % createdBuses.length];
      busIndex++;

      const existingTurno = await prisma.programacionTurno.findFirst({
        where: {
          tenantId: tenant.id,
          frecuenciaId: freq.id,
          fecha: hoy,
        },
      });

      if (!existingTurno) {
        await prisma.programacionTurno.create({
          data: {
            tenantId: tenant.id,
            frecuenciaId: freq.id,
            busDiscoTeoricoId: busAsignado.id,
            fecha: hoy,
            asientosVendidosWeb: [],
            asientosBloqueadosTemp: {},
            ventaWebCongelada: false,
          },
        });
      }
    }
  }
  console.log(`✅ Rutas bifurcadas, tramos tarifarios y programación horaria completada.`);
  console.log(`🎯 Bloque de asientos web: Asientos 1 al 10 habilitados para locking atómico de 15 min.`);
  console.log(`🚀 Sembrado de base de datos Neon finalizado exitosamente.`);
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seed de Prisma:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
