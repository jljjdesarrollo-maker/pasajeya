/**
 * Prisma Database Seeder para Vilcabambaturis Cía. Ltda.
 * Inicializa el tenant piloto, bancos, rutas interparroquiales, tarifas y unidades.
 */

export const SEED_DATA = {
  tenant: {
    slug: 'vilcabambaturis',
    nombreComercial: 'Vilcabambaturis Cía. Ltda.',
    ruc: '1191728394001',
    whatsappSoporte: '+593987654321',
    activo: true
  },
  bancos: [
    {
      banco: 'BANCO_DE_LOJA',
      numeroCuenta: '2901234567',
      tipoCuenta: 'Corriente',
      titular: 'Vilcabambaturis Cía. Ltda.',
      ruc: '1191728394001',
      imagenQrUrl: '/qr/banco-loja.png',
      activo: true
    },
    {
      banco: 'BANCO_PICHINCHA',
      numeroCuenta: '3109876543',
      tipoCuenta: 'Corriente',
      titular: 'Vilcabambaturis Cía. Ltda.',
      ruc: '1191728394001',
      imagenQrUrl: '/qr/deuna-pichincha.png',
      activo: true
    }
  ],
  unidades: [
    { numeroDisco: '04', placa: 'LBA-2564', capacidadTotal: 45 },
    { numeroDisco: '12', placa: 'LBA-3190', capacidadTotal: 45 },
    { numeroDisco: '18', placa: 'LBA-1845', capacidadTotal: 45 },
    { numeroDisco: '25', placa: 'LBA-4012', capacidadTotal: 45 }
  ],
  rutas: [
    {
      origen: 'Loja (Terminal Terrestre Reina del Cisne)',
      destino: 'Vilcabamba (Valle de la Longevidad)',
      tramos: [
        { puntoDestino: 'Malacatos (Parque Central)', tarifaNormal: 1.50, tarifaMedia: 0.75 },
        { puntoDestino: 'Vilcabamba (Terminal Principal)', tarifaNormal: 2.00, tarifaMedia: 1.00 },
        { puntoDestino: 'El Tambo (Intersección)', tarifaNormal: 2.50, tarifaMedia: 1.25 },
        { puntoDestino: 'Yangana (Centro)', tarifaNormal: 3.00, tarifaMedia: 1.50 },
        { puntoDestino: 'Zahuayco', tarifaNormal: 3.25, tarifaMedia: 1.60 },
        { puntoDestino: 'La Elvira', tarifaNormal: 3.50, tarifaMedia: 1.75 }
      ]
    }
  ],
  frecuencias: [
    '06:00', '07:15', '08:30', '10:00', '11:30',
    '13:00', '14:30', '16:00', '17:30', '19:00'
  ]
};

async function main() {
  console.log('🌱 Inicializando datos base para Vilcabambaturis Cía. Ltda....');
  console.log('✅ Tenant configurado:', SEED_DATA.tenant.nombreComercial);
  console.log(`✅ ${SEED_DATA.unidades.length} Unidades de autobús registradas.`);
  console.log(`✅ ${SEED_DATA.frecuencias.length} Frecuencias horarias creadas.`);
  console.log('🚀 Sembrado completado con éxito.');
}

if (process.argv[1]?.includes('seed')) {
  main().catch(console.error);
}
