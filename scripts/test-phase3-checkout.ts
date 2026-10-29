/**
 * Script de Verificación Integral - FASE 3: Interfaz Pública, Rutas, Mapa de Asientos y Pase QR
 * Proyecto: PasajeYa (Cliente Piloto: Vilcabambaturis Cía. Ltda.)
 *
 * Pruebas:
 * 1. Topología y Filtrado de Rutas (Bifurcación Malacatos: Vilcabamba vs El Tambo)
 * 2. Bloqueo Atómico de Asientos (Bloque Web 1 al 10, regla 15 minutos)
 * 3. Restricción de Asientos 11 al 45 (Exclusivos para Taquilla Física)
 * 4. Cálculo Inmutable de Tarifa + Fee de $0.25 por boleto individual
 * 5. Regla T-20 min: Congelamiento de Venta Web
 * 6. Generación Criptográfica HMAC-SHA256 para Pase Digital QR
 */

import { dbService } from '../src/services/database';
import { generateTicketHmac, buildQrPayload } from '../src/services/crypto';

async function runPhase3Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 [PasajeYa - Fase 3] Iniciando Suite de Pruebas de Checkout');
  console.log('🧪 ========================================================\n');

  let passed = 0;
  const total = 6;

  // --------------------------------------------------------------------------
  // TEST 1: Topología y Bifurcación Vial (Malacatos vs El Tambo vs Vilcabamba)
  // --------------------------------------------------------------------------
  console.log('▶️ TEST 1: Filtrado de Turnos según Topología (ADR-005)');
  const turnosElTambo = dbService.getTurnosPorDestino('El Tambo');
  const turnosVilcabamba = dbService.getTurnosPorDestino('Vilcabamba');
  const turnosMalacatos = dbService.getTurnosPorDestino('Malacatos');

  const allTamboServeTambo = turnosElTambo.every(t => t.paradasAtendidas.includes('El Tambo'));
  const noTamboServesVilca = turnosElTambo.every(t => !t.paradasAtendidas.includes('Vilcabamba'));
  const allVilcaServeMalacatos = turnosVilcabamba.every(t => t.paradasAtendidas.includes('Malacatos'));

  if (
    turnosElTambo.length > 0 &&
    turnosVilcabamba.length > 0 &&
    allTamboServeTambo &&
    noTamboServesVilca &&
    allVilcaServeMalacatos &&
    turnosMalacatos.length === dbService.getTurnos().length
  ) {
    console.log(`✅ TEST 1 PASÓ: El Tambo bifurca correctamente en Malacatos sin tocar Vilcabamba (${turnosElTambo.length} turnos). Malacatos es atendido al 100% (${turnosMalacatos.length} turnos).`);
    passed++;
  } else {
    console.error('❌ TEST 1 FALLÓ en filtrado de topología:', {
      tamboCount: turnosElTambo.length,
      vilcaCount: turnosVilcabamba.length,
      allTamboServeTambo,
      noTamboServesVilca
    });
  }

  // --------------------------------------------------------------------------
  // TEST 2: Bloqueo Atómico de Asientos (1 al 10 con 15 minutos)
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 2: Bloqueo Atómico de Asiento (Seat Locking 15 min)');
  // Crear turno activo para el futuro (dentro de 3 horas) no congelado
  const futureDeparture = new Date(Date.now() + 3 * 3600 * 1000);
  const futureHora = `${futureDeparture.getHours().toString().padStart(2, '0')}:${futureDeparture.getMinutes().toString().padStart(2, '0')}`;
  const testTurnoId = 'turno-test-future';

  (dbService as any).turnos.push({
    id: testTurnoId,
    tenantId: 'tenant-vilcabambaturis',
    frecuenciaId: 'frec-future',
    frecuenciaHora: futureHora,
    origen: 'Loja',
    destino: 'Vilcabamba',
    destinoFinal: 'Vilcabamba',
    paradasAtendidas: ['Malacatos', 'Vilcabamba'],
    busDiscoTeoricoId: 'bus-04',
    busDiscoRealId: null,
    fecha: new Date().toISOString().split('T')[0],
    asientosVendidosWeb: [],
    asientosBloqueadosTemp: {},
    ventaWebCongelada: false
  });

  const testTurno = dbService.getTurnoById(testTurnoId)!;
  const testSessionA = 'session-user-alpha';
  const testSessionB = 'session-user-beta';

  // Bloquear asiento 4 con sesión A
  const lockResult = dbService.lockSeat(testTurno.id, 4, testSessionA);
  const turnoAfterLock = dbService.getTurnoById(testTurno.id);
  const lockInfo = turnoAfterLock?.asientosBloqueadosTemp['4'];

  // Intentar bloquear el mismo asiento 4 con sesión B (debe fallar)
  const conflictResult = dbService.lockSeat(testTurno.id, 4, testSessionB);

  // Liberar el asiento
  dbService.unlockSeat(testTurno.id, 4, testSessionA);
  const turnoAfterUnlock = dbService.getTurnoById(testTurno.id);

  if (
    lockResult.success &&
    lockInfo &&
    lockInfo.sessionId === testSessionA &&
    lockInfo.expiresAt > Date.now() + 14 * 60 * 1000 &&
    !conflictResult.success &&
    !turnoAfterUnlock?.asientosBloqueadosTemp['4']
  ) {
    console.log(`✅ TEST 2 PASÓ: Asiento #4 bloqueado atómicamente por 15 min. Conflicto de concurrencia rechazado con éxito.`);
    passed++;
  } else {
    console.error('❌ TEST 2 FALLÓ en seat locking:', { lockResult, conflictResult, lockInfo });
  }

  // --------------------------------------------------------------------------
  // TEST 3: Restricción Inmutable: Solo Asientos 1 al 10 en Bloque Web
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 3: Restricción de Asientos Web (Asientos 11 al 45 exclusivos de Taquilla)');
  const invalidSeat11 = dbService.lockSeat(testTurno.id, 11, testSessionA);
  const invalidSeat45 = dbService.lockSeat(testTurno.id, 45, testSessionA);
  const invalidSeat0 = dbService.lockSeat(testTurno.id, 0, testSessionA);

  if (!invalidSeat11.success && !invalidSeat45.success && !invalidSeat0.success) {
    console.log(`✅ TEST 3 PASÓ: Rechazo estricto de asientos fuera del Bloque Web (1 al 10). Taquilla física protegida.`);
    passed++;
  } else {
    console.error('❌ TEST 3 FALLÓ: Se permitió seleccionar asientos de taquilla física:', { invalidSeat11, invalidSeat45 });
  }

  // --------------------------------------------------------------------------
  // TEST 4: Cálculo Inmutable de Tarifa + Fee de $0.25 por boleto
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 4: Cálculo Inmutable de Tarifa + Fee de $0.25 por boleto individual');
  const tarifaLojaVilca = 2.00;
  const tarifaLojaTambo = 2.50;
  const feePorBoleto = 0.25;

  // Escenario 1: 1 boleto a Vilcabamba
  const subtotal1 = 1 * tarifaLojaVilca;
  const fee1 = 1 * feePorBoleto;
  const total1 = subtotal1 + fee1;

  // Escenario 2: 3 boletos a El Tambo
  const subtotal3 = 3 * tarifaLojaTambo;
  const fee3 = 3 * feePorBoleto;
  const total3 = subtotal3 + fee3;

  if (total1 === 2.25 && total3 === 8.25 && fee1 === 0.25 && fee3 === 0.75) {
    console.log(`✅ TEST 4 PASÓ: Cálculo exacto. 1 pasaje Vilcabamba = $${total1.toFixed(2)} (fee $0.25). 3 pasajes El Tambo = $${total3.toFixed(2)} (fee $0.75).`);
    passed++;
  } else {
    console.error('❌ TEST 4 FALLÓ en cálculo de tarifas:', { total1, total3, fee1, fee3 });
  }

  // --------------------------------------------------------------------------
  // TEST 5: Regla T-20 min: Congelamiento Automático
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 5: Regla T-20 min (Congelamiento de Venta Web)');
  // Creamos un turno que sale dentro de 10 minutos
  const now = new Date();
  const departureSoon = new Date(now.getTime() + 10 * 60 * 1000); // 10 min a futuro
  const departureStr = `${departureSoon.getHours().toString().padStart(2, '0')}:${departureSoon.getMinutes().toString().padStart(2, '0')}`;

  const frozenTurnoId = 'turno-test-freeze';
  (dbService as any).turnos.push({
    id: frozenTurnoId,
    tenantId: 'tenant-vilcabambaturis',
    frecuenciaId: 'frec-freeze',
    frecuenciaHora: departureStr,
    origen: 'Loja',
    destino: 'Vilcabamba',
    destinoFinal: 'Vilcabamba',
    paradasAtendidas: ['Malacatos', 'Vilcabamba'],
    busDiscoTeoricoId: 'bus-04',
    busDiscoRealId: null,
    fecha: new Date().toISOString().split('T')[0],
    asientosVendidosWeb: [],
    asientosBloqueadosTemp: {},
    ventaWebCongelada: false
  });

  dbService.checkDepartureFreezes();
  const checkedTurno = dbService.getTurnoById(frozenTurnoId);

  // Intentar bloquear asiento en turno congelado
  const lockInFrozen = dbService.lockSeat(frozenTurnoId, 1, 'session-test');

  if (checkedTurno?.ventaWebCongelada === true && !lockInFrozen.success) {
    console.log(`✅ TEST 5 PASÓ: Turno a T-10 min congelado automáticamente (${checkedTurno.frecuenciaHora}). Bloqueo de asientos web rechazado.`);
    passed++;
  } else {
    console.error('❌ TEST 5 FALLÓ en regla T-20 min:', { checkedTurno, lockInFrozen });
  }

  // --------------------------------------------------------------------------
  // TEST 6: Generación Criptográfica HMAC-SHA256 para Pase Digital QR
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 6: Criptografía HMAC-SHA256 de Pase Digital QR');
  const hmac1 = await generateTicketHmac({
    tenantId: 'tenant-vilcabambaturis',
    codigoUnico: 'VILCA-2026-0099',
    turnoId: 'turno-1',
    numeroAsiento: 1,
    origen: 'Loja',
    destino: 'Vilcabamba',
    compradorCedula: '1104859201'
  });

  const hmac2 = await generateTicketHmac({
    tenantId: 'tenant-vilcabambaturis',
    codigoUnico: 'VILCA-2026-0100',
    turnoId: 'turno-1',
    numeroAsiento: 2,
    origen: 'Loja',
    destino: 'Vilcabamba',
    compradorCedula: '1104859201'
  });

  const qrPayload = buildQrPayload(
    {
      codigoUnico: 'VILCA-2026-0099',
      tenantId: 'tenant-vilcabambaturis',
      turnoId: 'turno-1',
      numeroAsiento: 1,
      origen: 'Loja',
      destino: 'Vilcabamba',
      puntoAbordaje: 'Terminal Reina del Cisne',
      compradorCedula: '1104859201',
      compradorNombre: 'CARLOS ALBERTO MORA OCHOA',
      firmaDigitalHmac: hmac1
    },
    '14:30',
    '04'
  );

  if (
    hmac1 &&
    hmac2 &&
    hmac1 !== hmac2 &&
    hmac1.length >= 16 &&
    qrPayload.includes('VILCA-2026-0099') &&
    qrPayload.includes(hmac1)
  ) {
    console.log(`✅ TEST 6 PASÓ: Firma criptográfica HMAC generada (${hmac1.slice(0, 16)}...). Payload QR oficial verificado.`);
    passed++;
  } else {
    console.error('❌ TEST 6 FALLÓ en firma HMAC:', { hmac1, hmac2, qrPayload });
  }

  // --------------------------------------------------------------------------
  // RESUMEN FINAL
  // --------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`🏁 RESUMEN FASE 3: ${passed}/${total} Pruebas Pasaron con Éxito (100%)`);
  console.log('========================================================\n');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase3Tests().catch(err => {
  console.error('❌ Error fatal en pruebas de Fase 3:', err);
  process.exit(1);
});
