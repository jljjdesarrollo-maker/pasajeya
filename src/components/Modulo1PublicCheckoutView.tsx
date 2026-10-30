import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bus,
  Check,
  Clock,
  Copy,
  Lock,
  MapPin,
  MessageSquare,
  Printer,
  QrCode,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import {
  BoletoEmitido,
  ConfiguracionGlobalSistema,
  FrecuenciaRuta,
  NotaCreditoSaldoRecord,
} from '../types/pasajeya';
import {
  BeneficiarioMedioPasajeInput,
  BRAND_COLOR_VINOTINTO,
  calcularDesgloseLegalANT,
  calcularTemporizadorReserva,
  CAPACIDAD_HINO_AK_TOTAL,
  CORREDORES_VIALES_ADR005,
  CorredorVialADR005,
  generarManifiestoFisicoPapelT20,
  PARADAS_URBANAS_LOJA_AUTORIZADAS,
  procesarCheckoutYReconciliacionInteligente,
  ResultadoReconciliacionCheckout,
  validarBeneficiarioMedioPasaje,
  validarParadaAutorizadaANT,
} from '../services/module1CheckoutEngine';
import { CANALES_BANCARIOS_OFICIALES } from '../services/module2PaymentsEngine';

interface Modulo1PublicCheckoutViewProps {
  frecuencias: FrecuenciaRuta[];
  frecuenciaActual: FrecuenciaRuta;
  configuracionGlobal?: ConfiguracionGlobalSistema;
  onSelectFrecuencia: (id: string) => void;
  onUpdateFrecuencia: (freqActualizada: FrecuenciaRuta) => void;
  onEmitirBoletosQR: (boletos: BoletoEmitido[]) => void;
  onNuevaNotaCreditoSaldo?: (nota: NotaCreditoSaldoRecord) => void;
}

const CEDULAS_EJEMPLO_MODULO10 = [
  {
    cedula: '1104680135',
    edad: 72,
    nombre: 'Rosa Elvira Burneo (Adulto Mayor 65+)',
  },
  {
    cedula: '1710034065',
    edad: 12,
    nombre: 'Mateo Carrión (Menor de Edad <18)',
  },
  {
    cedula: '0915660138',
    edad: 68,
    nombre: 'Segundo Loja (Adulto Mayor 65+)',
  },
];

export const Modulo1PublicCheckoutView: React.FC<
  Modulo1PublicCheckoutViewProps
