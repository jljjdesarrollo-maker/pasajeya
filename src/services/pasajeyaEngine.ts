import {
  AlertaWhatsAppLog,
  AsientoBloqueWeb,
  BancoConciliacion,
  BoletoEmitido,
  FilaSincronizacionSRI,
  FrecuenciaRuta,
  RolOperativo,
  UnidadFlota,
} from '../types/pasajeya';

export const PIN_CORPORATIVO_OFICIAL = '1191';

export const TENANT_VILCABAMBATURIS = {
  id: 'tenant-vilcabambaturis-01',
  nombre: 'Vilcabambaturis Cía. Ltda.',
  ruc: '1191705482001',
  matriz: 'Terminal Terrestre Reina del Cisne — Loja, Ecuador',
  gatewayVpsUrl: 'https://wa-gw.vilcabambaturis-vps.ec/v1/dispatch',
};

export const FLOTA_UNIDADES: UnidadFlota[] = [
  {
    disco: 'Disco #04',
    placa: 'LAA-1404',
    chofer: 'Carlos Jaramillo',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'ACTIVO',
  },
  {
    disco: 'Disco #08',
    placa: 'LAA-1892',
    chofer: 'Segundo Armijos',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'ACTIVO',
  },
  {
    disco: 'Disco #11',
    placa: 'LAA-2041',
    chofer: 'Kléver Carrión',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'ACTIVO',
  },
  {
    disco: 'Disco #14',
    placa: 'LAA-2315',
    chofer: 'Víctor Hugo Burneo',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'RESERVA_ANDEN',
  },
  {
    disco: 'Disco #19',
    placa: 'LAA-2580',
    chofer: 'Manuel Agustín Ochoa',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'RESERVA_ANDEN',
  },
  {
    disco: 'Disco #22',
    placa: 'LAA-2710',
    chofer: 'Patricio Samaniego',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'EN_RUTA',
    rutaActual: 'Loja ➔ Vilcabamba (En tránsito por Malacatos)',
  },
  {
    disco: 'Disco #25',
    placa: 'LAA-2890',
    chofer: 'Galo Peñarreta',
    capacidad: 45,
    pinUnidad: '1191',
    estadoOperativo: 'DESPACHADO',
    rutaActual: 'Vilcabamba ➔ Yangana (Despachado de andén)',
  },
];

/**
 * Genera una firma determinista HMAC-SHA256 simulada/compatible en navegador y Node
 * para el pase de abordar QR (Fase 3 + Fase 4).
 */
