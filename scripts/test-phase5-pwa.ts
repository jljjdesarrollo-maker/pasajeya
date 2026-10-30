/**
 * Suite de Pruebas E2E Automatizada — Módulo 4 / Fase 5:
 * PWA Offline-First para Tripulación, Visor de Solo Consulta (Orden Secuencial 1 al 45),
 * Distinción de Boletos Web (#912D26 vs Gris Neutral), Protocolo de No-Show y Fajas Físicas
 * "RESERVADO WEB" (Límite Urbano UNL Argelia) y CRUD de Unidades + Restablecimiento de PIN (/admin/flota).
 */

import {
  crearEstadoInicialFrecuencias,
  PIN_CORPORATIVO_OFICIAL,
  validarAccesoCorporativo,
} from '../src/services/pasajeyaEngine.ts';
import {
  limpiarBaseOffline,
  obtenerPasajerosOfflinePorFrecuencia,
  serializarPayloadQR,
} from '../src/lib/offlineDb.ts';
import {
  autenticarYSincronizarEnTerminal5MinAntes,
  construirVisorSoloConsultaSecuencial1a45,
  crearCatalogoFlotaInicial,
  crearUnidadFlotaCRUD,
  editarUnidadFlotaCRUD,
  ejecutarRetiroFajaNoShowPasadaUNLArgelia,
  evaluarDistincionVisualTurnoPwa,
  generarKitFajasFisicasReservadoWeb,
  MINUTOS_RECORRIDO_LIMITE_UNL_ARGELIA,
  obtenerEstadoBotonSincronizacionManual,
  PARADA_LIMITE_URBANO_NO_SHOW,
  restablecerPinDiscoAuxilioRapido,
  verificarPaseQrCriptograficoOfflineSub100ms,
} from '../src/services/module4PwaEngine.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FALLO DE PRUEBA: ${message}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${message}`);
}

