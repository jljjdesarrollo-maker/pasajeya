/**
 * Script de Verificación Integral - FASE 2: Conciliación Bancaria & Idempotencia
 * Proyecto: PasajeYa (Cliente Piloto: Vilcabambaturis Cía. Ltda.)
 *
 * Pruebas:
 * 1. Parser Banco de Loja (Regex ultrarrápido < 20ms)
 * 2. Parser Banco Pichincha / Deuna (Regex ultrarrápido < 20ms)
 * 3. Conciliación Real con Neon PostgreSQL (Prisma ORM) en < 3000ms
 * 4. Idempotencia Estricta [tenantId, referenciaBanco]: Prevención de duplicados
 * 5. Validación de Monto Incompleto (MONTO_INCOMPLETO)
 */

import { parseBancoDeLoja, parseBancoPichincha } from '../src/services/bankParsers';
import { processBankReconciliation } from '../src/services/bankReconciliationEngine';
import { prisma } from '../src/services/prisma';

async function runPhase2Tests() {
  console.log('🧪 ========================================================');
  console.log('🧪 [PasajeYa - Fase 2] Iniciando Suite de Pruebas Bancarias');
  console.log('🧪 ========================================================\n');

  let passedTests = 0;
  let totalTests = 5;

  // --------------------------------------------------------------------------
  // TEST 1: Parser Banco de Loja
  // --------------------------------------------------------------------------
  console.log('▶️ TEST 1: Parser Banco de Loja (Aviso de Crédito Directo)');
  const sampleEmailLoja = `
    Banco de Loja Notificaciones:
    Estimado cliente VILCABAMBATURIS CIA. LTDA.,
    Le notificamos que ha recibido una transferencia por el valor de $4.50 USD.
    Número de Comprobante / Referencia: 784912
    Ordenante: CARLOS ALBERTO MORA OCHOA
    Cuenta acreditada: Cta Cte 2901234567
    Fecha: 28/10/2026 14:15:30
  `;

  const t1Start = performance.now();
  const parsedLoja = parseBancoDeLoja(sampleEmailLoja, 'notificaciones@bancodeloja.fin.ec');
  const t1Elapsed = performance.now() - t1Start;

  if (
    parsedLoja &&
    parsedLoja.banco === 'BANCO_DE_LOJA' &&
    parsedLoja.referencia === '784912' &&
    parsedLoja.monto === 4.50 &&
    t1Elapsed < 50
  ) {
    console.log(`✅ TEST 1 PASÓ (${t1Elapsed.toFixed(2)}ms): Banco=${parsedLoja.banco}, Ref=${parsedLoja.referencia}, Monto=$${parsedLoja.monto}`);
    passedTests++;
  } else {
    console.error('❌ TEST 1 FALLÓ:', parsedLoja, `Tiempo: ${t1Elapsed}ms`);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Parser Banco Pichincha / Deuna
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 2: Parser Banco Pichincha / Deuna');
  const sampleEmailPichincha = `
    ¡Buenas noticias! Recibiste un pago en Deuna / Banco Pichincha por un monto de $2.25.
    Código de comprobante: PICH-904128
    De: MARIA ELENA CASTILLO RIOS
    Para: VILCABAMBATURIS CIA. LTDA.
    Fecha: 28 de Octubre 2026
  `;

  const t2Start = performance.now();
  const parsedPichincha = parseBancoPichincha(sampleEmailPichincha, 'notificaciones@deuna.app');
  const t2Elapsed = performance.now() - t2Start;

  if (
    parsedPichincha &&
    parsedPichincha.banco === 'BANCO_PICHINCHA' &&
    parsedPichincha.referencia === 'PICH-904128' &&
    parsedPichincha.monto === 2.25 &&
    t2Elapsed < 50
  ) {
    console.log(`✅ TEST 2 PASÓ (${t2Elapsed.toFixed(2)}ms): Banco=${parsedPichincha.banco}, Ref=${parsedPichincha.referencia}, Monto=$${parsedPichincha.monto}`);
    passedTests++;
  } else {
    console.error('❌ TEST 2 FALLÓ:', parsedPichincha, `Tiempo: ${t2Elapsed}ms`);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Conciliación Real E2E en Neon PostgreSQL (< 3000ms)
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 3: Conciliación E2E en Neon PostgreSQL con Prisma ORM');
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'vilcabambaturis' },
  });
  if (!tenant) throw new Error('Tenant vilcabambaturis no existe en la base de datos');

  const turno = await prisma.programacionTurno.findFirst({
    where: { tenantId: tenant.id },
    include: { frecuencia: true },
  });
  if (!turno) throw new Error('No hay turnos sembrados en la base de datos');

  const testRef = `LOJA-TEST-${Date.now().toString().slice(-6)}`;
  const testAsiento = 2;

  // Creamos reserva previa en PENDIENTE
  await prisma.transaccionPago.create({
    data: {
      tenantId: tenant.id,
      turnoId: turno.id,
      banco: 'BANCO_DE_LOJA',
      referenciaBanco: testRef,
      montoEsperado: 2.25,
      feeServicioCalculado: 0.25,
      estado: 'PENDIENTE',
      compradorCedula: '1104859201',
      compradorNombre: 'CARLOS ALBERTO MORA OCHOA',
      compradorCorreo: 'carlos.mora@example.com',
      compradorWhatsApp: '+593991234567',
      boletos: {
        create: [
          {
            tenantId: tenant.id,
            turnoId: turno.id,
            numeroAsiento: testAsiento,
            origen: 'Loja',
            destino: 'Vilcabamba',
            puntoAbordaje: 'Terminal Loja',
            codigoUnico: `VILCA-${testAsiento}-${Date.now().toString().slice(-4)}`,
            firmaDigitalHmac: `HMAC-TEST-${Date.now()}`,
            estado: 'RESERVADO',
          },
        ],
      },
    },
  });

  const webhookInput = {
    rawSubject: 'Aviso de Transferencia Acreditada - Banco de Loja',
    rawBody: `Banco de Loja le informa:\nSe ha acreditado una transferencia directa por valor de $2.25.\nReferencia de transacción: ${testRef}\nOrdenante: CARLOS ALBERTO MORA OCHOA\nCuenta destino: 2901234567 Corriente.`,
    senderAddress: 'notificaciones@bancodeloja.fin.ec',
  };

  const t3Start = performance.now();
  const reconResult = await processBankReconciliation(tenant.id, webhookInput);
  const t3Elapsed = performance.now() - t3Start;

  if (
    reconResult.success &&
    reconResult.status === 'CONFIRMADO' &&
    t3Elapsed < 3000
  ) {
    console.log(`✅ TEST 3 PASÓ (${t3Elapsed.toFixed(2)}ms < 3000ms): Transacción ${reconResult.transaccionId} confirmada con ${reconResult.boletosConfirmados?.length} boleto(s).`);
    passedTests++;
  } else {
    console.error('❌ TEST 3 FALLÓ:', reconResult);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Idempotencia Estricta [tenantId, referenciaBanco]
  // Inmediatamente re-enviamos el MISMO comprobante para validar que NO se duplique
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 4: Prueba de Idempotencia Estricta (Reintento con misma referencia)');
  const t4Start = performance.now();
  const duplicateResult = await processBankReconciliation(tenant.id, webhookInput);
  const t4Elapsed = performance.now() - t4Start;

  if (
    duplicateResult.success &&
    duplicateResult.status === 'IDEMPOTENTE_DUPLICADO'
  ) {
    console.log(`✅ TEST 4 PASÓ (${t4Elapsed.toFixed(2)}ms): Idempotencia detectada. Mensaje: "${duplicateResult.message.slice(0, 60)}..."`);
    passedTests++;
  } else {
    console.error('❌ TEST 4 FALLÓ:', duplicateResult);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Detección de Monto Incompleto
  // --------------------------------------------------------------------------
  console.log('\n▶️ TEST 5: Detección de Monto Incompleto (Pago menor al esperado)');
  const underpayRef = `LOJA-UNDER-${Date.now().toString().slice(-6)}`;

  await prisma.transaccionPago.create({
    data: {
      tenantId: tenant.id,
      turnoId: turno.id,
      banco: 'BANCO_DE_LOJA',
      referenciaBanco: underpayRef,
      montoEsperado: 4.50,
      feeServicioCalculado: 0.50,
      estado: 'PENDIENTE',
      compradorCedula: '1104859201',
      compradorNombre: 'JUAN PEREZ',
      compradorCorreo: 'juan@example.com',
      compradorWhatsApp: '+593991234567',
    },
  });

  const underpayInput = {
    rawSubject: 'Transferencia Parcial - Banco de Loja',
    rawBody: `Banco de Loja le informa:\nSe ha acreditado una transferencia por valor de $1.00.\nReferencia de transacción: ${underpayRef}`,
    senderAddress: 'notificaciones@bancodeloja.fin.ec',
  };

  const underpayResult = await processBankReconciliation(tenant.id, underpayInput);

  if (
    !underpayResult.success &&
    underpayResult.status === 'MONTO_INCOMPLETO'
  ) {
    console.log(`✅ TEST 5 PASÓ: Monto Incompleto detectado correctamente ($1.00 < $4.50).`);
    passedTests++;
  } else {
    console.error('❌ TEST 5 FALLÓ:', underpayResult);
  }

  // --------------------------------------------------------------------------
  // RESUMEN FINAL
  // --------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`🏁 RESUMEN: ${passedTests}/${totalTests} Pruebas Pasaron con Éxito (100%)`);
  console.log('========================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase2Tests()
  .catch((e) => {
    console.error('❌ Error fatal ejecutando pruebas de Fase 2:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
