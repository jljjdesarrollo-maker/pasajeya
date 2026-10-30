/**
 * Suite de Pruebas Automatizada — Fase 4 & Módulo 3 Definitivo:
 * Consola de Taquilla, Pizarra en Tiempo Real (#912D26 vs Gris Neutral),
 * Mapa Tricolor de 45 Asientos (#912D26, #2E7D32, #F57C00),
 * 3 Botones Independientes de Copiado al Sistema de Vilcabambaturis,
 * Control Estricto de Flota (Bloqueo EN_RUTA/DESPACHADO + Protocolo 0 Ventas Web)
 * y RBAC (Secretaria Lectura/Escritura vs Tripulación/Ayudante Solo Lectura).
 */

import {
  aplicarCongelamientoT20,
  crearEstadoInicialFrecuencias,
  formatearTextoCopiadoSRI,
  obtenerManifiestoCongeladoSRI,
  PIN_CORPORATIVO_OFICIAL,
  reasignarBusRealYNotificarWhatsApp,
  validarAccesoCorporativo,
  venderAsientoEnVentanilla,
} from '../src/services/pasajeyaEngine.ts';
import {
  COLOR_TAQUILLA_DISPONIBLE_VERDE,
  COLOR_TAQUILLA_RESERVA_NARANJA,
  COLOR_TAQUILLA_VENDIDO_ROJO,
  construirMapaTricolor45Asientos,
  ejecutarProtocoloCeroVentasWeb,
  evaluarTarjetaPizarraTurno,
  generarManifiestoImpresoConAsientosLiberados,
  generarPayloadsCopiadoSistemaVilcabambaturis,
  obtenerPermisosRBACTaquilla,
  obtenerUnidadesFlotaConBloqueoEnRuta,
  venderAsientoTaquillaTricolorConRBAC,
} from '../src/services/module3TaquillaEngine.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FALLO DE PRUEBA: ${message}`);
    process.exit(1);
  }
  console.log(`✅ OK: ${message}`);
}