async function runModule4PwaTests() {
  console.log('================================================================');
  console.log('PASAJEYA SaaS — SUITE DE VALIDACIÓN MÓDULO 4 (PWA TRIPULACIÓN)');
  console.log('Cliente Piloto: Vilcabambaturis Cía. Ltda. (RUC 1191705482001)');
  console.log('================================================================\n');

  await limpiarBaseOffline();

  // =========================================================================
  // 1. CRUD DE UNIDADES Y GESTIÓN DE CREDENCIALES (/admin/flota)
  // =========================================================================
  console.log(
    '--- [1/5] CRUD de Unidades (/admin/flota) y Restablecimiento de PIN (Auxilio Rápido) ---'
  );
  let catalogoFlota = crearCatalogoFlotaInicial();
  assert(
    catalogoFlota.length === 7 &&
      catalogoFlota.every((u) => u.pinUnidad === PIN_CORPORATIVO_OFICIAL),
    `Catálogo inicial de flota inicializado con ${catalogoFlota.length} unidades y PIN corporativo 1191`
  );

  // Intentar crear unidad con rol SECRETARIA o AYUDANTE (debe ser bloqueado; exclusivo GERENCIA)
  let creacionBloqueada = false;
  try {
    crearUnidadFlotaCRUD({
      catalogoActual: catalogoFlota,
      rolOperador: 'SECRETARIA',
      disco: 'Disco #40',
      placa: 'LAA-4040',
      chofer: 'Sr. Pedro Salinas',
    });
  } catch (err: any) {
    creacionBloqueada = err.message.includes('ACCESO DENEGADO (/admin/flota)');
  }
  assert(
    creacionBloqueada,
    'Bloquea creación de unidades en /admin/flota para roles distintos a GERENCIA / ADMINISTRACIÓN'
  );

  // Crear nueva unidad con rol GERENCIA
  const { catalogoActualizado: catConNueva, unidadCreada } =
    crearUnidadFlotaCRUD({
      catalogoActual: catalogoFlota,
      rolOperador: 'GERENCIA',
      disco: 'Disco #35',
      placa: 'LAA-3055',
      chofer: 'Sr. Jorge Armijos',
      pinUnidad: '4580',
    });
  catalogoFlota = catConNueva;
  assert(
    catalogoFlota.length === 8 &&
      unidadCreada.disco === 'Disco #35' &&
      unidadCreada.pinUnidad === '4580',
    'GERENCIA crea exitosamente unidad Disco #35 (Placa LAA-3055) con PIN personalizado 4580 en /admin/flota'
  );

  // Editar PIN y Chofer de una unidad por GERENCIA
  const { catalogoActualizado: catEditado, unidadEditada } =
    editarUnidadFlotaCRUD({
      catalogoActual: catalogoFlota,
      rolOperador: 'GERENCIA',
      discoOriginal: 'Disco #08',
      nuevoPinUnidad: '7722',
    });
  catalogoFlota = catEditado;
  assert(
    unidadEditada.pinUnidad === '7722',
    'GERENCIA edita credenciales (PIN 7722) de Disco #08 en /admin/flota'
  );

  // Botón de Auxilio Rápido para restablecer PIN (habilitado para GERENCIA y SECRETARIA, bloqueado para AYUDANTE)
  let resetBloqueadoAyudante = false;
  try {
    restablecerPinDiscoAuxilioRapido({
      catalogoActual: catalogoFlota,
      rolOperador: 'AYUDANTE',
      disco: 'Disco #08',
    });
  } catch (err: any) {
    resetBloqueadoAyudante = err.message.includes('ACCESO DENEGADO');
  }
  assert(
    resetBloqueadoAyudante,
    'Bloquea restablecimiento de PIN cuando lo intenta rol AYUDANTE'
  );

  const {
    catalogoActualizado: catPostReset,
    unidadActualizada,
    mensajeAuxilio,
  } = restablecerPinDiscoAuxilioRapido({
    catalogoActual: catalogoFlota,
    rolOperador: 'SECRETARIA',
    disco: 'Disco #08',
    pinRestablecido: PIN_CORPORATIVO_OFICIAL,
  });
  catalogoFlota = catPostReset;
  assert(
    unidadActualizada.pinUnidad === '1191' &&
      Boolean(unidadActualizada.ultimoResetPinAt) &&
      mensajeAuxilio.includes('Auxilio rápido ejecutado por SECRETARIA'),
    `Botón de Auxilio Rápido permite a SECRETARIA o GERENCIA restablecer en 1-clic el PIN de Disco #08 a 1191`
  );

  // =========================================================================
  // 2. PWA OFFLINE-FIRST CON CARGA PREVIA EN TERMINAL (INDEXEDDB) Y BOTÓN PROMINENTE
  // =========================================================================
  console.log(
    '\n--- [2/5] PWA Offline-First: Sincronización 5m antes (<1s) y Botón Prominente Verde/Rojo ---'
  );
  const frecuencias = crearEstadoInicialFrecuencias();
  const freqConVentas = frecuencias[0]; // Loja -> Vilcabamba 10:30 (Disco #08, 6 boletos web)

  // Estado Rojo antes de sincronizar
  const botonRojo = obtenerEstadoBotonSincronizacionManual({
    sincronizado: false,
    disco: freqConVentas.busDiscoReal,
  });
  assert(
    botonRojo.estadoVisual === 'ROJO_PENDIENTE_SINCRONIZAR' &&
      botonRojo.colorFondoHex === '#912D26' &&
      botonRojo.etiquetaBoton ===
        '[⚠️ TOCAR AQUÍ PARA SINCRONIZAR MANIFIESTO]',
    `Estado Rojo del botón manual verificado: "${botonRojo.etiquetaBoton}" (#912D26)`
  );

  // Login en oficina (5 min antes) con Disco + PIN -> Carga automática en < 1 segundo en IndexedDB
  const syncOficina = await autenticarYSincronizarEnTerminal5MinAntes({
    catalogoFlota,
    frecuencia: freqConVentas,
    discoSeleccionado: 'Disco #08',
    pinIngresado: '1191',
  });
  assert(
    syncOficina.autenticado === true &&
      syncOficina.latenciaDescargaMs < 1000 &&
      syncOficina.cumpleSlaSub1Segundo === true &&
      syncOficina.totalPasajerosIndexedDB === 6 &&
      syncOficina.botonSincronizacion.estadoVisual === 'VERDE_ACTUALIZADO' &&
      syncOficina.botonSincronizacion.colorFondoHex === '#2E7D32' &&
      syncOficina.botonSincronizacion.etiquetaBoton ===
        '[✓ MANIFIESTO ACTUALIZADO — Disco #08]',
    `Sincronización en Oficina (Disco #08 + PIN 1191) completada en ${syncOficina.latenciaDescargaMs}ms (< 1s) y botón pasa a Verde: "${syncOficina.botonSincronizacion.etiquetaBoton}"`
  );

  // =========================================================================
  // 3. CERO COBERTURA EN RUTA: VALIDACIÓN CRIPTOGRÁFICA OFFLINE QR (< 100ms)
  // =========================================================================
  console.log(
    '\n--- [3/5] Cero Cobertura en Ruta: Validación Criptográfica QR Offline (< 100ms) ---'
  );
  const pasajerosIndexedDb = await obtenerPasajerosOfflinePorFrecuencia(
    freqConVentas.id
  );
  const pasajeroAsiento1 = pasajerosIndexedDb[0];
  const payloadQrValido = serializarPayloadQR(pasajeroAsiento1);

  const verifOffline = await verificarPaseQrCriptograficoOfflineSub100ms(
    payloadQrValido,
    freqConVentas.id
  );
  assert(
    verifOffline.valido === true &&
      verifOffline.latenciaMs < 100 &&
      verifOffline.cumpleSlaSub100ms === true &&
      verifOffline.pasajero?.asientoNumero === 1,
    `Validación criptográfica QR HMAC-SHA256 100% offline en ${verifOffline.latenciaMs}ms (< 100ms, 0 llamadas HTTP)`
  );

  // =========================================================================
  // 4. VISOR DE SOLO CONSULTA, DISTINCIÓN DE BOLETOS WEB Y ORDEN SECUENCIAL 1 AL 45
  // =========================================================================
  console.log(
    '\n--- [4/5] Visor de Solo Consulta, Distinción Visual (#912D26 vs Gris) y Orden 1 al 45 ---'
  );
  const freqSinVentas = frecuencias.find(
    (f) => f.boletos.filter((b) => b.canalVenta === 'WEB').length === 0
  )!;

  const distincionRoja = evaluarDistincionVisualTurnoPwa(freqConVentas);
  const distincionGris = evaluarDistincionVisualTurnoPwa(freqSinVentas);

  assert(
    distincionRoja.varianteTarjeta === 'ROJO_VINOTINTO_CON_BOLETOS_WEB' &&
      distincionRoja.colorTarjetaHex === '#912D26' &&
      distincionRoja.boletosWebVendidosCount === 6 &&
      distincionRoja.etiquetaDestacada === '6 BOLETOS WEB',
    `Turno con ventas web resaltado en Rojo Vinotinto (#912D26) con etiqueta exacta "${distincionRoja.etiquetaDestacada}"`
  );

  assert(
    distincionGris.varianteTarjeta === 'GRIS_NEUTRAL_CERO_BOLETOS_WEB' &&
      distincionGris.colorTarjetaHex === '#64748B' &&
      distincionGris.boletosWebVendidosCount === 0 &&
      distincionGris.etiquetaDestacada === '0 Boletos Web',
    `Turno sin ventas web marcado en Gris Neutral (#64748B) con "${distincionGris.etiquetaDestacada}" para evitar búsquedas innecesarias`
  );

  const visorConsulta = await construirVisorSoloConsultaSecuencial1a45({
    frecuencia: freqConVentas,
  });
  const estaOrdenado1a45 = visorConsulta.croquisSecuencial45Asientos.every(
    (item, idx) => item.numeroAsiento === idx + 1
  );
  const pasajerosOrdenadosSecuencialmente =
    visorConsulta.pasajerosOrdenadosPorAsiento.every(
      (p, idx, arr) => idx === 0 || p.asientoNumero >= arr[idx - 1].asientoNumero
    );

  assert(
    visorConsulta.perfilAcceso === 'SOLO_LECTURA_CONSULTA_RAPIDA' &&
      visorConsulta.obligacionCheckInClicsABordo === false &&
      visorConsulta.croquisSecuencial45Asientos.length === 45 &&
      estaOrdenado1a45 &&
      pasajerosOrdenadosSecuencialmente,
    'Visor de Solo Consulta configurado sin obligación de check-in ni clics por pasajero, con los 45 asientos y pasajeros en estricto orden secuencial (1 al 45)'
  );

  // =========================================================================
  // 5. PROTOCOLO DE NO-SHOW Y FAJAS FÍSICAS "RESERVADO WEB" (LÍMITE UNL ARGELIA)
  // =========================================================================
  console.log(
    '\n--- [5/5] Protocolo de No-Show y Fajas Físicas "RESERVADO WEB" (UNL Argelia) ---'
  );
  const kitFajas = generarKitFajasFisicasReservadoWeb(freqConVentas);
  assert(
    kitFajas.paradaLimiteUrbano === PARADA_LIMITE_URBANO_NO_SHOW &&
      kitFajas.minutosLimiteRecorrido ===
        MINUTOS_RECORRIDO_LIMITE_UNL_ARGELIA &&
      kitFajas.fajasReservadoWeb.length === 6 &&
      kitFajas.fajasReservadoWeb.every(
        (f) =>
          f.etiquetaFaja === 'RESERVADO WEB' &&
          f.fajaColocadaEnAnden === true &&
          f.asientoNumero >= 1 &&
          f.asientoNumero <= 10
      ),
    `Secretaría entrega manifiesto impreso junto con ${kitFajas.fajasReservadoWeb.length} fajas físicas "RESERVADO WEB" colocadas en los asientos 1–10 vendidos online`
  );

  // Intentar retirar faja ANTES de pasar la parada límite UNL Argelia (debe bloquearse)
  let retiroAntesDeUnlBloqueado = false;
  try {
    ejecutarRetiroFajaNoShowPasadaUNLArgelia({
      frecuencia: freqConVentas,
      asientoNumero: 1,
      yaPasoParadaUNLArgelia: false,
    });
  } catch (err: any) {
    retiroAntesDeUnlBloqueado = err.message.includes('PROTECCIÓN DE RESERVA URBANA');
  }
  assert(
    retiroAntesDeUnlBloqueado,
    'Protege el asiento web e impide retirar la faja física "RESERVADO WEB" antes de superar la parada límite UNL Argelia (20 min)'
  );

  // Retirar faja física y liberar asiento tras superar UNL Argelia por No-Show
  const retiroPostUnl = ejecutarRetiroFajaNoShowPasadaUNLArgelia({
    frecuencia: freqConVentas,
    asientoNumero: 1,
    yaPasoParadaUNLArgelia: true,
  });
  assert(
    retiroPostUnl.exito === true &&
      retiroPostUnl.fajaRetirada === true &&
      retiroPostUnl.asientosNoShowActualizados.includes(1) &&
      retiroPostUnl.reembolsoEfectivoPermitido === false &&
      retiroPostUnl.mensajeOperativo.includes('UNL Argelia'),
    `Pasada la parada límite UNL Argelia, el ayudante retira la faja física "RESERVADO WEB" por No-Show y libera el Asiento #1 para pasajeros en ruta`
  );

  const authCorporate = validarAccesoCorporativo(
    PIN_CORPORATIVO_OFICIAL,
    'AYUDANTE'
  );
  assert(
    authCorporate.autorizado && authCorporate.rol === 'AYUDANTE',
    'Control de acceso corporativo PIN 1191 para rol AYUDANTE operativo'
  );

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS PRUEBAS DEL MÓDULO 4 / FASE 5 PASARON AL 100%');
  console.log('================================================================');
}

runModule4PwaTests().catch((err) => {
  console.error('Error inesperado en suite de pruebas Módulo 4 PWA:', err);
  process.exit(1);
});