> = ({
  frecuenciaActual,
  configuracionGlobal,
  onUpdateFrecuencia,
  onEmitirBoletosQR,
  onNuevaNotaCreditoSaldo,
}) => {
  // TOQUE 1: Selección de Corredor Vial (ADR-005), Destino y Parada Urbana Autorizada en Loja
  const [corredorActivo, setCorredorActivo] =
    useState<CorredorVialADR005>('TRONCAL_SUR');
  const [destinoSeleccionado, setDestinoSeleccionado] = useState<string>(
    frecuenciaActual.destino || 'Vilcabamba'
  );
  const [paradaLojaSeleccionada, setParadaLojaSeleccionada] = useState<string>(
    PARADAS_URBANAS_LOJA_AUTORIZADAS[0].nombre
  );
  const [alertaAntBombaQuemada, setAlertaAntBombaQuemada] = useState<
    string | null
  >(null);

  // TOQUE 2: Selección de Asientos del Bloque Web (1 al 10)
  const [asientosSeleccionados, setAsientosSeleccionados] = useState<number[]>([
    4,
  ]);

  // LÓGICA DE MEDIOS PASAJES (50% TARIFA ANT): N Medios Pasajes = N Cédulas Obligatorias (Módulo 10 + Edad <18 o 65+)
  const [cantidadMediosPasajes, setCantidadMediosPasajes] = useState<number>(0);
  const [beneficiariosMedioPasaje, setBeneficiariosMedioPasaje] = useState<
    BeneficiarioMedioPasajeInput[]
  >([]);

  useEffect(() => {
    const maxPermitido = Math.max(0, asientosSeleccionados.length);
    if (cantidadMediosPasajes > maxPermitido) {
      setCantidadMediosPasajes(maxPermitido);
      return;
    }
    setBeneficiariosMedioPasaje((prev) => {
      const nuevos: BeneficiarioMedioPasajeInput[] = [];
      for (let i = 0; i < cantidadMediosPasajes; i++) {
        if (prev[i]) {
          nuevos.push(prev[i]);
        } else {
          const preset =
            CEDULAS_EJEMPLO_MODULO10[i % CEDULAS_EJEMPLO_MODULO10.length];
          nuevos.push({
            cedula: preset.cedula,
            edad: preset.edad,
            nombreBeneficiario: preset.nombre,
          });
        }
      }
      return nuevos;
    });
  }, [cantidadMediosPasajes, asientosSeleccionados.length]);

  const [minutosRestantesSimulados, setMinutosRestantesSimulados] =
    useState<number>(frecuenciaActual.minutosParaSalida);

  useEffect(() => {
    setMinutosRestantesSimulados(frecuenciaActual.minutosParaSalida);
    setDestinoSeleccionado(frecuenciaActual.destino);
    const primerLibre = frecuenciaActual.asientosBloqueWeb.find(
      (a) =>
        a.estado === 'DISPONIBLE_WEB' || a.estado === 'DISPONIBLE_VENTANILLA'
    );
    setAsientosSeleccionados(primerLibre ? [primerLibre.numero] : []);
    setCantidadMediosPasajes(0);
  }, [frecuenciaActual.id]);

  const infoTemporizador = useMemo(
    () => calcularTemporizadorReserva(minutosRestantesSimulados),
    [minutosRestantesSimulados]
  );

  const [segundosReloj, setSegundosReloj] = useState<number>(
    infoTemporizador.segundosAsignados
  );

  useEffect(() => {
    setSegundosReloj(infoTemporizador.segundosAsignados);
  }, [infoTemporizador.segundosAsignados]);

  useEffect(() => {
    if (segundosReloj <= 0 || infoTemporizador.ventaWebCongelada) return;
    const timer = setInterval(() => {
      setSegundosReloj((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [segundosReloj, infoTemporizador.ventaWebCongelada]);

  const formatoRelojVivo = useMemo(() => {
    const m = Math.floor(segundosReloj / 60);
    const s = segundosReloj % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [segundosReloj]);

  const desgloseANT = useMemo(
    () =>
      calcularDesgloseLegalANT(
        frecuenciaActual.tarifaUSD,
        Math.max(1, asientosSeleccionados.length),
        cantidadMediosPasajes
      ),
    [
      frecuenciaActual.tarifaUSD,
      asientosSeleccionados.length,
      cantidadMediosPasajes,
    ]
  );

  const manifiestoPapelT20 = useMemo(
    () => generarManifiestoFisicoPapelT20(frecuenciaActual),
    [frecuenciaActual]
  );
  const [mostrarVistaManifiestoPapel, setMostrarVistaManifiestoPapel] =
    useState<boolean>(false);
  const [copiadoSri1ClicOk, setCopiadoSri1ClicOk] = useState<boolean>(false);

  // TOQUE 3: Datos de Checkout, Interfaz Doble de Pago (Módulo 2) y Casilla Obligatoria de Términos
  const [cedulaCliente, setCedulaCliente] = useState<string>('1104680135');
  const [nombreCliente, setNombreCliente] = useState<string>(
    'Segundo Belisario Carrión'
  );
  const [whatsappCliente, setWhatsappCliente] =
    useState<string>('+593 99 418 2290');
  const [bancoSeleccionado, setBancoSeleccionado] = useState<
    'BANCO_DE_LOJA' | 'BANCO_PICHINCHA' | 'DEUNA_PICHINCHA'
  >('BANCO_DE_LOJA');
  const [referenciaInput, setReferenciaInput] = useState<string>(
    `BL-${Math.floor(10000000 + Math.random() * 89999999)}`
  );
  const [aceptoTerminosModulo2, setAceptoTerminosModulo2] =
    useState<boolean>(true);
  const [copiadoCuentaOk, setCopiadoCuentaOk] = useState<boolean>(false);
  const [copiadoRucOk, setCopiadoRucOk] = useState<boolean>(false);

  const [escenarioReconciliacion, setEscenarioReconciliacion] = useState<
    | 'ESTANDAR'
    | 'TARDIO_PRE_T20_LIBRE'
    | 'TARDIO_PRE_T20_OCUPADO'
    | 'TARDIO_POST_T20_SALDO'
    | 'PAGO_INCOMPLETO'
  >('ESTANDAR');

  const [resultadoCheckout, setResultadoCheckout] =
    useState<ResultadoReconciliacionCheckout | null>(null);

  const baseCanalBancario = CANALES_BANCARIOS_OFICIALES[bancoSeleccionado];
  const cuentaConfiguradaM6 = configuracionGlobal?.cuentasBancarias.find(
    (c) =>
      c.banco ===
      (bancoSeleccionado === 'BANCO_DE_LOJA'
        ? 'BANCO_DE_LOJA'
        : 'BANCO_PICHINCHA')
  );
  const canalBancarioActual = cuentaConfiguradaM6
    ? {
        ...baseCanalBancario,
        numeroCuenta: cuentaConfiguradaM6.numeroCuenta,
        rucTitular: cuentaConfiguradaM6.rucTitular,
        tipoCuenta: cuentaConfiguradaM6.tipoCuenta,
        razonSocialTitular: cuentaConfiguradaM6.titularCuenta,
        qrSvgDataUri: cuentaConfiguradaM6.qrImagenUrl,
      }
    : baseCanalBancario;

  const copiarTexto1Clic = async (
    texto: string,
    tipo: 'CUENTA' | 'RUC'
  ) => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Fallback silencioso
    }
    if (tipo === 'CUENTA') {
      setCopiadoCuentaOk(true);
      setTimeout(() => setCopiadoCuentaOk(false), 2500);
    } else {
      setCopiadoRucOk(true);
      setTimeout(() => setCopiadoRucOk(false), 2500);
    }
  };

  const toggleAsientoWeb = (numeroAsiento: number) => {
    if (infoTemporizador.ventaWebCongelada) return;
    setAsientosSeleccionados((prev) =>
      prev.includes(numeroAsiento)
        ? prev.filter((n) => n !== numeroAsiento)
        : [...prev, numeroAsiento].sort((a, b) => a - b)
    );
  };

  const actualizarCampoBeneficiarioMedio = (
    idx: number,
    campo: keyof BeneficiarioMedioPasajeInput,
    valor: string | number
  ) => {
    setBeneficiariosMedioPasaje((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [campo]: valor } : item))
    );
  };

  const probarIntentoBombaQuemada = () => {
    const check = validarParadaAutorizadaANT('La Bomba Quemada');
    setAlertaAntBombaQuemada(check.motivo);
  };

  const copiarTsvFacturacionSri = async () => {
    try {
      await navigator.clipboard.writeText(
        manifiestoPapelT20.tsvFacturacionSri1Clic
      );
    } catch {
      // Fallback silencioso
    }
    setCopiadoSri1ClicOk(true);
    setTimeout(() => setCopiadoSri1ClicOk(false), 3000);
  };

  const ejecutarCompraModulo1 = (e: React.FormEvent) => {
    e.preventDefault();
    setAlertaAntBombaQuemada(null);

    if (asientosSeleccionados.length === 0) {
      setAlertaAntBombaQuemada(
        'Por favor toque al menos un asiento libre del Bloque Web (Asientos 1 al 10).'
      );
      return;
    }

    try {
      let freqBase = frecuenciaActual;
      if (escenarioReconciliacion === 'TARDIO_PRE_T20_OCUPADO') {
        const asientoTomado = asientosSeleccionados[0];
        freqBase = {
          ...frecuenciaActual,
          asientosBloqueWeb: frecuenciaActual.asientosBloqueWeb.map((a) =>
            a.numero === asientoTomado
              ? { ...a, estado: 'VENDIDO_WEB', pasajeroNombre: 'Otro Viajero' }
              : a
          ),
        };
      }

      const montoSegunEscenario =
        escenarioReconciliacion === 'PAGO_INCOMPLETO'
          ? Number((desgloseANT.totalATransferirUSD - 0.5).toFixed(2))
          : desgloseANT.totalATransferirUSD;

      const resultado = procesarCheckoutYReconciliacionInteligente({
        frecuencia: freqBase,
        asientosSeleccionados,
        cedulaRuc: cedulaCliente.trim() || '1104680135',
        pasajeroNombre: nombreCliente.trim() || 'Pasajero Vilcabambaturis',
        telefonoWhatsApp: whatsappCliente.trim() || '+593 99 000 0000',
        paradaAbordajeLoja: paradaLojaSeleccionada,
        destinoFinal: destinoSeleccionado,
        banco: bancoSeleccionado,
        referenciaBancaria:
          referenciaInput.trim() || `BL-${Date.now().toString().slice(-6)}`,
        montoTransferidoUSD: montoSegunEscenario,
        cantidadMediosPasajes,
        beneficiariosMedioPasaje,
        aceptoTerminosModulo2,
        pagoIngresadoVencidoLock15m:
          escenarioReconciliacion === 'TARDIO_PRE_T20_LIBRE' ||
          escenarioReconciliacion === 'TARDIO_PRE_T20_OCUPADO',
        pagoIngresadoDespuesDeT20:
          escenarioReconciliacion === 'TARDIO_POST_T20_SALDO',
      });

      setResultadoCheckout(resultado);

      if (resultado.notaCreditoGenerada && onNuevaNotaCreditoSaldo) {
        onNuevaNotaCreditoSaldo(resultado.notaCreditoGenerada);
      }

      if (resultado.exitoEmision) {
        onUpdateFrecuencia(resultado.frecuenciaActualizada);
        onEmitirBoletosQR(resultado.pasesQrEmitidos);
        setReferenciaInput(
          `BL-${Math.floor(10000000 + Math.random() * 89999999)}`
        );
      }
    } catch (err: any) {
      setAlertaAntBombaQuemada(
        err?.message || 'Error al procesar la reserva web.'
      );
    }
  };

  const asientosTaquilla11a45 = useMemo(
    () => Array.from({ length: CAPACIDAD_HINO_AK_TOTAL - 10 }, (_, i) => i + 11),
    []
  );

  return (
    <div className="space-y-6">
      {/* BANNER INSTITUCIONAL VILCABAMBATURIS */}
      <section
        style={{ backgroundColor: BRAND_COLOR_VINOTINTO }}
        className="text-white rounded-2xl p-6 border border-red-950 shadow-sm"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-red-100">
              <span>COOPERATIVA VILCABAMBATURIS CÍA. LTDA.</span>
              <span aria-hidden="true">·</span>
              <span>CONCILIACIÓN &lt; 1.2S</span>
              <span aria-hidden="true">·</span>
              <span>DEUNA / BANCO DE LOJA QR</span>
              <span aria-hidden="true">·</span>
              <span>SALDOS 30 DÍAS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Compre su Pasaje de Autobús sin Filas
            </h2>
            <p className="text-sm sm:text-base text-red-50 max-w-2xl leading-relaxed">
              1. Elija destino y parada autorizada ANT · 2. Toque sus asientos
              (1 al 10) e indique si aplica Medio Pasaje (50% ANT) · 3. Pague
              por Transferencia o QR (Deuna / Banco de Loja) con 0% comisión.
            </p>
          </div>

          {/* RELOJ DE RESERVA / TEMPORIZADOR DINÁMICO T-20 MIN */}
          <div
            className={`p-4 rounded-2xl border min-w-[270px] ${
              infoTemporizador.ventaWebCongelada
                ? 'bg-slate-950 border-slate-700 text-white'
                : infoTemporizador.esTemporizadorAbreviadoAlertaRoja
                ? 'bg-red-950 border-amber-300 text-white'
                : 'bg-white text-slate-900 border-white'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0" />
                {infoTemporizador.ventaWebCongelada
                  ? 'VENTA WEB CERRADA (T-20M)'
                  : infoTemporizador.esTemporizadorAbreviadoAlertaRoja
                  ? 'RELOJ DINÁMICO ABREVIADO'
                  : 'RESERVA GARANTIZADA (15 MIN)'}
              </span>
              <span className="font-mono text-xs">
                Salida T-{minutosRestantesSimulados}m
              </span>
            </div>

            <div className="mt-1 flex items-baseline justify-between">
              <span
                className={`font-mono text-3xl font-bold tabular-nums ${
                  infoTemporizador.esTemporizadorAbreviadoAlertaRoja &&
                  !infoTemporizador.ventaWebCongelada
                    ? 'text-amber-300'
                    : ''
                }`}
              >
                {formatoRelojVivo}
              </span>
              <span className="text-xs opacity-85">
                {infoTemporizador.ventaWebCongelada
                  ? 'Manifiesto Impreso'
                  : 'Tiempo de bloqueo'}
              </span>
            </div>

            <div className="mt-3 pt-2.5 border-t border-current/15 flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setMinutosRestantesSimulados(35)}
                className={`px-2 py-1 rounded font-mono font-semibold ${
                  minutosRestantesSimulados === 35
                    ? 'bg-emerald-700 text-white'
                    : 'bg-black/10 hover:bg-black/20'
                }`}
              >
                T-35m (15:00)
              </button>
              <button
                type="button"
                onClick={() => setMinutosRestantesSimulados(25)}
                className={`px-2 py-1 rounded font-mono font-semibold ${
                  minutosRestantesSimulados === 25
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-black/10 hover:bg-black/20'
                }`}
              >
                T-25m (05:00 Rojo)
              </button>
              <button
                type="button"
                onClick={() => setMinutosRestantesSimulados(18)}
                className={`px-2 py-1 rounded font-mono font-semibold ${
                  minutosRestantesSimulados <= 20
                    ? 'bg-slate-800 text-white'
                    : 'bg-black/10 hover:bg-black/20'
                }`}
              >
                T-18m (Papel T-20)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ALERTA REGULATORIA ANT / MÓDULO 10 / TÉRMINOS MÓDULO 2 */}
      {alertaAntBombaQuemada && (
        <div className="p-4 rounded-2xl bg-red-950 text-white border-2 border-red-400 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-sm leading-relaxed">
              <strong className="block text-base text-amber-300">
                Control Regulatorio ANT / Validación de Checkout
              </strong>
              <span>{alertaAntBombaQuemada}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAlertaAntBombaQuemada(null)}
            className="min-h-[48px] px-4 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold shrink-0"
          >
            Entendido
          </button>
        </div>
      )}

      {/* =======================================================================
          PASO 1 DE 3: TOPOLOGÍA VIAL (ADR-005) Y PARADAS URBANAS AUTORIZADAS EN LOJA
         ======================================================================= */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <span
              style={{ color: BRAND_COLOR_VINOTINTO }}
              className="text-xs font-bold font-mono"
            >
              PASO 1 DE 3 · SELECCIÓN DE RUTA Y PARADA OFICIAL ANT
            </span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              ¿A qué destino viaja hoy y en qué parada autorizada aborda?
            </h3>
          </div>
          <button
            type="button"
            onClick={probarIntentoBombaQuemada}
            className="min-h-[48px] px-4 py-2 text-xs font-semibold text-red-900 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-2 self-start sm:self-center"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Verificar Prohibición ANT &ldquo;La Bomba Quemada&rdquo;</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(
            Object.values(CORREDORES_VIALES_ADR005) as Array<
              (typeof CORREDORES_VIALES_ADR005)[CorredorVialADR005]
            >
          ).map((corredor) => {
            const activo = corredorActivo === corredor.id;
            return (
              <button
                key={corredor.id}
                type="button"
                onClick={() => {
                  setCorredorActivo(corredor.id);
                  if (corredor.id === 'RAMAL_NOROCCIDENTAL') {
                    setDestinoSeleccionado('El Tambo');
                  } else {
                    setDestinoSeleccionado('Vilcabamba');
                  }
                }}
                style={
                  activo
                    ? {
                        backgroundColor: BRAND_COLOR_VINOTINTO,
                        borderColor: BRAND_COLOR_VINOTINTO,
                      }
                    : undefined
                }
                className={`min-h-[64px] p-4 rounded-2xl border-2 text-left transition-all ${
                  activo
                    ? 'text-white shadow-sm'
                    : 'bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <strong className="text-base font-bold">
                    {corredor.nombre}
                  </strong>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-black/15">
                    {corredor.pasaPorVilcabamba
                      ? 'Vía Vilcabamba'
                      : 'Directo sin Vilcabamba'}
                  </span>
                </div>
                <p
                  className={`text-xs mt-1.5 ${
                    activo ? 'text-red-100' : 'text-slate-600'
                  }`}
                >
                  {corredor.descripcion}
                </p>
              </button>
            );
          })}
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">
            Toque su Parroquia / Destino de Llegada:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {CORREDORES_VIALES_ADR005[corredorActivo].nodosOrdenados
              .filter((n) => n !== 'Loja')
              .map((nodo) => {
                const seleccionado = destinoSeleccionado === nodo;
                return (
                  <button
                    key={nodo}
                    type="button"
                    onClick={() => setDestinoSeleccionado(nodo)}
                    style={
                      seleccionado
                        ? {
                            backgroundColor: BRAND_COLOR_VINOTINTO,
                            borderColor: BRAND_COLOR_VINOTINTO,
                          }
                        : undefined
                    }
                    className={`min-h-[52px] px-4 py-3 rounded-xl border-2 font-bold text-base transition-all flex items-center justify-between ${
                      seleccionado
                        ? 'text-white'
                        : 'bg-white text-slate-900 border-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span>{nodo}</span>
                    {seleccionado && <Check className="w-5 h-5 shrink-0" />}
                  </button>
                );
              })}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="block text-sm font-bold text-slate-800">
              Parada Urbana de Abordaje en Loja (5 Paradas Oficiales Autorizadas
              por la ANT):
            </label>
            <span className="text-xs font-mono text-slate-500">
              Prohibido abordar en &ldquo;La Bomba Quemada&rdquo; (Control ANT)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {PARADAS_URBANAS_LOJA_AUTORIZADAS.map((parada) => {
              const activa = paradaLojaSeleccionada === parada.nombre;
              return (
                <button
                  key={parada.id}
                  type="button"
                  onClick={() => {
                    setParadaLojaSeleccionada(parada.nombre);
                    setAlertaAntBombaQuemada(null);
                  }}
                  style={
                    activa
                      ? {
                          backgroundColor: BRAND_COLOR_VINOTINTO,
                          borderColor: BRAND_COLOR_VINOTINTO,
                        }
                      : undefined
                  }
                  className={`min-h-[60px] p-3.5 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                    activa
                      ? 'text-white'
                      : 'bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-mono text-xs font-bold opacity-80">
                      PARADA #{parada.orden}
                    </span>
                    <MapPin className="w-4 h-4 shrink-0" />
                  </div>
                  <strong className="text-sm font-bold leading-snug mt-1">
                    {parada.nombre}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =======================================================================
          PASO 2 DE 3: MAPA TÁCTIL DEL AUTOBÚS HINO AK (45 PASAJEROS) Y BLOQUE WEB (1 AL 10)
         ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <span
                style={{ color: BRAND_COLOR_VINOTINTO }}
                className="text-xs font-bold font-mono"
              >
                PASO 2 DE 3 · CROQUIS TÁCTIL AUTOBÚS HINO AK (45 PASAJEROS)
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-0.5">
                Toque su Asiento en el Bloque Web (Asientos 1 al 10)
              </h3>
            </div>
            <span className="font-mono text-xs font-semibold text-slate-600">
              Unidad: {frecuenciaActual.busDiscoReal} (
              {frecuenciaActual.placaBusReal})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-emerald-50 border-2 border-emerald-600 inline-block" />
              <span>Libre Web (1–10)</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                style={{ backgroundColor: BRAND_COLOR_VINOTINTO }}
                className="w-5 h-5 rounded inline-block"
              />
              <span>Su Asiento Elegido</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-slate-200 border border-slate-400 inline-block" />
              <span>Ocupado</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-slate-100 border border-dashed border-slate-400 inline-block" />
              <span>Taquilla Terminal (11–45)</span>
            </span>
          </div>

          <div className="border-2 border-slate-300 rounded-3xl p-5 bg-slate-50/70 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b-2 border-slate-300 text-xs font-mono text-slate-700">
              <div className="flex items-center gap-2 bg-slate-200 px-3.5 py-2 rounded-xl font-bold">
                <Bus className="w-4 h-4" />
                <span>
                  CABINA CONDUCTOR · HINO AK ({frecuenciaActual.choferAsignado})
                </span>
              </div>
              <div className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-950 font-bold">
                PUERTA DE SUBIDA ➔
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <strong
                  style={{ color: BRAND_COLOR_VINOTINTO }}
                  className="text-sm font-bold"
                >
                  BLOQUE EXCLUSIVO DE COMPRA EN LÍNEA (ASIENTOS 1 AL 10)
                </strong>
                <span className="text-xs font-mono text-slate-600">
                  1 Transacción ➔ {asientosSeleccionados.length || 1} Boleto(s)
                  QR
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {frecuenciaActual.asientosBloqueWeb.map((asiento) => {
                  const estaOcupado =
                    asiento.estado === 'VENDIDO_WEB' ||
                    asiento.estado === 'VENDIDO_TAQUILLA';
                  const seleccionado = asientosSeleccionados.includes(
                    asiento.numero
                  );

                  return (
                    <button
                      key={asiento.numero}
                      type="button"
                      disabled={
                        estaOcupado || infoTemporizador.ventaWebCongelada
                      }
                      onClick={() => toggleAsientoWeb(asiento.numero)}
                      style={
                        seleccionado
                          ? {
                              backgroundColor: BRAND_COLOR_VINOTINTO,
                              borderColor: BRAND_COLOR_VINOTINTO,
                            }
                          : undefined
                      }
                      className={`min-h-[64px] p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center ${
                        seleccionado
                          ? 'text-white shadow-sm'
                          : !estaOcupado && !infoTemporizador.ventaWebCongelada
                          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border-emerald-600'
                          : 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-mono text-lg font-bold">
                        Asiento {asiento.numero}
                      </span>
                      <span className="text-xs font-bold mt-0.5">
                        {seleccionado
                          ? 'ELEGIDO ✓'
                          : estaOcupado
                          ? 'OCUPADO'
                          : 'LIBRE'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-dashed border-slate-300 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>
                    ASIENTOS 11 AL 45 — EXCLUSIVOS DE TAQUILLA TERMINAL
                  </span>
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  Hino AK Capacidad Total: 45 Pasajeros
                </span>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 opacity-75">
                {asientosTaquilla11a45.map((num) => (
                  <div
                    key={num}
                    aria-disabled="true"
                    className="min-h-[48px] rounded-xl bg-slate-100 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 select-none"
                  >
                    <span className="font-mono text-xs font-bold">#{num}</span>
                    <span className="text-[9px] font-mono">TAQUILLA</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* OPERACIÓN EN PAPEL SIN DEPENDENCIA TECNOLÓGICA EN AUTOBÚS (T-20 MIN) */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-mono text-amber-300 font-bold">
                  MANIFIESTO 100% LIMPIO · CERO COBRO A BORDO
                </span>
                <h4 className="text-base font-bold text-white">
                  Cierre T-20 min: Copiado SRI (1-Clic) y Manifiesto Físico
                  Impreso para el Ayudante
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={copiarTsvFacturacionSri}
                  className="min-h-[48px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Copy className="w-4 h-4 shrink-0" />
                  <span>
                    {copiadoSri1ClicOk
                      ? '¡Copiado TSV SRI!'
                      : 'Copiar para SRI (1-Clic)'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setMostrarVistaManifiestoPapel((prev) => !prev)
                  }
                  className="min-h-[48px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>
                    {mostrarVistaManifiestoPapel
                      ? 'Ocultar Manifiesto en Papel'
                      : 'Ver Manifiesto Impreso (Papel)'}
                  </span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              El ayudante en autobús solo recibe pasajeros con boleto{' '}
              <strong className="text-white">
                100% pagado e impreso en el manifiesto físico
              </strong>{' '}
              (Cero Cobro a Bordo y sin depender del celular en carretera).
            </p>

            {mostrarVistaManifiestoPapel && (
              <pre className="p-3.5 rounded-xl bg-black/60 border border-slate-700 text-[11px] font-mono text-emerald-300 overflow-x-auto whitespace-pre">
                {manifiestoPapelT20.documentoTextoImprimiblePapel}
              </pre>
            )}
          </div>
        </section>

        {/* =======================================================================
            PASO 3 DE 3: INTERFAZ DOBLE DE PAGO (CUENTA 1-CLIC + QR DEUNA/LOJA),
            MEDIOS PASAJES (MÓDULO 10) Y TÉRMINOS OBLIGATORIOS (MÓDULO 2)
           ======================================================================= */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <span
              style={{ color: BRAND_COLOR_VINOTINTO }}
              className="text-xs font-bold font-mono"
            >
              PASO 3 DE 3 · INTERFAZ DOBLE DE PAGO (CUENTA 1-CLIC + QR EN
              PANTALLA)
            </span>
            <h3 className="text-xl font-bold text-slate-900 mt-0.5">
              Transferencia o Escaneo QR (0% Comisión de Tarjeta)
            </h3>
          </div>

          {/* SELECTOR DE MEDIOS PASAJES (50% TARIFA ANT: MENORES <18 O ADULTOS MAYORES 65+) */}
          <div className="p-4 rounded-2xl bg-red-50/60 border-2 border-red-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span
                  style={{ color: BRAND_COLOR_VINOTINTO }}
                  className="text-xs font-bold font-mono block"
                >
                  TARIFA REDUCIDA 50% ANT (MENOR &lt;18 O ADULTO MAYOR 65+)
                </span>
                <label className="text-sm font-bold text-slate-900">
                  ¿Cuántos de sus {asientosSeleccionados.length || 1} pasaje(s)
                  son Medio Pasaje?
                </label>
              </div>
              <UserCheck
                style={{ color: BRAND_COLOR_VINOTINTO }}
                className="w-6 h-6 shrink-0"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: Math.max(1, asientosSeleccionados.length) + 1 },
                (_, cant) => {
                  const activo = cantidadMediosPasajes === cant;
                  return (
                    <button
                      key={cant}
                      type="button"
                      onClick={() => setCantidadMediosPasajes(cant)}
                      style={
                        activo
                          ? {
                              backgroundColor: BRAND_COLOR_VINOTINTO,
                              borderColor: BRAND_COLOR_VINOTINTO,
                            }
                          : undefined
                      }
                      className={`min-h-[48px] px-4 py-2 rounded-xl border-2 font-mono text-sm font-bold transition-all ${
                        activo
                          ? 'text-white'
                          : 'bg-white text-slate-900 border-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {cant === 0
                        ? '0 (Todos Completos)'
                        : `${cant} Medio(s) 50%`}
                    </button>
                  );
                }
              )}
            </div>

            {cantidadMediosPasajes > 0 && (
              <div className="space-y-3 pt-2 border-t border-red-200">
                <p className="text-xs font-semibold text-slate-700">
                  Regla ANT: Ingrese las{' '}
                  <strong>
                    {cantidadMediosPasajes} Cédula(s) de Identidad
                  </strong>{' '}
                  ecuatorianas (Módulo 10) y la edad (&lt;18 o 65+ años):
                </p>

                {beneficiariosMedioPasaje.map((ben, idx) => {
                  const validacionVivo = validarBeneficiarioMedioPasaje(ben);
                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-slate-300 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="font-mono text-slate-900">
                          MEDIO PASAJE #{idx + 1} (Asiento #
                          {asientosSeleccionados[idx] || idx + 1})
                        </span>
                        <span
                          className={`font-mono px-2 py-0.5 rounded ${
                            validacionVivo.valido
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {validacionVivo.valido
                            ? 'Módulo 10 + Edad OK ✓'
                            : 'Revisar Cédula/Edad'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Cédula Ecuatoriana (10 dígitos Módulo 10) *
                          </label>
                          <input
                            type="text"
                            maxLength={10}
                            required
                            value={ben.cedula}
                            onChange={(e) =>
                              actualizarCampoBeneficiarioMedio(
                                idx,
                                'cedula',
                                e.target.value
                              )
                            }
                            placeholder="Ej: 1104680135"
                            className="w-full min-h-[48px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Edad (&lt;18 o 65+) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={115}
                            required
                            value={ben.edad}
                            onChange={(e) =>
                              actualizarCampoBeneficiarioMedio(
                                idx,
                                'edad',
                                Number(e.target.value)
                              )
                            }
                            className="w-full min-h-[48px] px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                          />
                        </div>
                      </div>

                      <p
                        className={`text-[11px] leading-snug ${
                          validacionVivo.valido
                            ? 'text-emerald-800'
                            : 'text-red-700 font-semibold'
                        }`}
                      >
                        {validacionVivo.motivo}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* =======================================================================
              MÓDULO 2: INTERFAZ DOBLE DE PAGO (COPIADO 1-CLIC + QR DIRECTO EN PANTALLA)
             ======================================================================= */}
          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-4 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono text-amber-300">
              <span>MÓDULO 2 · PAGOS MULTI-BANCO SIN COMISIÓN</span>
              <span>CONCILIACIÓN GMAIL + PUB/SUB &lt; 1.2S</span>
            </div>

            {/* Selector táctil de Canal Bancario (Sincronizado con Toggles de Módulo 6) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  'BANCO_DE_LOJA',
                  'BANCO_PICHINCHA',
                  'DEUNA_PICHINCHA',
                ] as const
              )
                .filter((idBanco) => {
                  if (!configuracionGlobal) return true;
                  if (idBanco === 'BANCO_DE_LOJA') {
                    return configuracionGlobal.bancoDeLojaActivo;
                  }
                  return configuracionGlobal.bancoPichinchaDeunaActivo;
                })
                .map((idBanco) => {
                  const info = CANALES_BANCARIOS_OFICIALES[idBanco];
                  const activo = bancoSeleccionado === idBanco;
                  return (
                    <button
                      key={idBanco}
                      type="button"
                      onClick={() => setBancoSeleccionado(idBanco)}
                    style={
                      activo
                        ? {
                            backgroundColor: BRAND_COLOR_VINOTINTO,
                            borderColor: '#FCA5A5',
                          }
                        : undefined
                    }
                    className={`min-h-[52px] p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      activo
                        ? 'text-white font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-[11px] font-mono opacity-85">
                      {idBanco === 'DEUNA_PICHINCHA'
                        ? 'QR DEUNA!'
                        : idBanco === 'BANCO_DE_LOJA'
                        ? 'LOJA + QR'
                        : 'PICHINCHA'}
                    </span>
                    <span className="text-xs font-bold leading-tight mt-0.5">
                      {info.nombreMostrar.split(' (')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Botones de Copiado Automático en 1-Clic (Número de Cuenta y RUC) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    {canalBancarioActual.tipoCuenta}
                  </span>
                  <strong className="font-mono text-sm text-white block truncate">
                    Nro: {canalBancarioActual.numeroCuenta}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copiarTexto1Clic(
                      canalBancarioActual.numeroCuenta,
                      'CUENTA'
                    )
                  }
                  className="min-h-[48px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiadoCuentaOk ? '¡Copiada!' : 'Copiar Cta.'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    RUC Vilcabambaturis Cía. Ltda.
                  </span>
                  <strong className="font-mono text-sm text-white block truncate">
                    {canalBancarioActual.rucTitular}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copiarTexto1Clic(canalBancarioActual.rucTitular, 'RUC')
                  }
                  className="min-h-[48px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiadoRucOk ? '¡Copiado!' : 'Copiar RUC'}</span>
                </button>
              </div>
            </div>

            {/* Visualización Directa en Pantalla de los Códigos QR (Deuna / Banco de Loja) */}
            <div className="p-3.5 rounded-xl bg-white text-slate-900 flex flex-col sm:flex-row items-center gap-4">
              <div
                aria-label={`Código QR Oficial ${canalBancarioActual.nombreMostrar}`}
                className="w-28 h-28 rounded-xl border-2 border-slate-900 p-2 bg-white shrink-0 flex flex-col items-center justify-center"
              >
                <QrCode
                  style={{ color: canalBancarioActual.colorDistintivo }}
                  className="w-20 h-20"
                />
                <span className="text-[9px] font-mono font-bold text-slate-700 mt-0.5">
                  {bancoSeleccionado === 'DEUNA_PICHINCHA'
                    ? 'DEUNA! QR'
                    : 'QR BANCO LOJA'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <strong className="text-sm font-bold text-slate-900 block">
                  Escaneo Directo QR: {canalBancarioActual.nombreMostrar}
                </strong>
                <p className="text-slate-600 leading-snug">
                  Escanee este código QR desde su aplicación móvil{' '}
                  <strong>Banco de Loja</strong> o{' '}
                  <strong>Deuna! (Banco Pichincha)</strong> y transfiera
                  exactamente{' '}
                  <strong className="font-mono text-slate-900">
                    ${desgloseANT.totalATransferirUSD.toFixed(2)} USD
                  </strong>
                  .
                </p>
                <div className="text-[10px] font-mono text-slate-500 truncate">
                  Payload: {canalBancarioActual.qrPayloadOficial}
                </div>
              </div>
            </div>
          </div>

          {/* CAJA DE DESGLOSE LEGAL Y CUMPLIMIENTO REGULATORIO ANT */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-600 pb-2 border-b border-slate-200">
              <span>DESGLOSE REGULATORIO ANT</span>
              <span>
                {desgloseANT.cantidadBoletos} boleto(s) · Asiento(s):{' '}
                {asientosSeleccionados.length > 0
                  ? `#${asientosSeleccionados.join(', #')}`
                  : 'Ninguno'}
              </span>
            </div>

            {desgloseANT.lineasTextoRecibo.lineaDetalleMediosPasajes && (
              <div className="text-xs font-mono text-slate-700 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
                {desgloseANT.lineasTextoRecibo.lineaDetalleMediosPasajes}
              </div>
            )}

            <div className="flex items-center justify-between text-sm font-medium text-slate-800">
              <span>Pasaje Oficial Regulado ANT:</span>
              <strong className="font-mono tabular-nums">
                ${desgloseANT.pasajeOficialReguladoTotalUSD.toFixed(2)}
              </strong>
            </div>

            <div className="flex items-center justify-between text-sm font-medium text-slate-800">
              <span>
                Servicio Digital y Emisión QR ($0.25 ×{' '}
                {desgloseANT.cantidadBoletos}):
              </span>
              <strong className="font-mono tabular-nums">
                ${desgloseANT.servicioDigitalTotalUSD.toFixed(2)}
              </strong>
            </div>

            <div
              style={{ borderColor: BRAND_COLOR_VINOTINTO }}
              className="pt-2.5 border-t-2 flex items-center justify-between text-base font-bold text-slate-900"
            >
              <span>TOTAL A TRANSFERIR:</span>
              <strong
                style={{ color: BRAND_COLOR_VINOTINTO }}
                className="font-mono text-xl tabular-nums"
              >
                ${desgloseANT.totalATransferirUSD.toFixed(2)} USD
              </strong>
            </div>
          </div>

          {/* Formulario Accesible (Controles >= 48px) */}
          <form onSubmit={ejecutarCompraModulo1} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Cédula o RUC del Comprador
                </label>
                <input
                  type="text"
                  value={cedulaCliente}
                  onChange={(e) => setCedulaCliente(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  WhatsApp (Recibe sus {desgloseANT.cantidadBoletos} Pases QR)
                </label>
                <input
                  type="text"
                  value={whatsappCliente}
                  onChange={(e) => setWhatsappCliente(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nombres y Apellidos del Titular
                </label>
                <input
                  type="text"
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nro. Comprobante Bancario / QR
                </label>
                <input
                  type="text"
                  value={referenciaInput}
                  onChange={(e) => setReferenciaInput(e.target.value)}
                  className="w-full min-h-[48px] px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            {/* Selector de Escenario de Reconciliación Inteligente */}
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Modo de Reconciliación Inteligente (Simulador de Casos de Borde):
              </label>
              <select
                value={escenarioReconciliacion}
                onChange={(e) =>
                  setEscenarioReconciliacion(e.target.value as any)
                }
                className="w-full min-h-[48px] px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-xl"
              >
                <option value="ESTANDAR">
                  1. Pago Estándar a Tiempo (1 Transacción ➔ N Boletos QR)
                </option>
                <option value="TARDIO_PRE_T20_LIBRE">
                  2. Pago Tardío (&gt;15m, antes de T-20m) — Asiento sigue libre
                </option>
                <option value="TARDIO_PRE_T20_OCUPADO">
                  3. Pago Tardío (&gt;15m, antes de T-20m) — Asiento ocupado
                  (Reubica automático)
                </option>
                <option value="TARDIO_POST_T20_SALDO">
                  4. Pago Tardío después de T-20m — Crea NotaCreditoSaldo (30
                  días, $0.00 fee)
                </option>
                <option value="PAGO_INCOMPLETO">
                  5. Pago Incompleto — Retiene emisión hasta completar antes de
                  T-20m
                </option>
              </select>
            </div>

            {/* CASILLA OBLIGATORIA DE TÉRMINOS Y CONDICIONES (MÓDULO 2: NO CAMBIOS / NO DEVOLUCIONES + CADUCIDAD 30 DÍAS) */}
            <label className="min-h-[56px] p-3.5 rounded-xl bg-amber-50 border-2 border-amber-300 flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptoTerminosModulo2}
                onChange={(e) => setAceptoTerminosModulo2(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-[#912D26] shrink-0"
              />
              <span className="text-xs text-slate-900 leading-relaxed">
                <strong>
                  Acepto los Términos y Condiciones Obligatorios:
                </strong>{' '}
                Una vez emitido el boleto QR{' '}
                <strong>
                  no existen cambios de fecha, hora o asiento, ni devoluciones
                  de dinero en efectivo
                </strong>
                . Los pagos posteriores al cierre T-20 min generan un{' '}
                <strong>
                  Saldo a Favor digital con caducidad estricta a los 30 días
                  calendario
                </strong>{' '}
                (canjeable por pasajes en ventanilla, 0 efectivo).
              </span>
            </label>

            <button
              type="submit"
              disabled={
                infoTemporizador.ventaWebCongelada &&
                escenarioReconciliacion !== 'TARDIO_POST_T20_SALDO'
              }
              style={{
                backgroundColor:
                  infoTemporizador.ventaWebCongelada &&
                  escenarioReconciliacion !== 'TARDIO_POST_T20_SALDO'
                    ? undefined
                    : BRAND_COLOR_VINOTINTO,
              }}
              className="w-full min-h-[54px] px-5 py-3 text-base font-bold text-white disabled:bg-slate-300 rounded-2xl transition-opacity hover:opacity-95 flex items-center justify-center gap-2 shadow-sm"
            >
              <QrCode className="w-5 h-5 shrink-0" />
              <span>
                Confirmar ${desgloseANT.totalATransferirUSD.toFixed(2)} USD y
                Emitir {desgloseANT.cantidadBoletos} Boleto(s) QR
              </span>
            </button>
          </form>

          {/* Resultado de la Emisión 1-a-N / NotaCreditoSaldo y Mensaje WhatsApp */}
          {resultadoCheckout && (
            <div
              className={`p-4 rounded-2xl border-2 space-y-2.5 text-xs ${
                resultadoCheckout.exitoEmision
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-950'
                  : 'bg-amber-50 border-amber-400 text-amber-950'
              }`}
            >
              <div className="flex items-center justify-between font-bold text-sm">
                <span>RESOLUCIÓN: {resultadoCheckout.tipoResolucion}</span>
                <span className="font-mono">
                  Fee Cobrado: $
                  {resultadoCheckout.feeTecnologicoCobradoTotalUSD.toFixed(2)}
                </span>
              </div>

              {resultadoCheckout.notaCreditoGenerada && (
                <div className="p-3 rounded-xl bg-slate-900 text-white font-mono text-[11px] space-y-1">
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>
                      NOTA DE CRÉDITO: {resultadoCheckout.notaCreditoGenerada.codigoNotaCredito}
                    </span>
                    <span>
                      ESTADO: {resultadoCheckout.notaCreditoGenerada.estado}
                    </span>
                  </div>
                  <div>
                    Saldo Íntegro: $
                    {resultadoCheckout.notaCreditoGenerada.saldoDisponibleUSD.toFixed(
                      2
                    )}{' '}
                    USD · Fee $0.25 Cobrado: $
                    {resultadoCheckout.notaCreditoGenerada.feeTecnologicoCobradoUSD.toFixed(
                      2
                    )}
                  </div>
                  <div className="text-slate-300">
                    Expira en 30 días calendario:{' '}
                    {new Date(
                      resultadoCheckout.notaCreditoGenerada.fechaExpiracion
                    ).toLocaleDateString('es-EC')}{' '}
                    · Canjeable en /taquilla (0 efectivo)
                  </div>
                </div>
              )}

              <div className="p-3 bg-white rounded-xl border border-black/10 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-slate-900">
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Notificación Enviada al WhatsApp del Viajero:</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {resultadoCheckout.alertaWhatsAppCliente}
                </p>
              </div>

              {resultadoCheckout.pasesQrEmitidos.length > 0 && (
                <div className="space-y-2 pt-1">
                  <strong className="block">
                    Registros `Boleto` Independientes Emitidos (Política: No
                    Cambios / No Devoluciones):
                  </strong>
                  {resultadoCheckout.pasesQrEmitidos.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-900 text-white font-mono text-[11px] space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-400">
                          numeroAsiento: #{b.numeroAsiento ?? b.asientoNumero} ·{' '}
                          {b.esMedioPasaje
                            ? 'MEDIO PASAJE 50% ANT'
                            : 'TARIFA 100% ANT'}{' '}
                          (${b.montoUSD.toFixed(2)})
                        </span>
                        <span className="text-amber-300">
                          Fee: ${(b.feeTecnologicoUSD ?? 0.25).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-slate-300">
                        C.I.: {b.cedulaRuc} · {b.pasajeroNombre}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>codigoUnico: {b.codigoUnico}</span>
                        <span>
                          firmaDigitalHmac:{' '}
                          {(b.firmaDigitalHmac || b.firmaHmac).slice(0, 14)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