async function runPhase4Tests() {
  console.log('================================================================');
  console.log('PASAJEYA SaaS — SUITE DE VALIDACIÓN MÓDULO 3 (TAQUILLA, SRI & FLOTA)');
  console.log('Cliente Piloto: Vilcabambaturis Cía. Ltda. (RUC 1191705482001)');
  console.log('================================================================\n');

  // 1. Prueba de Control de Acceso (PIN 1191) y RBAC (Secretaria vs Tripulación/Ayudante)
  console.log('--- [1/7] Control de Acceso PIN 1191 y Roles RBAC ---');
  const authFallido = validarAccesoCorporativo('0000', 'SECRETARIA');
  assert(!authFallido.autorizado, 'Rechaza PIN incorrecto (0000)');

  const authSecretaria = validarAccesoCorporativo(
    PIN_CORPORATIVO_OFICIAL,
    'SECRETARIA'
  );
  assert(
    authSecretaria.autorizado && authSecretaria.rol === 'SECRETARIA',
    'Autoriza acceso con PIN corporativo 1191 y rol SECRETARIA'
  );

  const rbacSecretaria = obtenerPermisosRBACTaquilla('SECRETARIA');
  const rbacAyudante = obtenerPermisosRBACTaquilla('AYUDANTE');

  assert(
    rbacSecretaria.modoAcceso === 'LECTURA_ESCRITURA' &&
      rbacSecretaria.puedeVenderEnTaquilla &&
      rbacSecretaria.puedeReasignarFlota &&
      rbacSecretaria.puedeCanjearNotasCredito &&
      rbacSecretaria.puedeCerrarTurnos,
    'Rol SECRETARIA posee modo LECTURA_ESCRITURA completo sobre ventas, flota, notas de crédito y cierres'
  );

  assert(
    rbacAyudante.modoAcceso === 'SOLO_LECTURA' &&
      !rbacAyudante.puedeVenderEnTaquilla &&
      !rbacAyudante.puedeReasignarFlota &&
      !rbacAyudante.puedeCanjearNotasCredito &&
      !rbacAyudante.puedeCerrarTurnos,
    'Rol AYUDANTE (Tripulación) opera estrictamente en modo SOLO_LECTURA para inspección móvil de lista y mapa tricolor'
  );

  // 2. Pizarra de Turnos en Tiempo Real (#912D26 vs Gris Neutral) y Corte T-20m
  console.log('\n--- [2/7] Pizarra de Turnos (#912D26 vs Gris Neutral) y Corte T-20m ---');
  const frecuencias = crearEstadoInicialFrecuencias();
  const freq1 = frecuencias[0]; // Loja -> Vilcabamba 10:30 (T-18 min, 6 ventas)
  const freq2 = frecuencias[1]; // Loja -> Yangana 11:00 (T-35 min, 2 ventas + 1 lock 15m)
  const freq4SinVentas = frecuencias[3]; // Loja -> El Tambo 12:15 (0 ventas web)

  const pizarraFreq1 = evaluarTarjetaPizarraTurno(freq1);
  const pizarraFreq4 = evaluarTarjetaPizarraTurno(freq4SinVentas);

  assert(
    pizarraFreq1.varianteVisual === 'ROJO_VINOTINTO_CON_VENTAS' &&
      pizarraFreq1.colorFondoHex === '#912D26' &&
      pizarraFreq1.pasajesVendidosCount === 6,
    `Tarjeta en Rojo Vinotinto (#912D26) para turno con ventas activas (${pizarraFreq1.pasajesVendidosCount} vendidos)`
  );

  assert(
    pizarraFreq4.varianteVisual === 'GRIS_NEUTRAL_SIN_VENTAS' &&
      pizarraFreq4.pasajesVendidosCount === 0 &&
      pizarraFreq4.puedeCerrarSinVentasWeb === true,
    'Tarjeta en Gris Neutral (#64748B) para turno sin ventas en línea (0 ventas)'
  );

  assert(
    freq1.minutosParaSalida <= 20 && freq1.ventaWebCongelada === true,
    `Frecuencia ${freq1.codigoFrecuencia} (T-${freq1.minutosParaSalida}m) congela automáticamente ventas web a T-20 min`
  );

  // 3. Gestión Tricolor del Mapa de Asientos (45 Asientos Hino AK)
  console.log('\n--- [3/7] Gestión Tricolor del Mapa de Asientos (45 Asientos) ---');
  const mapaTricolorFreq2 = construirMapaTricolor45Asientos(freq2);
  assert(
    mapaTricolorFreq2.length === 45,
    'Construye croquis completo de 45 asientos para unidad Hino AK'
  );

  const asientoVendidoFreq2 = mapaTricolorFreq2.find((a) => a.numero === 1)!;
  const asientoReserva15mFreq2 = mapaTricolorFreq2.find((a) => a.numero === 3)!;
  const asientoNativoLibreFreq2 = mapaTricolorFreq2.find((a) => a.numero === 15)!;

  assert(
    asientoVendidoFreq2.estadoTricolor === 'VENDIDO_CONFIRMADO' &&
      asientoVendidoFreq2.colorHex === COLOR_TAQUILLA_VENDIDO_ROJO,
    `Asiento #1 vendido se muestra en Rojo Vinotinto (${COLOR_TAQUILLA_VENDIDO_ROJO})`
  );

  assert(
    asientoReserva15mFreq2.estadoTricolor === 'RESERVA_PENDIENTE_15M' &&
      asientoReserva15mFreq2.colorHex === COLOR_TAQUILLA_RESERVA_NARANJA &&
      asientoReserva15mFreq2.puedeVenderseEnVentanilla === false,
    `Asiento #3 en reserva temporal 15m se muestra en Naranja/Ocre (${COLOR_TAQUILLA_RESERVA_NARANJA}) y está bloqueado para venta presencial en taquilla`
  );

  assert(
    asientoNativoLibreFreq2.estadoTricolor === 'DISPONIBLE_TAQUILLA' &&
      asientoNativoLibreFreq2.colorHex === COLOR_TAQUILLA_DISPONIBLE_VERDE &&
      asientoNativoLibreFreq2.puedeVenderseEnVentanilla === true,
    `Asiento nativo #15 disponible se muestra en Verde Menta (${COLOR_TAQUILLA_DISPONIBLE_VERDE})`
  );

  // Verificar que intentar vender un asiento en Reserva Pendiente 15m (#3 en freq2) falla estrictamente
  let errorVentaEnReserva15m = false;
  try {
    venderAsientoTaquillaTricolorConRBAC({
      rol: 'SECRETARIA',
      frecuencia: freq2,
      asientoNumero: 3,
      cedulaRuc: '1104771920',
      pasajeroNombre: 'Intento Sobre Reserva',
      telefonoWhatsApp: '+593 99 111 2222',
      destinoParada: 'Yangana',
    });
  } catch {
    errorVentaEnReserva15m = true;
  }
  assert(
    errorVentaEnReserva15m,
    'Bloquea venta presencial en ventanilla sobre asiento #3 mientras su temporizador de 15 minutos está activo (#F57C00)'
  );

  // Verificar que Rol AYUDANTE no puede vender en taquilla (Solo Lectura)
  let errorVentaAyudanteSoloLectura = false;
  try {
    venderAsientoTaquillaTricolorConRBAC({
      rol: 'AYUDANTE',
      frecuencia: freq1,
      asientoNumero: 4,
      cedulaRuc: '1104771920',
      pasajeroNombre: 'Intento Ayudante',
      telefonoWhatsApp: '+593 99 111 2222',
      destinoParada: 'Vilcabamba',
    });
  } catch {
    errorVentaAyudanteSoloLectura = true;
  }
  assert(
    errorVentaAyudanteSoloLectura,
    'Bloquea intento de venta en taquilla cuando el rol activo es AYUDANTE (Solo Lectura)'
  );

  // 4. Liberación Automática de Asientos Sobrantes (1-10) y Venta en Taquilla (1-45)
  console.log('\n--- [4/7] Liberación T-20m (1-10) y Venta en Taquilla (1-45) ---');
  const resultadoCongelarFreq2 = aplicarCongelamientoT20(freq2, true);
  const liberadosFreq2 =
    resultadoCongelarFreq2.frecuenciaActualizada.asientosBloqueWeb.filter(
      (a) => a.estado === 'DISPONIBLE_VENTANILLA'
    );
  assert(
    resultadoCongelarFreq2.frecuenciaActualizada.ventaWebCongelada === true &&
      liberadosFreq2.length === 7,
    `Al congelar ${freq2.codigoFrecuencia} a T-20m, los 7 asientos no vendidos pasan a DISPONIBLE_VENTANILLA (#2E7D32)`
  );

  // Venta en ventanilla sobre asiento liberado #4 en freq1
  const ventaTaquilla = venderAsientoEnVentanilla(freq1, {
    asientoNumero: 4,
    cedulaRuc: '1104771920',
    pasajeroNombre: 'Mercy Esperanza Jaramillo',
    telefonoWhatsApp: '+593 99 112 2334',
    destinoParada: 'Vilcabamba',
  });
  assert(
    ventaTaquilla.boletoEmitido.asientoNumero === 4 &&
      ventaTaquilla.boletoEmitido.firmaHmac.startsWith('HMAC256-'),
    'Secretaria emite boleto físico sobre asiento web liberado #4'
  );

  // Venta en ventanilla sobre asiento nativo #18 (rango 11-45)
  const ventaNativo18 = venderAsientoTaquillaTricolorConRBAC({
    rol: 'SECRETARIA',
    frecuencia: ventaTaquilla.frecuenciaActualizada,
    asientoNumero: 18,
    cedulaRuc: '1103948120',
    pasajeroNombre: 'Segundo Vicente Carrión',
    telefonoWhatsApp: '+593 98 445 6677',
    destinoParada: 'Malacatos',
  });
  const mapaPostVenta18 = construirMapaTricolor45Asientos(
    ventaNativo18.frecuenciaActualizada
  );
  assert(
    mapaPostVenta18.find((a) => a.numero === 18)?.estadoTricolor ===
      'VENDIDO_CONFIRMADO' &&
      mapaPostVenta18.find((a) => a.numero === 18)?.colorHex ===
        COLOR_TAQUILLA_VENDIDO_ROJO,
    'Secretaria emite boleto en ventanilla sobre asiento nativo #18 y pasa de Verde Menta (#2E7D32) a Rojo Vinotinto (#912D26)'
  );

  // 5. Exportación y 3 Botones Independientes de Copiado al Sistema de Vilcabambaturis + Manifiesto Físico
  console.log('\n--- [5/7] 3 Botones de Copiado Independientes y Manifiesto Impreso ---');
  const manifiestoSri = obtenerManifiestoCongeladoSRI(freq1);
  const tsvSri = formatearTextoCopiadoSRI(freq1, true);
  const payloadsFila0 = generarPayloadsCopiadoSistemaVilcabambaturis(
    manifiestoSri[0],
    freq1
  );

  assert(
    payloadsFila0.botonCopiarCedulaRuc === '1104589210' &&
      payloadsFila0.botonCopiarReferenciaComprobante === 'BL-99481204' &&
      payloadsFila0.botonCopiarVentanaEmergenteDeposito.includes('BL-99481204') &&
      payloadsFila0.botonCopiarVentanaEmergenteDeposito.includes('1104589210'),
    'Genera los 3 botones independientes en 1-clic: [Copiar Cédula / RUC], [Copiar # Comprobante / Referencia] y [Copiar para Ventana Emergente de Depósito]'
  );

  const manifiestoImpreso = generarManifiestoImpresoConAsientosLiberados(freq1);
  assert(
    manifiestoImpreso.asientosWebLiberadosParaTaquilla.length === 4 &&
      manifiestoImpreso.textoImprimible.includes(
        'ASIENTOS DEL BLOQUE WEB (1 AL 10) LIBERADOS PARA TAQUILLA: #4, #7, #9, #10'
      ) &&
      tsvSri.includes('CEDULA_RUC\tNOMBRE_PASAJERO'),
    'Manifiesto Físico Impreso visualiza claramente los asientos liberados de web (#4, #7, #9, #10) para entrega física al ayudante'
  );

  // 6. Control Estricto de Flota: Bloqueo de Vehículos en Ruta (EN_RUTA / DESPACHADO) y WhatsApp VPS
  console.log('\n--- [6/7] Bloqueo de Vehículos en Ruta y Reasignación + WhatsApp VPS ---');
  const unidadesControl = obtenerUnidadesFlotaConBloqueoEnRuta(
    freq1.busDiscoReal
  );
  const disco22EnRuta = unidadesControl.find((u) => u.disco === 'Disco #22')!;
  const disco25Despachado = unidadesControl.find((u) => u.disco === 'Disco #25')!;

  assert(
    disco22EnRuta.estadoOperativo === 'EN_RUTA' &&
      disco22EnRuta.seleccionableComoBusReal === false &&
      disco25Despachado.estadoOperativo === 'DESPACHADO' &&
      disco25Despachado.seleccionableComoBusReal === false,
    'Unidades en estado EN_RUTA (Disco #22) o DESPACHADO (Disco #25) están marcadas como NO seleccionables'
  );

  let bloqueoEnRutaActivado = false;
  try {
    reasignarBusRealYNotificarWhatsApp(
      freq1,
      'Disco #22',
      'Intento inválido de asignar unidad en ruta'
    );
  } catch {
    bloqueoEnRutaActivado = true;
  }
  assert(
    bloqueoEnRutaActivado,
    'Imposibilidad estricta de seleccionar como busDiscoReal un autobús que ya se encuentra EN_RUTA o DESPACHADO'
  );

  const resultadoReasignacion = reasignarBusRealYNotificarWhatsApp(
    ventaTaquilla.frecuenciaActualizada,
    'Disco #14',
    'Contingencia mecánica en embrague de unidad titular'
  );

  assert(
    resultadoReasignacion.frecuenciaActualizada.busDiscoTeorico ===
      'Disco #08' &&
      resultadoReasignacion.frecuenciaActualizada.busDiscoReal === 'Disco #14' &&
      resultadoReasignacion.alertasDisparadas.length === 7,
    `Preserva busDiscoTeorico (Disco #08), actualiza busDiscoReal (Disco #14) y dispara ${resultadoReasignacion.alertasDisparadas.length} alertas por WhatsApp`
  );

  // 7. Protocolo de 0 Ventas Web (DESPACHADO_SIN_VENTAS_WEB)
  console.log('\n--- [7/7] Protocolo de 0 Ventas Web (DESPACHADO_SIN_VENTAS_WEB) ---');
  const cierreSinVentas = ejecutarProtocoloCeroVentasWeb(freq4SinVentas);
  assert(
    cierreSinVentas.frecuenciaActualizada.estadoDespacho ===
      'DESPACHADO_SIN_VENTAS_WEB' &&
      cierreSinVentas.frecuenciaActualizada.ventaWebCongelada === true,
    'Cierre en 1-clic (DESPACHADO_SIN_VENTAS_WEB) cuando el autobús sale de la terminal sin ventas en línea'
  );

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS PRUEBAS DEL MÓDULO 3 / FASE 4 PASARON AL 100%');
  console.log('================================================================');
}

runPhase4Tests().catch((err) => {
  console.error('Error inesperado en suite de pruebas Fase 4 / Módulo 3:', err);
  process.exit(1);
});