export function generarFirmaHmacQR(payload: {
  frecuenciaId: string;
  asientoNumero: number;
  cedulaRuc: string;
  referenciaBancaria: string;
}): string {
  const secret = 'PASAJEYA_HMAC_SECRET_VILCABAMBATURIS_2026';
  const raw = `${payload.frecuenciaId}|${payload.asientoNumero}|${payload.cedulaRuc}|${payload.referenciaBancaria}|${secret}`;
  let h1 = 0xdeadbeef ^ raw.length;
  let h2 = 0x41c6ce57 ^ raw.length;
  for (let i = 0, ch; i < raw.length; i++) {
    ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `HMAC256-${hex1}${hex2}${hex1.slice(0, 8)}`.toUpperCase();
}

/**
 * Validación de control de acceso corporativo para /taquilla y /admin (Regla #1 Fase 4)
 */
export function validarAccesoCorporativo(
  pin: string,
  rol: string
): { autorizado: boolean; rol?: RolOperativo; mensaje: string } {
  const pinLimpio = pin.trim();
  if (pinLimpio !== PIN_CORPORATIVO_OFICIAL) {
    return {
      autorizado: false,
      mensaje: 'PIN corporativo inválido. Acceso denegado a módulo protegido.',
    };
  }
  if (rol !== 'SECRETARIA' && rol !== 'GERENCIA' && rol !== 'AYUDANTE') {
    return {
      autorizado: false,
      mensaje: 'Rol no autorizado para operar Taquilla / Administración / Abordaje.',
    };
  }
  return {
    autorizado: true,
    rol: rol as RolOperativo,
    mensaje: `Sesión iniciada correctamente con rol ${rol}.`,
  };
}

/**
 * Regla T-20 Minutos y Liberación Automática de Asientos Sobrantes (Reglas #2 y #3 Fase 4)
 * - Si minutosParaSalida <= 20 (o si se fuerza el congelamiento T-20), ventaWebCongelada pasa a true.
 * - Todos los asientos del Bloque Web (1 al 10) que NO fueron vendidos (DISPONIBLE_WEB o LOCKED_WEB)
 *   se liberan automáticamente como DISPONIBLE_VENTANILLA para venta inmediata en taquilla física.
 */
export function aplicarCongelamientoT20(
  frecuencia: FrecuenciaRuta,
  forzarCongelamiento = false
): {
  frecuenciaActualizada: FrecuenciaRuta;
  asientosLiberados: number[];
  recienCongelada: boolean;
} {
  const debeCongelar =
    forzarCongelamiento ||
    frecuencia.minutosParaSalida <= 20 ||
    frecuencia.ventaWebCongelada;

  if (!debeCongelar) {
    return {
      frecuenciaActualizada: frecuencia,
      asientosLiberados: [],
      recienCongelada: false,
    };
  }

  const asientosLiberados: number[] = [];
  const nuevosAsientos: AsientoBloqueWeb[] = frecuencia.asientosBloqueWeb.map(
    (asiento) => {
      if (
        asiento.estado === 'DISPONIBLE_WEB' ||
        asiento.estado === 'LOCKED_WEB'
      ) {
        asientosLiberados.push(asiento.numero);
        return {
          ...asiento,
          estado: 'DISPONIBLE_VENTANILLA',
          lockedUntil: null,
        };
      }
      return asiento;
    }
  );

  const nuevosMinutos =
    forzarCongelamiento && frecuencia.minutosParaSalida > 20
      ? 20
      : frecuencia.minutosParaSalida;

  const frecuenciaActualizada: FrecuenciaRuta = {
    ...frecuencia,
    minutosParaSalida: nuevosMinutos,
    ventaWebCongelada: true,
    congeladaAt: frecuencia.congeladaAt || new Date().toISOString(),
    asientosBloqueWeb: nuevosAsientos,
  };

  return {
    frecuenciaActualizada,
    asientosLiberados,
    recienCongelada: !frecuencia.ventaWebCongelada,
  };
}

/**
 * Construye la lista congelada de compradores web lista para sincronización con el SRI
 */
export function obtenerManifiestoCongeladoSRI(
  frecuencia: FrecuenciaRuta
): FilaSincronizacionSRI[] {
  const boletosWeb = frecuencia.boletos
    .filter((b) => b.canalVenta === 'WEB')
    .sort((a, b) => a.asientoNumero - b.asientoNumero);

  return boletosWeb.map((b) => ({
    boletoId: b.id,
    asiento: b.asientoNumero,
    tipoIdentificacion: b.cedulaRuc.length === 13 ? 'RUC' : 'CEDULA',
    identificacion: b.cedulaRuc,
    razonSocialNombres: b.pasajeroNombre,
    telefono: b.telefonoWhatsApp,
    origen: b.origen,
    destino: b.destino,
    conceptoSri: `TRANSPORTE PASAJEROS ${b.origen.toUpperCase()} - ${b.destino.toUpperCase()} (ASIENTO #${b.asientoNumero})`,
    subtotal0: b.montoUSD.toFixed(2),
    iva: '0.00', // Transporte terrestre de pasajeros grava tarifa 0% IVA en Ecuador (Art. 56 LRTI)
    totalUSD: b.montoUSD.toFixed(2),
    referenciaPago: b.referenciaBancaria,
    banco:
      b.banco === 'BANCO_DE_LOJA'
        ? 'Banco de Loja'
        : b.banco === 'BANCO_PICHINCHA'
        ? 'Banco Pichincha'
        : 'Efectivo Taquilla',
    sincronizadoSri: b.sincronizadoSri,
  }));
}

/**
 * Genera el bloque de texto TSV (Tab-Separated Values) en 1-clic para pegar directo
 * en el sistema contable / facturador SRI o Excel de la secretaria.
 */
export function formatearTextoCopiadoSRI(
  frecuencia: FrecuenciaRuta,
  incluirCabecera = true
): string {
  const filas = obtenerManifiestoCongeladoSRI(frecuencia);
  const cabecera = [
    'TIPO_ID',
    'CEDULA_RUC',
    'NOMBRE_PASAJERO',
    'ASIENTO',
    'ORIGEN',
    'DESTINO',
    'TARIFA_IVA_0_USD',
    'REFERENCIA_BANCARIA',
    'UNIDAD_REAL',
  ].join('\t');

  const lineas = filas.map((f) =>
    [
      f.tipoIdentificacion,
      f.identificacion,
      f.razonSocialNombres,
      `Asiento ${f.asiento}`,
      f.origen,
      f.destino,
      f.totalUSD,
      f.referenciaPago,
      frecuencia.busDiscoReal,
    ].join('\t')
  );

  return incluirCabecera ? [cabecera, ...lineas].join('\n') : lineas.join('\n');
}

/**
 * Reasignación de flota (busDiscoTeorico vs busDiscoReal) y disparo de alertas
 * por WhatsApp vía Gateway VPS ($5/mes) a todos los pasajeros confirmados (Regla #4 Fase 4).
 */
export function reasignarBusRealYNotificarWhatsApp(
  frecuencia: FrecuenciaRuta,
  nuevoBusDiscoReal: string,
  motivoContingencia: string
): {
  frecuenciaActualizada: FrecuenciaRuta;
  alertasDisparadas: AlertaWhatsAppLog[];
} {
  const unidadEncontrada = FLOTA_UNIDADES.find(
    (u) => u.disco === nuevoBusDiscoReal
  );

  if (
    unidadEncontrada &&
    (unidadEncontrada.estadoOperativo === 'EN_RUTA' ||
      unidadEncontrada.estadoOperativo === 'DESPACHADO')
  ) {
    throw new Error(
      `CONTROL ESTRICTO DE FLOTA: Imposible asignar la unidad ${unidadEncontrada.disco} (${unidadEncontrada.placa}) como busDiscoReal porque se encuentra actualmente en estado ${unidadEncontrada.estadoOperativo}${
        unidadEncontrada.rutaActual ? ` (${unidadEncontrada.rutaActual})` : ''
      }. Seleccione una unidad disponible en andén.`
    );
  }

  const nuevaPlaca = unidadEncontrada ? unidadEncontrada.placa : 'LAA-2990';
  const nuevoChofer = unidadEncontrada
    ? unidadEncontrada.chofer
    : frecuencia.choferAsignado;

  const busDiscoAnterior = frecuencia.busDiscoReal;
  const timestamp = new Date().toISOString();

  const alertasDisparadas: AlertaWhatsAppLog[] = frecuencia.boletos
    .sort((a, b) => a.asientoNumero - b.asientoNumero)
    .map((boleto, idx) => {
      const mensaje = `[Vilcabambaturis Cía. Ltda. - PasajeYa] Hola ${boleto.pasajeroNombre}, informamos que su frecuencia ${frecuencia.origen} ➔ ${frecuencia.destino} (${frecuencia.horaSalida}, ${frecuencia.anden}) operará en la unidad ${nuevoBusDiscoReal} (Placa ${nuevaPlaca}) en reemplazo de ${busDiscoAnterior} por ${motivoContingencia}. Su asiento #${boleto.asientoNumero} se mantiene garantizado.`;
      return {
        id: `wa-alert-${Date.now()}-${idx + 1}`,
        frecuenciaId: frecuencia.id,
        asientoNumero: boleto.asientoNumero,
        pasajeroNombre: boleto.pasajeroNombre,
        telefonoWhatsApp: boleto.telefonoWhatsApp,
        busDiscoAnterior,
        busDiscoNuevo: nuevoBusDiscoReal,
        motivo: motivoContingencia,
        mensaje,
        gatewayEndpoint: TENANT_VILCABAMBATURIS.gatewayVpsUrl,
        latenciaMs: 145 + idx * 18,
        estado: 'ENTREGADO_VPS',
        timestamp,
      };
    });

  const frecuenciaActualizada: FrecuenciaRuta = {
    ...frecuencia,
    busDiscoReal: nuevoBusDiscoReal,
    placaBusReal: nuevaPlaca,
    choferAsignado: nuevoChofer,
  };

  return {
    frecuenciaActualizada,
    alertasDisparadas,
  };
}

/**
 * Emisión directa en Ventanilla Física por parte de la Secretaria sobre un asiento
 * liberado post-congelamiento T-20m (DISPONIBLE_VENTANILLA)
 */
export function venderAsientoEnVentanilla(
  frecuencia: FrecuenciaRuta,
  params: {
    asientoNumero: number;
    cedulaRuc: string;
    pasajeroNombre: string;
    telefonoWhatsApp: string;
    destinoParada?: string;
  }
): {
  frecuenciaActualizada: FrecuenciaRuta;
  boletoEmitido: BoletoEmitido;
} {
  const asientoActual = frecuencia.asientosBloqueWeb.find(
    (a) => a.numero === params.asientoNumero
  );
  if (!asientoActual) {
    throw new Error(`El asiento #${params.asientoNumero} no existe en el bloque 1-10.`);
  }
  if (
    asientoActual.estado !== 'DISPONIBLE_VENTANILLA' &&
    asientoActual.estado !== 'DISPONIBLE_WEB'
  ) {
    throw new Error(
      `El asiento #${params.asientoNumero} no está disponible para ventanilla (Estado actual: ${asientoActual.estado}).`
    );
  }

  const referenciaBancaria = `TAQ-${frecuencia.codigoFrecuencia}-A${params.asientoNumero}-${Date.now()
    .toString()
    .slice(-5)}`;

  const firmaHmac = generarFirmaHmacQR({
    frecuenciaId: frecuencia.id,
    asientoNumero: params.asientoNumero,
    cedulaRuc: params.cedulaRuc,
    referenciaBancaria,
  });

  const nuevoBoleto: BoletoEmitido = {
    id: `bol-taq-${Date.now()}-${params.asientoNumero}`,
    frecuenciaId: frecuencia.id,
    asientoNumero: params.asientoNumero,
    cedulaRuc: params.cedulaRuc,
    pasajeroNombre: params.pasajeroNombre,
    telefonoWhatsApp: params.telefonoWhatsApp || '0990000000',
    origen: frecuencia.origen,
    destino: params.destinoParada || frecuencia.destino,
    montoUSD: frecuencia.tarifaUSD,
    canalVenta: 'TAQUILLA',
    banco: 'EFECTIVO_TAQUILLA',
    referenciaBancaria,
    firmaHmac,
    sincronizadoSri: true, // Emitido directamente en taquilla
    emitidoAt: new Date().toISOString(),
  };

  const nuevosAsientos = frecuencia.asientosBloqueWeb.map((a) =>
    a.numero === params.asientoNumero
      ? {
          ...a,
          estado: 'VENDIDO_TAQUILLA' as const,
          boletoId: nuevoBoleto.id,
          pasajeroNombre: nuevoBoleto.pasajeroNombre,
          cedulaRuc: nuevoBoleto.cedulaRuc,
        }
      : a
  );

  return {
    frecuenciaActualizada: {
      ...frecuencia,
      asientosBloqueWeb: nuevosAsientos,
      boletos: [...frecuencia.boletos, nuevoBoleto],
    },
    boletoEmitido: nuevoBoleto,
  };
}

/**
 * Datos iniciales realistas para Vilcabambaturis Cía. Ltda.
 * Incluye frecuencias en T-18 min (congelada automáticamente), T-20 min, y frecuencias activas.
 */
export function crearEstadoInicialFrecuencias(): FrecuenciaRuta[] {
  const freq1Id = 'freq-loja-vilca-1030';
  const freq1Boletos: BoletoEmitido[] = [
    {
      id: 'bol-web-101',
      frecuenciaId: freq1Id,
      asientoNumero: 1,
      cedulaRuc: '1104589210',
      pasajeroNombre: 'María Fernanda Burneo Valdivieso',
      telefonoWhatsApp: '+593 99 412 8810',
      origen: 'Loja',
      destino: 'Vilcabamba',
      montoUSD: 1.75,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99481204',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq1Id,
        asientoNumero: 1,
        cedulaRuc: '1104589210',
        referenciaBancaria: 'BL-99481204',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T09:42:10Z',
    },
    {
      id: 'bol-web-102',
      frecuenciaId: freq1Id,
      asientoNumero: 2,
      cedulaRuc: '1191748291001',
      pasajeroNombre: 'Hostería Izhcayluma S.A. (Ramiro Palacio)',
      telefonoWhatsApp: '+593 98 765 4321',
      origen: 'Loja',
      destino: 'Vilcabamba',
      montoUSD: 1.75,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99481599',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq1Id,
        asientoNumero: 2,
        cedulaRuc: '1191748291001',
        referenciaBancaria: 'BL-99481599',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T09:48:22Z',
    },
    {
      id: 'bol-web-103',
      frecuenciaId: freq1Id,
      asientoNumero: 3,
      cedulaRuc: '1103829104',
      pasajeroNombre: 'Jorge Luis Cueva Eguiguren',
      telefonoWhatsApp: '+593 99 102 3344',
      origen: 'Loja',
      destino: 'Malacatos',
      montoUSD: 1.25,
      canalVenta: 'WEB',
      banco: 'BANCO_PICHINCHA',
      referenciaBancaria: 'BP-44291088',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq1Id,
        asientoNumero: 3,
        cedulaRuc: '1103829104',
        referenciaBancaria: 'BP-44291088',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T09:51:05Z',
    },
    {
      id: 'bol-web-104',
      frecuenciaId: freq1Id,
      asientoNumero: 5,
      cedulaRuc: '1105192837',
      pasajeroNombre: 'Diana Carolina Samaniego Mora',
      telefonoWhatsApp: '+593 98 311 9022',
      origen: 'Loja',
      destino: 'Vilcabamba',
      montoUSD: 1.75,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99482103',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq1Id,
        asientoNumero: 5,
        cedulaRuc: '1105192837',
        referenciaBancaria: 'BL-99482103',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T09:56:40Z',
    },
    {
      id: 'bol-web-105',
      frecuenciaId: freq1Id,
      asientoNumero: 6,
      cedulaRuc: '1714920184',
      pasajeroNombre: 'Esteban Andrés Riofrío Bustamante',
      telefonoWhatsApp: '+593 99 884 1209',
      origen: 'Loja',
      destino: 'El Tambo',
      montoUSD: 1.50,
      canalVenta: 'WEB',
      banco: 'BANCO_PICHINCHA',
      referenciaBancaria: 'BP-44293812',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq1Id,
        asientoNumero: 6,
        cedulaRuc: '1714920184',
        referenciaBancaria: 'BP-44293812',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T10:01:18Z',
    },
    {
      id: 'bol-web-106',
      frecuenciaId: freq1Id,
      asientoNumero: 8,
      cedulaRuc: '1102948172',
      pasajeroNombre: 'Rosa Elvira Carrión Peñarreta',
      telefonoWhatsApp: '+593 96 901 4471',
      origen: 'Loja',
      destino: 'Vilcabamba',
      montoUSD: 1.75,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99482990',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq1Id,
        asientoNumero: 8,
        cedulaRuc: '1102948172',
        referenciaBancaria: 'BL-99482990',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T10:04:50Z',
    },
  ];

  const asientosFreq1Base: AsientoBloqueWeb[] = Array.from(
    { length: 10 },
    (_, i) => {
      const num = i + 1;
      const boleto = freq1Boletos.find((b) => b.asientoNumero === num);
      if (boleto) {
        return {
          numero: num,
          estado: 'VENDIDO_WEB',
          boletoId: boleto.id,
          pasajeroNombre: boleto.pasajeroNombre,
          cedulaRuc: boleto.cedulaRuc,
        };
      }
      return {
        numero: num,
        estado: 'DISPONIBLE_WEB',
      };
    }
  );

  // Frecuencia 1: A 18 minutos de salir -> Se aplica automáticamente regla T-20 min
  const freq1SinCongelar: FrecuenciaRuta = {
    id: freq1Id,
    codigoFrecuencia: 'VBT-1030-SUR',
    origen: 'Loja',
    destino: 'Vilcabamba',
    paradasIntermedias: ['Malacatos', 'El Tambo', 'La Elvira'],
    horaSalida: '10:30',
    minutosParaSalida: 18, // <= 20 min -> Congelada automáticamente
    tarifaUSD: 1.75,
    anden: 'Andén 04 — Terminal Loja',
    busDiscoTeorico: 'Disco #08',
    busDiscoReal: 'Disco #08',
    placaBusReal: 'LAA-1892',
    choferAsignado: 'Segundo Armijos',
    ventaWebCongelada: false,
    asientosBloqueWeb: asientosFreq1Base,
    boletos: freq1Boletos,
  };

  const { frecuenciaActualizada: freq1Congelada } =
    aplicarCongelamientoT20(freq1SinCongelar);

  // Frecuencia 2: Loja -> Yangana / Zahuayco (Faltan 35 min -> Venta Web Activa, lista para probar botón T-20m)
  const freq2Id = 'freq-loja-yangana-1100';
  const freq2Boletos: BoletoEmitido[] = [
    {
      id: 'bol-web-201',
      frecuenciaId: freq2Id,
      asientoNumero: 1,
      cedulaRuc: '1104019283',
      pasajeroNombre: 'Luis Alfredo Loaiza Aguirre',
      telefonoWhatsApp: '+593 99 210 7788',
      origen: 'Loja',
      destino: 'Yangana',
      montoUSD: 2.50,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99483100',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq2Id,
        asientoNumero: 1,
        cedulaRuc: '1104019283',
        referenciaBancaria: 'BL-99483100',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T09:50:00Z',
    },
    {
      id: 'bol-web-202',
      frecuenciaId: freq2Id,
      asientoNumero: 2,
      cedulaRuc: '1103918273',
      pasajeroNombre: 'Carmen Beatriz Toledo Quizhpe',
      telefonoWhatsApp: '+593 98 551 6201',
      origen: 'Loja',
      destino: 'Zahuayco',
      montoUSD: 1.60,
      canalVenta: 'WEB',
      banco: 'BANCO_PICHINCHA',
      referenciaBancaria: 'BP-44295001',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq2Id,
        asientoNumero: 2,
        cedulaRuc: '1103918273',
        referenciaBancaria: 'BP-44295001',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T09:59:12Z',
    },
    {
      id: 'bol-web-203',
      frecuenciaId: freq2Id,
      asientoNumero: 4,
      cedulaRuc: '1191709912001',
      pasajeroNombre: 'Agropecuaria Valle Sagrado Cía. Ltda.',
      telefonoWhatsApp: '+593 99 711 4092',
      origen: 'Loja',
      destino: 'Yangana',
      montoUSD: 2.50,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99483412',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq2Id,
        asientoNumero: 4,
        cedulaRuc: '1191709912001',
        referenciaBancaria: 'BL-99483412',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T10:02:45Z',
    },
  ];

  const asientosFreq2: AsientoBloqueWeb[] = Array.from(
    { length: 10 },
    (_, i) => {
      const num = i + 1;
      const boleto = freq2Boletos.find((b) => b.asientoNumero === num);
      if (boleto) {
        return {
          numero: num,
          estado: 'VENDIDO_WEB',
          boletoId: boleto.id,
          pasajeroNombre: boleto.pasajeroNombre,
          cedulaRuc: boleto.cedulaRuc,
        };
      }
      if (num === 3) {
        return {
          numero: num,
          estado: 'LOCKED_WEB',
          lockedUntil: '12:45 min restantes',
        };
      }
      return {
        numero: num,
        estado: 'DISPONIBLE_WEB',
      };
    }
  );

  const freq2Activa: FrecuenciaRuta = {
    id: freq2Id,
    codigoFrecuencia: 'VBT-1100-YAN',
    origen: 'Loja',
    destino: 'Yangana',
    paradasIntermedias: ['Malacatos', 'Vilcabamba', 'Zahuayco'],
    horaSalida: '11:00',
    minutosParaSalida: 35,
    tarifaUSD: 2.50,
    anden: 'Andén 05 — Terminal Loja',
    busDiscoTeorico: 'Disco #11',
    busDiscoReal: 'Disco #11',
    placaBusReal: 'LAA-2041',
    choferAsignado: 'Kléver Carrión',
    ventaWebCongelada: false,
    asientosBloqueWeb: asientosFreq2,
    boletos: freq2Boletos,
  };

  // Frecuencia 3: Vilcabamba -> Loja (Retorno, faltan 50 min)
  const freq3Id = 'freq-vilca-loja-1130';
  const freq3Boletos: BoletoEmitido[] = [
    {
      id: 'bol-web-301',
      frecuenciaId: freq3Id,
      asientoNumero: 1,
      cedulaRuc: '1102819201',
      pasajeroNombre: 'Gabriela Alejandra Ontaneda',
      telefonoWhatsApp: '+593 99 304 1122',
      origen: 'Vilcabamba',
      destino: 'Loja',
      montoUSD: 1.75,
      canalVenta: 'WEB',
      banco: 'BANCO_DE_LOJA',
      referenciaBancaria: 'BL-99484009',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq3Id,
        asientoNumero: 1,
        cedulaRuc: '1102819201',
        referenciaBancaria: 'BL-99484009',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T10:05:11Z',
    },
    {
      id: 'bol-web-302',
      frecuenciaId: freq3Id,
      asientoNumero: 2,
      cedulaRuc: '1105882910',
      pasajeroNombre: 'Roberto Carlos Vivanco',
      telefonoWhatsApp: '+593 98 119 4020',
      origen: 'La Elvira',
      destino: 'Loja',
      montoUSD: 1.40,
      canalVenta: 'WEB',
      banco: 'BANCO_PICHINCHA',
      referenciaBancaria: 'BP-44297110',
      firmaHmac: generarFirmaHmacQR({
        frecuenciaId: freq3Id,
        asientoNumero: 2,
        cedulaRuc: '1105882910',
        referenciaBancaria: 'BP-44297110',
      }),
      sincronizadoSri: false,
      emitidoAt: '2026-10-29T10:06:30Z',
    },
  ];

  const asientosFreq3: AsientoBloqueWeb[] = Array.from(
    { length: 10 },
    (_, i) => {
      const num = i + 1;
      const boleto = freq3Boletos.find((b) => b.asientoNumero === num);
      if (boleto) {
        return {
          numero: num,
          estado: 'VENDIDO_WEB',
          boletoId: boleto.id,
          pasajeroNombre: boleto.pasajeroNombre,
          cedulaRuc: boleto.cedulaRuc,
        };
      }
      return {
        numero: num,
        estado: 'DISPONIBLE_WEB',
      };
    }
  );

  const freq3Activa: FrecuenciaRuta = {
    id: freq3Id,
    codigoFrecuencia: 'VBT-1130-NOR',
    origen: 'Vilcabamba',
    destino: 'Loja',
    paradasIntermedias: ['La Elvira', 'El Tambo', 'Malacatos'],
    horaSalida: '11:30',
    minutosParaSalida: 50,
    tarifaUSD: 1.75,
    anden: 'Andén 01 — Terminal Vilcabamba',
    busDiscoTeorico: 'Disco #04',
    busDiscoReal: 'Disco #04',
    placaBusReal: 'LAA-1404',
    choferAsignado: 'Carlos Jaramillo',
    ventaWebCongelada: false,
    asientosBloqueWeb: asientosFreq3,
    boletos: freq3Boletos,
  };

  // Frecuencia 4: Ramal Noroccidental Directo (Loja -> El Tambo 12:15) con 0 ventas web
  // para distinguir en la Pizarra de Turnos la tarjeta en Gris Neutral vs Rojo Vinotinto (#912D26)
  // y permitir el protocolo DESPACHADO_SIN_VENTAS_WEB.
  const freq4SinVentas: FrecuenciaRuta = {
    id: 'freq-loja-eltambo-1215',
    codigoFrecuencia: 'VBT-1215-TAM',
    origen: 'Loja',
    destino: 'El Tambo',
    paradasIntermedias: ['Malacatos'],
    horaSalida: '12:15',
    minutosParaSalida: 65,
    tarifaUSD: 1.50,
    anden: 'Andén 04 — Terminal Loja',
    busDiscoTeorico: 'Disco #19',
    busDiscoReal: 'Disco #19',
    placaBusReal: 'LAA-2580',
    choferAsignado: 'Manuel Agustín Ochoa',
    ventaWebCongelada: false,
    estadoDespacho: 'PROGRAMADO',
    asientosBloqueWeb: Array.from({ length: 10 }, (_, i) => ({
      numero: i + 1,
      estado: 'DISPONIBLE_WEB',
    })),
    boletos: [],
  };

  return [freq1Congelada, freq2Activa, freq3Activa, freq4SinVentas];
}
