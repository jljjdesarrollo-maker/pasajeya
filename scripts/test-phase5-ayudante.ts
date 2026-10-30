/**
 * Suite de Pruebas Automatizada — Fase 5: App PWA Offline-First para el Ayudante,
 * Pre-carga T-20 min en IndexedDB, Verificación Criptográfica QR (HMAC-SHA256) Offline
 * y Sincronización Diferencial (Delta Sync -> /api/v1/tickets/sync-boarding).
 */

import {
  crearEstadoInicialFrecuencias,
  PIN_CORPORATIVO_OFICIAL,
  validarAccesoCorporativo,
} from '../src/services/pasajeyaEngine.ts';
import {
  ejecutarSincronizacionDelta,
  limpiarBaseOffline,
  obtenerColaDeltaPendiente,
  obtenerPasajerosOfflinePorFrecuencia,
  obtenerSecretoHmacDeIndexedDB,
  precargarManifiestoT20EnIndexedDB,
  registrarAbordajeOffline,
  SECRET_HMAC_OFFLINE_DEFAULT,
  serializarPayloadQR,
  verificarQrHmacOffline,
} from '../src/lib/offlineDb.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FALLO DE PRUEBA: ${message}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${message}`);
}

async function runPhase5Tests() {
  console.log('================================================================');
  console.log('PASAJEYA SaaS — SUITE DE VALIDACIÓN FASE 5 (PWA AYUDANTE & QR)');
  console.log('Cliente Piloto: Vilcabambaturis Cía. Ltda. (RUC 1191705482001)');
  console.log('================================================================\n');

  await limpiarBaseOffline();

  // 1. Control de Acceso Ruta /ayudante con PIN 1191 y Rol AYUDANTE
  console.log('--- [1/5] Control de Acceso Ruta /ayudante (PIN 1191 / AYUDANTE) ---');
  const loginInvalido = validarAccesoCorporativo('9999', 'AYUDANTE');
  assert(!loginInvalido.autorizado, 'Rechaza PIN incorrecto para rol AYUDANTE');

  const loginAyudante = validarAccesoCorporativo(
    PIN_CORPORATIVO_OFICIAL,
    'AYUDANTE'
  );
  assert(
    loginAyudante.autorizado && loginAyudante.rol === 'AYUDANTE',
    'Autoriza acceso a /ayudante con PIN corporativo 1191 y rol AYUDANTE'
  );

  // 2. Pre-carga T-20 min en IndexedDB y Autonomía en Carretera
  console.log('\n--- [2/5] Pre-carga T-20 min en IndexedDB (Offline-First) ---');
  const frecuencias = crearEstadoInicialFrecuencias();
  const freq1 = frecuencias[0]; // Loja -> Vilcabamba 10:30 (Congelada T-18m, 6 pasajeros confirmados)

  const infoPrecarga = await precargarManifiestoT20EnIndexedDB(freq1);
  const pasajerosIndexedDb = await obtenerPasajerosOfflinePorFrecuencia(
    freq1.id
  );
  const secretoAlmacenado = await obtenerSecretoHmacDeIndexedDB();

  assert(
    infoPrecarga.totalPrecargados === 6 && pasajerosIndexedDb.length === 6,
    `Pre-carga T-20 min almacena en IndexedDB los ${pasajerosIndexedDb.length} pasajeros congelados del turno ${freq1.codigoFrecuencia}`
  );
  assert(
    secretoAlmacenado === SECRET_HMAC_OFFLINE_DEFAULT,
    'Clave secreta HMAC-SHA256 almacenada localmente en IndexedDB para verificación sin red'
  );

  // 3. Verificación Criptográfica Offline de Código QR (HMAC-SHA256)
  console.log(
    '\n--- [3/5] Escáner QR y Verificación Criptográfica Offline (HMAC-SHA256) ---'
  );
  const pasajeroAsiento1 = pasajerosIndexedDb[0];
  const qrValidoPayload = serializarPayloadQR(pasajeroAsiento1);

  const verifExitosa = await verificarQrHmacOffline(qrValidoPayload, freq1.id);
  assert(
    verifExitosa.valido === true &&
      verifExitosa.firmaEsperada === pasajeroAsiento1.firmaHmac &&
      verifExitosa.pasajero?.asientoNumero === 1,
    `Verifica matemáticamente sin conexión (0 HTTP) la firma HMAC-SHA256 del Asiento #1 (${pasajeroAsiento1.pasajeroNombre})`
  );

  // Prueba de rechazo de código QR adulterado / falsificado
  const qrAdulteradoPayload = JSON.stringify({
    v: 'PASAJEYA_QR_V5',
    boletoId: pasajeroAsiento1.boletoId,
    frecuenciaId: pasajeroAsiento1.frecuenciaId,
    asientoNumero: pasajeroAsiento1.asientoNumero,
    cedulaRuc: pasajeroAsiento1.cedulaRuc,
    referenciaBancaria: pasajeroAsiento1.referenciaBancaria,
    firmaHmac: 'HMAC256-ADULTERADO000000000000',
  });
  const verifRechazada = await verificarQrHmacOffline(
    qrAdulteradoPayload,
    freq1.id
  );
  assert(
    verifRechazada.valido === false &&
      verifRechazada.motivo.includes('ALERTA DE SEGURIDAD'),
    'Rechaza instantáneamente un código QR con firma HMAC-SHA256 adulterada o falsificada'
  );

  // 4. Registro de Abordaje Offline (Por QR y Manual por Cédula/Asiento)
  console.log(
    '\n--- [4/5] Marcado de Abordaje Offline (QR + Manual en Tramo Sin Señal) ---'
  );
  const abordajeQr = await registrarAbordajeOffline({
    frecuenciaId: freq1.id,
    boletoId: pasajeroAsiento1.boletoId,
    metodo: 'QR_HMAC_OFFLINE',
    tramoCarretera: 'Tramo Malacatos (Señal Intermitente)',
  });
  assert(
    abordajeQr.exito &&
      abordajeQr.pasajeroActualizado?.estadoAbordaje === 'ABORDADO',
    `Asiento #1 marcado como ABORDADO vía QR_HMAC_OFFLINE en IndexedDB`
  );

  // Marcar abordaje manual por número de cédula (ej. pantalla rota o sin batería)
  const pasajeroAsiento3 = pasajerosIndexedDb.find(
    (p) => p.asientoNumero === 3
  )!;
  const abordajeManual = await registrarAbordajeOffline({
    frecuenciaId: freq1.id,
    asientoOCedula: pasajeroAsiento3.cedulaRuc,
    metodo: 'MANUAL_CEDULA_ASIENTO',
    tramoCarretera: 'Tramo Yangana / Zahuayco (Sin Cobertura 4G)',
  });
  assert(
    abordajeManual.exito &&
      abordajeManual.pasajeroActualizado?.asientoNumero === 3 &&
      abordajeManual.pasajeroActualizado?.estadoAbordaje === 'ABORDADO',
    `Asiento #3 (${pasajeroAsiento3.pasajeroNombre}) marcado como ABORDADO manualmente por Cédula (${pasajeroAsiento3.cedulaRuc})`
  );

  // Verificar que un boleto ya abordado no pueda ser reutilizado por segunda vez
  const reescaneoQrUsado = await verificarQrHmacOffline(
    qrValidoPayload,
    freq1.id
  );
  assert(
    reescaneoQrUsado.valido === false && reescaneoQrUsado.yaAbordado === true,
    'Bloquea doble abordaje si se intenta escanear nuevamente un QR ya registrado como ABORDADO'
  );

  // 5. Sincronización Diferencial (Delta Sync -> /api/v1/tickets/sync-boarding)
  console.log(
    '\n--- [5/5] Sincronización Diferencial (Delta Sync /api/v1/tickets/sync-boarding) ---'
  );
  const colaPendienteAntes = await obtenerColaDeltaPendiente(freq1.id);
  assert(
    colaPendienteAntes.length === 2,
    `Cola Delta Sync retiene localmente los 2 abordajes marcados offline con timestamp`
  );

  const syncResult = await ejecutarSincronizacionDelta(freq1.id);
  const colaPendienteDespues = await obtenerColaDeltaPendiente(freq1.id);
  const pasajerosPostSync = await obtenerPasajerosOfflinePorFrecuencia(
    freq1.id
  );

  assert(
    syncResult.endpoint === '/api/v1/tickets/sync-boarding' &&
      syncResult.procesados === 2 &&
      colaPendienteDespues.length === 0 &&
      pasajerosPostSync.filter((p) => p.sincronizadoNube).length === 6,
    `Delta Sync (/api/v1/tickets/sync-boarding) sincroniza los ${syncResult.procesados} abordajes con Neon PostgreSQL y vacía la cola pendiente`
  );

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE LA FASE 5 PASARON EXITOSAMENTE (100%)');
  console.log('================================================================');
}

runPhase5Tests().catch((err) => {
  console.error('Error inesperado en suite de pruebas Fase 5:', err);
  process.exit(1);
});
